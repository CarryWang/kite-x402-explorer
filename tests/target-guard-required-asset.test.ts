import assert from 'node:assert/strict';
import test from 'node:test';
import { auditX402ChallengeTarget, assertSafeSigningTarget } from '../src/lib/target-guard.js';
import { KITE_CHAINS } from '../src/types/kite.js';
import type { X402AcceptOption } from '../src/types/x402.js';
const recipient = ('0x' + '11'.repeat(20)) as `0x${string}`;
function challenge(network = 'eip155:2368'): X402AcceptOption {
  return { scheme: 'exact', network, asset: KITE_CHAINS[network]!.assetAddress, amount: '1', payTo: recipient, maxTimeoutSeconds: 60 };
}

for (const asset of ['', undefined, null, 42, {}, '0x123']) {
  test(`malformed asset ${JSON.stringify(asset)} produces an unsafe verdict`, () => {
    const verdict = auditX402ChallengeTarget({ ...challenge(), asset } as unknown as X402AcceptOption);
    assert.equal(verdict.isSafe, false);
    assert.ok(verdict.violations.some(v => v.code === 'INVALID_ASSET_CONTRACT'));
  });
}
for (const network of ['eip155:2368', 'eip155:2366']) {
  test(`official ${network} assets retain case-insensitive matching`, () => {
    const input = challenge(network);
    input.asset = ('0x' + input.asset.slice(2).toUpperCase()) as `0x${string}`;
    assert.equal(auditX402ChallengeTarget(input).isSafe, true);
  });
}
test('the signing guard rejects an empty asset before allowing sandbox signing', () => {
  // 这里只检验策略拒绝，不调用钱包，也不把本地演示记成真实付款。
  assert.throws(() => assertSafeSigningTarget({ ...challenge(), asset: '' } as unknown as X402AcceptOption,
    recipient, 'eip155:2368', 'sandbox', 'server'), /Asset token contract mismatch/);
});
