/** Metadata returned by the local x402 simulator. No chain transaction occurs. */
export function buildMockSettlement() {
  return {
    facilitator: 'https://facilitator.pieverse.io/v2',
    settledOnChain: false,
    simulated: true,
  } as const;
}
