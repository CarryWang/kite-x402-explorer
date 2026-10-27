import { describe, it, expect } from 'vitest';
import { AnomalySpikeDetector } from '../src/lib/anomaly-spike-detector';

describe('AnomalySpikeDetector', () => {
  it('detects no anomaly for steady baseline volumes', () => {
    const detector = new AnomalySpikeDetector(10, 2.5);
    for (let i = 0; i < 6; i++) {
      detector.recordObservation({ timestamp: 1000 + i, volumeUsd: 100, failureRate: 0.01 });
    }
    const alert = detector.recordObservation({ timestamp: 1010, volumeUsd: 105, failureRate: 0.01 });
    expect(alert.isAnomaly).toBe(false);
  });

  it('triggers critical alert upon extreme volume surge', () => {
    const detector = new AnomalySpikeDetector(10, 2.5);
    for (let i = 0; i < 6; i++) {
      detector.recordObservation({ timestamp: 1000 + i, volumeUsd: 50, failureRate: 0.0 });
    }
    const alert = detector.recordObservation({ timestamp: 1010, volumeUsd: 5000, failureRate: 0.0 });
    expect(alert.isAnomaly).toBe(true);
    expect(alert.severity).toBe('CRITICAL');
  });
});
