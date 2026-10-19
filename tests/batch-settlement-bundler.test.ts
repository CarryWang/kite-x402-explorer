import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashReceipt,
  computeReceiptMerkleRoot,
  calculateNetBalances,
  resolveBilateralNetTransfers,
  computeAmortizedGasSavings,
  createSettlementBundle,
  generateReceiptProof,
  verifyReceiptInclusionProof,
  executeSettlementBundle,
  type BundledReceipt,
} from '../src/lib/batch-settlement-bundler.js';

const TEST_TOKEN = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const AGENT_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as `0x${string}`;
const AGENT_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as `0x${string}`;
const AGENT_C = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as `0x${string}`;

function makeMockReceipt(override?: Partial<BundledReceipt>): BundledReceipt {
  return {
    receiptId: override?.receiptId || 'rcpt-001',
    payer: override?.payer || AGENT_A,
    recipient: override?.recipient || AGENT_B,
    tokenAddress: override?.tokenAddress || TEST_TOKEN,
    amount: override?.amount !== undefined ? override.amount : 1000000n, // 1 USDC
    nonce: override?.nonce || '0x0000000000000000000000000000000000000000000000000000000000000001',
    signature:
      override?.signature ||
      '0x3045022100e4785dbd80bb9f8b000000000000000000000000000000000000000000000000022066c6b3e400000000000000000000000000000000000000000000000000000001',
    timestamp: override?.timestamp || 1700000000000,
  };
}

test('hashReceipt validates address formats and strictly positive amounts', () => {
  const valid = makeMockReceipt();
  const hash = hashReceipt(valid);
  assert.match(hash, /^0x[a-f0-9]{64}$/i);

  assert.throws(
    () => hashReceipt(makeMockReceipt({ payer: 'invalid-address' as `0x${string}` })),
    /Invalid payer address/
  );
  assert.throws(
    () => hashReceipt(makeMockReceipt({ recipient: 'not-an-address' as `0x${string}` })),
    /Invalid recipient address/
  );
  assert.throws(
    () => hashReceipt(makeMockReceipt({ amount: 0n })),
    /Payment amount must be strictly positive/
  );
  assert.throws(
    () => hashReceipt(makeMockReceipt({ amount: -500n })),
    /Payment amount must be strictly positive/
  );
  assert.throws(
    () => hashReceipt(makeMockReceipt({ nonce: '123' as `0x${string}` })),
    /Invalid receipt nonce format/
  );
});

test('computeReceiptMerkleRoot calculates root deterministically', () => {
  const r1 = hashReceipt(makeMockReceipt({ receiptId: '1', nonce: '0x01' }));
  const r2 = hashReceipt(makeMockReceipt({ receiptId: '2', nonce: '0x02' }));
  const r3 = hashReceipt(makeMockReceipt({ receiptId: '3', nonce: '0x03' }));

  const root1 = computeReceiptMerkleRoot([r1, r2, r3]);
  const root2 = computeReceiptMerkleRoot([r1, r2, r3]);
  assert.equal(root1, root2);
  assert.match(root1, /^0x[a-f0-9]{64}$/i);

  assert.throws(() => computeReceiptMerkleRoot([]), /empty receipt list/);
});

test('calculateNetBalances and resolveBilateralNetTransfers compute accurate settlements', () => {
  // Agent A pays Agent B 10 USDC
  // Agent B pays Agent A 4 USDC
  // Agent B pays Agent C 3 USDC
  const receipts: BundledReceipt[] = [
    makeMockReceipt({ receiptId: 'r1', payer: AGENT_A, recipient: AGENT_B, amount: 10n, nonce: '0x01' }),
    makeMockReceipt({ receiptId: 'r2', payer: AGENT_B, recipient: AGENT_A, amount: 4n, nonce: '0x02' }),
    makeMockReceipt({ receiptId: 'r3', payer: AGENT_B, recipient: AGENT_C, amount: 3n, nonce: '0x03' }),
  ];

  const netMap = calculateNetBalances(receipts);

  // Agent A: sent 10, received 4 => net -6
  const summaryA = netMap.get(AGENT_A.toLowerCase())!;
  assert.equal(summaryA.netAmount, -6n);
  assert.equal(summaryA.totalSent, 10n);
  assert.equal(summaryA.totalReceived, 4n);

  // Agent B: sent 7, received 10 => net +3
  const summaryB = netMap.get(AGENT_B.toLowerCase())!;
  assert.equal(summaryB.netAmount, 3n);

  // Agent C: sent 0, received 3 => net +3
  const summaryC = netMap.get(AGENT_C.toLowerCase())!;
  assert.equal(summaryC.netAmount, 3n);

  // Net transfers should collapse to:
  // Agent A pays Agent B 3, Agent A pays Agent C 3 (total 2 transactions instead of 3)
  const transfers = resolveBilateralNetTransfers(netMap);
  assert.equal(transfers.length, 2);
  const totalNetSettled = transfers.reduce((sum, t) => sum + t.amount, 0n);
  assert.equal(totalNetSettled, 6n);
});

