import type { X402AcceptOption } from '../types/x402.js';
import { decodePaymentRequiredHeader } from './x402-decoder.js';
import { KITE_CHAINS } from '../types/kite.js';

export interface ParsedChallengeReport {
  valid: boolean;
  version: number;
  selectedAccept: X402AcceptOption;
  isKiteNetwork: boolean;
  chainName: 'mainnet' | 'testnet' | 'unknown';
  formattedAmount: string;
  assetSymbol: string;
  error?: string;
}

/**
 * Parses and verifies an x402 challenge header from an HTTP 402 response.
 */
export function analyze402Challenge(headerValue: string): ParsedChallengeReport | null {
  const payload = decodePaymentRequiredHeader(headerValue);
  if (!payload || !payload.accepts || payload.accepts.length === 0) {
    return null;
  }

  const accept = payload.accepts[0];
  const kiteConfig = KITE_CHAINS[accept.network];
  const isKite = Boolean(kiteConfig);

  let formattedAmount = accept.amount;
  let assetSymbol = 'TOKENS';

  if (kiteConfig) {
    const decimals = kiteConfig.assetDecimals;
    assetSymbol = kiteConfig.assetSymbol;
    try {
      const bi = BigInt(accept.amount);
      const div = BigInt(10 ** decimals);
      const whole = bi / div;
      const frac = (bi % div).toString().padStart(decimals, '0').slice(0, 4);
      formattedAmount = `${whole}.${frac} ${assetSymbol}`;
    } catch {
      formattedAmount = `${accept.amount} units`;
    }
  }

  return {
    valid: true,
    version: payload.x402Version || 2,
    selectedAccept: accept,
    isKiteNetwork: isKite,
    chainName: kiteConfig ? kiteConfig.name : 'unknown',
    formattedAmount,
    assetSymbol,
  };
}
