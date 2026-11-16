import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { generateRandomNonce, createSignedEIP3009Payload, splitSignature, type BuildEIP3009Params } from '../src/lib/eip3009.js';
const address = ('0x' + '11'.repeat(20)) as `0x${string}`;
const signature = ('0x' + '22'.repeat(64) + '1b') as `0x${string}`;
type SignedInput = Parameters<BuildEIP3009Params['signTypedDataFn']>[0];
let calls: SignedInput[] = [];
const params = (): BuildEIP3009Params => ({ fromAddress: address, payToAddress: address, assetAddress: address, amountUnits: '1', network: 'eip155:2368', signTypedDataFn: async input => { calls.push(input); return signature; } });
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const replaceCrypto = (value: unknown) => Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
beforeEach(() => { calls = []; });
afterEach(() => { if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto); else Reflect.deleteProperty(globalThis, 'crypto'); });

test('unsupported and inherited network keys are rejected before requesting a signature', async () => {
  for (const network of ['eip155:1', 'unknown', '__proto__']) {
    await assert.rejects(createSignedEIP3009Payload({ ...params(), network }), /Unsupported/);
  }
  assert.equal(calls.length, 0);
});

test('missing secure randomness stops payment authorization', async () => {
  for (const value of [undefined, {}]) {
    replaceCrypto(value);
    assert.throws(() => generateRandomNonce(), /Secure randomness/);
    await assert.rejects(createSignedEIP3009Payload(params()), /Secure randomness/);
  }
  assert.equal(calls.length, 0);
});

test('exactly 32 bytes are generated and domain chain ID matches the network', async () => {
  const lengths: number[] = [];
  replaceCrypto({ getRandomValues: (bytes: Uint8Array) => { lengths.push(bytes.length); return bytes.fill(0xab); } });
  const result = await createSignedEIP3009Payload({ ...params(), network: 'eip155:2366' });
  assert.deepEqual(lengths, [32]);
  assert.equal(result.payload.network, 'eip155:2366');
  assert.equal(calls[0]!.domain.chainId, 2366);
  assert.equal(calls[0]!.message.nonce, '0x' + 'ab'.repeat(32));
  assert.equal(calls[0]!.message.value, 1n);
});

test('malformed addresses and amount bounds are rejected before requesting a signature', async () => {
  for (const amountUnits of ['0', '-1', '1.5', '01', '1e6', (2n ** 256n).toString()]) {
    await assert.rejects(createSignedEIP3009Payload({ ...params(), amountUnits }), /uint256/);
  }
  await assert.rejects(createSignedEIP3009Payload({ ...params(), payToAddress: '0x123' }), /addresses/);
  assert.equal(calls.length, 0);
});

test('signature encoding, length and recovery values are checked', () => {
  for (const value of ['0x', '0x' + 'gg'.repeat(65), signature.slice(0, -2), signature + '00', signature.slice(0, -2) + 'ff']) {
    assert.throws(() => splitSignature(value as `0x${string}`));
  }
  assert.equal(splitSignature((signature.slice(0, -2) + '00') as `0x${string}`).v, 27);
  assert.equal(splitSignature((signature.slice(0, -2) + '01') as `0x${string}`).v, 28);
});
