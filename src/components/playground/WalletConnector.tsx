import React, { useState, useEffect } from 'react';
import { createWalletClient, custom, type Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { kiteTestnetChain, kiteMainnetChain } from '../../lib/chains.js';
import { KITE_CHAINS } from '../../types/kite.js';
import { Wallet, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { EIP3009_TYPES } from '../../lib/eip3009.js';

export interface WalletSigner {
  type: 'injected' | 'sandbox';
  address: `0x${string}`;
  signTypedData: (params: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: typeof EIP3009_TYPES;
    primaryType: 'TransferWithAuthorization';
    message: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
      validAfter: bigint;
      validBefore: bigint;
      nonce: `0x${string}`;
    };
  }) => Promise<Hex>;
}

interface WalletConnectorProps {
  targetNetwork: 'eip155:2366' | 'eip155:2368';
  onSignerReady: (signer: WalletSigner | null) => void;
}

export const WalletConnector: React.FC<WalletConnectorProps> = ({
  targetNetwork,
  onSignerReady,
}) => {
  const [walletType, setWalletType] = useState<'sandbox' | 'injected'>('sandbox');
  const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(null);
  const [sandboxPrivateKey, setSandboxPrivateKey] = useState<Hex>(() => {
    const saved = sessionStorage.getItem('kite_sandbox_pk');
    if (saved && saved.startsWith('0x')) return saved as Hex;
    const pk = generatePrivateKey();
    sessionStorage.setItem('kite_sandbox_pk', pk);
    return pk;
  });

  const targetChain = targetNetwork === 'eip155:2368' ? kiteTestnetChain : kiteMainnetChain;
  const targetConfig = KITE_CHAINS[targetNetwork];

  // Set up Sandbox Signer
  useEffect(() => {
    if (walletType === 'sandbox') {
      const account = privateKeyToAccount(sandboxPrivateKey);
      const signer: WalletSigner = {
        type: 'sandbox',
        address: account.address,
        signTypedData: async (params) => {
          return await account.signTypedData(params);
        },
      };
      onSignerReady(signer);
    }
  }, [walletType, sandboxPrivateKey, onSignerReady]);

  // Handle Injected Wallet Connect
  const connectInjectedWallet = async () => {
    if (typeof window === 'undefined' || !(window as unknown as { ethereum?: unknown }).ethereum) {
      alert('No EVM browser wallet detected (MetaMask / Rabby). Please install one or use Sandbox mode.');
      return;
    }

    try {
      const ethereum = (window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum;
      const client = createWalletClient({
        chain: targetChain,
        transport: custom(ethereum),
      });

      const [addr] = await client.requestAddresses();
      setInjectedAddress(addr);

      // Verify chain
      try {
        await client.switchChain({ id: targetChain.id });
      } catch (switchErr) {
        console.warn('Chain switch prompt:', switchErr);
      }

      const signer: WalletSigner = {
        type: 'injected',
        address: addr,
        signTypedData: async (params) => {
          return await client.signTypedData({
            account: addr,
            ...params,
          });
        },
      };

      setWalletType('injected');
      onSignerReady(signer);
    } catch (err) {
      console.error('Wallet connection rejected:', err);
    }
  };

  const regenerateSandboxKey = () => {
    const newPk = generatePrivateKey();
    sessionStorage.setItem('kite_sandbox_pk', newPk);
    setSandboxPrivateKey(newPk);
  };

  const sandboxAccount = privateKeyToAccount(sandboxPrivateKey);

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wallet size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>AI Agent Payer Wallet</span>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={() => setWalletType('sandbox')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: walletType === 'sandbox' ? 'rgba(0, 245, 255, 0.15)' : 'transparent',
              color: walletType === 'sandbox' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: walletType === 'sandbox' ? 600 : 400,
            }}
          >
            Sandbox Key
          </button>
          <button
            onClick={connectInjectedWallet}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: walletType === 'injected' ? 'rgba(121, 40, 202, 0.2)' : 'transparent',
              color: walletType === 'injected' ? '#c084fc' : 'var(--text-muted)',
              fontWeight: walletType === 'injected' ? 600 : 400,
            }}
          >
            Browser Wallet
          </button>
        </div>
      </div>

      {walletType === 'sandbox' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SANDBOX AGENT ADDRESS</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
              {sandboxAccount.address}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle2 size={12} /> Auto-Signer Ready
            </span>
            <button
              onClick={regenerateSandboxKey}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 7px',
                cursor: 'pointer',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title="Generate new sandbox key"
            >
              <RefreshCw size={11} /> New Key
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CONNECTED WEB3 WALLET</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#c084fc' }}>
              {injectedAddress || 'Not connected'}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Network: {targetConfig.name} ({targetConfig.chainId})
          </div>
        </div>
      )}
    </div>
  );
};
