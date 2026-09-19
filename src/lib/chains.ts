import { defineChain } from 'viem';
import { KITE_MAINNET, KITE_TESTNET } from '../types/kite.js';

export const kiteMainnetChain = defineChain({
  id: KITE_MAINNET.chainId,
  name: 'Kite AI Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Kite',
    symbol: 'KITE',
  },
  rpcUrls: {
    default: { http: [KITE_MAINNET.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'KiteScan', url: KITE_MAINNET.explorerUrl },
  },
});

export const kiteTestnetChain = defineChain({
  id: KITE_TESTNET.chainId,
  name: 'Kite AI Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Kite Testnet',
    symbol: 'tKITE',
  },
  rpcUrls: {
    default: { http: [KITE_TESTNET.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'KiteScan Testnet', url: KITE_TESTNET.explorerUrl },
  },
});
