# Phase 7B-A H1 — Direct Quotation Governance Truth-Sync

**Date:** August 6, 2026  
**Type:** Docs-only governance PR  
**Starting main SHA:** `c89ad7d8473a973ff9dbbab2b0ca94033952ff34`

---

## Scope

Synchronize tracked ONEDECORE governance with owner decision:

> Sales Executive may create, finalize/freeze, and send quotations for currently assigned leads **without** Sales Manager or Super Admin approval.

## Actions taken

| Item | Result |
| :--- | :--- |
| New ADR | `docs/ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md` |
| ADR-0020 | Partial-supersession note; quotation lifecycle updated; PM/design/Closed-Won preserved |
| DEC-0056 | Added to decision register |
| DEC-0012 | Reconciled — hard bounds configurable; no quotation approval workflow |
| docs/01, 02, 05, 06, 07, 09, 10 | Quotation-approval contradictions removed |

## Explicit non-actions

| Item | Status |
| :--- | :--- |
| M18 migration file | **Unchanged** (SHA-256 verified) |
| Managed Supabase | **No writes** — M1–M17 only; M18 unapplied |
| Quotation runtime / migrations | **None** |
| PDF / acceptance / WhatsApp send | **None** |
| Public intake activation | **Unchanged — inactive** |
| Deployment | **None** |
| Phase 6 stale debt (migration counts, 6A complete wording) | **Left untouched** |

## Revenue basis locked

Sales achievement = `taxable_base_paise` (post-discount, pre-tax). GST excluded from performance.

## Acceptance / Closed-Won

Unchanged: client acceptance remains prerequisite for Closed-Won; one authoritative acceptance per lead.

## Related

- [ADR-0022](../ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [DEC-0056](../10-decision-register.md)
