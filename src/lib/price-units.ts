/**
 * Convert a manifest `price_usd` string (e.g. "0.001") into the settlement
 * token's integer base units, using string arithmetic so no precision is lost
 * to floating point.
 *
 * Returns null when the price is not a plain non-negative decimal, or when it
 * has more fractional digits than the token can represent.
 */
export function usdToAtomicUnits(priceUsd: string, decimals: number): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(priceUsd.trim());
  if (!match || !Number.isInteger(decimals) || decimals < 0) return null;
  const [, whole, fraction = ''] = match;
  if (fraction.length > decimals) return null;
  return BigInt(whole + fraction.padEnd(decimals, '0')).toString();
}
