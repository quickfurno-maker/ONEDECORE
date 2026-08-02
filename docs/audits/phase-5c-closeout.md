# Phase 5C — Integrated Closeout Audit

**Audit state:** **PASSED** — closeout documentation PR open (protected-main Phase 5C truth finalizes on PR merge)

**Protected main (audit baseline):** `095358ef5ad6552c45e9f533da2fb07bcb079b03` (PR #11 merge — lifecycle collaboration)

**Managed Supabase:** OneDecore (`lpurlfmpvriyvpkujvyl`, `ap-south-1`) — migrations **1–14** aligned; M14 applied 2026-08-02 (Phase DB-3B)

**Deployment:** none | **Public intake:** inactive | **Closed-Won:** blocked until Phase 7B | **Phase 5D:** not started

---

## 1. Slice merge state

| Slice | Status | Evidence |
|-------|--------|----------|
| 5C1 | MERGED (PR #5) | Read-only CRM workspace |
| 5C2A | MERGED (PR #7) | Assignment mutations |
| 5C2B | MERGED (PR #10 + H1 hotfix) | Manual lead + duplicate-safe flow |
| 5C2C | MERGED (PR #11) | Lifecycle collaboration mutations |

## 2. Managed database

- Migrations 1–14 LOCAL = REMOTE (read-only verified during closeout)
- M14: `20260801140000_crm_manual_lead_duplicate_safe_flow.sql` — **APPLIED** (Phase DB-3B)
- No M15; no managed write during closeout

## 3. Role matrix (integrated)

| Role | Broad read | Assign | Manual create | Dup override | Lifecycle | Notes/FU | Closed-Won |
|------|------------|--------|---------------|--------------|-----------|----------|------------|
| super_admin | yes | yes | yes | yes | yes | yes | **blocked** |
| sales_manager | yes | yes | yes | yes | yes | yes | **blocked** |
| management (legacy) | yes | yes | yes | yes | yes | yes | **blocked** |
| sales_executive | assigned only | no* | forced self | no | own leads | own leads | **blocked** |
| sales (legacy) | executive-compatible | no* | forced self | no | own leads | own leads | **blocked** |
| project_manager | **denied** | — | — | — | — | — | — |
| designer | **denied** | — | — | — | — | — | — |

\*Assignment via 5C2A where `leads.assign` granted; executives cannot assign others.

## 4. Assignment invariants (5C2A)

Reused pgTAP `07_crm_assignment_mutations_test.sql` + application tests `phase-5c2a-assignment-mutations.test.ts`:

- Eligible active sales target only
- Reassignment preserves status; safe unassign rules
- Terminal lead immutable; open foreign follow-up blocks unsafe reassignment
- Expected-state stale protection; same-assignee no-op safe

## 5. Manual lead / duplicate invariants (5C2B + M14)

Reused pgTAP `08_crm_manual_lead_duplicate_safe_flow_test.sql` + `phase-5c2b-manual-lead.test.ts`:

- `ACTIVE_DUPLICATE`: hard block all roles
- `RECENT_SIMILAR`: SA/manager/management override only; reason 10–500; executive denied
- `CONTACT_IDENTITY_CONFLICT`: hard block; no merge/override
- Executive forced self; manager self/unassigned/eligible target
- Manual create: no `consent_events`; `entry_method=manual`; `source=manual-crm`
- Cross-exec preview: no PII leak (`existing_lead_id` visibility-gated)

## 6. Lifecycle invariants (5C2C)

Reused `phase-5c2c-lifecycle-collaboration.test.ts` + Owner/Browser QA:

- DB transition graph authoritative; `new`/`assigned` forward-only; Closed-Won blocked
- On-Hold reason + resume target; Closed-Lost reason + note
- Notes: SSR INSERT `lead_id`/`body` only; append-only; DB owns `created_by`
- Follow-ups: existing RPCs; executive forced self owner; manager broad owner selection
- Terminal note/follow-up **UI blocks** are application-level (not new DB permission grants)

## 7. Cross-slice integration (closeout runs)

| Check | Result |
|-------|--------|
| A. Manual create → assign → lifecycle (manager/exec path) | Owner QA + Browser QA PASS |
| B. Follow-up → assignment safety | pgTAP + 5C2A/5C2C tests PASS |
| C. Duplicate + privacy | Owner QA cross-exec negative PASS |
| D. Terminal Closed-Lost behavior | Browser QA + lifecycle tests PASS |

## 8. Quality gates (closeout run — 2026-08-02)

| Gate | Result |
|------|--------|
| `npm run db:reset` + `check:db` | **350/350** PASS |
| `npm run test:app` | **397/397** PASS |
| `npm run test:image` | **17/17** PASS |
| `npm run check` | PASS |
| `phase-5c2b-owner-qa.mjs` | **20/20** PASS |
| `phase-5c2c-owner-qa.mjs` | **19/19** PASS |
| `phase-5c2b-browser-qa.mjs` | **21/21** PASS |
| `phase-5c2c-browser-qa.mjs` | **14/14** PASS (real POST mutations) |
| HTTP 500 / use-server runtime errors | **none** |
| CRM `"use server"` H1 compliance | PASS (async exports only) |

## 9. Managed read-only spot-check

- RLS enabled on CRM tables
- Authenticated direct INSERT on leads/contacts/contact_channels denied
- M14 permission grants unchanged (SA/manager/management override; exec create only)
- `submit_lead_intake` present; public intake inactive

## 10. Phase boundaries

- **Phase 5C:** implementation slices complete; **CLOSED** after closeout doc PR merges to protected main
- **Phase 5D:** NOT STARTED (bulk import / targets — separate authorization)
- **Deployment:** Phase 10 only
- **Closed-Won:** Phase 7B quotation acceptance

## 11. Remaining risks

- Tracked docs updated in closeout PR; historical audit timestamps preserved where noted
- Owner/Browser QA require local Supabase + `PHASE_5C1_QA_PASSWORD` (not committed)
- Application not production-deployed; managed CRM RPCs live but UI requires deployment for production use

## 12. Next action

Merge closeout documentation PR → protected-main push CI green → **Phase 5C COMPLETE** → owner may authorize **Phase 5D** preflight.
