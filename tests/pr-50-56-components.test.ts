import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { encodeFunctionData } from 'viem';
import { TokenTransferTable } from '../src/components/tokens/TokenTransferTable.js';
import { ContractAbiDecoder } from '../src/components/contracts/ContractAbiDecoder.js';
import { ValidatorStatusCard } from '../src/components/validators/ValidatorStatusCard.js';
import { BlockTimeHistogram } from '../src/components/analytics/BlockTimeHistogram.js';

const render = (component: React.ReactElement) => renderToStaticMarkup(component);

test('transfer table distinguishes unavailable data from an observed empty list', () => {
  const unavailable = render(React.createElement(TokenTransferTable, {}));
  const empty = render(React.createElement(TokenTransferTable, { transfers: [] }));
  assert.match(unavailable, /unavailable/i);
  assert.doesNotMatch(unavailable, /no erc-20/i);
  assert.match(empty, /no .*transfer events/i);
});

test('contract call is decoded from supplied ABI and calldata without a fabricated default', () => {
  const abi = [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [
    { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' },
  ], outputs: [] }] as const;
  const data = encodeFunctionData({ abi, functionName: 'transfer', args: [
    '0x1111111111111111111111111111111111111111', 42n,
  ] });
  const missing = render(React.createElement(ContractAbiDecoder, {}));
  const decoded = render(React.createElement(ContractAbiDecoder, { abi, data }));
  assert.match(missing, /unavailable/i);
  assert.doesNotMatch(missing, /transfer\(/);
  assert.match(decoded, /transfer/);
  assert.match(decoded, /0x1111111111111111111111111111111111111111/);
  assert.match(decoded, /42/);
  assert.match(render(React.createElement(ContractAbiDecoder, { abi, data: '0x1234' })), /unable to decode/i);
});

test('validator card requires provenance and does not invent unknown metrics', () => {
  assert.match(render(React.createElement(ValidatorStatusCard, {})), /unavailable/i);
  const observed = render(React.createElement(ValidatorStatusCard, { validator: {
    address: '0x1111111111111111111111111111111111111111',
    source: 'Kite RPC', observedAt: '2026-11-16T00:00:00Z',
  } }));
  assert.match(observed, /Kite RPC/);
  assert.match(observed, /unknown/i);
  assert.doesNotMatch(observed, /0%|0 blocks/);
});

test('block time histogram is empty-safe and displays observed interval distribution', () => {
  const empty = render(React.createElement(BlockTimeHistogram, {}));
  assert.match(empty, /unavailable/i);
  assert.doesNotMatch(empty, /NaN|1\.2/);
  const histogram = render(React.createElement(BlockTimeHistogram, { intervals: [1, 1, 2, 3] }));
  assert.match(histogram, /1\.75/);
  assert.match(histogram, /2 intervals/);
  assert.equal((histogram.match(/role="listitem"/g) || []).length, 2);
});

test('CSV serialization escapes cells, aligns columns, and neutralizes formulas', async () => {
  const module = await import('../src/components/common/ExportCsvButton.js');
  const buildCsv = (module as unknown as { buildCsv?: (rows: readonly Record<string, unknown>[]) => string }).buildCsv;
  assert.equal(typeof buildCsv, 'function');
  const csv = buildCsv!([
    { name: 'A "quote"', note: '=2+2', count: 4 },
    { note: 'line\nbreak', name: 'Bob', extra: '+SUM(1,2)' },
  ]);
  assert.equal(csv, '"name","note","count","extra"\r\n"A ""quote""","\'=2+2","4",""\r\n"Bob","line\nbreak","","\'+SUM(1,2)"');
});
