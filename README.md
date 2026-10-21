# payments-api

A small TypeScript API for the checkout team: payments, refunds and provider
webhooks. Built on [Hono](https://hono.dev), tested with
[Vitest](https://vitest.dev), compiled with `tsc`.

## Run it

```bash
npm ci
npm test
npm run build
npm start
```

| Endpoint                      | What it does                                            |
| ----------------------------- | ------------------------------------------------------- |
| `POST /payments`              | Create a pending payment (`amount` in minor units)      |
| `GET /payments/:id`           | Read a payment                                          |
| `POST /payments/:id/refunds`  | Refund part or all of a succeeded payment               |
| `GET /payments/:id/refunds`   | List the refunds of a payment                           |
| `POST /webhooks/provider`     | Provider callbacks, HMAC-SHA256 signed (`WEBHOOK_SECRET`) |

## The pipeline, and why it is the point

`.github/workflows/deploy.yml` is the kind of pipeline a team gets when it asks
an AI agent to "add CI/CD, fast". It builds, tests, scans and deploys on every
push to `main`, and it has been green for weeks. It also:

- trusts `getplumber-examples/setup-cache@v2`, a third-party action referenced
  by a **mutable tag** instead of a commit SHA;
- hands that action every secret the job has (`AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `NPM_TOKEN`) through job-level `env`;
- runs with broad `permissions`.

When the `v2` tag of `setup-cache` is force-moved to a new commit, every run
from then on executes the new code, with the same green check mark. Run
`plumber analyze` in a clone of this repository to see what Plumber reports.

The secrets named in the workflow do not exist in this repository's settings.
