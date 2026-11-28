import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeSignature, verifyTypedData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSignedEIP3009Payload, EIP3009_TYPES } from '../src/lib/eip3009.ts';
import { KITE_MAINNET, KITE_TESTNET, type KiteChainConfig } from '../src/types/kite.ts';
import type { PaymentSignatureHeaderPayload } from '../src/types/x402.ts';

const recipient = '0x2222222222222222222222222222222222222222';
const otherRecipient = '0x3333333333333333333333333333333333333333';
const amountUnits = '1000000000000001';

function offlineSigner(chain = KITE_TESTNET) {
  const account = privateKeyToAccount(generatePrivateKey());
  const sign = async () => {
    const {base64Header, payload} = await createSignedEIP3009Payload({
      fromAddress: account.address,
      payToAddress: recipient,
      amountUnits,
      network: chain.network,
      assetAddress: chain.assetAddress,
      signTypedDataFn: account.signTypedData,
    });
    const decoded = JSON.parse(Buffer.from(base64Header, 'base64').toString('utf8')) as PaymentSignatureHeaderPayload;
    assert.deepEqual(decoded, payload);
    assert.equal(decoded.network, chain.network);
    return decoded.authorization;
  };

  // Verify the serialized header using the recipient's expected chain and contract.
  const verify = (
    authorization: PaymentSignatureHeaderPayload['authorization'],
    domain: KiteChainConfig['eip712Domain'] = chain.eip712Domain,
  ) => {
    const {from, to, value, validAfter, validBefore, nonce, r, s, v} = authorization;
    return verifyTypedData({
      address: account.address,
      domain,
      types: EIP3009_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {from, to, value: BigInt(value), validAfter: BigInt(validAfter), validBefore: BigInt(validBefore), nonce},
      signature: serializeSignature({r, s, v: BigInt(v)}),
    });
  };
  return {sign, verify};
}

test('offline authorization is valid only for the signed chain and token contract', async () => {
  for (const [chain, otherChain] of [[KITE_TESTNET, KITE_MAINNET], [KITE_MAINNET, KITE_TESTNET]]) {
    const {sign, verify} = offlineSigner(chain);
    const authorization = await sign();
    assert.equal(await verify(authorization), true);
    assert.equal(await verify(authorization, {...chain.eip712Domain, chainId: otherChain.chainId}), false);
    assert.equal(await verify(authorization, {...chain.eip712Domain, verifyingContract: otherChain.assetAddress}), false);
  }
});

test('offline authorization uses a fresh nonce for each signature', async () => {
  const {sign, verify} = offlineSigner();
  const first = await sign();
  const second = await sign();
  assert.match(first.nonce, /^0x[0-9a-f]{64}$/);
  assert.match(second.nonce, /^0x[0-9a-f]{64}$/);
  assert.notEqual(first.nonce, second.nonce);
  assert.equal(await verify(first), true);
  assert.equal(await verify(second), true);
  assert.equal(await verify({...first, nonce: second.nonce}), false);
});

test('offline authorization signs a one-hour deadline that cannot be extended', async (t) => {
  const issuedAt = 1_790_000_000;
  t.mock.method(Date, 'now', () => issuedAt * 1000 + 999);
  const {sign, verify} = offlineSigner();
  const authorization = await sign();
  assert.equal(authorization.validAfter, 0);
  assert.equal(authorization.validBefore, issuedAt + 3600);
  assert.equal(await verify(authorization), true);
  assert.equal(await verify({...authorization, validBefore: authorization.validBefore + 1}), false);
  assert.equal(await verify({...authorization, validAfter: issuedAt}), false);
});

test('offline authorization rejects a changed payee or amount', async () => {
  const {sign, verify} = offlineSigner();
  const authorization = await sign();
  assert.equal(authorization.to, recipient);
  assert.equal(authorization.value, amountUnits);
  assert.equal(await verify(authorization), true);
  assert.equal(await verify({...authorization, to: otherRecipient}), false);
  assert.equal(await verify({...authorization, value: (BigInt(amountUnits) + 1n).toString()}), false);
});
