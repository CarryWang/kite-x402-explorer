# Kite x402 Service Explorer & Playground

> Autonomous AI Agent Micropayment Hub on the Kite Blockchain (EIP-155: 2366 / 2368).

![Kite x402 Icon](/public/kite-icon.svg)

## 📌 Overview

**Kite x402 Service Explorer & Playground** is an open-source developer hub and interactive execution sandbox tailored for the [Kite](https://gokite.ai) agentic economy. It bridges static `service.yaml` manifests from [`kite-x402-services`](https://github.com/gokite-ai/kite-x402-services) into live, verifiable Web3 execution, telemetry, and automated auditing.

The bundled service directory and `/api/mock-x402` route are demonstration data. Their addresses and availability labels are not verified payment destinations. The mock route does not contact a facilitator or settle a transaction; generated proof records are marked `simulated`. The escrow, channel, dispute, revenue-share, reputation, semantic-cache, compute-router, data-attestation, and session-allowance modules are local prototypes rather than deployed contracts or services. Credit, attestation discounts, cache discounts, and delegated spend approval require trusted external verification before production use.

### Key Capabilities

1. **Service Directory & Inspection**:
   - Multi-facet filtering by category (`AI`, `Search`, `DeFi`, `Weather`, `Data`), status (`live`, `testnet`, `draft`), and network.
   - Deep endpoint inspection drawer with parameter schemas, pricing, token unit conversion, and multi-language client code generator (cURL, TypeScript, Python, Agent Tool).

2. **Interactive x402 Protocol Playground**:
   - 3-step interactive protocol execution:
     - **Step 1**: Discover HTTP 402 challenge & parse `PAYMENT-REQUIRED` headers.
     - **Step 2**: EIP-3009 `TransferWithAuthorization` typed signing with an isolated sandbox agent key. The local mock flow disables browser-wallet signing.
     - **Step 3**: Dispatch `PAYMENT-SIGNATURE` $\to$ facilitator settlement $\to$ HTTP 200 response.
   - Guardrails against edge cases: upstream 502 no-deduction protection & signature deadline validation.

3. **Health Probing & Latency Telemetry**:
   - Automated periodic probing against unmonetized `/healthz` and `/api/probe/:serviceName`.
   - Real-time status indicators (Healthy, Degraded, Down) with exact roundtrip millisecond latency metrics.
   - Auto-refresh controls (Off / 15s / 30s / 60s) and global telemetry status bar.

4. **Persistent Proof Logs & Verifiable Receipts**:
   - Local `localStorage` audit history tracking all 402 challenges, EIP-3009 signatures, and KiteScan settlement hashes.
   - Standardized `x402-receipt-v1.json` export with one-click download and clipboard copy.

5. **Manifest Visual Builder & Schema Linter**:
   - Form-based `service.yaml` generator with real-time Ajv validation against `service.schema.json`.
   - Preset templates for AI reasoning agents, DeFi oracles, and web crawlers.
   - Direct GitHub PR submission deep linker and Git CLI script generator.

6. **Kite Testnet E2E Suite**:
   - Read-only checks for RPC block heights, pieUSD domain separator and facilitator capabilities; an offline EIP-3009 signature roundtrip is separate. Payment failure/zero-deduction evidence remains blocked until a seller integration is available.

7. **Multi-Agent Quorum Consensus Engine**:
   - Byzantine fault-tolerant M-of-N decentralized AI inference verification.
   - Collects signed output digests from independent agent nodes and validates cryptographic integrity.
   - Dynamically calculates weighted micropayment rewards proportional to compute units provided by agreeing nodes, while slashing or penalizing dissenting and rogue outputs.
   - Enforces time-locked expiration windows with automated 100% client refund guarantees if quorum cannot be achieved.

---

## 🚀 Quick Start

Run `npm test` for payment safety regression tests and `npm run build` before deploying changes.

### Prerequisites
- Node.js >= 20
- npm >= 10

### Installation

```bash
git clone https://github.com/carry/kite-x402-explorer.git
cd kite-x402-explorer
npm install
```

### Running Locally

```bash
# Start Vite development server (Port 5173)
npm run dev

# Start Node.js x402 CORS Proxy & Relay server (Port 3001)
npm run server

# Or run both concurrently:
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Docker Production Deployment

Build and run the unified container (serves both optimized SPA assets and proxy endpoints):

```bash
# Build production Docker image
docker build -t kite-x402-explorer .

# Run container on port 3001
docker run -d -p 3001:3001 --name kite-explorer kite-x402-explorer
```

Access the application at [http://localhost:3001](http://localhost:3001).

The runtime installs only production dependencies and starts the locally installed
TypeScript loader directly, so startup does not need access to the npm registry.
After starting the container, run `npm run test:production` to verify the health
endpoint, service registry, manifest validation, mock x402 challenge, and built SPA
assets. Set `SMOKE_BASE_URL` if the server uses a different address or port.

CI runs the tests and build, then runs these smoke checks inside the production
Docker image with external networking disabled.

---

## ⛓️ Network Specifications

| Environment | CAIP-2 Network | Chain ID | Asset Contract | Token Symbol | Facilitator Endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Kite Testnet** | `eip155:2368` | 2368 | `0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A` | `pieUSD` (18 dec) | `https://facilitator.pieverse.io/v2` |
| **Kite Mainnet** | `eip155:2366` | 2366 | `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e` | `USDC.e` (6 dec) | `https://facilitator.pieverse.io/v2` |

---

## 📁 Repository Structure

```
kite-x402-explorer/
├── docs/
│   ├── ARCHITECTURE.md          # Technical flowcharts & protocol specifications
│   └── ROADMAP.md               # Weekly milestone tracker
├── server/
│   └── index.ts                 # Express proxy, mock simulator, and health endpoints
├── src/
│   ├── components/
│   │   ├── builder/             # Manifest Visual Builder & PR Submission Modal
│   │   ├── common/              # Navbar, StatusBadge, ProofLogDrawer, ErrorBoundary
│   │   ├── directory/           # DirectoryView, ServiceCard, ServiceDetailModal
│   │   ├── docs/                # Architecture & Protocol Documentation View
│   │   ├── e2e/                 # Kite Testnet E2E Suite & Diagnostic Runner
│   │   └── playground/          # Interactive x402 Protocol Tester & Visualizer
│   ├── lib/                     # Viem chains, EIP-3009 typed data, receipt exporter
│   ├── services/                # Health prober, proof logger, schema validator
│   ├── styles/                  # CSS variables, Web3 dark-mode design system
│   ├── types/                   # Manifest, health, proof, and x402 TypeScript interfaces
│   ├── App.tsx                  # App layout, router tabs, and state manager
│   └── main.tsx                 # Application entry point
├── Dockerfile                   # Multi-stage production container build
├── nginx.conf                   # Optional reverse proxy configuration
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Experimental agent market libraries

The batch settlement, bonding escrow, dynamic fee oracle, capability registry, subscription, relay, liquidity, bridge, insurance, state channel, arbitration, treasury, invoice, indexer, streaming, reputation, receipt proof, and anomaly modules are independent in-memory library prototypes. They are not wired into the API or a deployed contract and do not move funds. Their payment, payout, and cross-chain state changes require trusted external verification and durable state before production use.

- The batch bundler hashes receipts and builds Merkle proofs. A trusted integration must verify each EIP-3009 authorization before bundling and independently confirm the transaction and its transfers before recording settlement. The nonce set must be persisted. Net balances are analytical only: signed payer/recipient edges cannot be replaced by a newly inferred net transfer.
- The bonding module models locks, unbonding, and slashing in memory. It does not custody collateral, verify adjudication evidence, or compensate a beneficiary on-chain. A production integration must supply authenticated state transitions and a trusted dispute decision.
- The fee oracle requires an issuer-held secret to sign payable quotes. Its utilization inputs and clock must come from trusted server state.
- The capability registry requires a trusted provider and reputation verifier. Its score is an independent routing hint; registration does not prove a provider has bonded funds or completed a paid settlement.

---

## 📜 License

Apache-2.0

### Diagnostic evidence

The testnet suite performs read-only RPC and facilitator capability checks, compares DOMAIN_SEPARATOR on chain, and separately signs/recovers an ephemeral authorization offline. RPC/CORS failures never generate block heights or successful checks. Reports include the evidence scope and `settlementVerified:false`; the zero-deduction check is blocked until an instrumented seller and balance evidence are available. No payment is submitted by this suite.
