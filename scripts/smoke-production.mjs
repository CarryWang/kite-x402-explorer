import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Uses only Node built-ins so it can also run inside the production image.
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';

function request(path, options = {}) {
  return fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(2000),
  });
}

async function waitForServer() {
  let lastError;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await request('/api/health');
      assert.equal(response.status, 200);
      const health = await response.json();
      assert.equal(health.status, 'online');
      assert.equal(health.service, 'kite-x402-explorer-proxy');
      return;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw new Error(`Production server did not become healthy at ${baseUrl}`, { cause: lastError });
}

await waitForServer();

const servicesResponse = await request('/api/services');
assert.equal(servicesResponse.status, 200);
const { count, services } = await servicesResponse.json();
assert.ok(count > 0, 'The bundled service registry should be available');
assert.equal(count, services.length);

const validationResponse = await request('/api/validate-manifest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ yaml: JSON.stringify(services[0]) }),
});
assert.equal(validationResponse.status, 200);
const validation = await validationResponse.json();
assert.equal(validation.success, true, JSON.stringify(validation));

const challengeResponse = await request(`/api/mock-x402/${services[0].name}`);
assert.equal(challengeResponse.status, 402);
assert.ok(challengeResponse.headers.get('payment-required'));
await challengeResponse.text();

const pageResponse = await request('/');
assert.equal(pageResponse.status, 200);
assert.match(pageResponse.headers.get('content-type') || '', /text\/html/);
const html = await pageResponse.text();
assert.match(html, /<div id="root">/);
const scriptPath = html.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(scriptPath, 'The built page should reference a JavaScript bundle');
const scriptResponse = await request(scriptPath);
assert.equal(scriptResponse.status, 200);
assert.match(scriptResponse.headers.get('content-type') || '', /javascript/);
assert.ok((await scriptResponse.text()).length > 0);

console.log('Production smoke checks passed: health, registry, manifest validation, x402 challenge, and SPA assets.');
