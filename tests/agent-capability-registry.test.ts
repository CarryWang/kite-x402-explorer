import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentCapabilityRegistry,
  type CapabilityRegistrationInput,
  type ToolFunctionSchema,
} from '../src/lib/agent-capability-registry.ts';

const providerA = '0x1111111111111111111111111111111111111111';
const providerB = '0x2222222222222222222222222222222222222222';

const sampleToolSchema: ToolFunctionSchema = {
  name: 'generate_text_summary',
  description: 'Summarizes long-form technical articles into concise bullet points',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The source text to summarize',
      required: true,
    },
    {
      name: 'max_bullets',
      type: 'number',
      description: 'Maximum bullet points to generate',
      required: false,
      default: 5,
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format style',
      required: false,
      enum: ['markdown', 'plain', 'json'],
      default: 'markdown',
    },
  ],
  returnType: 'string',
};

test('registers capability successfully with valid schema and sha256 hash', () => {
  const registry = new AgentCapabilityRegistry(() => true);
  const input: CapabilityRegistrationInput = {
    provider: providerA,
    name: 'Summarizer Pro',
    version: '1.0.0',
    category: 'llm-inference',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.002,
    avgLatencyMs: 450,
    reputationScore: 92,
  };

  const cap = registry.registerCapability(input);
  assert.equal(cap.name, 'Summarizer Pro');
  assert.equal(cap.version, '1.0.0');
  assert.equal(cap.category, 'llm-inference');
  assert.equal(cap.costPerCallUsd, 0.002);
  assert.equal(cap.reputationScore, 92);
  assert.equal(cap.active, true);
  assert.match(cap.capabilityId, /^cap_1111111111111111111111111111111111111111_summarizer_pro_1\.0\.0$/);
  assert.match(cap.hash, /^[0-9a-f]{64}$/);
});

test('rejects registration with invalid parameters', () => {
  const registry = new AgentCapabilityRegistry(() => true);
  const baseInput: CapabilityRegistrationInput = {
    provider: providerA,
    name: 'Tool',
    version: '1.0.0',
    category: 'code-execution',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.001,
    avgLatencyMs: 100,
    reputationScore: 80,
  };

  // Bad provider address
  assert.throws(
    () => registry.registerCapability({ ...baseInput, provider: 'invalid-address' }),
    /Invalid Ethereum address/
  );

  // Empty name
  assert.throws(
    () => registry.registerCapability({ ...baseInput, name: '   ' }),
    /name cannot be empty/
  );

  // Bad semver
  assert.throws(
    () => registry.registerCapability({ ...baseInput, version: 'v1.0' }),
    /Invalid semver/
  );

  // Non-positive cost
  assert.throws(
    () => registry.registerCapability({ ...baseInput, costPerCallUsd: 0 }),
    /Cost per call must be a positive number/
  );
  assert.throws(
    () => registry.registerCapability({ ...baseInput, costPerCallUsd: -0.05 }),
    /Cost per call must be a positive number/
  );

  // Negative latency
  assert.throws(
    () => registry.registerCapability({ ...baseInput, avgLatencyMs: -10 }),
    /Average latency must be non-negative/
  );

  // Reputation outside 0-100
  assert.throws(
    () => registry.registerCapability({ ...baseInput, reputationScore: 105 }),
    /Reputation score must be between 0 and 100/
  );
  assert.throws(
    () => registry.registerCapability({ ...baseInput, reputationScore: -5 }),
    /Reputation score must be between 0 and 100/
  );
});

test('rejects duplicate capability registration', () => {
  const registry = new AgentCapabilityRegistry(() => true);
  const input: CapabilityRegistrationInput = {
    provider: providerA,
    name: 'Embedder',
    version: '1.0.0',
    category: 'vector-embedding',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.0005,
    avgLatencyMs: 80,
    reputationScore: 88,
  };

  registry.registerCapability(input);
  assert.throws(
    () => registry.registerCapability(input),
    /already registered/
  );
});

test('lists and filters capabilities by provider and handles status updates', () => {
  const registry = new AgentCapabilityRegistry(() => true);
  const capA = registry.registerCapability({
    provider: providerA,
    name: 'Service A',
    version: '1.0.0',
    category: 'data-oracle',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.001,
    avgLatencyMs: 200,
    reputationScore: 85,
  });

  const capB = registry.registerCapability({
    provider: providerB,
    name: 'Service B',
    version: '1.0.0',
    category: 'data-oracle',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.003,
    avgLatencyMs: 150,
    reputationScore: 90,
  });

  assert.equal(registry.listCapabilities().length, 2);
  assert.equal(registry.listCapabilities(providerA).length, 1);
  assert.equal(registry.listCapabilities(providerA)[0]?.capabilityId, capA.capabilityId);

  // Deactivate Service A
  const updated = registry.updateCapabilityStatus(capA.capabilityId, false);
  assert.equal(updated, true);
  assert.equal(registry.getCapability(capA.capabilityId)?.active, false);

  // Deactivated capability is excluded from queryCapabilities
  const activeQueries = registry.queryCapabilities({ category: 'data-oracle' });
  assert.equal(activeQueries.length, 1);
  assert.equal(activeQueries[0]?.capability.capabilityId, capB.capabilityId);

  // Deregister Service B
  assert.equal(registry.deregisterCapability(capB.capabilityId), true);
  assert.equal(registry.getCapability(capB.capabilityId), undefined);
});

