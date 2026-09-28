import type { PaymentProofRecord } from '../types/proof.js';

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
    return JSON.parse(raw);
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
