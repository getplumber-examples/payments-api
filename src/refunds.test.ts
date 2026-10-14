import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { sign, SIGNATURE_HEADER } from "./webhooks.js";

const SECRET = "test-secret";
const app = createApp({ webhookSecret: SECRET });

async function settledPayment(amount: number): Promise<string> {
  const created = await app.request("/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, currency: "EUR", customerId: "cus_refund" }),
  });
  const { id } = await created.json();
  const body = JSON.stringify({ id: `evt_${id}`, type: "payment.succeeded", data: { paymentId: id } });
  await app.request("/webhooks/provider", {
    method: "POST",
    headers: { "content-type": "application/json", [SIGNATURE_HEADER]: sign(body, SECRET) },
    body,
  });
  return id;
}

async function refund(paymentId: string, body: unknown = {}) {
  return app.request(`/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("refunds", () => {
  it("refunds the full amount by default", async () => {
    const id = await settledPayment(5000);
    const res = await refund(id);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.amount).toBe(5000);
    const payment = await (await app.request(`/payments/${id}`)).json();
    expect(payment.refundedAmount).toBe(5000);
  });

  it("allows chained partial refunds up to the original amount", async () => {
    const id = await settledPayment(1000);
    expect((await refund(id, { amount: 400 })).status).toBe(201);
    expect((await refund(id, { amount: 600 })).status).toBe(201);
    const over = await refund(id, { amount: 1 });
    expect(over.status).toBe(409);
    expect((await over.json()).code).toBe("exceeds_balance");
  });

  it("refuses to refund a payment that is still pending", async () => {
    const created = await app.request("/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 100, currency: "GBP", customerId: "cus_pending" }),
    });
    const { id } = await created.json();
    const res = await refund(id);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("not_settled");
  });

  it("lists the refunds of a payment", async () => {
    const id = await settledPayment(300);
    await refund(id, { amount: 100, reason: "duplicate" });
    await refund(id, { amount: 200 });
    const { data } = await (await app.request(`/payments/${id}/refunds`)).json();
    expect(data).toHaveLength(2);
    expect(data[0].reason).toBe("duplicate");
  });
});
