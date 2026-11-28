import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { AgentCapabilityRegistry, hashCapability, type CapabilityRegistrationInput } from '../src/lib/agent-capability-registry.js';

function input(): CapabilityRegistrationInput { return { provider: A, name: 'Original', version: '1.0.0',
  category: 'llm-inference', costPerCallUsd: 1, avgLatencyMs: 10, reputationScore: 80,
  toolSchema: { name: 'local', description: 'Local fixture', parameters: [{ name: 'query', type: 'string', required: true }] } }; }

test('registration installs the same verified provider and schema even when the caller reuses its input', () => {
  const original = input();
  const digest = hashCapability(original);
  const registry = new AgentCapabilityRegistry(() => {
    original.provider = B; original.name = 'Replacement'; original.costPerCallUsd = 0;
    original.toolSchema.parameters[0].type = 'number'; return true;
  });
  const capability = registry.registerCapability(original);
  assert.equal(capability.provider, A);
  assert.equal(capability.name, 'Original');
  assert.equal(capability.costPerCallUsd, 1);
  assert.equal(capability.hash, digest);
  assert.equal(capability.toolSchema.parameters[0].type, 'string');
});

test('verifier arguments cannot modify the policy later stored under a capability hash', () => {
  const registry = new AgentCapabilityRegistry((checked) => {
    checked.reputationScore = 1000;
    checked.toolSchema.parameters.length = 0;
    return true;
  });
  const capability = registry.registerCapability(input());
  assert.equal(capability.reputationScore, 80);
  assert.equal(registry.getCapability(capability.capabilityId)?.toolSchema.parameters.length, 1);
});
