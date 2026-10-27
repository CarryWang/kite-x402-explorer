import { isAddress, keccak256, stringToHex } from 'viem';

export type BridgeIntentStatus = 'pending' | 'attested' | 'settled' | 'refunded' | 'expired';

export interface CrossChainBridgeIntent {
  intentId: string;
  sourceChainId: number;
  sourceToken: `0x${string}`;
  sourceAmountWei: bigint;
  destinationChainId: number;
  destinationRecipient: `0x${string}`;
  minDestinationAmountWei: bigint;
  nonce: bigint;
  expiryTimestamp: number;
  status: BridgeIntentStatus;
  relayer?: `0x${string}`;
  destinationTxHash?: `0x${string}`;
  createdAt: number;
}

export interface BridgeRouteQuote {
  sourceChainId: number;
  destinationChainId: number;
  sourceAmountWei: bigint;
  estimatedOutputWei: bigint;
  bridgeFeeWei: bigint;
  estimatedLatencySeconds: number;
  feeBps: number;
}

export const KITE_MAINNET_CHAIN_ID = 2366;
export const KITE_TESTNET_CHAIN_ID = 2368;
export const DEFAULT_BRIDGE_FEE_BPS = 15; // 0.15% bridge fee
export const BPS_DENOMINATOR = 10_000;

/**
 * Derives a deterministic unique ID for a cross-chain settlement intent.
 */
export function deriveBridgeIntentId(params: {
  sourceChainId: number;
  destinationChainId: number;
  destinationRecipient: `0x${string}`;
  nonce: bigint;
  createdAt: number;
}): string {
  const hash = keccak256(
    stringToHex(
      `bridge:${params.sourceChainId}:${params.destinationChainId}:${params.destinationRecipient.toLowerCase()}:${params.nonce}:${params.createdAt}`,
    ),
  );
  return `intent-${hash.slice(2, 14)}`;
}

/**
 * Calculates a route quote for bridging liquidity into Kite Chain for x402 settlement.
 */
export function calculateBridgeRouteQuote(params: {
  sourceChainId: number;
  destinationChainId: number;
  sourceAmountWei: bigint;
  feeBps?: number;
}): BridgeRouteQuote {
  if (params.sourceAmountWei <= 0n) {
    throw new Error('Source amount must be positive');
  }

  const feeBps = params.feeBps ?? DEFAULT_BRIDGE_FEE_BPS;
  const bridgeFeeWei = (params.sourceAmountWei * BigInt(feeBps)) / BigInt(BPS_DENOMINATOR);
  const estimatedOutputWei = params.sourceAmountWei - bridgeFeeWei;

  const estimatedLatencySeconds = params.sourceChainId === params.destinationChainId
    ? 2
    : 15; // Fast settlement relayer

  return {
    sourceChainId: params.sourceChainId,
    destinationChainId: params.destinationChainId,
    sourceAmountWei: params.sourceAmountWei,
    estimatedOutputWei,
    bridgeFeeWei,
    estimatedLatencySeconds,
    feeBps,
  };
}

/**
 * Constructs a cross-chain settlement intent for automated agent execution.
 */
export function createBridgeIntent(params: {
  sourceChainId: number;
  sourceToken: `0x${string}`;
  sourceAmountWei: bigint;
  destinationChainId?: number;
  destinationRecipient: `0x${string}`;
  slippageBps?: number;
  nonce?: bigint;
  ttlSeconds?: number;
  timestamp?: number;
}): CrossChainBridgeIntent {
  if (!isAddress(params.sourceToken)) {
    throw new Error(`Invalid source token address: ${params.sourceToken}`);
  }
  if (!isAddress(params.destinationRecipient)) {
    throw new Error(`Invalid recipient address: ${params.destinationRecipient}`);
  }
  if (params.sourceAmountWei <= 0n) {
    throw new Error('Source amount must be positive');
  }

  const destinationChainId = params.destinationChainId ?? KITE_TESTNET_CHAIN_ID;
  const createdAt = params.timestamp ?? Date.now();
  const nonce = params.nonce ?? BigInt(Math.floor(Math.random() * 1_000_000));
  const ttl = params.ttlSeconds ?? 1800; // 30 minutes
  const expiryTimestamp = createdAt + ttl * 1000;

  const quote = calculateBridgeRouteQuote({
    sourceChainId: params.sourceChainId,
    destinationChainId,
    sourceAmountWei: params.sourceAmountWei,
  });

  const slippageBps = params.slippageBps ?? 50; // 0.5% max slippage
  const minDestinationAmountWei =
    (quote.estimatedOutputWei * BigInt(BPS_DENOMINATOR - slippageBps)) / BigInt(BPS_DENOMINATOR);

  const intentId = deriveBridgeIntentId({
    sourceChainId: params.sourceChainId,
    destinationChainId,
    destinationRecipient: params.destinationRecipient,
    nonce,
    createdAt,
  });

  return {
    intentId,
    sourceChainId: params.sourceChainId,
    sourceToken: params.sourceToken,
    sourceAmountWei: params.sourceAmountWei,
    destinationChainId,
    destinationRecipient: params.destinationRecipient,
    minDestinationAmountWei,
    nonce,
    expiryTimestamp,
    status: 'pending',
    createdAt,
  };
}

/**
 * Attests fulfillment and on-chain settlement of a cross-chain intent.
 */
export function attestBridgeFulfillment(
  intent: CrossChainBridgeIntent,
  params: {
    relayerAddress: `0x${string}`;
    destinationTxHash: `0x${string}`;
    timestamp?: number;
  },
): CrossChainBridgeIntent {
  if (intent.status !== 'pending') {
    throw new Error(`Cannot attest intent in state: ${intent.status}`);
  }
  if (!isAddress(params.relayerAddress)) {
    throw new Error(`Invalid relayer address: ${params.relayerAddress}`);
  }

  const now = params.timestamp ?? Date.now();
  if (now > intent.expiryTimestamp) {
    return {
      ...intent,
      status: 'expired',
    };
  }

  return {
    ...intent,
    status: 'settled',
    relayer: params.relayerAddress,
    destinationTxHash: params.destinationTxHash,
  };
}
