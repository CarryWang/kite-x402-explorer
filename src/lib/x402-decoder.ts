import type { X402ChallengePayload } from '../types/x402.js';

/**
 * Decodes a base64 encoded PAYMENT-REQUIRED header string into a structured object.
 */
export function decodePaymentRequiredHeader(headerVal: string): X402ChallengePayload | null {
  try {
    const rawStr = typeof atob !== 'undefined' ? atob(headerVal) : Buffer.from(headerVal, 'base64').toString('utf-8');
    return JSON.parse(rawStr) as X402ChallengePayload;
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
