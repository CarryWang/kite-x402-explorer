# Engineering Roadmap & Release Milestones

The sections below record the original project milestones. The active 28-day development plan begins on 2026-11-13 and is tracked in [the current implementation plan](superpowers/plans/2026-11-13-four-week-explorer.md).

The original checklist describes features that were built, not evidence of a live payment. The playground and payment receipts are local demonstrations; the testnet suite performs read-only diagnostics and an offline signature roundtrip. Official directory entries are metadata, and live probing in official mode remains unavailable.

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

- [x] **Local CORS Proxy**: Constrained relay endpoint and separate local simulator.
- [x] **402 Challenge Inspector**: Local mock challenge inspection with token unit parsing.
- [x] **EIP-3009 Signature Builder**: Typed data constructor and isolated sandbox demonstration.
- [x] **Wallet Interfaces**: Browser wallet connection UI and sandbox key generator; the mock flow does not sign with a browser wallet.
- [x] **Mock Dispatcher**: Sends a simulated `PAYMENT-SIGNATURE` to the local mock endpoint.
- [x] **Protocol Visualizer**: 4-phase audit timeline with KiteScan deep linker.
- [x] **Error Demonstrations**: Local upstream failure and signature expiration cases. Zero deduction has not been verified against a funded seller.

---

## 📅 Week 3: Health Probing Engine, Latency Metrics & Proof Logs [COMPLETED]

- [x] **Health Prober Engine**: Automated `/healthz` prober checking upstream latency, network matching, and asset consistency.
- [x] **Live Status Badges**: Real-time status indicators (Healthy / Degraded / Down) and latency metrics on cards and drawers.
- [x] **Global Probing Controls**: One-click batch probing and auto-refresh intervals.
- [x] **Local Proof Logs**: Browser storage records challenges and simulated authorization attempts.
- [x] **Receipt Exporter**: Downloadable JSON receipts distinguish simulated and settled evidence.

**Original Weekly Release Target**:
`feat: implement service health probing engine, live latency badges, and persistent proof logs`

---

## 📅 Week 4: Manifest Visual Builder, Testnet Diagnostics & Production Packaging [COMPLETED]

- [x] **Manifest Visual Builder**: "Register New Service" interactive form with instant field linting.
- [x] **Real-Time Schema Validation**: Inline error and warning feedback against `service.schema.json`.
- [x] **One-Click PR Export**: Formatted, PR-ready `service.yaml` generator with Kite repository submission guide.
- [x] **Kite Testnet Diagnostics**: Read-only RPC, domain, and facilitator checks plus an offline signature roundtrip. No payment transaction is submitted.
- [x] **Production Packaging**: Bundle, Dockerfile, static deployment configuration, and smoke checks. Production payment readiness is not implied.

**Original Weekly Release Target**:
`feat: add manifest visual builder, testnet e2e suite, and production deployment bundle`
