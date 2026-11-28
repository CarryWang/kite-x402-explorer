export interface AgentBudgetAllocation {
  agentRole: 'coordinator' | 'researcher' | 'auditor' | 'synthesizer' | 'sentinel';
  weightBps: number; // basis points, e.g. 3000 = 30%
  assignedAddress: string;
}

export interface SplitShare {
  agentRole: string;
  recipient: string;
  shareUnits: bigint;
  shareFormatted: string;
  percentage: number;
}

export interface SwarmSplitResult {
  totalAmountUnits: bigint;
  totalDustRefundUnits: bigint;
  shares: SplitShare[];
  isValid: boolean;
  error?: string;
}

/**
 * Calculates exact atomic payment shares across a multi-agent swarm DAG workflow.
 * Guarantees zero dust leakage and strict basis points conservation.
 */
export function calculateSwarmBountySplit(
  totalBountyUnits: bigint,
  allocations: AgentBudgetAllocation[],
  assetDecimals: number = 18
): SwarmSplitResult {
  // ERC-20 decimals 是 uint8；拒绝无效元数据，避免格式化抛异常或构造失真的单位。
  if (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 255) {
    return { totalAmountUnits: totalBountyUnits, totalDustRefundUnits: 0n, shares: [],
      isValid: false, error: 'Asset decimals must be an integer from 0 to 255' };
  }
  if (totalBountyUnits <= 0n) {
    return {
      totalAmountUnits: totalBountyUnits,
      totalDustRefundUnits: 0n,
      shares: [],
      isValid: false,
      error: 'Bounty amount must be positive',
    };
  }
  if (allocations.length === 0) {
    return {
      totalAmountUnits: totalBountyUnits,
      totalDustRefundUnits: 0n,
      shares: [],
      isValid: false,
      error: 'No swarm agents specified in allocation table',
    };
  }

  if (allocations.some((a) => !Number.isInteger(a.weightBps) || a.weightBps <= 0 || a.weightBps > 10000)) {
    return {
      totalAmountUnits: totalBountyUnits,
      totalDustRefundUnits: 0n,
      shares: [],
      isValid: false,
      error: 'Each agent weight must be an integer from 1 to 10000 basis points',
    };
  }

  const totalBps = allocations.reduce((sum, a) => sum + a.weightBps, 0);
  if (totalBps !== 10000) {
    return {
      totalAmountUnits: totalBountyUnits,
      totalDustRefundUnits: 0n,
      shares: [],
      isValid: false,
      error: `Sum of agent weights must equal exactly 10,000 basis points (100%), got ${totalBps}`,
    };
  }

  let distributedSum = 0n;
  const shares: SplitShare[] = [];

  for (const alloc of allocations) {
    const shareUnits = (totalBountyUnits * BigInt(alloc.weightBps)) / 10000n;
    distributedSum += shareUnits;

    // Formatting
    // 先用 Number 计算 10 ** decimals 会在合法的高精度代币上丢失原子单位。
    const div = 10n ** BigInt(assetDecimals);
    const whole = shareUnits / div;
    const frac = (shareUnits % div).toString().padStart(assetDecimals, '0').slice(0, 4);

    shares.push({
      agentRole: alloc.agentRole,
      recipient: alloc.assignedAddress,
      shareUnits,
      shareFormatted: assetDecimals === 0 ? whole.toString() : `${whole}.${frac}`,
      percentage: alloc.weightBps / 100,
    });
  }

  const dust = totalBountyUnits - distributedSum;

  return {
    totalAmountUnits: totalBountyUnits,
    totalDustRefundUnits: dust,
    shares,
    isValid: true,
  };
}
