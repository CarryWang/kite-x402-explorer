# 28-Day Engineering Roadmap & Daily Checklist

This document tracks the daily commits and development progress for the 4-week iteration of **Kite x402 Explorer & Playground**.

---

## 📅 Week 1: Foundation, Data Layer & Directory Showcase

- [x] **Day 1**: Project initialization, directory structure, Vite + TypeScript setup, core type definitions (`ServiceManifest`, `KiteChainConfig`, `X402ChallengePayload`), and baseline documentation (`README.md`, `ARCHITECTURE.md`, `ROADMAP.md`).
- [x] **Day 2**: Service Schema Validator (implement Ajv schema validator conforming to `service.schema.json`).
- [x] **Day 3**: Manifest Loader & Dataset Integration (load `open-meteo-weather` and custom mock services).
- [x] **Day 4**: Directory View UI (category filtering, real-time keyword search, responsive card layout).
- [x] **Day 5**: Service Detail Inspection Drawer (endpoint schema breakdown, parameters table, pricing units).
- [x] **Day 6**: Developer Code Snippet Generator (cURL, TypeScript SDK, Python requests export).
- [x] **Day 7**: Week 1 Polish (responsive mobile layouts, dark-mode styling fine-tuning, error boundary protection).

---

## 📅 Week 2: x402 Interactive Protocol Playground

- [x] **Day 8**: Local CORS Proxy & Protocol Relay endpoint with full x402 header mirror.
- [x] **Day 9**: Initial call dispatcher and 402 HTTP interceptor with Base64 header decoder.
- [x] **Day 10**: EIP-712 / EIP-3009 TransferWithAuthorization signature builder.
- [x] **Day 11**: Web3 Wallet connection (viem) & Sandboxed one-click private key generator.
- [x] **Day 12**: Paid request re-dispatch with `PAYMENT-SIGNATURE` header.
- [x] **Day 13**: Protocol Visualizer & Explorer Deep Linker (visualize 402 $\to$ 200 diff, transaction hash viewer).
- [x] **Day 14**: Error state handling (upstream timeouts, insufficient funds, signature rejections) & Week 2 milestone.

---

## 📅 Week 3: Health Probing & Transaction Proof Logs

- [ ] **Day 15**: Background `/healthz` prober engine and latency recorder.
- [ ] **Day 16**: Live status indicators on cards and detail modals.
- [ ] **Day 17**: Batch probing & auto-refresh cron.
- [ ] **Day 18**: Local transaction history store (IndexedDB / LocalStorage persistence).
- [ ] **Day 19**: Verifiable receipt export (JSON payment proofs).
- [ ] **Day 20**: Micro-interactions & animations (loading states, step transitions).
- [ ] **Day 21**: Week 3 Integration review and stability tests.

---

## 📅 Week 4: Manifest Builder, Testnet E2E & Go-Live

- [ ] **Day 22**: "Register New Service" visual builder form.
- [ ] **Day 23**: In-browser real-time YAML validation with schema linting.
- [ ] **Day 24**: One-click PR-ready `service.yaml` export.
- [ ] **Day 25**: Custom service playground preview mode.
- [ ] **Day 26**: Production build bundling & Dockerfile setup.
- [ ] **Day 27**: Live Kite Testnet verification with pieUSD transactions.
- [ ] **Day 28**: Release packaging, documentation finalization, and community announcement.
