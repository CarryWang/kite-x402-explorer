# Technical Architecture: Kite x402 Explorer & Playground

This document outlines the system architecture, protocol message lifecycle, and cryptographic verification flow underpinning the Kite x402 Explorer.

---

## 1. Protocol Sequence Flow

The x402 protocol specification utilizes standard HTTP status codes combined with EIP-712 structured data signing over EVM chains:

```
+----------------+          +-------------------------+          +-----------------------+          +--------------------+
|  Agent Client  |          |  x402 Wrapper / Proxy   |          |  Payment Facilitator  |          |  Upstream Web2 API |
+----------------+          +-------------------------+          +-----------------------+          +--------------------+
        |                                |                                   |                                 |
        |  1. GET /v1/resource           |                                   |                                 |
        |------------------------------->|                                   |                                 |
        |                                |                                   |                                 |
        |  2. HTTP 402 Payment Required  |                                   |                                 |
        |     Header: PAYMENT-REQUIRED   |                                   |                                 |
        |<-------------------------------|                                   |                                 |
        |                                |                                   |                                 |
        |  [Client parses base64 header] |                                   |                                 |
        |  [Signs EIP-3009 Transfer]     |                                   |                                 |
        |                                |                                   |                                 |
        |  3. GET /v1/resource           |                                   |                                 |
        |     Header: PAYMENT-SIGNATURE  |                                   |                                 |
        |------------------------------->|                                   |                                 |
        |                                |  4. POST /verify                  |                                 |
        |                                |---------------------------------->|                                 |
        |                                |  5. 200 OK (Signature Valid)     |                                 |
        |                                |<----------------------------------|                                 |
        |                                |                                   |                                 |
        |                                |  6. Proxy Request (Stripped /v1)  |                                 |
        |                                |-------------------------------------------------------------------->|
        |                                |  7. 200 OK Upstream Payload       |                                 |
        |                                |<--------------------------------------------------------------------|
        |                                |                                   |                                 |
        |                                |  8. POST /settle (Broadcasts Tx)  |                                 |
        |                                |---------------------------------->|                                 |
        |                                |  9. Tx Hash Settled on Kite       |                                 |
        |                                |<----------------------------------|                                 |
        |                                |                                   |                                 |
        | 10. HTTP 200 OK + Upstream JSON|                                   |                                 |
        |     Header: PAYMENT-RESPONSE   |                                   |                                 |
        |<-------------------------------|                                   |                                 |
```

---

## 2. EIP-3009 Authorization Structure

Payment authorization on the Kite network implements `TransferWithAuthorization`:

```typescript
const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'v', type: 'uint8' },
    { name: 'r', type: 'bytes32' },
    { name: 's', type: 'bytes32' }
  ]
};
```

### Critical Rules
1. **Never Settle Before Upstream Returns < 400**: If the upstream service fails with 5xx or 4xx, the payment middleware must abort settlement.
2. **Facilitator Base URL**: Always appends `/v2` (e.g. `https://facilitator.pieverse.io/v2`).
3. **Exact Token Domain Names**:
   - Testnet: `name: "pieUSD"`, `version: "1"`, `chainId: 2368`
   - Mainnet: `name: "Bridged USDC (Kite AI)"`, `version: "2"`, `chainId: 2366`

---

## 3. Component Hierarchy

```
App.tsx
├── Navbar.tsx (Brand, Navigation tabs, Network switcher)
├── DirectoryView.tsx (Search, Category filters, Stats)
│   └── ServiceCard.tsx (Pricing, Network badge, Endpoints preview)
├── ServiceDetailModal.tsx (Deep inspect, Schema specs, cURL/TS code snippets)
├── PlaygroundView.tsx (3-step payment flow simulation & JSON response viewer)
└── DocsView.tsx (Architecture docs & 28-day roadmap)
```

---

## 4. Multi-Agent Swarm DAG & Bounty Allocation Flow

In collaborative multi-agent swarms (e.g., `kite-agent-swarm`), a master coordinator decomposes a complex goal into a Directed Acyclic Graph (DAG) of subtasks executed by specialized agents (e.g., data crawlers, analyzers, verifiers).

### Atomic Settlement & Conservation Rule
When splitting protocol bounties or service payouts across swarm agents, the `SwarmBudgetAllocator` enforces exact conservation of funds:

$$\sum_{i} \text{allocated\_amount}_i + \text{dust\_refund} = \text{total\_bounty\_wei}$$

