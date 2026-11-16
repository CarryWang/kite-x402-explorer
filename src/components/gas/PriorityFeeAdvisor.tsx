import { useState, type FC } from 'react';
import { computeFeeRecommendations } from '../../utils/fee-estimator.js';
import type { FeeMarketObservation, FeeTierRecommendation } from '../../utils/fee-estimator.js';

interface PriorityFeeAdvisorProps {
  observation: FeeMarketObservation | null;
  onSelectTier?: (tier: FeeTierRecommendation) => void;
}

export const PriorityFeeAdvisor: FC<PriorityFeeAdvisorProps> = ({ observation, onSelectTier }) => {
  const [selectedTier, setSelectedTier] = useState<string>('Standard');
  const tiers = computeFeeRecommendations(observation);

  const handleSelect = (tier: FeeTierRecommendation) => {
    setSelectedTier(tier.tier);
    onSelectTier?.(tier);
  };

  return (
    <section className="glass-card" style={{ padding: '1rem' }} aria-label="Observed priority fee tiers">
      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.3rem' }}>Observed Priority Fee Tiers</h4>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        Illustrative max fee caps: twice the supplied base fee plus sampled priority fees. Inclusion time is unknown.
      </p>
      {tiers.length === 0 ? (
        <p role="status">No fee observations available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
          {tiers.map((tier) => (
            <button
              type="button"
              key={tier.tier}
              onClick={() => handleSelect(tier)}
              aria-pressed={selectedTier === tier.tier}
              style={{
                padding: '0.75rem', textAlign: 'left', color: 'var(--text-primary)',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                border: selectedTier === tier.tier ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
              }}
            >
              <strong>{tier.tier}</strong>
              <p>Max fee: {tier.maxFeePerGasGwei} Gwei</p>
              <small>Sampled priority: {tier.maxPriorityFeePerGasGwei} Gwei</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default PriorityFeeAdvisor;
