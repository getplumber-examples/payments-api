import { createHmac, timingSafeEqual } from "node:crypto";
import { type PaymentStore } from "./payments.js";

export interface ProviderEvent {
  id: string;
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded";
  data: { paymentId: string; refundId?: string; amount?: number };
}

export const SIGNATURE_HEADER = "x-provider-signature";

export function sign(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(rawBody, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export class WebhookHandler {
  /** Provider retries deliveries; the same event must never be applied twice. */
  private readonly seen = new Set<string>();
  /** Refunds the provider has confirmed as settled, by refund id. */
  readonly settledRefunds = new Set<string>();

  constructor(private readonly payments: PaymentStore) {}

  handle(event: ProviderEvent): { applied: boolean } {
    if (this.seen.has(event.id)) return { applied: false };
    this.seen.add(event.id);
    switch (event.type) {
      case "payment.succeeded":
        this.payments.settle(event.data.paymentId, "succeeded");
        return { applied: true };
      case "payment.failed":
        this.payments.settle(event.data.paymentId, "failed");
        return { applied: true };
      case "refund.succeeded":
        // The refund was created by us (refunds.ts); the provider confirms the
        // money moved. Touch the payment so an unknown id still 404s.
        this.payments.get(event.data.paymentId);
        if (event.data.refundId) this.settledRefunds.add(event.data.refundId);
        return { applied: true };
      default:
        return { applied: false };
    }
  }
}
