/**
 * Thin client for the payment provider's REST API. Only the capture call is
 * used today; the webhook flow (webhooks.ts) brings the outcome back.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

export class ProviderClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /**
   * The provider's edge returns 502 for a few seconds during its deploys.
   * Captures are idempotent on paymentId, so a 502 is retried with backoff.
   */
  async capture(paymentId: string, amount: number): Promise<{ providerRef: string }> {
    let res: Response | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      res = await this.fetchImpl(`${this.baseUrl}/v1/captures`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ paymentId, amount }),
      });
      if (res.status !== 502 || attempt === MAX_ATTEMPTS) break;
      await this.sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
    if (!res || !res.ok) {
      throw new ProviderError(`capture of ${paymentId} failed with HTTP ${res?.status ?? 0}`, res?.status ?? 0);
    }
    return (await res.json()) as { providerRef: string };
  }
}
