# Four-Week Explorer Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for each daily task. Each day ends with one independently verifiable commit.

**Goal:** Make the existing explorer a trustworthy directory and diagnostic tool over 28 consecutive days, 2026-11-13 through 2026-12-10.

**Architecture:** Keep demo payment routes separate from official directory data and live observations. Validate outbound targets on the server, display provenance in the browser, and report only observed diagnostic and receipt evidence. Real fund movement is outside this plan.

**Tech Stack:** TypeScript, React, Vite, Express, Node test runner, Docker, GitHub Actions.

**Spec:** [Current project scope and limitations](../../../README.md) and the user-approved 28-day schedule in this chat.

## Global Constraints

- One focused, buildable commit per calendar day.
- Run `npm test` and `npm run build` before every commit; run production smoke checks for server changes.
- Never label demo output as a live payment or verified balance change. Do not send funded payments under this plan.
- Review new open PRs before duplicating their work, and preserve daily commits when integrating into `main`.

## Review Focus

- Reject untrusted proxy URLs or DNS results that could contact private addresses.
- Treat stale or missing official registry data as unavailable.
- Fail or mark unavailable diagnostics without observed evidence.
- Distinguish simulated signatures and receipts from on-chain settlement proof.
- Keep reusable authorization data out of exported logs.

## Daily Tasks

For behavior changes, write a failing regression test, run it, implement the scoped change, rerun affected and global checks, then make the day's single commit. File paths for later days are starting points; inspect current code before editing.

| Day | Date | Deliverable and primary files | Commit |
| --- | --- | --- | --- |
| 1 | 11-13 | Correct payment claims in `README.md`, `docs/ROADMAP.md`, `DocsView.tsx`, and `PlaygroundView.tsx`; record this schedule. | `docs: align roadmap with verified capabilities` |
| 2 | 11-14 | Validate directory mode, commit, and outbound origins at startup in `server/config.ts`. | `refactor: validate server configuration at startup` |
| 3 | 11-15 | Limit proxy methods, request size, and forwarded headers in `server/index.ts` and `server/outbound.ts`; update vulnerable runtime transitive dependencies and verify `npm audit --omit=dev`. | `fix: constrain proxy requests and responses` |
| 4 | 11-16 | Cover DNS, timeout, redirects, and edge addresses in `tests/outbound.test.ts`. | `test: cover outbound request boundaries` |
| 5 | 11-17 | Define stable typed probe results in server and browser prober. | `refactor: define explicit probe results` |
| 6 | 11-18 | Smoke-test demo and official modes in `scripts/smoke-production.mjs` and CI. | `test: smoke both directory modes` |
| 7 | 11-19 | Show accessible loading, failure, empty, and stale directory states in `App.tsx`. | `feat: show directory loading and stale states` |
| 8 | 11-20 | Reject duplicate registry names, bad paths, and oversized trees in `server/official-registry.ts`. | `fix: reject ambiguous registry entries` |
| 9 | 11-21 | Test registry refresh, stale fallback, and recovery in `tests/official-registry.test.ts`. | `test: cover registry refresh and recovery` |
| 10 | 11-22 | Show source commit, fetch time, and errors in directory details. | `feat: display registry provenance` |
| 11 | 11-23 | Enable official live probes only for operator-approved origins. | `feat: allow approved official service probes` |
| 12 | 11-24 | Bound server and browser probe concurrency. | `fix: bound concurrent health probes` |
| 13 | 11-25 | Separate service failure, probe failure, and stale observation in the UI. | `feat: distinguish health evidence states` |
| 14 | 11-26 | Test directory refresh and probe integration, including source changes. | `test: verify directory and probe integration` |
| 15 | 11-27 | Validate challenge network, asset, amount, recipient, and deadline in `challenge-parser.ts`. | `fix: validate payment challenges strictly` |
| 16 | 11-28 | Test offline authorization chain, nonce, expiry, and tampering failures. | `test: cover authorization failure cases` |
| 17 | 11-29 | Add a controlled unfunded seller failure fixture. | `feat: add instrumented seller fixture` |
| 18 | 11-30 | Verify failure leaves a test ledger unchanged and label the evidence scope. | `test: verify zero deduction on failure` |
| 19 | 12-01 | Validate receipt source, status, and transaction evidence before export. | `feat: validate receipt evidence` |
| 20 | 12-02 | Redact signatures and reusable payloads from stored and exported logs. | `fix: redact sensitive proof data` |
| 21 | 12-03 | Exercise demo and diagnostic flows end to end in CI without funded transactions. | `test: cover playground diagnostic flow` |
| 22 | 12-04 | Expose safe request-count, failure, and duration metrics. | `feat: expose safe operational metrics` |
| 23 | 12-05 | Separate process liveness from registry readiness in health endpoints. | `feat: add service readiness checks` |
| 24 | 12-06 | Rate-limit public proxy and probe endpoints. | `fix: rate limit public endpoints` |
| 25 | 12-07 | Tighten CORS and browser security headers. | `fix: harden browser security headers` |
| 26 | 12-08 | Verify bundle size, Docker startup, and network-isolated smoke checks. | `chore: verify production packaging` |
| 27 | 12-09 | Inject registry timeout, DNS failure, and malformed upstream responses into production-path tests. | `test: exercise degraded production paths` |
| 28 | 12-10 | Record release notes, deployment steps, limits, and the 28-commit verification result. | `docs: prepare four week release` |

## Daily Completion Record

| Day | Commit | Tests | Build | Notes |
| --- | --- | --- | --- | --- |
| 1 | `docs: align roadmap with verified capabilities` | 229/229 passed | passed | Corrected claims; dependency audit found one high and two moderate runtime advisories for Day 3 |
| 2 | `refactor: validate server configuration at startup` | 233/233 passed; production smoke passed | passed | Centralized directory and outbound origin validation; checked `main` and recent PR heads for overlap |

Append one row before each later day's single commit.
