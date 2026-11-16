import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { P95LatencyTracker } from '../src/components/analytics/P95LatencyTracker.js';
import { GasSpikeAlertBadge } from '../src/components/analytics/GasSpikeAlertBadge.js';
import { TokenFlowSankeyMini } from '../src/components/analytics/TokenFlowSankeyMini.js';

test('latency tracker reports only supplied observations', () => {
  const html = renderToStaticMarkup(React.createElement(P95LatencyTracker, {
    metrics: [100, 200, 300, 400].map((propagationTimeMs, i) => ({
      blockNumber: i + 1, propagationTimeMs, gasUsedPercent: 50, timestamp: i + 1,
    })),
  }));
  assert.match(html, /250 ms/);
  assert.match(html, /400 ms/);
  assert.doesNotMatch(html, /Live Telemetry/);
  assert.match(renderToStaticMarkup(React.createElement(P95LatencyTracker, { metrics: [] })), /No observations/);
});

test('gas badge does not label invalid observations normal', () => {
  const html = renderToStaticMarkup(React.createElement(GasSpikeAlertBadge, {
    currentGasGwei: Number.NaN, baselineGasGwei: 1,
  }));
  assert.match(html, /unavailable/i);
  assert.doesNotMatch(html, /Gas Normal|NaN/);
});

test('token flow has no fabricated default distribution', () => {
  const empty = renderToStaticMarkup(React.createElement(TokenFlowSankeyMini, {}));
  assert.match(empty, /No flow observations/);
  assert.doesNotMatch(empty, /Settlement Escrow/);
  const supplied = renderToStaticMarkup(React.createElement(TokenFlowSankeyMini, {
    flows: [{ label: 'Observed fees', volumePercent: 42 }],
  }));
  assert.match(supplied, /Observed fees/);
  assert.match(supplied, /42%/);
  const invalid = renderToStaticMarkup(React.createElement(TokenFlowSankeyMini, {
    flows: [{ label: 'Invalid', volumePercent: Number.NaN }],
  }));
  assert.match(invalid, /No flow observations/);
  assert.doesNotMatch(invalid, /Invalid/);
});
