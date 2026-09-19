# Kite x402 Service Explorer & Playground

> Autonomous AI Agent Micropayment Hub on the Kite Blockchain (EIP-155: 2366 / 2368).

![Kite x402 Icon](/public/kite-icon.svg)

## 📌 Overview

**Kite x402 Service Explorer & Playground** is an open-source developer hub and interactive playground tailored for the [Kite](https://gokite.ai) agentic economy. It bridges the gap between static `service.yaml` manifests in [`kite-x402-services`](https://github.com/gokite-ai/kite-x402-services) and real-world AI Agent integrations.

### Key Capabilities
- **Service Discovery & Catalog**: Browse, search, and filter verified x402-compliant paid HTTP services across categories (AI, Search, DeFi Security, Weather, Datasets).
- **Interactive x402 Protocol Playground**: Walk through the complete HTTP 402 payment lifecycle:
  1. Trigger unauthenticated request $\to$ receive `402 Payment Required` + base64 challenge.
  2. Inspect and verify EIP-3009 `TransferWithAuthorization` parameters.
  3. Re-dispatch request with `PAYMENT-SIGNATURE` $\to$ facilitator verification $\to$ on-chain settlement $\to$ `200 OK`.
- **Health Probing & Online Metrics**: Track latency and operational status of upstream `/healthz` endpoints.
- **Manifest Builder & Validator**: Visual generator to scaffold, validate against `service.schema.json`, and export PR-ready manifests for official Kite repository inclusion.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 10

### Installation

```bash
cd kite-x402-explorer
npm install
```

### Running Locally

```bash
# Start Vite development server
npm run dev

# Or run both frontend and CORS relay proxy:
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⛓️ Network Reference

| Environment | CAIP-2 Network | Chain ID | Asset | Facilitator |
| :--- | :--- | :--- | :--- | :--- |
| **Kite Testnet** | `eip155:2368` | 2368 | `pieUSD` (18 decimals) | `https://facilitator.pieverse.io/v2` |
| **Kite Mainnet** | `eip155:2366` | 2366 | `USDC.e` (6 decimals) | `https://facilitator.pieverse.io/v2` |

---

## 📁 Repository Structure

```
kite-x402-explorer/
├── docs/
│   ├── ARCHITECTURE.md       # Technical flowcharts & protocol specifications
│   └── ROADMAP.md            # 28-day daily milestone checklist
├── server/
│   └── index.ts              # Lightweight proxy for CORS relay & probing
├── src/
│   ├── components/
│   │   ├── common/           # Navbar, Badges, Modals
│   │   ├── directory/        # ServiceCard, DirectoryView, DetailModal
│   │   ├── docs/             # Roadmap & Architecture View
│   │   └── playground/       # 3-Step Interactive Protocol Tester
│   ├── lib/                  # Viem chains, x402 base64 decoders
│   ├── services/             # Sample datasets & manifest loader
│   ├── styles/               # CSS variables, dark-mode design system
│   ├── types/                # Manifest, Kite, & x402 TypeScript definitions
│   ├── App.tsx               # Main application component
│   └── main.tsx              # Application entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 📜 License

Apache-2.0
