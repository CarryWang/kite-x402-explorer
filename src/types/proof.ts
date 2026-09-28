/**
 * Type definitions for persistent proof logs and verifiable receipts.
 */

export type ProofStatus =
  | 'settled'
  | 'simulated'
  | 'aborted_502'
  | 'expired_sig'
  | 'failed';

export interface EIP3009AuthDetails {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v?: number;
  r?: string;
  s?: string;
}

export interface PaymentProofRecord {
  id: string;
  timestamp: string;
  serviceName: string;
  serviceDisplayName: string;
  endpointPath: string;
  httpMethod: string;
  network: string;
  tokenSymbol: string;
  tokenAddress: string;
  amountFormatted: string;
  amountRaw: string;
  payerAddress: string;
  payToAddress: string;
  status: ProofStatus;
  txHash?: string;
  rawChallengeHeader?: string;
  signedAuthorizationPayload?: string;
  eip3009Details?: EIP3009AuthDetails;
  responseStatus: number;
  responseBodySnippet?: string;
}

export interface VerifiablePaymentReceipt {
  $schema: string;
  receiptId: string;
  timestamp: string;
  protocol: {
    standard: string;
    version: number;
    specificationUrl: string;
  };
  service: {
    name: string;
    displayName: string;
    endpoint: string;
    method: string;
  };
  payment: {
    network: string;
    chainName: string;
    tokenSymbol: string;
    assetContract: string;
    amountFormatted: string;
    amountRaw: string;
    payer: string;
    payTo: string;
    authorization: {
      nonce: string;
      validAfter: number;
      validBefore: number;
      v?: number;
      r?: string;
      s?: string;
    };
    settlement: {
      settled: boolean;
      status: ProofStatus;
      txHash?: string;
      explorerUrl?: string;
      facilitator: string;
    };
  };
  verification: {
    clientVerified: boolean;
    guaranteeNote: string;
  };
}
