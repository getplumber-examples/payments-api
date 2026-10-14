import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { sign, SIGNATURE_HEADER, verifySignature } from "./webhooks.js";

const SECRET = "test-secret";
const app = createApp({ webhookSecret: SECRET });

async function pendingPayment(): Promise<string> {
  const res = await app.request("/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 2500, currency: "USD", customerId: "cus_hook" }),
  });
  return (await res.json()).id;
}

function deliver(body: string, signature?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) headers[SIGNATURE_HEADER] = signature;
  return app.request("/webhooks/provider", { method: "POST", headers, body });
}

describe("provider webhooks", () => {
  it("verifies HMAC signatures in constant time", () => {
    const body = '{"id":"evt_1"}';
    expect(verifySignature(body, sign(body, SECRET), SECRET)).toBe(true);
    expect(verifySignature(body, sign(body, "other"), SECRET)).toBe(false);
    expect(verifySignature(body, undefined, SECRET)).toBe(false);
  });

  it("rejects unsigned and badly signed deliveries", async () => {
    const id = await pendingPayment();
    const body = JSON.stringify({ id: "evt_unsigned", type: "payment.succeeded", data: { paymentId: id } });
    expect((await deliver(body)).status).toBe(401);
    expect((await deliver(body, "deadbeef")).status).toBe(401);
    const payment = await (await app.request(`/payments/${id}`)).json();
    expect(payment.status).toBe("pending");
  });

  it("settles the payment on payment.succeeded", async () => {
    const id = await pendingPayment();
    const body = JSON.stringify({ id: "evt_ok", type: "payment.succeeded", data: { paymentId: id } });
    const res = await deliver(body, sign(body, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: true });
    const payment = await (await app.request(`/payments/${id}`)).json();
    expect(payment.status).toBe("succeeded");
  });

  it("ignores a redelivered event", async () => {
    const id = await pendingPayment();
    const body = JSON.stringify({ id: "evt_dup", type: "payment.failed", data: { paymentId: id } });
    expect(await (await deliver(body, sign(body, SECRET))).json()).toEqual({ applied: true });
    expect(await (await deliver(body, sign(body, SECRET))).json()).toEqual({ applied: false });
  });

  it("returns 404 for an event about an unknown payment", async () => {
    const body = JSON.stringify({ id: "evt_404", type: "payment.succeeded", data: { paymentId: "pay_missing" } });
    expect((await deliver(body, sign(body, SECRET))).status).toBe(404);
  });
});
