import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoSnippet,
  buildPythonSnippet,
  buildRustSnippet,
  buildTsSnippet,
  snippetContext,
} from '../src/lib/client-snippets.js';
import { INITIAL_SERVICES } from '../src/services/sample-services.js';
import type { ServiceEndpoint, ServiceManifest } from '../src/types/service.js';

const builders = {
  ts: buildTsSnippet,
  python: buildPythonSnippet,
  go: buildGoSnippet,
  rust: buildRustSnippet,
};

const service = (overrides: Partial<ServiceManifest> = {}): ServiceManifest => ({
  schema: 1,
  name: 'demo-service',
  display_name: 'Demo Service',
  description: 'A demo service used by the snippet tests.',
  maintainer: { github: 'demo' },
  status: 'testnet',
  base_url: 'https://demo.sandbox.gokite.ai',
  network: 'eip155:2368',
  pay_to: '0x1111111111111111111111111111111111111111',
  upstream: { name: 'demo', url: 'https://example.com' },
  endpoints: [],
  categories: ['other'],
  ...overrides,
});

const endpoint = (overrides: Partial<ServiceEndpoint> = {}): ServiceEndpoint => ({
  method: 'GET',
  path: '/v1/demo',
  summary: 'Demo endpoint for tests',
  price_usd: '0.001',
  ...overrides,
});

test('snippet context follows the service network and endpoint example', () => {
  const testnet = snippetContext(service(), endpoint({ example_request: { query: { q: 'a b' } } }));
  assert.equal(testnet.fullUrl, 'https://demo.sandbox.gokite.ai/v1/demo');
  assert.equal(testnet.queryParams, '?q=a+b');
  assert.equal(testnet.chainId, 2368);
  assert.equal(testnet.tokenSymbol, 'pieUSD');
  assert.equal(testnet.isTestnet, true);

  const mainnet = snippetContext(service({ network: 'eip155:2366', status: 'live' }), endpoint());
  assert.equal(mainnet.chainId, 2366);
  assert.equal(mainnet.tokenSymbol, 'USDC.e');
  assert.equal(mainnet.queryParams, '');
});

test('snippet context uses a placeholder host for services without base_url', () => {
  const { fullUrl } = snippetContext(service({ base_url: undefined, status: 'draft' }), endpoint());
  assert.equal(fullUrl, 'https://your-host/v1/demo');
});

test('every language snippet targets the endpoint URL, method and network', () => {
  const svc = service();
  const ep = endpoint({ method: 'POST', example_request: { query: { lang: 'en' } } });
  for (const [language, build] of Object.entries(builders)) {
    const code = build(svc, ep);
    assert.match(code, /https:\/\/demo\.sandbox\.gokite\.ai\/v1\/demo\?lang=en/, `${language} url`);
    assert.match(code, /PAYMENT-REQUIRED/, `${language} challenge header`);
    assert.doesNotMatch(code, /PAYMENT-SIGNATURE|Settled/, `${language} only discovers the challenge over HTTP`);
  }
  assert.match(buildTsSnippet(svc, ep), /method: "POST"/);
  assert.match(buildPythonSnippet(svc, ep), /requests\.post\(/);
  assert.match(buildGoSnippet(svc, ep), /NewRequest\("POST"/);
  assert.match(buildRustSnippet(svc, ep), /\.post\(target\)/);
});

test('TS and Python snippets use the token name and version of the service network', () => {
  const testnet = service();
  const mainnet = service({ network: 'eip155:2366', status: 'live' });
  assert.match(buildTsSnippet(testnet, endpoint()), /name: "pieUSD"[\s\S]*version: "1"[\s\S]*chainId: 2368/);
  assert.match(buildTsSnippet(mainnet, endpoint()), /name: "Bridged USDC \(Kite AI\)"[\s\S]*version: "2"[\s\S]*chainId: 2366/);
  assert.match(buildPythonSnippet(testnet, endpoint()), /CHAIN_ID = 2368/);
  assert.match(buildPythonSnippet(mainnet, endpoint()), /CHAIN_ID = 2366/);
});

test('every bundled sample service renders all four snippets without unresolved placeholders', () => {
  assert.ok(INITIAL_SERVICES.length > 0);
  for (const svc of INITIAL_SERVICES) {
    for (const ep of svc.endpoints) {
      for (const [language, build] of Object.entries(builders)) {
        const code = build(svc, ep);
        assert.ok(code.length > 200, `${svc.name} ${ep.path} ${language} is not empty`);
        assert.doesNotMatch(code, /undefined|\[object Object\]/, `${svc.name} ${ep.path} ${language}`);
        assert.ok(code.includes(ep.path), `${svc.name} ${language} mentions ${ep.path}`);
      }
    }
  }
});

const EIP3009_FIELDS = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'];

test('TS snippet signs against an explicitly approved Kite token', () => {
  const svc = service();
  const code = buildTsSnippet(svc, endpoint());
  assert.match(code, /verifyingContract:\s*approved\.asset/);
  assert.match(code, /approved\.asset\.toLowerCase\(\) !== "0x38129cf4ce5e183eff248f42a7d345bb1b47621a"/);
  assert.match(code, /approved\.amount <= 0n/);
  assert.doesNotMatch(code, /accepts\[0\]|AGENT_PRIVATE_KEY/);
  assert.equal(code.includes(`verifyingContract: "${svc.pay_to}"`), false);
});

test('Python snippet signs against an explicitly approved Kite token', () => {
  const code = buildPythonSnippet(service(), endpoint());
  assert.match(code, /"verifyingContract":\s*asset/);
  assert.match(code, /asset\.lower\(\) != "0x38129cf4ce5e183eff248f42a7d345bb1b47621a"/);
  assert.match(code, /0 < amount < 2\*\*256/);
  assert.doesNotMatch(code, /AGENT_PRIVATE_KEY|challenge\["accepts"\]/);
});

test('TS snippet types TransferWithAuthorization with exactly the six EIP-3009 fields', () => {
  const code = buildTsSnippet(service(), endpoint());
  const block = code.match(/TransferWithAuthorization:\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'typed-data definition is present');
  const names = [...block[1].matchAll(/name:\s*'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(names, EIP3009_FIELDS);
});

test('Python snippet types TransferWithAuthorization with exactly the six EIP-3009 fields', () => {
  const code = buildPythonSnippet(service(), endpoint());
  const block = code.match(/"TransferWithAuthorization":\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'typed-data definition is present');
  const names = [...block[1].matchAll(/"name":\s*"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(names, EIP3009_FIELDS);
});

test('no bundled sample service produces a snippet that uses pay_to as the verifying contract', () => {
  for (const svc of INITIAL_SERVICES) {
    for (const ep of svc.endpoints) {
      for (const code of [buildTsSnippet(svc, ep), buildPythonSnippet(svc, ep)]) {
        assert.equal(code.includes(`verifyingContract: "${svc.pay_to}"`), false, `${svc.name} ${ep.path}`);
      }
    }
  }
});

test('client snippets omit the query delimiter for an empty map', () => {
  const ep = endpoint({ example_request: { query: {} } });
  for (const build of Object.values(builders)) {
    assert.match(build(service(), ep), /demo\.sandbox\.gokite\.ai\/v1\/demo"/);
  }
});

test('snippet context keeps blank and reserved-character query values', () => {
  const { queryParams } = snippetContext(service(), endpoint({
    example_request: { query: { blank: '', search: 'a+b & 中文' } },
  }));
  assert.equal(queryParams, '?blank=&search=a%2Bb+%26+%E4%B8%AD%E6%96%87');
});
