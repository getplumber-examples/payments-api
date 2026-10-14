import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const app = createApp({ webhookSecret: "test-secret" });

async function createPayment(body: unknown) {
  return app.request("/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("payments", () => {
  it("creates a pending payment in minor units", async () => {
    const res = await createPayment({ amount: 1999, currency: "EUR", customerId: "cus_42" });
    expect(res.status).toBe(201);
    const payment = await res.json();
    expect(payment.id).toMatch(/^pay_/);
    expect(payment.status).toBe("pending");
    expect(payment.refundedAmount).toBe(0);
  });

  it("rejects fractional amounts and unknown currencies", async () => {
    expect((await createPayment({ amount: 19.99, currency: "EUR", customerId: "cus_42" })).status).toBe(400);
    expect((await createPayment({ amount: 1999, currency: "CHF", customerId: "cus_42" })).status).toBe(400);
    expect((await createPayment({ amount: 1999, currency: "EUR" })).status).toBe(400);
  });

  it("lists payments filtered by customer", async () => {
    await createPayment({ amount: 100, currency: "USD", customerId: "cus_a" });
    await createPayment({ amount: 200, currency: "USD", customerId: "cus_b" });
    const res = await app.request("/payments?customerId=cus_b");
    const { data } = await res.json();
    expect(data.every((p: { customerId: string }) => p.customerId === "cus_b")).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for an unknown payment", async () => {
    const res = await app.request("/payments/pay_nope");
    expect(res.status).toBe(404);
  });
});
