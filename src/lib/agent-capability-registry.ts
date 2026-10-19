import { createHash } from 'node:crypto';

export type CapabilityCategory =
  | 'llm-inference'
  | 'code-execution'
  | 'data-oracle'
  | 'vector-embedding'
  | 'web-search';

export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  name: string;
  type: ParameterType;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface ToolFunctionSchema {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returnType?: string;
}

export interface AgentCapability {
  capabilityId: string;
  provider: `0x${string}`;
  name: string;
  version: string;
  category: CapabilityCategory;
  toolSchema: ToolFunctionSchema;
  costPerCallUsd: number;
  avgLatencyMs: number;
  reputationScore: number; // 0 to 100
  active: boolean;
  registeredAt: number;
  hash: string;
}

export interface CapabilityRegistrationInput {
  provider: string;
  name: string;
  version: string;
  category: CapabilityCategory;
  toolSchema: ToolFunctionSchema;
  costPerCallUsd: number;
  avgLatencyMs: number;
  reputationScore: number;
}

export interface CapabilityQuery {
  category?: CapabilityCategory;
  maxCostUsd?: number;
  maxLatencyMs?: number;
  minReputation?: number;
  keyword?: string;
  limit?: number;
}

export interface ParetoEvaluation {
  capability: AgentCapability;
  score: number;
  normalizedCostScore: number;
  normalizedLatencyScore: number;
  reputationScore: number;
}

export function normalizeAddress(address: string): `0x${string}` {
  const trimmed = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    throw new Error(`Invalid Ethereum address format: ${address}`);
  }
  return trimmed as `0x${string}`;
}

export function validateToolSchema(schema: ToolFunctionSchema): void {
  if (!schema.name || schema.name.trim().length === 0) {
    throw new Error('ToolFunctionSchema name cannot be empty');
  }
  if (!Array.isArray(schema.parameters)) {
    throw new Error('ToolFunctionSchema parameters must be an array');
  }
  for (const param of schema.parameters) {
    if (!param.name || param.name.trim().length === 0) {
      throw new Error('ToolParameter name cannot be empty');
    }
    const validTypes: ParameterType[] = ['string', 'number', 'boolean', 'object', 'array'];
    if (!validTypes.includes(param.type)) {
      throw new Error(`Invalid parameter type: ${param.type}`);
    }
  }
}

export function hashCapability(input: CapabilityRegistrationInput): string {
  const content = JSON.stringify([
    normalizeAddress(input.provider), input.name.trim().toLowerCase(), input.version,
    input.category, input.toolSchema, input.costPerCallUsd, input.avgLatencyMs,
    input.reputationScore,
  ]);
  return createHash('sha256').update(content).digest('hex');
}

export class AgentCapabilityRegistry {
  private capabilities: Map<string, AgentCapability> = new Map();

  constructor(private readonly verifyRegistration?: (input: CapabilityRegistrationInput) => boolean) {
    if (typeof verifyRegistration !== 'function') {
      throw new Error('Trusted provider and reputation verification is required');
    }
  }

  private snapshot(capability: AgentCapability): AgentCapability {
    return structuredClone(capability);
  }

