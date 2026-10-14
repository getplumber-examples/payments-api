import { randomUUID } from "node:crypto";
import { type PaymentStore } from "./payments.js";

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export class RefundError extends Error {
  constructor(
    message: string,
    readonly code: "not_settled" | "exceeds_balance",
  ) {
    super(message);
    this.name = "RefundError";
  }
}

export class RefundService {
  private readonly refunds = new Map<string, Refund>();

  constructor(private readonly payments: PaymentStore) {}

  /**
   * Refund part or all of a payment. Partial refunds may be chained as long
   * as the total never exceeds the original amount.
   */
  create(input: { paymentId: string; amount?: number; reason?: string }): Refund {
    const payment = this.payments.get(input.paymentId);
    if (payment.status !== "succeeded") {
      throw new RefundError(`payment ${payment.id} is ${payment.status}, only succeeded payments can be refunded`, "not_settled");
    }
    const remaining = payment.amount - payment.refundedAmount;
    const amount = input.amount ?? remaining;
    if (amount > remaining) {
      throw new RefundError(`refund of ${amount} exceeds the refundable balance of ${remaining}`, "exceeds_balance");
    }
    const refund: Refund = {
      id: `re_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      paymentId: payment.id,
      amount,
      reason: input.reason ?? "requested_by_customer",
      createdAt: new Date().toISOString(),
    };
    this.refunds.set(refund.id, refund);
    this.payments.recordRefund(payment.id, amount);
    return refund;
  }

  listForPayment(paymentId: string): Refund[] {
    return [...this.refunds.values()].filter((r) => r.paymentId === paymentId);
  }
}
