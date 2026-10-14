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

export class ProviderClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async capture(paymentId: string, amount: number): Promise<{ providerRef: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/captures`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ paymentId, amount }),
    });
    if (!res.ok) throw new ProviderError(`capture of ${paymentId} failed with HTTP ${res.status}`, res.status);
    return (await res.json()) as { providerRef: string };
  }
}
