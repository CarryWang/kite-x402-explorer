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

export function hashCapability(
  provider: string,
  name: string,
  version: string,
  costPerCallUsd: number
): string {
  const content = `${provider.toLowerCase()}:${name.toLowerCase()}:${version}:${costPerCallUsd.toFixed(6)}`;
  return createHash('sha256').update(content).digest('hex');
}
