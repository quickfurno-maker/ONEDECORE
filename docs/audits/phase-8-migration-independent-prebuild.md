# Phase 8 — Migration-Independent Prebuild Audit (P0)

**Status:** migration-independent prebuild in progress — formal Phase 8 NOT STARTED  
**Date:** August 7, 2026  
**Start main:** `67858da437a2a0d5ca5ebf9f6094ec04cdf50a8c`

## Governance alignment

- ADR-0020: Closed-Won requires accepted quotation; PM handover; Designer staffing
- ADR-0019: Five-role authorization; assignment authority limits
- ADR-0022: Quotation finalization boundary (no recalculation in Phase 8 prebuild)
- No ERP scope (ADR-0005)

## P0 shared contracts

`src/features/projects/contracts/` — references, lifecycle/handover, assignment, evidence, transitions, activity, client-update drafts, commercial snapshot boundary, permission capabilities.

## Non-actions

| Item | Status |
| --- | --- |
| Migrations M22+ | **None** |
| M19/M20/M21 | **Unchanged** |
| Managed Supabase writes | **None** |
| Closed-Won / project mutations | **None** |
| Formal persistence | **Deferred** |
