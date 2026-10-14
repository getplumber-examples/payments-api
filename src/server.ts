import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.WEBHOOK_SECRET ?? "dev-only-secret";

const app = createApp({ webhookSecret });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`payments-api listening on http://localhost:${info.port}`);
});
