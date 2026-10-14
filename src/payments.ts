import { randomUUID } from "node:crypto";
import { type Currency } from "./money.js";

export type PaymentStatus = "pending" | "succeeded" | "failed";

export interface Payment {
  id: string;
  amount: number;
  currency: Currency;
  customerId: string;
  status: PaymentStatus;
  refundedAmount: number;
  createdAt: string;
}

export class PaymentNotFoundError extends Error {
  constructor(id: string) {
    super(`payment ${id} not found`);
    this.name = "PaymentNotFoundError";
  }
}

export class PaymentStore {
  private readonly payments = new Map<string, Payment>();

  create(input: { amount: number; currency: Currency; customerId: string }): Payment {
    const payment: Payment = {
      id: `pay_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      amount: input.amount,
      currency: input.currency,
      customerId: input.customerId,
      status: "pending",
      refundedAmount: 0,
      createdAt: new Date().toISOString(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  get(id: string): Payment {
    const payment = this.payments.get(id);
    if (!payment) throw new PaymentNotFoundError(id);
    return payment;
  }

  list(customerId?: string): Payment[] {
    const all = [...this.payments.values()];
    return customerId ? all.filter((p) => p.customerId === customerId) : all;
  }

  /** Called when the provider confirms the outcome (see webhooks.ts). */
  settle(id: string, status: Exclude<PaymentStatus, "pending">): Payment {
    const payment = this.get(id);
    if (payment.status !== "pending") return payment;
    payment.status = status;
    return payment;
  }

  recordRefund(id: string, amount: number): Payment {
    const payment = this.get(id);
    payment.refundedAmount += amount;
    return payment;
  }
}
