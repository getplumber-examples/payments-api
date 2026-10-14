import { describe, expect, it } from "vitest";
import { ProviderClient, ProviderError } from "./provider.js";

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: string[] = [];
  const impl = async (input: string) => {
    calls.push(input);
    const next = responses.shift() ?? { status: 500 };
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  };
  return { impl, calls };
}

describe("provider client", () => {
  it("captures a payment", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { providerRef: "cap_1" } }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl);
    await expect(client.capture("pay_1", 100)).resolves.toEqual({ providerRef: "cap_1" });
    expect(calls).toHaveLength(1);
  });

  it("surfaces provider errors with their status", async () => {
    const { impl } = fakeFetch([{ status: 402 }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl);
    await expect(client.capture("pay_1", 100)).rejects.toBeInstanceOf(ProviderError);
  });
});
