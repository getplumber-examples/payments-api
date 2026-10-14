import { Hono } from "hono";
import { isCurrency, isValidAmount } from "./money.js";
import { PaymentNotFoundError, PaymentStore } from "./payments.js";
import { RefundError, RefundService } from "./refunds.js";
import { type ProviderEvent, SIGNATURE_HEADER, verifySignature, WebhookHandler } from "./webhooks.js";

export interface AppOptions {
  webhookSecret: string;
}

export function createApp(options: AppOptions) {
  const payments = new PaymentStore();
  const refunds = new RefundService(payments);
  const webhooks = new WebhookHandler(payments);
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.post("/payments", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidAmount(body.amount) || !isCurrency(body.currency) || typeof body.customerId !== "string") {
      return c.json({ error: "amount (positive integer, minor units), currency and customerId are required" }, 400);
    }
    const payment = payments.create({ amount: body.amount, currency: body.currency, customerId: body.customerId });
    return c.json(payment, 201);
  });

  app.get("/payments", (c) => c.json({ data: payments.list(c.req.query("customerId")) }));

  app.get("/payments/:id", (c) => {
    try {
      return c.json(payments.get(c.req.param("id")));
    } catch (err) {
      if (err instanceof PaymentNotFoundError) return c.json({ error: err.message }, 404);
      throw err;
    }
  });

  app.post("/payments/:id/refunds", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { amount?: unknown; reason?: unknown };
    if (body.amount !== undefined && !isValidAmount(body.amount)) {
      return c.json({ error: "amount must be a positive integer in minor units" }, 400);
    }
    try {
      const refund = refunds.create({
        paymentId: c.req.param("id"),
        amount: body.amount as number | undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
      return c.json(refund, 201);
    } catch (err) {
      if (err instanceof PaymentNotFoundError) return c.json({ error: err.message }, 404);
      if (err instanceof RefundError) return c.json({ error: err.message, code: err.code }, 409);
      throw err;
    }
  });

  app.get("/payments/:id/refunds", (c) => c.json({ data: refunds.listForPayment(c.req.param("id")) }));

  app.post("/webhooks/provider", async (c) => {
    const raw = await c.req.text();
    if (!verifySignature(raw, c.req.header(SIGNATURE_HEADER), options.webhookSecret)) {
      return c.json({ error: "invalid signature" }, 401);
    }
    let event: ProviderEvent;
    try {
      event = JSON.parse(raw) as ProviderEvent;
    } catch {
      return c.json({ error: "malformed event" }, 400);
    }
    try {
      return c.json(webhooks.handle(event), 200);
    } catch (err) {
      if (err instanceof PaymentNotFoundError) return c.json({ error: err.message }, 404);
      throw err;
    }
  });

  return app;
}