  public registerCapability(input: CapabilityRegistrationInput): AgentCapability {
    const provider = normalizeAddress(input.provider);
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Capability name cannot be empty');
    }
    if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
      throw new Error(`Invalid semver version: ${input.version}`);
    }
    if (
      typeof input.costPerCallUsd !== 'number' ||
      input.costPerCallUsd <= 0 ||
      !Number.isFinite(input.costPerCallUsd)
    ) {
      throw new Error(`Cost per call must be a positive number: ${input.costPerCallUsd}`);
    }
    if (
      typeof input.avgLatencyMs !== 'number' ||
      input.avgLatencyMs < 0 ||
      !Number.isFinite(input.avgLatencyMs)
    ) {
      throw new Error(`Average latency must be non-negative: ${input.avgLatencyMs}`);
    }
    if (
      typeof input.reputationScore !== 'number' ||
      input.reputationScore < 0 ||
      input.reputationScore > 100 ||
      !Number.isFinite(input.reputationScore)
    ) {
      throw new Error(`Reputation score must be between 0 and 100: ${input.reputationScore}`);
    }
    validateToolSchema(input.toolSchema);
    if (!this.verifyRegistration?.(input)) {
      throw new Error('Provider and reputation verification failed');
    }

    const capabilityId = `cap_${provider.slice(2)}_${input.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${input.version}`;
    if (this.capabilities.has(capabilityId)) {
      throw new Error(`Capability already registered: ${capabilityId}`);
    }

    const hash = hashCapability(input);
    const capability: AgentCapability = {
      capabilityId,
      provider,
      name: input.name.trim(),
      version: input.version,
      category: input.category,
      toolSchema: input.toolSchema,
      costPerCallUsd: input.costPerCallUsd,
      avgLatencyMs: input.avgLatencyMs,
      reputationScore: input.reputationScore,
      active: true,
      registeredAt: Date.now(),
      hash,
    };

    this.capabilities.set(capabilityId, this.snapshot(capability));
    return this.snapshot(capability);
  }

  public getCapability(capabilityId: string): AgentCapability | undefined {
    const capability = this.capabilities.get(capabilityId);
    return capability ? this.snapshot(capability) : undefined;
  }

  public listCapabilities(provider?: string): AgentCapability[] {
    const all = Array.from(this.capabilities.values());
    if (!provider) {
      return all.map((capability) => this.snapshot(capability));
    }
    const normalized = normalizeAddress(provider);
    return all.filter((c) => c.provider === normalized).map((capability) => this.snapshot(capability));
  }

  public updateCapabilityStatus(capabilityId: string, active: boolean): boolean {
    const existing = this.capabilities.get(capabilityId);
    if (!existing) {
      return false;
    }
    existing.active = active;
    return true;
  }

  public deregisterCapability(capabilityId: string): boolean {
    return this.capabilities.delete(capabilityId);
  }

  public queryCapabilities(query: CapabilityQuery): ParetoEvaluation[] {
    let filtered = Array.from(this.capabilities.values()).filter((c) => c.active);

    if (query.category) {
      filtered = filtered.filter((c) => c.category === query.category);
    }
    if (typeof query.maxCostUsd === 'number') {
      filtered = filtered.filter((c) => c.costPerCallUsd <= query.maxCostUsd!);
    }
    if (typeof query.maxLatencyMs === 'number') {
      filtered = filtered.filter((c) => c.avgLatencyMs <= query.maxLatencyMs!);
    }
    if (typeof query.minReputation === 'number') {
      filtered = filtered.filter((c) => c.reputationScore >= query.minReputation!);
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(kw) ||
          c.toolSchema.description.toLowerCase().includes(kw) ||
          c.toolSchema.parameters.some((p) => p.name.toLowerCase().includes(kw))
      );
    }

    const evaluations: ParetoEvaluation[] = filtered.map((c) => {
      const normalizedCostScore = 1 / (1 + c.costPerCallUsd * 100);
      const normalizedLatencyScore = 1 / (1 + c.avgLatencyMs / 1000);
      const repScore = c.reputationScore / 100;

      const score = repScore * 0.4 + normalizedCostScore * 0.35 + normalizedLatencyScore * 0.25;

      return {
        capability: this.snapshot(c),
        score,
        normalizedCostScore,
        normalizedLatencyScore,
        reputationScore: c.reputationScore,
      };
    });

    evaluations.sort((a, b) => b.score - a.score);

    if (typeof query.limit === 'number' && query.limit > 0) {
      return evaluations.slice(0, query.limit);
    }
    return evaluations;
  }

  public validateToolInvocationArgs(
    capabilityId: string,
    args: Record<string, unknown>
  ): ArgumentValidationResult {
    const capability = this.capabilities.get(capabilityId);
    if (!capability || !capability.active) {
      return {
        valid: false,
        errors: [`Capability not found: ${capabilityId}`],
      };
    }

    const errors: string[] = [];
    const schema = capability.toolSchema;

    for (const param of schema.parameters) {
      const val = args[param.name];

      if (val === undefined || val === null) {
        if (param.required) {
          errors.push(`Missing required parameter: '${param.name}'`);
        }
        continue;
      }

      switch (param.type) {
        case 'string':
          if (typeof val !== 'string') {
            errors.push(`Parameter '${param.name}' must be a string, got ${typeof val}`);
          } else if (param.enum && !param.enum.includes(val)) {
            errors.push(
              `Parameter '${param.name}' value '${val}' is not in allowed enum: [${param.enum.join(', ')}]`
            );
          }
          break;
        case 'number':
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            errors.push(`Parameter '${param.name}' must be a finite number, got ${typeof val}`);
          }
          break;
        case 'boolean':
          if (typeof val !== 'boolean') {
            errors.push(`Parameter '${param.name}' must be a boolean, got ${typeof val}`);
          }
          break;
        case 'array':
          if (!Array.isArray(val)) {
            errors.push(`Parameter '${param.name}' must be an array`);
          }
          break;
        case 'object':
          if (typeof val !== 'object' || val === null || Array.isArray(val)) {
            errors.push(`Parameter '${param.name}' must be an object`);
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export interface ArgumentValidationResult {
  valid: boolean;
  errors: string[];
}
