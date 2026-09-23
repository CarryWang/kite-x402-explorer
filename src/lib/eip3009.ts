import { type Hex, hexToNumber } from 'viem';
import { KITE_CHAINS } from '../types/kite.js';
import type { PaymentSignatureHeaderPayload } from '../types/x402.js';

export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * Generates a cryptographically secure 32-byte hex nonce.
 */
export function generateRandomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return ('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

/**
 * Splits a 65-byte hex signature (0x + 130 chars) into r, s, v
 */
export function splitSignature(sigHex: Hex): { r: Hex; s: Hex; v: number } {
  const clean = sigHex.startsWith('0x') ? sigHex.slice(2) : sigHex;
  const r = ('0x' + clean.slice(0, 64)) as Hex;
  const s = ('0x' + clean.slice(64, 128)) as Hex;
  let v = hexToNumber(('0x' + clean.slice(128, 130)) as Hex);
  if (v < 27) v += 27; // EIP-155 / standard EVM v normalization
  return { r, s, v };
}

export interface BuildEIP3009Params {
  fromAddress: `0x${string}`;
  payToAddress: `0x${string}`;
  amountUnits: string;
  network: string;
  assetAddress: `0x${string}`;
  tokenName?: string;
  tokenVersion?: string;
  signTypedDataFn: (params: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: typeof EIP3009_TYPES;
    primaryType: 'TransferWithAuthorization';
    message: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
      validAfter: bigint;
      validBefore: bigint;
      nonce: `0x${string}`;
    };
  }) => Promise<Hex>;
}

/**
 * Builds and signs a complete EIP-3009 authorization payload for Kite x402
 */
export async function createSignedEIP3009Payload(
  params: BuildEIP3009Params
): Promise<{ payload: PaymentSignatureHeaderPayload; base64Header: string }> {
  const kiteConfig = KITE_CHAINS[params.network] || KITE_CHAINS['eip155:2368'];
  const chainId = kiteConfig.chainId;
  const domainName = params.tokenName || kiteConfig.eip712Domain.name;
  const domainVersion = params.tokenVersion || kiteConfig.eip712Domain.version;

  const nonce = generateRandomNonce();
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour TTL
  const value = BigInt(params.amountUnits);

  const domain = {
    name: domainName,
    version: domainVersion,
    chainId,
    verifyingContract: params.assetAddress,
  };

  const message = {
    from: params.fromAddress,
    to: params.payToAddress,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const rawSig = await params.signTypedDataFn({
    domain,
    types: EIP3009_TYPES,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  const { r, s, v } = splitSignature(rawSig);

  const payload: PaymentSignatureHeaderPayload = {
    x402Version: 2,
    scheme: 'exact',
    network: params.network,
    authorization: {
      from: params.fromAddress,
      to: params.payToAddress,
      value: params.amountUnits,
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      nonce,
      v,
      r,
      s,
    },
  };

  const base64Header = btoa(JSON.stringify(payload));
  return { payload, base64Header };
}