test('computeAmortizedGasSavings calculates gas efficiency gains', () => {
  const savings = computeAmortizedGasSavings(100, 5);
  assert.equal(savings.individualTxEstimatedGas, 100n * (21000n + 65000n));
  assert.ok(savings.gasSavedWei > 0n);
  assert.ok(savings.savingsPercentage > 70); // Greater than 70% gas reduction
});

test('createSettlementBundle enforces validations and aggregates properties', () => {
  const receipts: BundledReceipt[] = [
    makeMockReceipt({ receiptId: 'r1', payer: AGENT_A, recipient: AGENT_B, amount: 100n, nonce: '0x01' }),
    makeMockReceipt({ receiptId: 'r2', payer: AGENT_B, recipient: AGENT_C, amount: 200n, nonce: '0x02' }),
  ];

  const bundle = createSettlementBundle({
    bundleId: 'bundle-20261019-01',
    tokenAddress: TEST_TOKEN,
    receipts,
  });

  assert.equal(bundle.bundleId, 'bundle-20261019-01');
  assert.equal(bundle.receiptCount, 2);
  assert.equal(bundle.totalVolume, 300n);
  assert.equal(bundle.status, 'pending');
  assert.match(bundle.merkleRoot, /^0x[a-f0-9]{64}$/i);

  // Rejects duplicate nonces from same payer
  assert.throws(
    () =>
      createSettlementBundle({
        bundleId: 'bundle-bad',
        tokenAddress: TEST_TOKEN,
        receipts: [
          makeMockReceipt({ receiptId: 'r1', payer: AGENT_A, nonce: '0x01' }),
          makeMockReceipt({ receiptId: 'r2', payer: AGENT_A, nonce: '0x01' }),
        ],
      }),
    /Duplicate nonce detected/
  );

  // Rejects token mismatch
  assert.throws(
    () =>
      createSettlementBundle({
        bundleId: 'bundle-mismatch',
        tokenAddress: TEST_TOKEN,
        receipts: [
          makeMockReceipt({
            receiptId: 'r1',
            tokenAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
          }),
        ],
      }),
    /Token mismatch/
  );
});

test('generateReceiptProof and verifyReceiptInclusionProof verify valid membership', () => {
  const receipts: BundledReceipt[] = [
    makeMockReceipt({ receiptId: 'r1', nonce: '0x01' }),
    makeMockReceipt({ receiptId: 'r2', nonce: '0x02' }),
    makeMockReceipt({ receiptId: 'r3', nonce: '0x03' }),
    makeMockReceipt({ receiptId: 'r4', nonce: '0x04' }),
  ];

  const bundle = createSettlementBundle({
    bundleId: 'proof-bundle',
    tokenAddress: TEST_TOKEN,
    receipts,
  });

  const proof = generateReceiptProof('r2', bundle);
  assert.equal(proof.receiptId, 'r2');
  assert.equal(proof.leafIndex, 1);
  assert.equal(verifyReceiptInclusionProof(proof), true);

  // Tampered proof should fail verification
  const fakeProof = {
    ...proof,
    merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  };
  assert.equal(verifyReceiptInclusionProof(fakeProof), false);
});

test('executeSettlementBundle performs transition and prevents replay attacks', () => {
  const receipts: BundledReceipt[] = [
    makeMockReceipt({ receiptId: 'r1', payer: AGENT_A, nonce: '0x01' }),
    makeMockReceipt({ receiptId: 'r2', payer: AGENT_B, nonce: '0x02' }),
  ];

  const bundle = createSettlementBundle({
    bundleId: 'settle-bundle',
    tokenAddress: TEST_TOKEN,
    receipts,
  });

  const registry = new Set<string>();
  const dummyTxHash =
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

  const { settledBundle, newlySettledNonces } = executeSettlementBundle(
    bundle,
    dummyTxHash,
    registry
  );

  assert.equal(settledBundle.status, 'settled');
  assert.equal(settledBundle.settlementTxHash, dummyTxHash);
  assert.equal(newlySettledNonces.length, 2);

  // Add nonces to registry
  for (const n of newlySettledNonces) {
    registry.add(n);
  }

  // Attempting to settle another bundle with an identical nonce must be rejected
  const replayBundle = createSettlementBundle({
    bundleId: 'replay-bundle',
    tokenAddress: TEST_TOKEN,
    receipts: [makeMockReceipt({ receiptId: 'r3', payer: AGENT_A, nonce: '0x01' })],
  });

  assert.throws(
    () => executeSettlementBundle(replayBundle, dummyTxHash, registry),
    /Settlement replay detected/
  );
});
