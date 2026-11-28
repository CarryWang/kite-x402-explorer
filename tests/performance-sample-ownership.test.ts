import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { ProtocolPerformanceTracker } from '../src/lib/performance-tracker.js';

function metric() { return { serviceName: 'local', endpointPath: '/v1/task', step1ProbeMs: 10,
  step2SigningMs: 20, step3SettlementMs: 30, totalRoundtripMs: 60, timestamp: 1000, success: true }; }

test('recording a metric captures the observed sample before its input is reused', () => {
  const tracker = new ProtocolPerformanceTracker();
  const input = metric(); tracker.recordMetric(input); input.step1ProbeMs = 999; input.success = false;
  assert.equal(tracker.getSummary()?.avgProbeMs, 10);
  assert.equal(tracker.getSummary()?.successRate, 100);
});

test('query results cannot rewrite retained history or later summaries', () => {
  const tracker = new ProtocolPerformanceTracker(1);
  tracker.recordMetric(metric()); tracker.getAllMetrics()[0].serviceName = 'rewritten';
  assert.equal(tracker.getSummary('local')?.sampleCount, 1);
  tracker.recordMetric({ ...metric(), step1ProbeMs: 20 });
  assert.equal(tracker.getAllMetrics().length, 1);
  assert.equal(tracker.getSummary()?.avgProbeMs, 20);
});

test('sample capacity must be a positive bounded integer', () => {
  for (const maxSamples of [NaN, Infinity, 0, -1, 1.5]) assert.throws(() => new ProtocolPerformanceTracker(maxSamples), /sample|limit|capacity/i);
});
