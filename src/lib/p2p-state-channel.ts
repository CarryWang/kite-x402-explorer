import { isAddress, keccak256, stringToHex } from 'viem';

export type ChannelStatus = 'open' | 'closing' | 'settled' | 'disputed';

export interface StateChannelConfig {
  channelId: string;
  sender: `0x${string}`;
  receiver: `0x${string}`;
  depositAmountWei: bigint;
  settledAmountWei: bigint;
  currentNonce: bigint;
  challengePeriodSeconds: number;
  closingDeadline?: number;
  status: ChannelStatus;
  createdAt: number;
}

export interface ChannelStateUpdate {
  channelId: string;
  nonce: bigint;
  transferredAmountWei: bigint;
  timestamp: number;
  digest: `0x${string}`;
}

export interface ChannelCloseProof {
  channelId: string;
  finalNonce: bigint;
  finalTransferredWei: bigint;
  refundToSenderWei: bigint;
  paymentToReceiverWei: bigint;
  stateDigest: `0x${string}`;
}

export const DEFAULT_CHALLENGE_PERIOD_SECONDS = 86400; // 24 hours

/**
 * Derives a deterministic state channel identifier.
 */
export function deriveChannelId(
  sender: `0x${string}`,
  receiver: `0x${string}`,
  nonce: bigint,
  timestamp: number,
): string {
  const hash = keccak256(
    stringToHex(`channel:${sender.toLowerCase()}:${receiver.toLowerCase()}:${nonce}:${timestamp}`),
  );
  return `channel-${hash.slice(2, 14)}`;
}

/**
 * Derives a cryptographic commitment digest for an off-chain state update.
 */
export function computeStateDigest(channelId: string, nonce: bigint, transferredWei: bigint): `0x${string}` {
  return keccak256(stringToHex(`update:${channelId}:${nonce}:${transferredWei}`));
}

/**
 * Opens a new bilateral off-chain micropayment state channel.
 */
export function openStateChannel(params: {
  sender: `0x${string}`;
  receiver: `0x${string}`;
  depositAmountWei: bigint;
  challengePeriodSeconds?: number;
  nonce?: bigint;
  timestamp?: number;
}, verifyFunding?: (params: { sender: `0x${string}`; receiver: `0x${string}`; depositAmountWei: bigint }) => boolean): StateChannelConfig {
  if (!isAddress(params.sender)) {
    throw new Error(`Invalid sender address: ${params.sender}`);
  }
  if (!isAddress(params.receiver)) {
    throw new Error(`Invalid receiver address: ${params.receiver}`);
  }
  if (params.sender.toLowerCase() === params.receiver.toLowerCase()) {
    throw new Error('Sender and receiver addresses must be distinct');
  }
  if (params.depositAmountWei <= 0n) {
    throw new Error('Deposit amount must be positive');
  }
  if (!verifyFunding?.(params)) {
    throw new Error('Verified channel funding required');
  }

  const createdAt = params.timestamp ?? Date.now();
  const nonce = params.nonce ?? 1n;
  const channelId = deriveChannelId(params.sender, params.receiver, nonce, createdAt);

  return {
    channelId,
    sender: params.sender,
    receiver: params.receiver,
    depositAmountWei: params.depositAmountWei,
    settledAmountWei: 0n,
    currentNonce: 0n,
    challengePeriodSeconds: params.challengePeriodSeconds ?? DEFAULT_CHALLENGE_PERIOD_SECONDS,
    status: 'open',
    createdAt,
  };
}

/**
 * Formulates and verifies a monotonic off-chain state update.
 */
export function updateChannelState(
  channel: StateChannelConfig,
  transferredAmountWei: bigint,
  timestamp: number = Date.now(),
): { channel: StateChannelConfig; update: ChannelStateUpdate } {
  if (channel.status !== 'open') {
    throw new Error(`Cannot update channel in status: ${channel.status}`);
  }
  if (transferredAmountWei <= channel.settledAmountWei) {
    throw new Error('Transferred amount must be monotonically increasing');
  }
  if (transferredAmountWei > channel.depositAmountWei) {
    throw new Error(`Transferred amount exceeds channel deposit capacity (${transferredAmountWei} > ${channel.depositAmountWei})`);
  }

  const nextNonce = channel.currentNonce + 1n;
  const digest = computeStateDigest(channel.channelId, nextNonce, transferredAmountWei);

  const updatedChannel: StateChannelConfig = {
    ...channel,
    currentNonce: nextNonce,
    settledAmountWei: transferredAmountWei,
  };

  const update: ChannelStateUpdate = {
    channelId: channel.channelId,
    nonce: nextNonce,
    transferredAmountWei,
    timestamp,
    digest,
  };

  return { channel: updatedChannel, update };
}

/**
 * Generates a definitive closing settlement proof for the state channel.
 */
export function generateCloseProof(
  channel: StateChannelConfig,
  finalUpdate: ChannelStateUpdate,
  verifyState?: (channel: StateChannelConfig, update: ChannelStateUpdate) => boolean,
): ChannelCloseProof {
  if (finalUpdate.channelId !== channel.channelId) {
    throw new Error('Update channel ID mismatch');
  }
  if (finalUpdate.transferredAmountWei > channel.depositAmountWei) {
    throw new Error('Update exceeds total channel collateral');
  }
  if (finalUpdate.transferredAmountWei < 0n || finalUpdate.nonce !== channel.currentNonce || finalUpdate.transferredAmountWei !== channel.settledAmountWei || finalUpdate.digest !== computeStateDigest(channel.channelId, finalUpdate.nonce, finalUpdate.transferredAmountWei)) {
    throw new Error('Invalid channel state update');
  }
  if (!verifyState?.(channel, finalUpdate)) {
    throw new Error('Verified signed channel state required');
  }

  const paymentToReceiverWei = finalUpdate.transferredAmountWei;
  const refundToSenderWei = channel.depositAmountWei - paymentToReceiverWei;

  return {
    channelId: channel.channelId,
    finalNonce: finalUpdate.nonce,
    finalTransferredWei: paymentToReceiverWei,
    refundToSenderWei,
    paymentToReceiverWei,
    stateDigest: finalUpdate.digest,
  };
}

/**
 * Initiates the challenge closure sequence.
 */
export function initiateChannelClose(
  channel: StateChannelConfig,
  timestamp: number = Date.now(),
): StateChannelConfig {
  if (channel.status !== 'open') {
    throw new Error(`Cannot close channel in state: ${channel.status}`);
  }

  return {
    ...channel,
    status: 'closing',
    closingDeadline: timestamp + channel.challengePeriodSeconds * 1000,
  };
}
