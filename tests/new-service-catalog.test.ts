import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_SERVICES } from '../src/services/sample-services.ts';
import { validateServiceManifest } from '../src/services/schema-validator.ts';

test('unimplemented new service examples remain drafts', () => {
  for (const name of [
    'kite-semantic-cache-gateway',
    'kite-compute-router',
    'kite-data-attestation-oracle',
    'kite-session-allowance-manager',
  ]) {
    const service = INITIAL_SERVICES.find((entry) => entry.name === name);
    assert.ok(service, `missing service ${name}`);
    assert.equal(service.status, 'draft');
    assert.equal(service.base_url, undefined);
    const validation = validateServiceManifest(service);
    assert.equal(validation.valid, true, `${name}: ${JSON.stringify(validation.errors)}`);
  }
});
