# Kite AI Data Attestation & Provenance Anchor

## Overview

Decentralized AI workflows require tamper-proof guarantees about training corpora, fine-tuning data, vector embeddings, and oracle feeds. When autonomous agents purchase dataset access using x402 micropayments, they need cryptographic verification that:
1. The purchased data batch corresponds to the declared content Merkle tree.
2. Individual items or inference embeddings are proven members of the dataset via Merkle inclusion paths.
3. The dataset quality score meets the agreed SLA standards before funds are settled.

The `DataAttestationAnchor` is a local prototype. Merkle inclusion is checked against a caller-supplied root, which must be authenticated from an external trusted anchor. Quality discounts remain disabled unless a trusted attestation verifier is provided. This repository does not anchor data, sign settlement receipts, or settle x402 payments for this feature.

---

## Quality Tier & Fee Discount Structure

Datasets with audited high-quality annotations receive volume-scaled discounts to incentivize verified curation:

| Quality Tier | Min Quality Score | Fee Discount | Dispute Eligible |
| :--- | :--- | :--- | :--- |
| **Sovereign** | $\ge 95.00\%$ (9500 bps) | 30% discount | No |
| **Gold** | $\ge 80.00\%$ (8000 bps) | 20% discount | Yes |
| **Silver** | $\ge 60.00\%$ (6000 bps) | 10% discount | Yes |
| **Bronze** | $\ge 30.00\%$ (3000 bps) | Standard fee | Yes |
| **Unverified** | $< 30.00\%$ | Standard fee | Yes |

---

## Verification Pipeline

1. **Input Validation**: Ensures valid non-zero EVM provider address, 32-byte hex Merkle root, positive record count, and bounded basis point score.
2. **Inclusion Proof Audit**:
   - Evaluates sibling hashes along the Merkle tree path from the target chunk leaf to the published root.
   - Rejects corrupted leaves, altered sibling hashes, or mismatched tree depth.
3. **External settlement requirement**:
   - A production service must authenticate the root and quality score and implement its own x402 settlement.
   - Bond slashing and dispute enforcement are outside this local helper.
