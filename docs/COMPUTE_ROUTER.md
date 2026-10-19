# Kite Multi-Tier AI Compute Router & Execution Allocator

## Overview

In autonomous multi-agent networks operating on the Kite Blockchain, agents dynamically negotiate and purchase AI compute through x402 micropayments. Different tasks have vastly different requirements:
- **Fast, high-throughput tasks** (e.g., entity extraction, telemetry scoring, translation) prioritize ultra-low latency (<150ms) and low micro-costs.
- **Complex orchestration tasks** (e.g., recursive code synthesis, multi-hop reasoning, formal verification) require Chain-of-Thought reasoning engines with higher token capacities.

The `ComputeTierRouter` provides a deterministic, SLA-aware routing layer that matches an incoming agent request against standardized compute tiers, enforcing budget constraints and issuing verifiable cryptographic execution tickets.

---

## Compute Tier Specification Matrix

| Tier | Model Identifier | Base Cost (pieUSD) | Token Rate (per 1k) | Max Context | Max Output | Target p95 Latency | Reasoning Support |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nano** | `kite-nano-v1` | 0.00010 | 0.00005 | 8,192 | 2,048 | 120 ms | No |
| **Balanced** | `kite-balanced-v2` | 0.00050 | 0.00020 | 32,768 | 8,192 | 450 ms | No |
| **Reasoning** | `kite-reasoning-r1` | 0.00200 | 0.00100 | 65,536 | 16,384 | 1,800 ms | Yes |
| **Deep-Inference** | `kite-deep-math-r1` | 0.00800 | 0.00400 | 131,072 | 32,768 | 4,200 ms | Yes |

---

## Routing & Cost Evaluation Flow

1. **Parameter Validation**: Ensures prompt tokens $> 0$, max completion tokens $\ge 0$, and positive maximum budget.
2. **Capability Filtering**: If `requireReasoning` is enabled, non-reasoning tiers (`nano`, `balanced`) are automatically disqualified.
3. **Constraint Check**:
   - $\text{promptTokens} \le \text{tier.maxContextTokens}$
   - $\text{maxCompletionTokens} \le \text{tier.maxOutputTokens}$
   - $\text{tier.p95LatencyMs} \le \text{request.maxAllowedLatencyMs}$ (if SLA latency is specified)
4. **Dynamic Cost Calculation**:
   $$\text{Total Cost} = \text{Base Cost} + \left\lceil \frac{(\text{Prompt Tokens} + \text{Completion Tokens}) \times \text{Token Rate}}{1000} \right\rceil$$
5. **Fallback Degradation**: If an agent requests a preferred tier (e.g. `reasoning`) but their maximum allocated budget is insufficient, the router attempts graceful degradation to compatible lower tiers (e.g. `balanced`).
6. **Execution Ticket Issuance**: When a route is approved, the engine computes a deterministic execution ticket hash (`0xtkt_<hash>`) linking the request ID, payer address, selected model, and committed payment units.
