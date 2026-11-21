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

// Each probe embeds the example body as a string literal. These read that literal back.
const decodeRustString = (literal: string): string =>
  literal.slice(1, -1).replace(/\\(u\{([0-9a-fA-F]+)\}|[\\"nrt0])/g, (_, esc: string, hex?: string) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : ({ n: '\n', r: '\r', t: '\t', '0': '\0' } as Record<string, string>)[esc] ?? esc);

const probeBodies = (svc: ServiceManifest, ep: ServiceEndpoint): Record<string, string | undefined> => ({
  ts: buildTsSnippet(svc, ep).match(/^\s*body: (".*"),$/m)?.[1],
  python: buildPythonSnippet(svc, ep).match(/^BODY = (".*")$/m)?.[1],
  go: buildGoSnippet(svc, ep).match(/strings\.NewReader\((".*")\)/)?.[1],
  rust: buildRustSnippet(svc, ep).match(/\.body\((".*")\)/)?.[1],
});

const sentBody = (language: string, literal: string): string =>
  language === 'rust' ? decodeRustString(literal) : JSON.parse(literal);

test('POST probes send the example request body in every language', () => {
  const body = { text: 'it\'s "quoted"\nline two', n: 0, nested: [1, { a: null }], emoji: 'ü✓' };
  const ep = endpoint({ method: 'POST', example_request: { body } });
  for (const [language, literal] of Object.entries(probeBodies(service(), ep))) {
    assert.ok(literal, `${language} probe sends a body`);
    assert.deepEqual(JSON.parse(sentBody(language, literal)), body, `${language} body round-trips`);
  }
});

test('falsy example bodies are still sent', () => {
  for (const body of [0, false, null, '']) {
    const ep = endpoint({ method: 'POST', example_request: { body } });
    for (const [language, literal] of Object.entries(probeBodies(service(), ep))) {
      assert.ok(literal, `${language} sends ${JSON.stringify(body)}`);
      assert.equal(sentBody(language, literal), JSON.stringify(body), `${language} body for ${JSON.stringify(body)}`);
    }
  }
});

test('GET probes and endpoints without an example body send no body', () => {
  const withoutBody = [
    endpoint({ method: 'GET', example_request: { body: { ignored: true } } }),
    endpoint({ method: 'POST' }),
    endpoint({ method: 'POST', example_request: { query: { q: 'x' } } }),
  ];
  for (const ep of withoutBody) {
    for (const [language, literal] of Object.entries(probeBodies(service(), ep))) {
      assert.equal(literal, undefined, `${language} ${ep.method} sends no body`);
    }
    assert.doesNotMatch(buildGoSnippet(service(), ep), /"strings"/, 'Go imports only what it uses');
    for (const build of Object.values(builders)) {
      assert.doesNotMatch(build(service(), ep), /Content-Type/i);
    }
  }
});

test('probes send example headers and a JSON content type with the body', () => {
  const ep = endpoint({ method: 'POST', example_request: { headers: { 'X-Api-Version': '2' }, body: { q: 1 } } });
  assert.match(buildTsSnippet(service(), ep), /headers: \{"X-Api-Version":"2","Content-Type":"application\/json"\}/);
  assert.match(buildPythonSnippet(service(), ep), /^HEADERS = \{"X-Api-Version": "2", "Content-Type": "application\/json"\}$/m);
  assert.match(buildGoSnippet(service(), ep), /req\.Header\.Set\("X-Api-Version", "2"\)\n\treq\.Header\.Set\("Content-Type", "application\/json"\)/);
  assert.match(buildRustSnippet(service(), ep), /\.header\("X-Api-Version", "2"\)\n\s*\.header\("Content-Type", "application\/json"\)/);
});

test('an example Content-Type header is kept instead of being duplicated', () => {
  const ep = endpoint({
    method: 'PUT',
    example_request: { headers: { 'content-type': 'application/json; charset=utf-8' }, body: { q: 1 } },
  });
  for (const [language, build] of Object.entries(builders)) {
    const code = build(service(), ep);
    assert.equal(code.match(/content-type/gi)?.length, 1, `${language} sets one content type`);
    assert.match(code, /application\/json; charset=utf-8/, `${language} keeps the example value`);
  }
});

test('example headers on GET probes are sent without a content type', () => {
  const ep = endpoint({ example_request: { headers: { Authorization: 'Bearer "demo"' } } });
  assert.match(buildTsSnippet(service(), ep), /headers: \{"Authorization":"Bearer \\"demo\\""\}/);
  assert.match(buildPythonSnippet(service(), ep), /^HEADERS = \{"Authorization": "Bearer \\"demo\\""\}$/m);
  assert.match(buildGoSnippet(service(), ep), /req\.Header\.Set\("Authorization", "Bearer \\"demo\\""\)/);
  assert.match(buildRustSnippet(service(), ep), /\.header\("Authorization", "Bearer \\"demo\\""\)/);
});

test('every bundled sample endpoint with an example body sends it from all four probes', () => {
  let checked = 0;
  for (const svc of INITIAL_SERVICES) {
    for (const ep of svc.endpoints) {
      if (ep.method === 'GET' || ep.example_request?.body === undefined) continue;
      checked++;
      for (const [language, literal] of Object.entries(probeBodies(svc, ep))) {
        assert.ok(literal, `${svc.name} ${ep.path} ${language}`);
        assert.deepEqual(JSON.parse(sentBody(language, literal)), ep.example_request.body, `${svc.name} ${ep.path} ${language}`);
      }
    }
  }
  assert.ok(checked > 0, 'sample catalog has POST examples');
});
