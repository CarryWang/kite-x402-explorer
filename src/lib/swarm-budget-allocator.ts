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
  if (allocations.length === 0) {
    return {
      totalAmountUnits: totalBountyUnits,
      totalDustRefundUnits: 0n,
      shares: [],
      isValid: false,
      error: 'No swarm agents specified in allocation table',
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
    const div = BigInt(10 ** assetDecimals);
    const whole = shareUnits / div;
    const frac = (shareUnits % div).toString().padStart(assetDecimals, '0').slice(0, 4);

    shares.push({
      agentRole: alloc.agentRole,
      recipient: alloc.assignedAddress,
      shareUnits,
      shareFormatted: `${whole}.${frac}`,
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
