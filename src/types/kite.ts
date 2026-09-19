/**
 * Kite Blockchain Network Reference and Asset definitions.
 */

export interface KiteChainConfig {
  name: 'mainnet' | 'testnet';
  network: 'eip155:2366' | 'eip155:2368';
  chainId: number;
  rpcUrl: string;
  assetAddress: `0x${string}`;
  assetSymbol: 'USDC.e' | 'pieUSD';
  assetDecimals: number;
  eip712Domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  facilitatorUrl: string;
  explorerUrl: string;
}

export const KITE_MAINNET: KiteChainConfig = {
  name: 'mainnet',
  network: 'eip155:2366',
  chainId: 2366,
  rpcUrl: 'https://rpc.gokite.ai',
  assetAddress: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
  assetSymbol: 'USDC.e',
  assetDecimals: 6,
  eip712Domain: {
    name: 'Bridged USDC (Kite AI)',
    version: '2',
    chainId: 2366,
    verifyingContract: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
  },
  facilitatorUrl: 'https://facilitator.pieverse.io/v2',
  explorerUrl: 'https://kitescan.ai',
};

export const KITE_TESTNET: KiteChainConfig = {
  name: 'testnet',
  network: 'eip155:2368',
  chainId: 2368,
  rpcUrl: 'https://rpc-testnet.gokite.ai',
  assetAddress: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
  assetSymbol: 'pieUSD',
  assetDecimals: 18,
  eip712Domain: {
    name: 'pieUSD',
    version: '1',
    chainId: 2368,
    verifyingContract: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
  },
  facilitatorUrl: 'https://facilitator.pieverse.io/v2',
  explorerUrl: 'https://testnet.kitescan.ai',
};

export const KITE_CHAINS: Record<string, KiteChainConfig> = {
  'eip155:2366': KITE_MAINNET,
  'eip155:2368': KITE_TESTNET,
  mainnet: KITE_MAINNET,
  testnet: KITE_TESTNET,
};
