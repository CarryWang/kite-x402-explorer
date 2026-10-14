/**
 * AI Dataset Annotation Quality Verifier & Batch Revenue Share Allocator for Kite Chain.
 *
 * Distributes x402 revenue to crowdsourced AI data contributors and annotation agents
 * proportionally weighted by token volume and cryptographic quality audit scores.
 */

export interface DataContributor {
  contributorAddress: `0x${string}`;
  acceptedTokensCount: number;
  qualityScoreBps: number; // 0 to 10000 bps (10000 = 100% quality)
  batchDeliverableHash?: `0x${string}`;
}

export interface ContributorPayout {
  contributorAddress: `0x${string}`;
  weightScore: bigint;
  allocatedWei: bigint;
  effectivePercentageBps: number;
}

export interface DatasetBatchSummary {
  totalTokens: number;
  averageQualityBps: number;
  totalContributors: number;
  totalPayoutWei: bigint;
  dustRefundWei: bigint;
  payouts: ContributorPayout[];
}

/**
 * Calculates quality-weighted revenue share allocations for dataset contributors.
 * Weight = tokensCount * qualityScoreBps.
 * Invariant: sum(payouts.allocatedWei) + dustRefundWei === totalPoolWei.
 */
export function calculateWeightedRevenueShare(
  totalPoolWei: bigint,
  contributors: DataContributor[]
): DatasetBatchSummary {
  if (contributors.length === 0 || totalPoolWei <= 0n) {
    return {
      totalTokens: 0,
      averageQualityBps: 0,
      totalContributors: 0,
      totalPayoutWei: 0n,
      dustRefundWei: totalPoolWei,
      payouts: [],
    };
  }

  // Filter contributors meeting minimum quality threshold (e.g. 5000 bps = 50%)
  const qualified = contributors.filter((c) => c.qualityScoreBps >= 5000 && c.acceptedTokensCount > 0);
  if (qualified.length === 0) {
    return {
      totalTokens: 0,
      averageQualityBps: 0,
      totalContributors: 0,
      totalPayoutWei: 0n,
      dustRefundWei: totalPoolWei,
      payouts: [],
    };
  }

  const weights = qualified.map((c) => BigInt(c.acceptedTokensCount) * BigInt(c.qualityScoreBps));
  const totalWeight = weights.reduce((acc, curr) => acc + curr, 0n);

  let distributedWei = 0n;
  const payouts: ContributorPayout[] = qualified.map((c, idx) => {
    const isLast = idx === qualified.length - 1;
    const share = isLast
      ? totalPoolWei - distributedWei
      : (totalPoolWei * weights[idx]) / totalWeight;

    distributedWei += share;
    const effectiveBps = Number((weights[idx] * 10000n) / totalWeight);

    return {
      contributorAddress: c.contributorAddress,
      weightScore: weights[idx],
      allocatedWei: share,
      effectivePercentageBps: effectiveBps,
    };
  });

  const totalTokens = qualified.reduce((acc, curr) => acc + curr.acceptedTokensCount, 0);
  const totalQuality = qualified.reduce((acc, curr) => acc + curr.qualityScoreBps, 0);
  const averageQualityBps = Math.round(totalQuality / qualified.length);

  return {
    totalTokens,
    averageQualityBps,
    totalContributors: qualified.length,
    totalPayoutWei: totalPoolWei,
    dustRefundWei: 0n,
    payouts,
  };
}

/**
 * Validates whether an annotation batch satisfies quality standards before escrow release.
 */
export function evaluateBatchThresholds(
  batch: DatasetBatchSummary,
  minAcceptableQualityBps: number = 7000 // 70%
): { isAcceptable: boolean; reason?: string } {
  if (batch.totalContributors === 0) {
    return { isAcceptable: false, reason: 'No contributors met minimum qualification criteria' };
  }
  if (batch.averageQualityBps < minAcceptableQualityBps) {
    return {
      isAcceptable: false,
      reason: `Average batch quality ${batch.averageQualityBps} bps is below required threshold ${minAcceptableQualityBps} bps`,
    };
  }
  return { isAcceptable: true };
}
