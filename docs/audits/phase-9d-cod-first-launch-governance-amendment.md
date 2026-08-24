# Phase 9D — COD-First Launch Governance Amendment

**Status:** `DOCS_ONLY` / `LOCAL_GOVERNANCE_PASS` (pending independent review/merge)  
**Date:** 2026-08-24  
**Branch / worktree:** `phase-9d-cod-first-launch-governance` / `OneDecore-phase9d-cod-first-launch-governance`  
**Starting main:** `f40089b9eb82c9e023365a9dca2cafecde0d54a2` (PR #85 merge — Phase 9D-D2)  
**Authority:** [ADR-0033](../ADR/ADR-0033-phase-9d-cod-first-launch-and-online-payment-deferral.md) / [DEC-0094](../10-decision-register.md)  
**Managed write:** none  
**Live payment:** none  
**Production:** OFF  

---

## Owner decision

Initial ONEDECORE furniture-shop launch is **COD-FIRST / COD-ONLY**. Online payments are deferred so MVP launch can proceed without waiting for Razorpay certification, without weakening ADR-0030 architecture.

## Evidence recorded

| Fact | Value |
| :--- | :--- |
| PR #85 | Merged; merge commit `f40089b9eb82c9e023365a9dca2cafecde0d54a2` |
| D2 | Final manual/browser QA cleared; local merge gate PASS before merge |
| Repository `main` migrations | **M1–M37** (latest `20260824140000_commerce_order_cod_checkout_foundation.sql`) |
| M38 on `main` | **no** |
| Razorpay / online payment on `main` | **no** |
| Deferred payment branch | `phase-9d-e-online-payments` @ `b2ea05c243d03d3e88385189b8a7098a8ffe20c8` (preserved; not pushed/merged by this gate) |
| Deferred M38 file | Present only on deferred branch; absent from `main` |
| Managed migration truth | Post-D1 closeout evidence in D2 audit: managed aligned **M1–M37**; this governance gate performs **no** managed write |
| Production | **OFF** |

## Sequencing amendment

| Path | Sequence |
| :--- | :--- |
| Original ADR-0030 | `9D-D → 9D-E → 9D-F → 10` |
| COD-first launch | `9D-D → 9D-F (COD certification) → 10 (COD-only activation)` |
| Deferred payments later | rebase/port preserved 9D-E → recertify → managed apply (renumber if needed) → test-mode → **separate** online activation |

## Rationale

Accelerate MVP furniture-shop launch using the merged COD storefront while preserving online-payment architecture for a later, separately gated resume. No architecture weakening (server pricing, snapshots, oversell protection, tracking proof, RBAC, no CRM marketing side effects, no ERP/WMS, no fake paid status, no auto-refunds).

## This amendment does not

- Change `src/**`, `supabase/**`, package manifests, `.env*`, or CI runtime
- Apply M38 managed
- Authorize Razorpay credentials / webhooks / live charges
- Claim 9D-F complete
- Claim production active
- Start 9D-F implementation

## Next

After this docs gate merges: **Phase 9D-F** = COD-only certification/hardening. Phase 10 may then activate **COD only**. Online payment remains deferred until 9D-E completion + explicit owner activation.
