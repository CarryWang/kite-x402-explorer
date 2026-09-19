/**
 * Protocol definitions for x402 Micropayments (v2).
 */

export interface X402AcceptOption {
  scheme: 'exact';
  network: 'eip155:2366' | 'eip155:2368' | string;
  asset: `0x${string}`;
  amount: string;
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    version?: string;
  };
}

export interface X402ChallengePayload {
  x402Version: 2 | number;
  accepts: X402AcceptOption[];
}

export interface EIP3009Authorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint | string;
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface PaymentSignatureHeaderPayload {
  x402Version: 2;
  scheme: 'exact';
  network: string;
  authorization: EIP3009Authorization;
}

export interface PaymentResponseHeaderPayload {
  txHash: `0x${string}`;
  settled: boolean;
  blockNumber?: number;
}
