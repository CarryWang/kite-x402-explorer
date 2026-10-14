/**
 * Milestone Task Escrow & Conditional x402 Settlement Vault for Kite Chain.
 *
 * Implements trust-minimized staged payouts for complex, long-running AI agent
 * tasks (e.g. multi-step data pipelines, machine learning training, code verification)
 * with basis points milestone allocation and time-lock expiration protection.
 */

export interface TaskMilestone {
  milestoneId: string;
  title: string;
  percentageBps: number; // 10000 bps = 100%
  payoutWei: bigint;
  requiredDeliverableHash?: `0x${string}`;
  isCompleted: boolean;
  completedAt?: number;
}

export type EscrowVaultStatus = 'created' | 'funded' | 'in_progress' | 'completed' | 'refunded';

export interface TaskEscrowVault {
  taskId: string;
  client: `0x${string}`;
  agentWorker: `0x${string}`;
  totalDepositWei: bigint;
  releasedWei: bigint;
  remainingWei: bigint;
  milestones: TaskMilestone[];
  expiryTimestamp: number;
  status: EscrowVaultStatus;
  createdAt: number;
}

/**
 * Creates and initializes a new milestone escrow vault.
 * Enforces basis points conservation: sum(milestone.percentageBps) === 10000.
 */
export function createMilestoneTask(
  taskId: string,
  client: `0x${string}`,
  agentWorker: `0x${string}`,
  totalDepositWei: bigint,
  milestonesConfig: Array<{ milestoneId: string; title: string; percentageBps: number; deliverableHash?: `0x${string}` }>,
  durationSeconds: number = 86400 * 7 // 7 days default
): TaskEscrowVault {
  const totalBps = milestonesConfig.reduce((acc, curr) => acc + curr.percentageBps, 0);
  if (totalBps !== 10000) {
    throw new Error(`Total milestone percentage must equal 10000 bps (100%), received: ${totalBps}`);
  }

  let allocatedWei = 0n;
  const milestones: TaskMilestone[] = milestonesConfig.map((m, index) => {
    // Last milestone absorbs any rounding dust
    const isLast = index === milestonesConfig.length - 1;
    const payout = isLast
      ? totalDepositWei - allocatedWei
      : (totalDepositWei * BigInt(m.percentageBps)) / 10000n;
    allocatedWei += payout;

    return {
      milestoneId: m.milestoneId,
      title: m.title,
      percentageBps: m.percentageBps,
      payoutWei: payout,
      requiredDeliverableHash: m.deliverableHash,
      isCompleted: false,
    };
  });

  const now = Math.floor(Date.now() / 1000);
  return {
    taskId,
    client,
    agentWorker,
    totalDepositWei,
    releasedWei: 0n,
    remainingWei: totalDepositWei,
    milestones,
    expiryTimestamp: now + durationSeconds,
    status: 'funded',
    createdAt: now,
  };
}

/**
 * Releases payment for an approved milestone deliverable.
 */
export function releaseMilestonePayout(
  vault: TaskEscrowVault,
  milestoneId: string,
  providedDeliverableHash?: `0x${string}`
): { vault: TaskEscrowVault; releasedAmountWei: bigint } {
  if (vault.status !== 'funded' && vault.status !== 'in_progress') {
    throw new Error(`Cannot release milestone on vault with status: ${vault.status}`);
  }
  if (Math.floor(Date.now() / 1000) > vault.expiryTimestamp) {
    throw new Error(`Cannot release milestone on expired vault ${vault.taskId}`);
  }

  const milestoneIndex = vault.milestones.findIndex((m) => m.milestoneId === milestoneId);
  if (milestoneIndex === -1) {
    throw new Error(`Milestone ${milestoneId} not found in task vault ${vault.taskId}`);
  }

  const milestone = vault.milestones[milestoneIndex];
  if (milestone.isCompleted) {
    throw new Error(`Milestone ${milestoneId} is already completed`);
  }

  // Validate deliverable hash if strictly configured
  if (
    milestone.requiredDeliverableHash &&
    milestone.requiredDeliverableHash.toLowerCase() !== providedDeliverableHash?.toLowerCase()
  ) {
    throw new Error(`Deliverable hash mismatch for milestone ${milestoneId}`);
  }

  const updatedMilestones = [...vault.milestones];
  updatedMilestones[milestoneIndex] = {
    ...milestone,
    isCompleted: true,
    completedAt: Math.floor(Date.now() / 1000),
  };

  const newReleasedWei = vault.releasedWei + milestone.payoutWei;
  const newRemainingWei = vault.totalDepositWei - newReleasedWei;
  const allCompleted = updatedMilestones.every((m) => m.isCompleted);

  const updatedVault: TaskEscrowVault = {
    ...vault,
    releasedWei: newReleasedWei,
    remainingWei: newRemainingWei,
    milestones: updatedMilestones,
    status: allCompleted ? 'completed' : 'in_progress',
  };

  return { vault: updatedVault, releasedAmountWei: milestone.payoutWei };
}

/**
 * Checks whether an expired, stalled task vault is eligible for client refund.
 */
export function checkTimeoutRefundEligibility(
  vault: TaskEscrowVault,
  currentTimestamp: number = Math.floor(Date.now() / 1000)
): { isEligible: boolean; refundableWei: bigint } {
  if (vault.status === 'completed' || vault.status === 'refunded') {
    return { isEligible: false, refundableWei: 0n };
  }

  const isExpired = currentTimestamp > vault.expiryTimestamp;
  if (!isExpired) {
    return { isEligible: false, refundableWei: 0n };
  }

  return {
    isEligible: true,
    refundableWei: vault.remainingWei,
  };
}
