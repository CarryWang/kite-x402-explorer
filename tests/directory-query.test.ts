import assert from 'node:assert/strict';
import test from 'node:test';
import { queryDirectory, type DirectoryQuery } from '../src/lib/directory-query.js';
import type { ServiceHealthStatus, HealthStatusType } from '../src/types/health.js';
import type { ServiceManifest } from '../src/types/service.js';

const service = (name: string, overrides: Partial<ServiceManifest> = {}): ServiceManifest => ({
  schema: 1,
  name,
  display_name: name.toUpperCase(),
  description: `${name} service`,
  maintainer: { github: 'demo' },
  status: 'testnet',
  base_url: `https://${name}.example.com`,
  network: 'eip155:2368',
  pay_to: '0x1111111111111111111111111111111111111111',
  upstream: { name, url: 'https://example.com' },
  endpoints: [{ method: 'GET', path: '/v1/x', summary: 'x', price_usd: '0.001' }],
  categories: ['other'],
  ...overrides,
});

const health = (serviceName: string, status: HealthStatusType, latencyMs: number): ServiceHealthStatus => ({
  serviceName,
  status,
  latencyMs,
  httpStatus: status === 'down' ? 503 : 200,
  networkMatched: true,
  assetMatched: true,
  facilitatorReachable: true,
  lastCheckedAt: '2026-11-27T00:00:00.000Z',
  endpointChecked: '/v1/x',
});

const query = (overrides: Partial<DirectoryQuery> = {}): DirectoryQuery => ({
  network: 'all',
  status: 'all',
  category: 'all',
  health: 'all',
  search: '',
  sortBy: 'name',
  ...overrides,
});

const names = (list: ServiceManifest[]) => list.map((s) => s.name);

test('search ignores surrounding whitespace', () => {
  const services = [service('weather', { description: 'Forecasts' }), service('search')];
  for (const search of ['weather', 'weather ', '  Weather', '\tweather\n']) {
    assert.deepEqual(names(queryDirectory(services, {}, query({ search }))), ['weather'], JSON.stringify(search));
  }
  assert.deepEqual(names(queryDirectory(services, {}, query({ search: '   ' }))), ['search', 'weather']);
});

test('search matches name, display name, description and tags', () => {
  const services = [
    service('alpha', { display_name: 'Gamma Feed' }),
    service('beta', { description: 'Gamma rays' }),
    service('delta', { tags: ['GAMMA'] }),
    service('epsilon'),
  ];
  assert.deepEqual(names(queryDirectory(services, {}, query({ search: 'gamma', sortBy: 'name' }))).sort(), ['alpha', 'beta', 'delta']);
});

test('fastest latency lists answering services first, then down, then unprobed', () => {
  const services = [service('unprobed'), service('down-fast'), service('slow'), service('fast'), service('never')];
  const healthMap = {
    'down-fast': health('down-fast', 'down', 4),
    slow: health('slow', 'degraded', 900),
    fast: health('fast', 'healthy', 120),
    never: health('never', 'unprobed', 0),
  };
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ sortBy: 'latency-asc' }))), ['fast', 'slow', 'down-fast', 'unprobed', 'never']);
});

test('a fast-failing service no longer outranks a healthy one', () => {
  const services = [service('healthy'), service('broken')];
  const healthMap = { healthy: health('healthy', 'healthy', 300), broken: health('broken', 'down', 2) };
  assert.equal(queryDirectory(services, healthMap, query({ sortBy: 'latency-asc' }))[0].name, 'healthy');
});

test('filters by network, status, category and health', () => {
  const services = [
    service('t1', { categories: ['ai'] }),
    service('m1', { network: 'eip155:2366', status: 'live', categories: ['ai'] }),
    service('t2', { status: 'draft', categories: ['weather'] }),
  ];
  const healthMap = { t1: health('t1', 'healthy', 100) };
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ network: 'mainnet' }))), ['m1']);
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ network: 'testnet' }))), ['t1', 't2']);
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ status: 'draft' }))), ['t2']);
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ category: 'ai' }))), ['m1', 't1']);
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ health: 'healthy' }))), ['t1']);
  assert.deepEqual(names(queryDirectory(services, healthMap, query({ health: 'unprobed' }))), ['m1', 't2']);
});

test('price and endpoint sorts use the cheapest endpoint and the endpoint count', () => {
  const ep = (price_usd: string) => ({ method: 'GET' as const, path: '/v1/x', summary: 'x', price_usd });
  const services = [
    service('mid', { endpoints: [ep('0.5'), ep('0.002')] }),
    service('cheap', { endpoints: [ep('0.001')] }),
    service('dear', { endpoints: [ep('0.01'), ep('0.02'), ep('0.03')] }),
  ];
  assert.deepEqual(names(queryDirectory(services, {}, query({ sortBy: 'price-asc' }))), ['cheap', 'mid', 'dear']);
  assert.deepEqual(names(queryDirectory(services, {}, query({ sortBy: 'price-desc' }))), ['dear', 'mid', 'cheap']);
  assert.deepEqual(names(queryDirectory(services, {}, query({ sortBy: 'endpoints' }))), ['dear', 'mid', 'cheap']);
});

test('does not reorder the caller\'s array', () => {
  const services = [service('b'), service('a')];
  queryDirectory(services, {}, query({ sortBy: 'name' }));
  assert.deepEqual(names(services), ['b', 'a']);
});
