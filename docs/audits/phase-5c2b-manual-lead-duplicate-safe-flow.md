# Phase 5C2B — Manual Lead Creation & Duplicate-Safe Flow Audit

> **Current state (August 2, 2026):** Phase 5C2B is **merged** to protected main (PR #10 + H1 hotfix). Migration 14 is **applied** to managed OneDecore Supabase (Phase DB-3B, 2026-08-02). Managed migrations **1–14** aligned. Phase 5C2C lifecycle mutations merged separately (PR #11). Application **not production-deployed**. Public lead intake **inactive**.

**Audit state:** **IMPLEMENTATION COMPLETE — MERGED**

Live PR/merge status and the merge-gate PR-head Quality Gate are verified in GitHub; this in-repo audit intentionally does not pin ephemeral open/merged state.

**Branch:** `phase-5c2b-manual-lead-duplicate-safe-flow`
**Implementation commit:** `874583ed53310e663b67a59be21988df21fa4411`
**Baseline SHA:** `b499c246863ae4a5c658c31a5f80ddbd11adf9c0`
**PR:** #9
**Implementation-commit CI:** run `30698833667` — SUCCESS on implementation commit `874583ed53310e663b67a59be21988df21fa4411`
**Merge-gate CI:** the current PR-head Quality Gate is verified in GitHub immediately before merge and is intentionally not pinned in this in-PR audit to avoid self-referential stale SHA/run metadata.
**Migration:** 14 — applied managed (Phase DB-3B, 2026-08-02)
**Managed Supabase:** migrations 1–14 aligned
**Deployment:** none
**Public lead intake:** inactive (copy-only default)
**Phase 5C:** implementation slices complete — closeout audit passed (doc PR pending merge)
**Phase 5C2C:** MERGED (PR #11)
**Phase 5D:** NOT STARTED

## Scope

Single governed CRM capability: role-aware manual lead creation with privacy-safe duplicate detection, atomic contact reuse/creation, assignment-on-create, and audited overrides. Closes Phase 5C exit-gate items for manual lead creation and duplicate-safe E2E. Does **not** complete Phase 5C overall; 5C2C lifecycle mutations remain separate.

## Owner decisions implemented

| Decision | Implementation |
|----------|----------------|
| **A — Active duplicate** | Hard block for all roles; no override path in preview or create RPC |
| **B — Recent similar (30 days)** | Soft block; `leads.duplicate_override` for super_admin, sales_manager, management only; reason 10–500 chars; audited |
| **C — Consent** | No consent events on manual create; UI notice; no waiver/checkbox |
| **D — One at a time** | One lead per RPC/form submission; no workload cap |

## Duplicate similarity (v1)

Resolved contact identity + matching `service_code` + `property_code` + fail-closed locality. Timeline does **not** distinguish duplicates. Outcomes: `CLEAR`, `REUSABLE_CONTACT`, `ACTIVE_DUPLICATE`, `RECENT_SIMILAR`, `CONTACT_IDENTITY_CONFLICT`.

## Privacy

Preview RPC returns only `outcome_code`, `can_create`, `can_override`, `existing_lead_id` (nullable, visibility-gated). No cross-executive PII. Create RPC re-runs authoritative duplicate check inside transaction with advisory lock on normalized identity.

## Migration 14 contract

- Permissions: `leads.create`, `leads.duplicate_override`
- Schema: conditional planner-field nullability for `entry_method = 'manual'`; `source` adds `manual-crm`
- RPCs: `public.check_manual_lead_duplicate`, `public.create_manual_lead` (invoker wrappers → private definer impl)
- Activity type: `lead.manual_created`
- Security: revoke PUBLIC/anon; authenticated EXECUTE only; no broad INSERT grants

## Role matrix (create)

| Role | Create | Assignee | Override recent |
|------|--------|----------|-----------------|
| super_admin | yes | unassigned / eligible exec | yes |
| sales_manager | yes | unassigned / self / eligible exec | yes |
| management (legacy) | yes | manager-compatible | yes |
| sales_executive | yes | forced self | no |
| sales (legacy) | yes | executive-compatible | no |
| project_manager | no | — | no |
| designer | no | — | no |

Initial status: `new` if unassigned, `assigned` if assignee set.

## Application architecture

```
/admin/crm/leads/new (Server Component)
  → requireCrmCreateAccess
  → ManualLeadForm (client)
    → Server Actions (preview / create)
      → crm-manual-lead-service
        → authenticated Supabase SSR client
          → public INVOKER RPC
            → private DEFINER implementation
```

No service-role client. No browser direct RPC or table INSERT.

## Routes & UI

- **New:** `/admin/crm/leads/new` — form, duplicate preview, role-specific assignee controls, consent notice
- **Updated:** `/admin/crm/leads` — "New lead" link when `canCreateLeads`

## Test & QA results (local)

| Gate | Result |
|------|--------|
| `npm run check` | PASS |
| `npm run test:app` | **376** tests PASS (baseline 363 + 13 new) |
| `npm run test:image` | **17** tests PASS |
| `npm run db:reset` | PASS (migration 14 applied) |
| `npm run check:db` | **350** pgTAP tests PASS (baseline 289 + 61 in file 08) |
| `phase-5c2b-owner-qa.mjs` | **20/20** PASS |
| `phase-5c2b-browser-qa.mjs` | **21/21** PASS (5 roles × 4 viewports + duplicate flow) |
| implementation-commit PR CI (run `30698833667`) | SUCCESS on `874583ed53310e663b67a59be21988df21fa4411` |
| merge-gate PR-head CI | Verified externally in GitHub immediately before merge |
| `git diff --check` | PASS |

Browser QA roles: super_admin, sales_manager, sales_executive, project_manager, designer.
Browser QA viewports: 1440, 768, 390, 360.
Legacy management/sales remain DB/Owner-QA compatibility coverage (not browser matrix roles).

Artifacts: `.artifacts/phase-5c2b/` (gitignored)

## Managed migration status

**APPLIED MANAGED (Phase DB-3B, 2026-08-02).** Migration 14 aligned on OneDecore (`lpurlfmpvriyvpkujvyl`). Historical pre-apply notes below remain accurate for the implementation window.

## Phase boundaries

- **5C2C:** merged (PR #11) — lifecycle/status/note/follow-up mutations
- **5D:** not implemented (no bulk/import)
- **Public intake:** regression suite unchanged; no activation

## Remaining risks

- Owner QA requires `PHASE_5C1_QA_PASSWORD` in shell (not committed).
- Browser QA requires local Next.js dev server and Playwright chromium (installed via smoke project path fallback).
- `next-env.d.ts` dev-path drift may occur after `next dev`; reverted from working tree for scope hygiene.

## Owner-review recommendation

PR #9 passed the documented pre-merge owner-review gates. Live PR-head CI, review-thread, mergeability, and branch-protection state are verified externally in GitHub immediately before merge. Managed migration 14 apply remains a **separate** post-merge authorization.
