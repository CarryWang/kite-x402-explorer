import crypto from 'node:crypto';

export interface CacheEntry {
  cacheKey: string;
  generationId: string;
  promptHash: string;
  topic: string;
  responsePayload: string;
  responseDigest: string;
  provider: string;
  cachedAt: number;
  expiresAt: number;
  basePriceUsd: number;
  discountBps: number; // e.g. 8000 = 80% discount
  hitCount: number;
  totalSavingsUsd: number;
}

export interface CacheLookupResult {
  hit: boolean;
  entry?: CacheEntry;
  effectivePriceUsd?: number;
  savingsUsd?: number;
  proof?: CacheHitProof;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
}

export interface CacheHitProof {
  cacheKey: string;
  generationId: string;
  promptHash: string;
  responseDigest: string;
  provider: string;
  effectivePriceUsd: number;
  discountBps: number;
  validUntil: number;
  proofSignature: string;
}

export interface CacheOracleMetrics {
  totalLookups: number;
  totalHits: number;
  totalMisses: number;
  hitRatio: number;
  activeEntries: number;
  totalUsdSaved: number;
}

export interface CacheRegisterParams {
  prompt: string;
  topic?: string;
  responsePayload: string;
  provider: string;
  basePriceUsd: number;
  discountBps?: number; // default 8000 (80%)
  ttlSeconds?: number;  // default 3600 (1 hour)
}

function proofPayload(proof: CacheHitProof): string {
  return JSON.stringify([
    proof.cacheKey, proof.generationId, proof.promptHash, proof.responseDigest,
    proof.provider, proof.effectivePriceUsd, proof.discountBps, proof.validUntil,
  ]);
}

export class SemanticCacheOracle {
  constructor(private readonly signingKey?: string) {}

  private entries = new Map<string, CacheEntry>();
  private totalLookups = 0;
  private totalHits = 0;
  private totalMisses = 0;
  private totalUsdSaved = 0;

  /**
   * Normalizes prompt text and computes a deterministic SHA-256 hash.
   */
  public static hashPrompt(prompt: string): string {
    const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Computes a deterministic SHA-256 digest of response payload.
   */
  public static digestPayload(payload: string): string {
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Registers a prompt response into the semantic cache.
   */
  public register(params: CacheRegisterParams): CacheEntry {
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }
    if (!Number.isFinite(params.basePriceUsd) || params.basePriceUsd <= 0) {
      throw new Error('Base price must be greater than zero');
    }

    const discountBps = params.discountBps ?? 8000;
    if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 9500) {
      throw new Error(`Discount BPS must be between 0 and 9500 (received ${discountBps})`);
    }

    const ttl = params.ttlSeconds ?? 3600;
    if (!Number.isSafeInteger(ttl) || ttl <= 0) {
      throw new Error('TTL must be greater than zero');
    }

    const promptHash = SemanticCacheOracle.hashPrompt(params.prompt);
    const responseDigest = SemanticCacheOracle.digestPayload(params.responsePayload);
    const now = Math.floor(Date.now() / 1000);
    const provider = params.provider.toLowerCase();
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${provider}:${promptHash}`)
      .digest('hex');

    const entry: CacheEntry = {
      cacheKey,
      generationId: crypto.randomUUID(),
      promptHash,
      topic: params.topic || 'general',
      responsePayload: params.responsePayload,
      responseDigest,
      provider,
      cachedAt: now,
      expiresAt: now + ttl,
      basePriceUsd: params.basePriceUsd,
      discountBps,
      hitCount: 0,
      totalSavingsUsd: 0,
    };

    this.entries.set(cacheKey, entry);
    return { ...entry };
  }

  /**
   * Queries the cache for a given prompt and provider.
   */
  public lookup(
    prompt: string,
    provider: string,
    now: number = Math.floor(Date.now() / 1000)
  ): CacheLookupResult {
    this.totalLookups++;
    const promptHash = SemanticCacheOracle.hashPrompt(prompt);
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${provider.toLowerCase()}:${promptHash}`)
      .digest('hex');

