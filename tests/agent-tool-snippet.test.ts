import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { buildAgentToolSnippet } from '../src/lib/agent-tool-snippet.js';
import { INITIAL_SERVICES } from '../src/services/sample-services.js';
import type { ServiceEndpoint, ServiceManifest } from '../src/types/service.js';

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

interface AgentTool {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, unknown> };
  execute: (args: Record<string, string>) => Promise<Record<string, unknown>>;
}

interface Call {
  url: string;
  init: RequestInit;
}

/** Compiles the generated snippet and loads it as a module. Its fetch calls go to `respond`. */
async function loadTool(code: string, respond: () => Response): Promise<{ tool: AgentTool; calls: Call[] }> {
  const diagnostics: string[] = [];
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  for (const d of js.diagnostics ?? []) diagnostics.push(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  assert.deepEqual(diagnostics, [], 'snippet is valid TypeScript');

  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js.outputText).toString('base64')}`);
  return { tool: Object.values(mod)[0] as AgentTool, calls };
}

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const challenge = {
  x402Version: 2,
  resource: { url: 'https://demo.sandbox.gokite.ai/v1/demo', description: '巴西天气 · São Paulo' },
  accepts: [{ scheme: 'exact', network: 'eip155:2368', amount: '1000000000000000', payTo: '0x1111111111111111111111111111111111111111' }],
};
const paymentRequired = () =>
  new Response('{}', {
    status: 402,
    headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge), 'utf8').toString('base64') },
  });

test('agent tool calls only code it defines and returns the decoded 402 terms', async () => {
  const ep = endpoint({ example_request: { query: { city: 'Lisbon' } } });
  const { tool, calls } = await loadTool(buildAgentToolSnippet(service(), ep), paymentRequired);

  assert.equal(tool.name, 'demo_service');
  assert.deepEqual(Object.keys(tool.parameters.properties), ['city']);

  const result = await tool.execute({ city: 'São Paulo' });
  assert.deepEqual(result, { status: 402, paymentRequired: challenge });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://demo.sandbox.gokite.ai/v1/demo?city=S%C3%A3o+Paulo');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'error');
});

test('agent tool never signs or pays', () => {
  const code = buildAgentToolSnippet(service(), endpoint());
  assert.doesNotMatch(code, /AutoPayment|signTypedData|privateKey|PRIVATE_KEY/i);
  assert.doesNotMatch(code, /headers:\s*\{[^}]*PAYMENT-SIGNATURE/);
});

test('agent tool sends JSON-object bodies for POST endpoints', async () => {
  const ep = endpoint({ method: 'POST', example_request: { body: { prompt: 'hi', lang: 'en' } } });
  const { tool, calls } = await loadTool(buildAgentToolSnippet(service(), ep), () => new Response('{"ok":true}', { status: 200 }));

  assert.deepEqual(Object.keys(tool.parameters.properties), ['prompt', 'lang']);
  const result = await tool.execute({ prompt: 'hello', lang: 'pt' });
  assert.deepEqual(result, { status: 200, body: '{"ok":true}' });
  assert.equal(calls[0].url, 'https://demo.sandbox.gokite.ai/v1/demo');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ prompt: 'hello', lang: 'pt' }));
});

test('agent tool without example parameters declares none', async () => {
  const { tool, calls } = await loadTool(buildAgentToolSnippet(service(), endpoint()), paymentRequired);
  assert.deepEqual(tool.parameters.properties, {});
  await tool.execute({});
  assert.equal(calls[0].url, 'https://demo.sandbox.gokite.ai/v1/demo');
});

test('agent tool reports a malformed or missing PAYMENT-REQUIRED header instead of throwing', async () => {
  const bad = await loadTool(buildAgentToolSnippet(service(), endpoint()), () =>
    new Response('', { status: 402, headers: { 'PAYMENT-REQUIRED': 'not base64 json' } }),
  );
  assert.equal((await bad.tool.execute({})).error, 'PAYMENT-REQUIRED header is not base64 JSON');

  const missing = await loadTool(buildAgentToolSnippet(service(), endpoint()), () => new Response('', { status: 402 }));
  assert.equal((await missing.tool.execute({})).error, '402 response without a PAYMENT-REQUIRED header');
});

test('every bundled sample endpoint renders a runnable agent tool', async () => {
  for (const svc of INITIAL_SERVICES) {
    for (const ep of svc.endpoints) {
      const code = buildAgentToolSnippet(svc, ep);
      assert.doesNotMatch(code, /undefined|\[object Object\]/, `${svc.name} ${ep.path}`);
      const { tool } = await loadTool(code, paymentRequired);
      const result = await tool.execute({});
      assert.equal(result.status, 402, `${svc.name} ${ep.path}`);
    }
  }
});
