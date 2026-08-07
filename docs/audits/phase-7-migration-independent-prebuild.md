# Phase 7 — Migration-Independent Prebuild Audit (C0)

**Status:** migration-independent prebuild — not formal Phase 7A/7B implementation  
**Date:** August 7, 2026  
**Base main:** `955ff53f32144bc42790e66de4f03af591acfa08`

## Scope

C0 shared quotation domain contracts for parallel Lane C (commercial engine) and Lane D (premium UI).

## Governance alignment

- ADR-0022: no internal approval states; quotation-level discount only; `taxable_base_paise` achievement basis
- docs/07: lifecycle state graph Draft → Finalized → Sent → client outcomes
- Tax rate: caller-supplied bps — **no frozen GST % in code**
- Reference allocation: **DEFERRED TO PERSISTENCE PHASE**

## Non-actions

| Item | Status |
| --- | --- |
| Migrations M22+ | **None** |
| M19/M20/M21 | **Unchanged** |
| Managed Supabase writes | **None** |
| Persistence / Closed-Won | **None** |
| Public routes / provider activation | **None** |

## Contracts introduced

`src/features/quotations/contracts/` — money, line items, discount, tax, lifecycle, reference, calculation I/O, snapshot, client decision, validation, display model.

## Lane C (PR 7-PC)

Pure calculation engine, validation, lifecycle transitions, HTML PDF renderer, synthetic fixtures.

## Lane D (PR 7-PD)

Premium quotation editor/preview/client decision UI components with in-memory adapter — no routes, no persistence.
