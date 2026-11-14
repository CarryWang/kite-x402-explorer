import assert from 'node:assert/strict';
import test from 'node:test';
import { parseServerConfig } from '../server/config.ts';

const registeredUrls = ['https://service.example/api', 'https://service.example/other'];

test('server config supplies demo defaults and unique registered origins', () => {
  const config = parseServerConfig({}, registeredUrls);
  assert.equal(config.registrySource, 'demo');
  assert.equal(config.registryCommit, undefined);
  assert.deepEqual(config.allowedOrigins, [
    'https://service.example',
    'https://facilitator.pieverse.io',
  ]);
});

test('server config accepts a pinned official directory and HTTPS origins', () => {
  const config = parseServerConfig({
    REGISTRY_SOURCE: 'official',
    REGISTRY_COMMIT: 'A'.repeat(40),
    OUTBOUND_ALLOWED_ORIGINS: ' https://api.example:8443,https://service.example ',
  }, registeredUrls);
  assert.equal(config.registrySource, 'official');
  assert.equal(config.registryCommit, 'A'.repeat(40));
  assert.deepEqual(config.allowedOrigins, [
    'https://service.example',
    'https://facilitator.pieverse.io',
    'https://api.example:8443',
  ]);
});

test('server config rejects invalid directory settings at startup', () => {
  for (const source of ['', 'staging', ' official ']) {
    assert.throws(() => parseServerConfig({ REGISTRY_SOURCE: source }), /REGISTRY_SOURCE/);
  }
  for (const commit of ['', 'main', 'g'.repeat(40)]) {
    assert.throws(() => parseServerConfig({ REGISTRY_COMMIT: commit }), /REGISTRY_COMMIT/);
  }
});

test('server config rejects outbound values that are not HTTPS origins', () => {
  for (const origin of [
    'http://api.example',
    'https://user:pass@api.example',
    'https://api.example/path',
    'https://api.example?token=secret',
    'https://api.example#section',
    'not a URL',
  ]) {
    assert.throws(
      () => parseServerConfig({ OUTBOUND_ALLOWED_ORIGINS: origin }),
      /OUTBOUND_ALLOWED_ORIGINS/,
      origin,
    );
  }
});
