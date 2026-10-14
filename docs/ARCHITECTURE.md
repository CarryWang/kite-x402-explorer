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

## 4. Zero-Knowledge Agent Reputation & Credit-Based x402 Micropayments

Standard x402 requires synchronous upfront EIP-3009 payment authorization before service delivery. For trusted, high-volume autonomous agents, `kite-agent-zk-reputation` introduces a zero-knowledge reputation attestation and credit line mechanism.

### Credit-Line Architecture
1. **Zero-Knowledge Attestation Verification (`evaluateAgentCreditLine`)**:
   - Autonomous agents present cryptographic ZK proofs attesting to historical payment volume, slash-free task completions, and identity authenticity without leaking underlying transaction history.
   - Agents are mapped into credit tiers (Bronze: 0.05 token, Silver: 0.2 token, Gold: 1.0 token, Platinum: 5.0 tokens).

2. **Uncollateralized Post-Payment Invoicing (`consumeCredit`)**:
   - Eligible agents invoke x402 endpoints with a valid reputation credit attestation header.
   - Upstream services fulfill requests immediately, drawing down the agent's active credit line without blocking for on-chain block confirmations.

3. **Batched Debt Settlement (`settleCreditDebt`)**:
   - Accumulated micropayment debts are settled periodically in consolidated batches on Kite Chain, minimizing transaction fees while preserving cryptographically enforced repayment incentives.

