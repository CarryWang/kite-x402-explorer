import test from 'node:test';
import assert from 'node:assert/strict';
import { ThroughputCalculator } from '../src/lib/metrics/throughputCalculator.js';
import { recordActiveSession as record11 } from '../src/modules/active_telemetry_20261111_143546.js';
import { recordActiveSession as record12 } from '../src/modules/active_telemetry_20261112_143446.js';

test('throughput validates window and counts observed event times only', () => {
  assert.throws(() => new ThroughputCalculator(0), /window/i);
  assert.throws(() => new ThroughputCalculator(Number.POSITIVE_INFINITY), /window/i);
  const calc = new ThroughputCalculator(1000);
  calc.recordEvent(1000);
  calc.recordEvent(1500);
  assert.deepEqual(calc.getStats(2000), { tps: 2, sampleCount: 2 });
  assert.deepEqual(calc.getStats(2501), { tps: 0, sampleCount: 0 });
  assert.throws(() => calc.recordEvent(Number.NaN), /timestamp/i);
});

test('dated heartbeat modules only return supplied observations', () => {
  const input = {
    sessionId: 'session-observed', account: 'account-observed',
    timestamp: '2026-11-12T00:00:00Z',
    metrics: { healthScore: 83, latencyMs: 75, activeChannels: 2 },
  };
  assert.deepEqual(record11(input), input);
  assert.deepEqual(record12(input), input);
  assert.throws(() => record11({ ...input, metrics: { ...input.metrics, latencyMs: Number.NaN } }), /latency/i);
});
