# Engineering Roadmap & Release Milestones (Weekly Sprint Model)

This document tracks the milestones and weekly releases for **Kite x402 Explorer & Playground**.

---

## 📅 Week 1: Foundation, Data Layer & Directory Showcase [COMPLETED]

- [x] **Project initialization**: Directory structure, Vite + TypeScript setup, core type definitions (`ServiceManifest`, `KiteChainConfig`, `X402ChallengePayload`), and baseline documentation.
- [x] **Schema Validator**: Ajv schema validator conforming to `service.schema.json`.
- [x] **Manifest Loader**: YAML manifest loader and dynamic service registry with sample services.
- [x] **Directory View UI**: Multi-facet filters (network, status, categories) and sorting options.
- [x] **Service Detail Drawer**: Deep endpoint inspection drawer with parameter schemas and token unit conversions.
- [x] **Code Generator**: Multi-language code snippet generator supporting cURL, TypeScript, Python, and Agent Tool formats.
- [x] **Week 1 Polish**: Error boundary protection and responsive UI polish.

---

## 📅 Week 2: x402 Interactive Protocol Playground [COMPLETED]

- [x] **Local CORS Proxy**: Protocol relay endpoint with full x402 header mirroring and local simulator.
- [x] **402 Challenge Inspector**: Live challenge interceptor with token unit parsing.
- [x] **EIP-3009 Signature Builder**: Viem-powered `TransferWithAuthorization` typed data constructor.
- [x] **Dual-Mode Wallet**: Browser wallet (MetaMask/Rabby) integration and sandbox agent key generator.
- [x] **Settlement Dispatcher**: Paid request re-dispatch with `PAYMENT-SIGNATURE` and facilitator flow.
- [x] **Protocol Visualizer**: 4-phase audit timeline with KiteScan deep linker.
- [x] **Error Guards**: Upstream failure (502) protection ensuring no-deduction invariant and signature expiration handling.

---

## 📅 Week 3: Health Probing Engine, Latency Metrics & Proof Logs [UPCOMING - WEEKLY SPRINT 1]

- [ ] **Health Prober Engine**: Automated `/healthz` prober checking upstream latency, network matching, and asset consistency.
- [ ] **Live Status Badges**: Real-time status indicators (Healthy / Degraded / Down) and latency metrics on cards and drawers.
- [ ] **Global Probing Controls**: One-click batch probing and auto-refresh intervals.
- [ ] **Persistent Proof Logs**: Local storage audit history tracking past 402 challenges, signed authorizations, and settlement tx hashes.
- [ ] **Receipt Exporter**: Downloadable verifiable JSON payment receipts for agent-to-service auditing.

**Weekly Release Target**:
`feat: implement service health probing engine, live latency badges, and persistent proof logs`

---

## 📅 Week 4: Manifest Visual Builder, Testnet E2E & Production Release [UPCOMING - WEEKLY SPRINT 2]

- [ ] **Manifest Visual Builder**: "Register New Service" interactive form with instant field linting.
- [ ] **Real-Time Schema Validation**: Inline error and warning feedback against `service.schema.json`.
- [ ] **One-Click PR Export**: Formatted, PR-ready `service.yaml` generator with Kite repository submission guide.
- [ ] **Kite Testnet E2E Suite**: Live on-chain pieUSD transaction run on Kite Testnet (eip155:2368).
- [ ] **Production Go-Live**: Bundle optimization, Dockerfile, static deployment configs, and open-source documentation.

**Weekly Release Target**:
`feat: add manifest visual builder, testnet e2e suite, and production deployment bundle`
