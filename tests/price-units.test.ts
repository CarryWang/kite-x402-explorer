import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ServiceDetailModal} from '../src/components/directory/ServiceDetailModal.tsx';
import {usdToAtomicUnits} from '../src/lib/price-units.ts';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';
import type {ServiceManifest} from '../src/types/service.ts';

test('usdToAtomicUnits converts exactly for 18 and 6 decimals', () => {
  assert.equal(usdToAtomicUnits('0.001', 18), '1000000000000000');
  assert.equal(usdToAtomicUnits('0.001', 6), '1000');
  assert.equal(usdToAtomicUnits('1', 6), '1000000');
  assert.equal(usdToAtomicUnits('0.0000001', 18), '100000000000');
  assert.equal(usdToAtomicUnits('123456789.123456', 6), '123456789123456');
});

test('usdToAtomicUnits rejects malformed prices and unrepresentable precision', () => {
  for (const bad of ['', 'abc', '-1', '1e-3', '0.', '.5', '1,000']) {
    assert.equal(usdToAtomicUnits(bad, 18), null, `expected null for "${bad}"`);
  }
  assert.equal(usdToAtomicUnits('0.0000001', 6), null);
});

function renderUnits(network: ServiceManifest['network'], price: string): string {
  const base = INITIAL_SERVICES[0];
  const service: ServiceManifest = {
    ...base,
    network,
    endpoints: [{...base.endpoints[0], price_usd: price}],
  };
  const html = renderToStaticMarkup(React.createElement(ServiceDetailModal, {
    service, onClose: () => {}, onOpenPlayground: () => {},
  }));
  const units = html.match(/>([^<>]*) units</)?.[1];
  assert.ok(units !== undefined, 'units label must render');
  return units;
}

test('detail modal shows exact pieUSD units for sub-micro testnet prices', () => {
  assert.equal(renderUnits('eip155:2368', '0.001'), '1000000000000000');
  // parseFloat(...) * 1e6 rounded this to 0 units.
  assert.equal(renderUnits('eip155:2368', '0.0000001'), '100000000000');
});

test('detail modal does not show a rounded amount the mainnet token cannot represent', () => {
  assert.equal(renderUnits('eip155:2366', '0.001'), '1000');
  assert.equal(renderUnits('eip155:2366', '0.0000001'), 'unavailable');
  assert.equal(renderUnits('eip155:2366', 'abc'), 'unavailable');
});
