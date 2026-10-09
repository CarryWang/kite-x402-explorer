import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type NavTab } from './components/common/Navbar.js';
import { DirectoryView } from './components/directory/DirectoryView.js';
import { ServiceDetailModal } from './components/directory/ServiceDetailModal.js';
import { PlaygroundView } from './components/playground/PlaygroundView.js';
import { ManifestBuilderView } from './components/builder/ManifestBuilderView.js';
import { TestnetE2ESuite } from './components/e2e/TestnetE2ESuite.js';
import { DocsView } from './components/docs/DocsView.js';
import { ProofLogDrawer } from './components/common/ProofLogDrawer.js';
import { INITIAL_SERVICES } from './services/sample-services.js';
import type { ServiceManifest, ServiceEndpoint } from './types/service.js';
import type { ServiceHealthStatus, HealthAutoRefreshInterval } from './types/health.js';
import {
  batchProbeServices,
  probeServiceHealth,
  getCachedHealthMap,
} from './services/health-prober.js';
import { getStoredProofs, subscribeToProofs } from './services/proof-logger.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  const [selectedNetwork, setSelectedNetwork] = useState<'all' | 'testnet' | 'mainnet'>('all');
  const [services, setServices] = useState<ServiceManifest[]>(INITIAL_SERVICES);
  const [selectedService, setSelectedService] = useState<ServiceManifest | null>(null);
  const [playgroundTarget, setPlaygroundTarget] = useState<{
    service: ServiceManifest;
    endpoint?: ServiceEndpoint;
  } | null>(null);

  // Health prober state
  const [healthMap, setHealthMap] = useState<Record<string, ServiceHealthStatus>>(getCachedHealthMap);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<HealthAutoRefreshInterval>(30);

  // Proof logs drawer state
  const [proofCount, setProofCount] = useState<number>(() => getStoredProofs().length);
  const [isProofDrawerOpen, setIsProofDrawerOpen] = useState<boolean>(false);

  // Run batch probe across all services
  const handleRunBatchProbe = useCallback(async () => {
    setIsProbing(true);
    try {
      const results = await batchProbeServices(services);
      setHealthMap(results);
    } catch (err) {
      console.error('Batch probing error:', err);
    } finally {
      setIsProbing(false);
    }
  }, [services]);

  // Re-check an individual service
  const handleProbeSingle = useCallback(async (service: ServiceManifest) => {
    try {
      const result = await probeServiceHealth(service);
      setHealthMap((prev) => ({
        ...prev,
        [service.name]: result,
      }));
    } catch (err) {
      console.error(`Error probing service ${service.name}:`, err);
    }
  }, []);

  // Initial probe and real-time proof count subscription
  useEffect(() => {
    handleRunBatchProbe();
    const unsubscribeProofs = subscribeToProofs((updated) => setProofCount(updated.length));
    return unsubscribeProofs;
  }, [handleRunBatchProbe]);

  // Auto-refresh interval effect
  useEffect(() => {
    if (autoRefreshInterval === 0) return;
    const timerId = setInterval(() => {
      handleRunBatchProbe();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timerId);
  }, [autoRefreshInterval, handleRunBatchProbe]);

  const handleOpenPlayground = (service: ServiceManifest, endpoint?: ServiceEndpoint) => {
    setPlaygroundTarget({ service, endpoint });
    setActiveTab('playground');
  };

  const handleTestInPlayground = (manifest: ServiceManifest) => {
    setServices((prev) => {
      const exists = prev.some((s) => s.name === manifest.name);
      return exists ? prev.map((s) => (s.name === manifest.name ? manifest : s)) : [manifest, ...prev];
    });
    setPlaygroundTarget({ service: manifest, endpoint: manifest.endpoints[0] });
    setActiveTab('playground');
  };

  const handleAddToDirectory = (manifest: ServiceManifest) => {
    setServices((prev) => {
      const exists = prev.some((s) => s.name === manifest.name);
      return exists ? prev.map((s) => (s.name === manifest.name ? manifest : s)) : [manifest, ...prev];
    });
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedNetwork={selectedNetwork}
        onSelectNetwork={setSelectedNetwork}
        proofCount={proofCount}
        onOpenProofLogs={() => setIsProofDrawerOpen(true)}
      />

      <main className="main-content">
        {activeTab === 'directory' && (
          <DirectoryView
            services={services}
            healthMap={healthMap}
            isProbing={isProbing}
            onRunBatchProbe={handleRunBatchProbe}
            autoRefreshInterval={autoRefreshInterval}
            onChangeAutoRefresh={setAutoRefreshInterval}
            selectedNetwork={selectedNetwork}
            onSelectService={(srv) => setSelectedService(srv)}
            onOpenPlayground={(srv) => handleOpenPlayground(srv)}
          />
        )}

        {activeTab === 'playground' && (
          <PlaygroundView
            services={services}
            selectedService={playgroundTarget?.service || services[0]}
            selectedEndpoint={playgroundTarget?.endpoint || null}
            onSelectService={(srv) => setPlaygroundTarget({ service: srv })}
            onOpenProofLogs={() => setIsProofDrawerOpen(true)}
          />
        )}

        {activeTab === 'builder' && (
          <ManifestBuilderView
            onTestInPlayground={handleTestInPlayground}
            onAddToDirectory={handleAddToDirectory}
          />
        )}

        {activeTab === 'e2e' && <TestnetE2ESuite />}

        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Detail Modal with health probe integration */}
      <ServiceDetailModal
        service={selectedService}
        health={selectedService ? healthMap[selectedService.name] : null}
        onClose={() => setSelectedService(null)}
        onOpenPlayground={(srv, ep) => handleOpenPlayground(srv, ep)}
        onRecheckHealth={handleProbeSingle}
      />

      {/* Persistent Proof Logs Slide-out Drawer */}
      <ProofLogDrawer
        isOpen={isProofDrawerOpen}
        onClose={() => setIsProofDrawerOpen(false)}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-glass)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>Kite x402 Explorer & Playground — Built for the Autonomous Agent Economy</div>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <span>Network: Kite eip155:2366 / 2368</span>
            <span>Protocol: x402 v2</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
