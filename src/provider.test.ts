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

  it("retries a 502 from the provider edge and succeeds", async () => {
    const { impl, calls } = fakeFetch([{ status: 502 }, { status: 502 }, { status: 200, body: { providerRef: "cap_2" } }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl, async () => {});
    await expect(client.capture("pay_2", 100)).resolves.toEqual({ providerRef: "cap_2" });
    expect(calls).toHaveLength(3);
  });

  it("gives up after three 502s", async () => {
    const { impl, calls } = fakeFetch([{ status: 502 }, { status: 502 }, { status: 502 }, { status: 502 }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl, async () => {});
    await expect(client.capture("pay_3", 100)).rejects.toMatchObject({ status: 502 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry other errors", async () => {
    const { impl, calls } = fakeFetch([{ status: 402 }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl, async () => {});
    await expect(client.capture("pay_4", 100)).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toHaveLength(1);
  });

  it("surfaces provider errors with their status", async () => {
    const { impl } = fakeFetch([{ status: 402 }]);
    const client = new ProviderClient("https://provider.test", "sk_test", impl);
    await expect(client.capture("pay_1", 100)).rejects.toBeInstanceOf(ProviderError);
  });
});
