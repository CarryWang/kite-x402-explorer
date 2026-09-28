import React from 'react';
import type { ServiceHealthStatus } from '../../types/health.js';

interface StatusBadgeProps {
  health?: ServiceHealthStatus | null;
  compact?: boolean;
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  health,
  compact = false,
  onClick,
}) => {
  if (!health) {
    return (
      <div
        className="status-pill unprobed"
        title="Status unprobed. Click or run batch check."
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: 'var(--radius-xl)',
          fontSize: '0.72rem',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-muted)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--text-muted)',
            opacity: 0.6,
          }}
        />
        <span>Unchecked</span>
      </div>
    );
  }

  const { status, latencyMs, details, lastCheckedAt } = health;

  const colorConfig = {
    healthy: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      text: 'var(--accent-emerald)',
      dot: 'var(--accent-emerald)',
      label: 'Healthy',
      pulse: true,
    },
    degraded: {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.35)',
      text: 'var(--accent-amber)',
      dot: 'var(--accent-amber)',
      label: 'Degraded',
      pulse: false,
    },
    down: {
      bg: 'rgba(244, 63, 94, 0.15)',
      border: 'rgba(244, 63, 94, 0.35)',
      text: 'var(--accent-rose)',
      dot: 'var(--accent-rose)',
      label: 'Offline',
      pulse: false,
    },
    unprobed: {
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      text: 'var(--text-muted)',
      dot: 'var(--text-muted)',
      label: 'Unchecked',
      pulse: false,
    },
  }[status];

  const tooltip = `${colorConfig.label} (${latencyMs}ms)\n${details || ''}\nLast checked: ${new Date(
    lastCheckedAt
  ).toLocaleTimeString()}`;

  return (
    <div
      title={tooltip}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-xl)',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: colorConfig.bg,
        color: colorConfig.text,
        border: `1px solid ${colorConfig.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: colorConfig.dot,
          boxShadow: colorConfig.pulse ? `0 0 8px ${colorConfig.dot}` : 'none',
          display: 'inline-block',
        }}
      />
      {!compact && <span>{colorConfig.label}</span>}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          opacity: 0.9,
          fontSize: '0.7rem',
          marginLeft: compact ? '0' : '2px',
        }}
      >
        {latencyMs}ms
      </span>
    </div>
  );
};