1. **Basis Points Split**: Each agent's share is quantified in basis points ($\text{bps}$, where $10000 \text{ bps} = 100\%$).
2. **Dust Protection**: Remainder fractions from integer division (`total_bounty_wei % 10000n`) are preserved and refunded to the designated treasury or coordinator address, guaranteeing zero wei loss.
3. **Execution Dependency Graph**: Each subtask records upstream dependency receipts, ensuring downstream agents only trigger x402 payment authorizations upon verifiable cryptographic proof of prerequisite steps.

---

## 5. Telemetry Streaming & Batch Multicall Probing

High-throughput autonomous agent networks require sub-second state queries and real-time observability across x402 payment settlements.

### Architecture Overview
1. **Multicall3 Aggregate Pattern (`0xcA11...CA11`)**:
   - Compresses hundreds of sequential contract state inspections (e.g. checking agent authorization nonces, token balances, and facilitator parameters) into a single RPC query via canonical Multicall3 `aggregate3`.
   - Dramatically cuts RPC round-trips and eliminates rate-limiting stalls for swarm agents.

2. **Real-time Settlement Stream (`/v1/telemetry/stream`)**:
   - `kite-agent-telemetry-indexer` monitors `TransferWithAuthorization` logs emitted across Kite Mainnet (2366) and Testnet (2368).
   - Delivers low-latency Server-Sent Events (SSE) to connected dashboards, explorers, and downstream settlement triggers.

3. **Batch Endpoint Health Probe (`evaluateEndpointProbe`)**:
   - Parallel probe evaluating HTTP 402 handshake headers (`PAYMENT-REQUIRED`) and latency thresholds to prevent dispatching agent workloads to degraded endpoints.

---

## 6. Optimistic Dispute Window & Slashing Protocol

To ensure trustless execution between untrusted autonomous agents without requiring synchronous on-chain proofs for every micropayment, the network implements an **Optimistic Dispute Window**:

1. **Challenge Window Lifecycle (`isWithinChallengeWindow`)**:
   - Every confirmed x402 payment enters a 3,600-second optimistic challenge period.
   - Any watcher or payer agent can challenge an invalid outcome (e.g. hash mismatch, upstream SLA breach, or falsified payload) by staking a challenger bond.

2. **Economic Slashing Distribution (`calculateSlashingPayout`)**:
   - If a provider is proven fraudulent, their escrowed bond is slashed:
     - **80%** is refunded directly to the aggrieved payer agent.
     - **15%** is distributed to the challenger who submitted the fraud proof.
     - **5%** is retained in the arbiter DAO treasury for protocol maintenance.

---

## 7. High-Throughput Stream Routing & State Channel Micropayments

When autonomous agents consume high-frequency, continuous data feeds (such as LLM token streaming or sensor telemetry), performing individual on-chain authorizations for each payload incurs prohibitive latency.

### State Channel Architecture
1. **Cumulative Micro-Tickets (`allocateStreamTicket`)**:
   - The payer agent opens an off-chain micro-channel with designated capacity.
   - For each streaming chunk, an incrementing nonce ticket with cumulative owed wei is signed and transmitted over HTTP headers (`PAYMENT-SIGNATURE`).

2. **Batched Checkpoint Settlement (`shouldTriggerCheckpoint`)**:
   - The recipient verifies tickets off-chain with sub-millisecond overhead.
   - Checkpoint settlements are triggered only when cumulative volume crosses `settlementThresholdWei` or the stream terminates, consolidating hundreds of micropayments into a single on-chain EIP-3009 transaction.

3. **Dynamic Mesh Routing (`/v1/router/route-stream`)**:
   - Workload router continuously probes candidate gateways to dispatch queries along the lowest-latency, cost-optimal path.

---

## 8. Milestone Task Escrow & Conditional Payment Release

For complex, long-running agent assignments (e.g. distributed crawling, neural network fine-tuning, or multi-step code synthesis), full payment upfront poses risk to the client, while zero payment upfront poses risk to the agent worker.

### Escrow Vault Protocol
1. **Basis Points Conservation (`createMilestoneTask`)**:
   - The client deposits the total task bounty into a locked escrow vault.
   - Milestone allocations are defined in basis points ($\text{bps}$, $10000 = 100\%$). The final milestone absorbs integer division rounding dust, ensuring exact conservation of funds.

2. **Deliverable Verification & Progressive Release (`releaseMilestonePayout`)**:
   - As each stage is completed, the agent worker submits cryptographic proof of the deliverable (e.g. SHA-256 artifact digest or IPFS CID).
   - Once verified, installment funds are released via EIP-3009 transfer to the worker agent without requiring full task completion.

3. **Time-Lock Expiration & Client Protection (`checkTimeoutRefundEligibility`)**:
   - If a worker agent stalls or becomes unresponsive before milestone deadlines, remaining locked funds are automatically eligible for full refund back to the client.
