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

## 4. Telemetry Streaming & Batch Multicall Probing

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

