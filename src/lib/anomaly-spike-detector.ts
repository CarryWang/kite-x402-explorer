/**
 * Payment Transaction Anomaly and Volume Spike Detector
 * Detects sudden volume surges, flash spikes, and failure rate anomalies in real-time.
 */

export interface VolumeObservation {
  timestamp: number;
  volumeUsd: number;
  failureRate: number; // 0.0 to 1.0
}

export interface AnomalyAlert {
  isAnomaly: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  currentVolumeUsd: number;
  movingAverageUsd: number;
  zScore: number;
  reason?: string;
}

export class AnomalySpikeDetector {
  private history: VolumeObservation[] = [];
  private readonly windowSize: number;
  private readonly zScoreThreshold: number;

  constructor(windowSize: number = 20, zScoreThreshold: number = 2.5) {
    this.windowSize = windowSize;
    this.zScoreThreshold = zScoreThreshold;
  }

  public recordObservation(obs: VolumeObservation): AnomalyAlert {
    if (!Number.isFinite(obs.volumeUsd) || obs.volumeUsd < 0 ||
      !Number.isFinite(obs.failureRate) || obs.failureRate < 0 || obs.failureRate > 1 ||
      !Number.isFinite(obs.timestamp)) {
      throw new Error('Invalid volume observation');
    }
    let alert: AnomalyAlert = {
      isAnomaly: false,
      severity: 'LOW',
      currentVolumeUsd: obs.volumeUsd,
      movingAverageUsd: obs.volumeUsd,
      zScore: 0,
    };

    if (this.history.length >= 5) {
      const volumes = this.history.map((h) => h.volumeUsd);
      const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const variance = volumes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / volumes.length;
      const stdDev = Math.max(Math.sqrt(variance), mean * 0.05, 1);
      const zScore = (obs.volumeUsd - mean) / stdDev;

      alert.movingAverageUsd = Math.round(mean * 100) / 100;
      alert.zScore = Math.round(zScore * 100) / 100;

      if (zScore >= this.zScoreThreshold) {
        alert.isAnomaly = true;
        if (zScore >= 4.0 || obs.failureRate > 0.8) {
          alert.severity = 'CRITICAL';
          alert.reason = 'Extreme volume surge or critical failure rate detected';
        } else if (zScore >= 3.0) {
          alert.severity = 'HIGH';
          alert.reason = 'Significant volume spike exceeding standard variance';
        } else {
          alert.severity = 'MEDIUM';
          alert.reason = 'Moderate volume anomaly detected';
        }
      }
    }

    if (obs.failureRate > 0.5) {
      alert.isAnomaly = true;
      if (obs.failureRate > 0.8) {
        alert.severity = 'CRITICAL';
        alert.reason = 'Critical failure rate detected';
      } else if (alert.severity === 'LOW') {
        alert.severity = 'MEDIUM';
        alert.reason = 'Elevated failure rate detected';
      }
    }

    this.history.push(obs);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    return alert;
  }
}
