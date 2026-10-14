/**
 * Stream Channel Router & Off-Chain Micropayment Settlement Engine for Kite Chain.
 *
 * Facilitates sub-millisecond AI agent streaming requests (LLM generation, telemetry feeds)
 * through cumulative off-chain micro-tickets with periodic EIP-3009 checkpoint settlement.
 */

export interface MicroTicket {
  channelId: string;
  sequenceNonce: number;
  payer: `0x${string}`;
  recipient: `0x${string}`;
  chunkCostWei: bigint;
  cumulativeWei: bigint;
  issuedAt: number;
}

export interface StreamChannelState {
  channelId: string;
  payer: `0x${string}`;
  recipient: `0x${string}`;
  currentNonce: number;
  totalCumulativeWei: bigint;
  maxChannelCapacityWei: bigint;
  settlementThresholdWei: bigint;
  lastSettledAt: number;
  isOpen: boolean;
}

export interface CheckpointSettlement {
  channelId: string;
  finalNonce: number;
  totalSettledWei: bigint;
  settlementTriggerReason: 'threshold_exceeded' | 'capacity_reached' | 'channel_close';
  timestamp: string;
}

/**
 * Initializes a new high-frequency streaming micropayment channel.
 */
export function openStreamChannel(
  channelId: string,
  payer: `0x${string}`,
  recipient: `0x${string}`,
  capacityWei: bigint,
  thresholdWei: bigint = capacityWei / 2n
): StreamChannelState {
  if (capacityWei <= 0n) {
    throw new Error('Channel capacity must be positive');
  }
  if (thresholdWei <= 0n || thresholdWei > capacityWei) {
    throw new Error('Settlement threshold must be positive and within channel capacity');
  }
  return {
    channelId,
    payer,
    recipient,
    currentNonce: 0,
    totalCumulativeWei: 0n,
    maxChannelCapacityWei: capacityWei,
    settlementThresholdWei: thresholdWei,
    lastSettledAt: Date.now(),
    isOpen: true,
  };
}

/**
 * Issues the next cumulative micro-ticket for an active streaming chunk.
 */
export function allocateStreamTicket(
  channel: StreamChannelState,
  chunkCostWei: bigint
): { channel: StreamChannelState; ticket: MicroTicket } {
  if (chunkCostWei <= 0n) {
    throw new Error('Ticket cost must be positive');
  }
  if (!channel.isOpen) {
    throw new Error(`Cannot allocate ticket on closed stream channel ${channel.channelId}`);
  }

  const newNonce = channel.currentNonce + 1;
  const newCumulativeWei = channel.totalCumulativeWei + chunkCostWei;

  if (newCumulativeWei > channel.maxChannelCapacityWei) {
    throw new Error(
      `Channel capacity exceeded: requested ${newCumulativeWei.toString()} wei > capacity ${channel.maxChannelCapacityWei.toString()} wei`
    );
  }

  const updatedChannel: StreamChannelState = {
    ...channel,
    currentNonce: newNonce,
    totalCumulativeWei: newCumulativeWei,
  };

  const ticket: MicroTicket = {
    channelId: channel.channelId,
    sequenceNonce: newNonce,
    payer: channel.payer,
    recipient: channel.recipient,
    chunkCostWei,
    cumulativeWei: newCumulativeWei,
    issuedAt: Date.now(),
  };

  return { channel: updatedChannel, ticket };
}

/**
 * Checks whether the stream channel has reached its checkpoint settlement criteria.
 */
export function shouldTriggerCheckpoint(channel: StreamChannelState): boolean {
  if (!channel.isOpen) return false;
  return channel.totalCumulativeWei >= channel.settlementThresholdWei;
}

/**
 * Generates the checkpoint settlement digest to trigger an on-chain EIP-3009 transfer.
 */
export function closeOrSettleChannel(
  channel: StreamChannelState,
  isFullClose: boolean = false
): { channel: StreamChannelState; settlement: CheckpointSettlement } {
  const reason: CheckpointSettlement['settlementTriggerReason'] = isFullClose
    ? 'channel_close'
    : channel.totalCumulativeWei >= channel.maxChannelCapacityWei
      ? 'capacity_reached'
      : 'threshold_exceeded';

  const settlement: CheckpointSettlement = {
    channelId: channel.channelId,
    finalNonce: channel.currentNonce,
    totalSettledWei: channel.totalCumulativeWei,
    settlementTriggerReason: reason,
    timestamp: new Date().toISOString(),
  };

  const updatedChannel: StreamChannelState = {
    ...channel,
    totalCumulativeWei: isFullClose ? 0n : 0n,
    lastSettledAt: Date.now(),
    isOpen: !isFullClose,
  };

  return { channel: updatedChannel, settlement };
}
