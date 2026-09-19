import React, { useState } from 'react';
import { Navbar, type NavTab } from './components/common/Navbar.js';
import { DirectoryView } from './components/directory/DirectoryView.js';
import { ServiceDetailModal } from './components/directory/ServiceDetailModal.js';
import { PlaygroundView } from './components/playground/PlaygroundView.js';
import { DocsView } from './components/docs/DocsView.js';
import { INITIAL_SERVICES } from './services/sample-services.js';
import type { ServiceManifest, ServiceEndpoint } from './types/service.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  const [selectedNetwork, setSelectedNetwork] = useState<'all' | 'testnet' | 'mainnet'>('all');
  const [services] = useState<ServiceManifest[]>(INITIAL_SERVICES);
  const [selectedService, setSelectedService] = useState<ServiceManifest | null>(null);
  const [playgroundTarget, setPlaygroundTarget] = useState<{
    service: ServiceManifest;
    endpoint?: ServiceEndpoint;
  } | null>(null);

  const handleOpenPlayground = (service: ServiceManifest, endpoint?: ServiceEndpoint) => {
    setPlaygroundTarget({ service, endpoint });
    setActiveTab('playground');
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedNetwork={selectedNetwork}
        onSelectNetwork={setSelectedNetwork}
      />

      <main className="main-content">
        {activeTab === 'directory' && (
          <DirectoryView
            services={services}
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
          />
        )}

        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Detail Modal */}
      <ServiceDetailModal
        service={selectedService}
        onClose={() => setSelectedService(null)}
        onOpenPlayground={(srv, ep) => handleOpenPlayground(srv, ep)}
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
