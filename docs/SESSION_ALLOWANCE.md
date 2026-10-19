# Kite Delegated Session Allowance & Sub-Account Manager

## Overview

In multi-agent architectures (such as autonomous research swarms, pipeline coordinators, and sentinel bots), human principals or master coordinator agents delegate execution authority to specialized worker agents. Granting raw private keys with unlimited wallet balances presents catastrophic financial risk.

The `SessionAllowanceManager` allows master accounts to authorize time-bound, budget-capped sub-allowances for worker agents under the x402 payment framework.

---

## Security Model & Invariants

1. **Scoped Authorization**:
   - Master account (`granter`) creates a session grant specifying the authorized worker agent (`delegateAgent`).
   - Self-delegation (`granter === delegateAgent`) is explicitly forbidden.
2. **Deterministic Budget Caps**:
   - Every spend must satisfy: $\text{spentUnits} + \text{amountUnits} \le \text{totalAllowanceUnits}$.
   - Overdraws are rejected before payment challenge verification.
3. **Temporal Validity Window**:
   - Enforces $[\text{validAfter}, \text{validBefore}]$ block or epoch timestamps.
   - Spends outside the window are rejected with explicit reason codes (`not yet active` / `expired`).
4. **Merchant / Recipient Allowlisting**:
   - Granters can restrict worker agent spends to approved service contracts (`allowedRecipients`), preventing funds from being siphoned to untrusted third parties.
5. **Revocation Authority**:
   - Granters retain full right to revoke active allowances at any time, instantly halting further worker spends.
