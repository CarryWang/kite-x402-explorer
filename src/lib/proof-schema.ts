import type { PaymentProofRecord } from '../types/proof.js';
import { KITE_CHAINS } from '../types/kite.js';

const address = /^0x[0-9a-fA-F]{40}$/;
const hash = /^0x[0-9a-fA-F]{64}$/;
const statuses = new Set(['settled', 'simulated', 'aborted_502', 'expired_sig', 'failed']);
const textFields = ['id', 'timestamp', 'serviceName', 'serviceDisplayName', 'endpointPath',
  'httpMethod', 'network', 'tokenSymbol', 'tokenAddress', 'amountFormatted',
  'amountRaw', 'payerAddress', 'payToAddress', 'status'] as const;

export function proofRecordErrors(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Expected a proof record object'];
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  for (const field of textFields) {
    if (typeof record[field] !== 'string' || !record[field] || (record[field] as string).length > 8192)
      errors.push(`Invalid or missing ${field}`);
  }
  if (errors.length) return errors;
  if (!Object.hasOwn(KITE_CHAINS, record.network as string)) errors.push('Unsupported payment network');
  if (!statuses.has(record.status as string)) errors.push('Unknown proof status');
  if (!Number.isFinite(Date.parse(record.timestamp as string))) errors.push('Invalid timestamp');
  for (const field of ['tokenAddress', 'payerAddress', 'payToAddress'])
    if (!address.test(record[field] as string)) errors.push(`Invalid ${field}`);
  if (!/^\d{1,78}$/.test(record.amountRaw as string) || BigInt(record.amountRaw as string) >= 2n ** 256n)
    errors.push('amountRaw must be an unsigned uint256 decimal string');
  if (!Number.isInteger(record.responseStatus) || (record.responseStatus as number) < 100 || (record.responseStatus as number) > 599)
    errors.push('Invalid HTTP response status');
  if (record.txHash !== undefined && (typeof record.txHash !== 'string' || !hash.test(record.txHash)))
    errors.push('Invalid transaction hash');
  if (record.status === 'settled' && !record.txHash) errors.push('A reported settlement must include a transaction hash');
  if (record.eip3009Details !== undefined) {
    const auth = record.eip3009Details as Record<string, unknown> | null;
    if (!auth || typeof auth !== 'object' || !address.test(String(auth.from)) || !address.test(String(auth.to)) ||
      typeof auth.value !== 'string' || !/^\d{1,78}$/.test(auth.value) || BigInt(auth.value) >= 2n ** 256n ||
      typeof auth.nonce !== 'string' || !hash.test(auth.nonce) ||
      !Number.isSafeInteger(auth.validAfter) || !Number.isSafeInteger(auth.validBefore) ||
      (auth.validAfter as number) < 0 || (auth.validBefore as number) < (auth.validAfter as number))
      errors.push('Invalid EIP-3009 authorization fields');
  }
  return errors;
}

export function isProofRecord(value: unknown): value is PaymentProofRecord {
  return proofRecordErrors(value).length === 0;
}
