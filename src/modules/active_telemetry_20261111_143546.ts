/** A caller-supplied observation; this module does not poll or infer session health. */
export interface ActiveSessionHeartbeat {
  sessionId: string;
  account: string;
  timestamp: string;
  metrics: {
    healthScore: number;
    latencyMs: number;
    activeChannels: number;
  };
}

export function recordActiveSession(observation: ActiveSessionHeartbeat): ActiveSessionHeartbeat {
  if (!observation || !observation.sessionId?.trim() || !observation.account?.trim() ||
      !observation.timestamp || !Number.isFinite(Date.parse(observation.timestamp))) {
    throw new TypeError('A session, account, and valid timestamp are required');
  }
  const { healthScore, latencyMs, activeChannels } = observation.metrics ?? {};
  if (!Number.isFinite(healthScore) || healthScore < 0 || healthScore > 100 ||
      !Number.isFinite(latencyMs) || latencyMs < 0 ||
      !Number.isSafeInteger(activeChannels) || activeChannels < 0) {
    throw new RangeError('healthScore, latencyMs, and activeChannels must be valid observations');
  }
  return { ...observation, metrics: { ...observation.metrics } };
}

export default recordActiveSession;
