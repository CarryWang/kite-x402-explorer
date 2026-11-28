import type { PaymentProofRecord } from '../types/proof.js';
import { isProofRecord } from '../lib/proof-schema.js';

const STORAGE_KEY = 'kite_x402_proof_records_v1';
type ProofUpdateListener = (proofs: PaymentProofRecord[]) => void;
const listeners: Set<ProofUpdateListener> = new Set();

/**
 * Retrieves all stored payment proof records from local storage.
 */
export function getStoredProofs(): PaymentProofRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProofRecord).slice(0, 100) : [];
  } catch (err) {
    console.warn('Failed to parse stored payment proofs from localStorage', err);
    return [];
  }
}

/**
 * Saves a payment proof record to local storage and alerts active listeners.
 */
export function saveProof(
  proofData: Omit<PaymentProofRecord, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): PaymentProofRecord {
  const current = getStoredProofs();

  const newRecord: PaymentProofRecord = {
    ...proofData,
    id: proofData.id || `prf_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`,
    timestamp: proofData.timestamp || new Date().toISOString(),
  };

  // Prepend new record, cap at 100 items to avoid quota issues
  const updated = [newRecord, ...current].slice(0, 100);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to write payment proof to localStorage', err);
  }

  notifyListeners(updated);
  return newRecord;
}

/** At most this many records are kept; the oldest are dropped first. */
export const MAX_STORED_PROOFS = 100;

const newestFirst = (a: PaymentProofRecord, b: PaymentProofRecord) => Date.parse(b.timestamp) - Date.parse(a.timestamp);

/**
 * Imports an array of payment proof records into local storage, merging and deduplicating by ID.
 * The merged list is ordered newest first and keeps the MAX_STORED_PROOFS newest records, so
 * importing old receipts never pushes out newer local ones. `skipped` counts new records that
 * were not kept because they are older than all retained records.
 */
export function importProofs(incoming: PaymentProofRecord[]): { added: number; skipped: number; total: number } {
  if (!incoming || incoming.length === 0) {
    return { added: 0, skipped: 0, total: getStoredProofs().length };
  }

  const current = getStoredProofs();
  const existingIds = new Set(current.map((p) => p.id));
  const newRecords: PaymentProofRecord[] = [];

  for (const record of incoming) {
    if (!isProofRecord(record)) continue;
    if (!existingIds.has(record.id)) {
      newRecords.push(record);
      existingIds.add(record.id);
    }
  }

  // Stable sort: on equal timestamps local records stay ahead of imported ones.
  const updated = [...current, ...newRecords].sort(newestFirst).slice(0, MAX_STORED_PROOFS);
  const kept = new Set(updated.map((p) => p.id));
  const added = newRecords.filter((p) => kept.has(p.id)).length;
  const skipped = newRecords.length - added;

  if (added > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to write imported proofs to localStorage', err);
    }
    notifyListeners(updated);
    return { added, skipped, total: updated.length };
  }

  return { added: 0, skipped, total: current.length };
}

/**
 * Deletes a single proof record by ID.
 */
export function deleteProof(id: string): void {
  const current = getStoredProofs();
  const updated = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove payment proof from localStorage', err);
  }
  notifyListeners(updated);
}

/**
 * Clears all proof records from local storage.
 */
export function clearAllProofs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear payment proofs from localStorage', err);
  }
  notifyListeners([]);
}

/**
 * Subscribes a React component to proof storage changes.
 */
export function subscribeToProofs(listener: ProofUpdateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(proofs: PaymentProofRecord[]): void {
  listeners.forEach((fn) => {
    try {
      fn(proofs);
    } catch (e) {
      console.error('Error notifying proof listener', e);
    }
  });
}
