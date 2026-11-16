import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignedEIP3009Payload, type BuildEIP3009Params } from '../src/lib/eip3009.js';

const address = ('0x' + '11'.repeat(20)) as `0x${string}`;
const signature = ('0x' + '22'.repeat(64) + '1b') as `0x${string}`;

test('payment network must be a canonical CAIP identifier before signing', async () => {
  let signed = false;
  const params: BuildEIP3009Params = {
    fromAddress: address, payToAddress: address, assetAddress: address,
    amountUnits: '1', network: 'mainnet',
    signTypedDataFn: async () => { signed = true; return signature; },
  };
  for (const network of ['mainnet', 'testnet']) {
    await assert.rejects(createSignedEIP3009Payload({ ...params, network }), /Unsupported payment network/);
  }
  assert.equal(signed, false);
});
