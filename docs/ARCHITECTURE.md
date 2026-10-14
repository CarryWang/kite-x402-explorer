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