    const entry = this.entries.get(cacheKey);
    if (!entry) {
      this.totalMisses++;
      return { hit: false, reason: 'NOT_FOUND' };
    }

    if (now >= entry.expiresAt) {
      this.entries.delete(cacheKey);
      this.totalMisses++;
      return { hit: false, reason: 'EXPIRED' };
    }

    // Cache Hit!
    this.totalHits++;
    entry.hitCount++;

    const effectivePriceUsd = Number((entry.basePriceUsd * (10000 - entry.discountBps) / 10000).toPrecision(15));
    const savingsUsd = Number((entry.basePriceUsd - effectivePriceUsd).toPrecision(15));

    entry.totalSavingsUsd += savingsUsd;
    this.totalUsdSaved += savingsUsd;

    const proof = this.generateProof(entry, effectivePriceUsd);

    return {
      hit: true,
      entry: { ...entry },
      effectivePriceUsd,
      savingsUsd,
      proof,
    };
  }

  /**
   * Generates a signed cryptographic proof of cache hit.
   */
  private generateProof(entry: CacheEntry, effectivePriceUsd: number): CacheHitProof {
    const proof: CacheHitProof = {
      cacheKey: entry.cacheKey,
      generationId: entry.generationId,
      promptHash: entry.promptHash,
      responseDigest: entry.responseDigest,
      provider: entry.provider,
      effectivePriceUsd,
      discountBps: entry.discountBps,
      validUntil: entry.expiresAt,
      proofSignature: '',
    };
    // Without a trusted secret, the cache can still be queried locally, but its
    // output cannot be presented as an authenticated discount entitlement.
    if (this.signingKey) {
      proof.proofSignature = crypto.createHmac('sha256', this.signingKey).update(proofPayload(proof)).digest('hex');
    }
    return proof;
  }

  /**
   * Validates a cache hit proof.
   */
  public static verifyProof(
    proof: CacheHitProof,
    now: number = Math.floor(Date.now() / 1000),
    trustedSigningKey?: string,
    isActive?: (proof: CacheHitProof) => boolean
  ): boolean {
    if (!trustedSigningKey || !isActive || now >= proof.validUntil || !/^[0-9a-f]{64}$/i.test(proof.proofSignature)) {
      return false;
    }
    try {
      if (!isActive(proof)) return false;
    } catch {
      return false;
    }
    const expectedSig = crypto.createHmac('sha256', trustedSigningKey).update(proofPayload(proof)).digest();
    return crypto.timingSafeEqual(Buffer.from(proof.proofSignature, 'hex'), expectedSig);
  }

  /** Verify both authentication and current cache membership after revocation. */
  public verifyIssuedProof(proof: CacheHitProof, now: number = Math.floor(Date.now() / 1000)): boolean {
    return SemanticCacheOracle.verifyProof(proof, now, this.signingKey, (candidate) =>
      this.entries.get(candidate.cacheKey)?.generationId === candidate.generationId
    );
  }

  /**
   * Invalidates a specific cache entry.
   */
  public invalidate(cacheKey: string): boolean {
    return this.entries.delete(cacheKey);
  }

  /**
   * Invalidates all cache entries for a specific provider.
   */
  public invalidateByProvider(provider: string): number {
    const p = provider.toLowerCase();
    let count = 0;
    for (const [key, entry] of this.entries.entries()) {
      if (entry.provider === p) {
        this.entries.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Returns current cache telemetry metrics.
   */
  public getMetrics(): CacheOracleMetrics {
    const hitRatio = this.totalLookups > 0 ? Number((this.totalHits / this.totalLookups).toFixed(4)) : 0;
    return {
      totalLookups: this.totalLookups,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRatio,
      activeEntries: this.entries.size,
      totalUsdSaved: this.totalUsdSaved,
    };
  }
}
