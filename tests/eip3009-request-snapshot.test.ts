import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignedEIP3009Payload, type BuildEIP3009Params } from '../src/lib/eip3009.js';
const address = ('0x' + '11'.repeat(20)) as `0x${string}`;
const other = ('0x' + '33'.repeat(20)) as `0x${string}`;
const signature = ('0x' + '22'.repeat(64) + '1b') as `0x${string}`;
type SigningInput = Parameters<BuildEIP3009Params['signTypedDataFn']>[0];
function params(): BuildEIP3009Params {
  return { fromAddress: address, payToAddress: address, assetAddress: address,
    amountUnits: '1', network: 'eip155:2368', signTypedDataFn: async () => signature };
}

test('pending signing keeps returned authorization bound to the original request', async () => {
  let release!: (value: `0x${string}`) => void;
  let signed!: SigningInput;
  const input = params();
  input.signTypedDataFn = request => { signed = request; return new Promise(resolve => { release = resolve; }); };
  const pending = createSignedEIP3009Payload(input);
  // 签名适配器尚未返回，调用方复用参数对象；返回头仍须对应已交给签名器的数据。
  input.fromAddress = other; input.payToAddress = other; input.amountUnits = '9';
  input.network = 'eip155:2366'; input.assetAddress = other;
  release(signature);
  const result = await pending;
  assert.equal(result.payload.network, 'eip155:2368');
  assert.equal(result.payload.authorization.from, signed.message.from);
  assert.equal(result.payload.authorization.to, signed.message.to);
  assert.equal(result.payload.authorization.value, signed.message.value.toString());
  assert.deepEqual(JSON.parse(Buffer.from(result.base64Header, 'base64').toString('utf8')), result.payload);
});

test('supported parameter getters are not reread across validation and signing', async () => {
  const original = params();
  const reads = new Map<string, number>();
  const input = {} as BuildEIP3009Params;
  for (const key of Object.keys(original) as (keyof BuildEIP3009Params)[]) {
    Object.defineProperty(input, key, { enumerable: true, get() {
      reads.set(key, (reads.get(key) ?? 0) + 1); return original[key];
    } });
  }
  assert.equal((await createSignedEIP3009Payload(input)).payload.authorization.value, '1');
  assert.deepEqual([...reads.values()], [1, 1, 1, 1, 1, 1]);
});

test('prototype-backed parameters retain their supported values and adapter receiver', async () => {
  const original = params();
  const input = Object.create(original) as BuildEIP3009Params;
  input.signTypedDataFn = async function () { assert.equal(this, input); return signature; };
  assert.equal((await createSignedEIP3009Payload(input)).payload.authorization.from, address);
});

test('a rejected signer is propagated without a second signing attempt', async () => {
  const input = params(); let calls = 0;
  input.signTypedDataFn = async () => { calls++; throw new Error('fixture rejected'); };
  await assert.rejects(createSignedEIP3009Payload(input), /fixture rejected/);
  assert.equal(calls, 1);
});
