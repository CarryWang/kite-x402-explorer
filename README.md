# Kite x402 Service Explorer & Playground

> Autonomous AI Agent Micropayment Hub on the Kite Blockchain (EIP-155: 2366 / 2368).

![Kite x402 Icon](/public/kite-icon.svg)

## 📌 Overview

**Kite x402 Service Explorer & Playground** is an open-source developer hub and interactive execution sandbox tailored for the [Kite](https://gokite.ai) agentic economy. It bridges static `service.yaml` manifests from [`kite-x402-services`](https://github.com/gokite-ai/kite-x402-services) into live, verifiable Web3 execution, telemetry, and automated auditing.

### Key Capabilities

1. **Service Directory & Inspection**:
   - Multi-facet filtering by category (`AI`, `Search`, `DeFi`, `Weather`, `Data`), status (`live`, `testnet`, `draft`), and network.
   - Deep endpoint inspection drawer with parameter schemas, pricing, token unit conversion, and multi-language client code generator (cURL, TypeScript, Python, Agent Tool).

2. **Interactive x402 Protocol Playground**:
   - 3-step interactive protocol execution:
     - **Step 1**: Discover HTTP 402 challenge & parse `PAYMENT-REQUIRED` headers.
     - **Step 2**: EIP-3009 `TransferWithAuthorization` typed signing with browser wallets (MetaMask/Rabby) or sandbox agent key generator.
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
   - Automated 5-stage on-chain diagnostic runner testing RPC block heights, pieUSD domain separator hashes, Facilitator status, EIP-3009 constructors, and 5xx zero-deduction safety invariants.

---

## 🚀 Quick Start

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

## 📜 License

Apache-2.0
