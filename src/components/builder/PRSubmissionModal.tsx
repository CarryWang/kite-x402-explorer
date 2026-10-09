import React, { useState } from 'react';
import type { ServiceManifest } from '../../types/service.js';
import {
  X,
  GitPullRequest,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface PRSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ServiceManifest;
  yamlContent: string;
}

export const PRSubmissionModal: React.FC<PRSubmissionModalProps> = ({
  isOpen,
  onClose,
  manifest,
  yamlContent,
}) => {
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedPrBody, setCopiedPrBody] = useState(false);

  if (!isOpen) return null;

  const githubNewFileUrl = `https://github.com/gokite-ai/kite-x402-services/new/main?filename=services/${encodeURIComponent(
    manifest.name
  )}/service.yaml&value=${encodeURIComponent(yamlContent)}`;

  const cliCommands = `# 1. Clone the official Kite x402 registry
git clone https://github.com/gokite-ai/kite-x402-services.git
cd kite-x402-services

# 2. Create feature branch
git checkout -b add-service-${manifest.name}

# 3. Create service directory and paste service.yaml
mkdir -p services/${manifest.name}
cat << 'EOF' > services/${manifest.name}/service.yaml
${yamlContent}
EOF

# 4. Commit and push
git add services/${manifest.name}/service.yaml
git commit -m "feat(services): add ${manifest.name} manifest"
git push origin add-service-${manifest.name}`;

  const prBody = `### New x402 Service Registration

#### Service Details
- **Name**: \`${manifest.name}\`
- **Display Name**: ${manifest.display_name}
- **Description**: ${manifest.description}
- **Network**: \`${manifest.network}\`
- **Pay To**: \`${manifest.pay_to}\`
- **Maintainer**: @${manifest.maintainer.github}
- **Upstream**: ${manifest.upstream.name} (${manifest.upstream.url})

#### Endpoints Included (${manifest.endpoints.length})
${manifest.endpoints.map((ep) => `- \`${ep.method} ${ep.path}\` ($${ep.price_usd}) — ${ep.summary}`).join('\n')}

#### Verification Checklist
- [x] Manifest conforms to \`service.schema.json\`
- [x] Tested in Kite x402 Explorer & Playground
- [x] Endpoints respond with valid HTTP 402 challenge when unpaid`;

  const handleCopyCli = async () => {
    await navigator.clipboard.writeText(cliCommands);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyPrBody = async () => {
    await navigator.clipboard.writeText(prBody);
    setCopiedPrBody(true);
    setTimeout(() => setCopiedPrBody(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 245, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
            }}
          >
            <GitPullRequest size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Submit Service to Kite Registry</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Follow these instructions to submit your service manifest to <code>gokite-ai/kite-x402-services</code>
            </p>
          </div>
        </div>

        {/* Target Path Banner */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            margin: '1.25rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              REPOSITORY TARGET PATH
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--accent-cyan)' }}>
              services/{manifest.name}/service.yaml
            </div>
          </div>

          <a
            href={githubNewFileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
          >
            <span>Open Direct GitHub PR</span>
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Step-by-Step Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Option A: Direct Web UI */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <ShieldCheck size={16} color="var(--accent-emerald)" />
              <strong style={{ fontSize: '0.9rem' }}>Method 1: Direct GitHub Web Editor (Fastest)</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Click the button above. GitHub will automatically open a fork editor with the target filename{' '}
              <code>services/{manifest.name}/service.yaml</code> and your validated YAML pre-filled.
            </p>
          </div>

          {/* Option B: Git CLI */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} color="var(--accent-purple)" />
                <strong style={{ fontSize: '0.9rem' }}>Method 2: Command Line Workflow</strong>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleCopyCli}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                {copiedCli ? (
                  <>
                    <Check size={12} color="var(--accent-emerald)" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy CLI Script
                  </>
                )}
              </button>
            </div>
            <pre
              className="code-block"
              style={{
                fontSize: '0.75rem',
                maxHeight: '140px',
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {cliCommands}
            </pre>
          </div>

          {/* PR Description Template */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} color="var(--accent-cyan)" />
                <strong style={{ fontSize: '0.9rem' }}>Pull Request Description Template</strong>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleCopyPrBody}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                {copiedPrBody ? (
                  <>
                    <Check size={12} color="var(--accent-emerald)" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy PR Body
                  </>
                )}
              </button>
            </div>
            <pre
              className="code-block"
              style={{
                fontSize: '0.75rem',
                maxHeight: '120px',
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {prBody}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
