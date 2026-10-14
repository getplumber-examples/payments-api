import { createHmac, timingSafeEqual } from "node:crypto";
import { type PaymentStore } from "./payments.js";

export interface ProviderEvent {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  data: { paymentId: string };
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
      default:
        return { applied: false };
    }
  }
}
