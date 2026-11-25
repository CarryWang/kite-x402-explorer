import type { X402ChallengePayload } from '../types/x402.js';

/**
 * Decodes base64 into UTF-8 text. atob() alone returns one character per
 * byte, which garbles any non-ASCII text, so the bytes go through TextDecoder.
 * Invalid UTF-8 throws instead of being replaced silently.
 */
function base64ToUtf8(value: string): string {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Decodes a base64 encoded PAYMENT-REQUIRED header string into a structured object.
 * x402 SDKs encode the UTF-8 bytes of the JSON, so descriptions may contain any language.
 */
export function decodePaymentRequiredHeader(headerVal: string): X402ChallengePayload | null {
  try {
    return JSON.parse(base64ToUtf8(headerVal)) as X402ChallengePayload;
  } catch (err) {
    console.error('Failed to decode PAYMENT-REQUIRED header:', err);
    return null;
  }
}

/**
 * Formats token amount into human-readable USD string based on network/decimals.
 */
export function formatTokenAmount(amountInt: string, decimals: number): string {
  try {
    const bi = BigInt(amountInt);
    const divisor = BigInt(10 ** decimals);
    const whole = bi / divisor;
    const remainder = bi % divisor;
    const remStr = remainder.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole}.${remStr}`;
  } catch {
    return amountInt;
  }
}
