import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePaymentRequiredHeader } from '../src/lib/x402-decoder.js';

// x402 SDKs base64-encode the UTF-8 bytes of the JSON challenge.
const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');

const challenge = {
  x402Version: 2,
  error: 'Payment required',
  resource: { url: 'https://api.example/weather', description: '巴西天气 · São Paulo ☀️', mimeType: 'application/json' },
  accepts: [{
    scheme: 'exact',
    network: 'eip155:2368',
    amount: '100000000000000000',
    asset: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
    payTo: '0x7ec512bAcF9F3a1EC024F9bC5AbFDA3836ADDEa9',
    maxTimeoutSeconds: 120,
    extra: { name: 'pieUSD', version: '1' },
  }],
};

test('decodes non-ASCII challenge text as UTF-8', () => {
  const decoded = decodePaymentRequiredHeader(encode(challenge));
  assert.deepEqual(decoded, challenge);
});

test('decodes an ASCII challenge unchanged', () => {
  const ascii = { ...challenge, resource: { ...challenge.resource, description: 'Weather in Sao Paulo' } };
  assert.deepEqual(decodePaymentRequiredHeader(encode(ascii)), ascii);
});

test('ignores surrounding whitespace in the header value', () => {
  assert.deepEqual(decodePaymentRequiredHeader(`  ${encode(challenge)}\n`), challenge);
});

test('returns null for headers that are not base64 JSON or not valid UTF-8', () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal(decodePaymentRequiredHeader('not base64!'), null);
    assert.equal(decodePaymentRequiredHeader(Buffer.from('not json').toString('base64')), null);
    // 0xC3 starts a two-byte UTF-8 sequence that never ends.
    assert.equal(decodePaymentRequiredHeader(Buffer.from([0x7b, 0xc3, 0x7d]).toString('base64')), null);
  } finally {
    console.error = quiet;
  }
});
