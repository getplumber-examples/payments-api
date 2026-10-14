export type Currency = "EUR" | "USD" | "GBP";

export const SUPPORTED_CURRENCIES: readonly Currency[] = ["EUR", "USD", "GBP"];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** Amounts are integers in minor units (cents). */
export function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