test('queryCapabilities filters by category, cost, latency, reputation, and keyword', () => {
  const registry = new AgentCapabilityRegistry(() => true);

  registry.registerCapability({
    provider: providerA,
    name: 'Web Search Engine',
    version: '1.0.0',
    category: 'web-search',
    toolSchema: {
      name: 'search_web',
      description: 'Real-time crawler and search index',
      parameters: [{ name: 'query', type: 'string', description: 'search query', required: true }],
    },
    costPerCallUsd: 0.005,
    avgLatencyMs: 600,
    reputationScore: 95,
  });

  registry.registerCapability({
    provider: providerB,
    name: 'Fast Vector Embedding',
    version: '1.0.0',
    category: 'vector-embedding',
    toolSchema: {
      name: 'embed_tokens',
      description: 'High-throughput 768-dim embeddings',
      parameters: [{ name: 'tokens', type: 'array', description: 'token array', required: true }],
    },
    costPerCallUsd: 0.0008,
    avgLatencyMs: 50,
    reputationScore: 99,
  });

  // Filter category
  const searchOnly = registry.queryCapabilities({ category: 'web-search' });
  assert.equal(searchOnly.length, 1);
  assert.equal(searchOnly[0]?.capability.name, 'Web Search Engine');

  // Filter maxCostUsd
  const cheapOnly = registry.queryCapabilities({ maxCostUsd: 0.002 });
  assert.equal(cheapOnly.length, 1);
  assert.equal(cheapOnly[0]?.capability.name, 'Fast Vector Embedding');

  // Filter maxLatencyMs
  const fastOnly = registry.queryCapabilities({ maxLatencyMs: 100 });
  assert.equal(fastOnly.length, 1);

  // Filter minReputation
  const highRep = registry.queryCapabilities({ minReputation: 98 });
  assert.equal(highRep.length, 1);
  assert.equal(highRep[0]?.capability.name, 'Fast Vector Embedding');

  // Filter keyword
  const keywordMatch = registry.queryCapabilities({ keyword: 'embeddings' });
  assert.equal(keywordMatch.length, 1);
  assert.equal(keywordMatch[0]?.capability.name, 'Fast Vector Embedding');
});

test('ranks query results using Pareto efficiency composite scores', () => {
  const registry = new AgentCapabilityRegistry(() => true);

  // Premium: high rep (99), higher cost (0.01), moderate latency (300ms)
  registry.registerCapability({
    provider: providerA,
    name: 'Premium Inference',
    version: '1.0.0',
    category: 'llm-inference',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.01,
    avgLatencyMs: 300,
    reputationScore: 99,
  });

  // Balanced: good rep (95), low cost (0.001), low latency (100ms)
  registry.registerCapability({
    provider: providerB,
    name: 'Balanced Inference',
    version: '1.0.0',
    category: 'llm-inference',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.001,
    avgLatencyMs: 100,
    reputationScore: 95,
  });

  // Cheap but slow: low rep (70), very low cost (0.0005), high latency (1200ms)
  registry.registerCapability({
    provider: providerA,
    name: 'Budget Inference',
    version: '1.0.0',
    category: 'llm-inference',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.0005,
    avgLatencyMs: 1200,
    reputationScore: 70,
  });

  const results = registry.queryCapabilities({ category: 'llm-inference' });
  assert.equal(results.length, 3);
  // Balanced should rank highest due to combined low cost, low latency and high rep
  assert.equal(results[0]?.capability.name, 'Balanced Inference');
  assert.ok(results[0]!.score > results[1]!.score);
  assert.ok(results[1]!.score > results[2]!.score);
});

test('validates tool invocation arguments correctly against schema constraints', () => {
  const registry = new AgentCapabilityRegistry(() => true);
  const cap = registry.registerCapability({
    provider: providerA,
    name: 'Summarizer Pro',
    version: '1.0.0',
    category: 'llm-inference',
    toolSchema: sampleToolSchema,
    costPerCallUsd: 0.002,
    avgLatencyMs: 450,
    reputationScore: 92,
  });

  // Valid invocation
  const validCall = registry.validateToolInvocationArgs(cap.capabilityId, {
    content: 'Kite AI is an autonomous agent payment rail.',
    max_bullets: 3,
    format: 'markdown',
  });
  assert.equal(validCall.valid, true);
  assert.equal(validCall.errors.length, 0);

  // Missing required param 'content'
  const missingRequired = registry.validateToolInvocationArgs(cap.capabilityId, {
    max_bullets: 3,
  });
  assert.equal(missingRequired.valid, false);
  assert.match(missingRequired.errors[0]!, /Missing required parameter: 'content'/);

  // Invalid parameter type (string expected, got number)
  const wrongType = registry.validateToolInvocationArgs(cap.capabilityId, {
    content: 12345,
  });
  assert.equal(wrongType.valid, false);
  assert.match(wrongType.errors[0]!, /must be a string/);

  // Invalid enum value
  const badEnum = registry.validateToolInvocationArgs(cap.capabilityId, {
    content: 'hello',
    format: 'xml',
  });
  assert.equal(badEnum.valid, false);
  assert.match(badEnum.errors[0]!, /is not in allowed enum/);

  // Non-existent capability
  const nonExistent = registry.validateToolInvocationArgs('cap_nonexistent', {});
  assert.equal(nonExistent.valid, false);
  assert.match(nonExistent.errors[0]!, /Capability not found/);
});
