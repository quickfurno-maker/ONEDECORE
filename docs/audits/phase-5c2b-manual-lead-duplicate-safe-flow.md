# Phase 5C2B â€” Manual Lead Creation & Duplicate-Safe Flow Audit

**Status:** **IMPLEMENTATION COMPLETE â€” LOCAL ONLY â€” AWAITING OWNER REVIEW**
**Branch:** `phase-5c2b-manual-lead-duplicate-safe-flow`
**Baseline SHA:** `b499c246863ae4a5c658c31a5f80ddbd11adf9c0`
**Migration:** 14 (`20260801140000_crm_manual_lead_duplicate_safe_flow.sql`) â€” **local Docker only**
**Managed Supabase:** migrations **1â€“13** unchanged
**Deployment:** none
**Public lead intake:** inactive (copy-only default)

## Scope

Single governed CRM capability: role-aware manual lead creation with privacy-safe duplicate detection, atomic contact reuse/creation, assignment-on-create, and audited overrides. Closes Phase 5C exit-gate items for manual lead creation and duplicate-safe E2E. Does **not** complete Phase 5C overall; 5C2C lifecycle mutations remain separate.

## Owner decisions implemented

| Decision | Implementation |
|----------|----------------|
| **A â€” Active duplicate** | Hard block for all roles; no override path in preview or create RPC |
| **B â€” Recent similar (30 days)** | Soft block; `leads.duplicate_override` for super_admin, sales_manager, management only; reason 10â€“500 chars; audited |
| **C â€” Consent** | No consent events on manual create; UI notice; no waiver/checkbox |
| **D â€” One at a time** | One lead per RPC/form submission; no workload cap |

## Duplicate similarity (v1)

Resolved contact identity + matching `service_code` + `property_code` + fail-closed locality. Timeline does **not** distinguish duplicates. Outcomes: `CLEAR`, `REUSABLE_CONTACT`, `ACTIVE_DUPLICATE`, `RECENT_SIMILAR`, `CONTACT_IDENTITY_CONFLICT`.

## Privacy

Preview RPC returns only `outcome_code`, `can_create`, `can_override`, `existing_lead_id` (nullable, visibility-gated). No cross-executive PII. Create RPC re-runs authoritative duplicate check inside transaction with advisory lock on normalized identity.

## Migration 14 contract

- Permissions: `leads.create`, `leads.duplicate_override`
- Schema: conditional planner-field nullability for `entry_method = 'manual'`; `source` adds `manual-crm`
- RPCs: `public.check_manual_lead_duplicate`, `public.create_manual_lead` (invoker wrappers â†’ private definer impl)
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
| project_manager | no | â€” | no |
| designer | no | â€” | no |

Initial status: `new` if unassigned, `assigned` if assignee set.

## Application architecture

```
/admin/crm/leads/new (Server Component)
  â†’ requireCrmCreateAccess
  â†’ ManualLeadForm (client)
    â†’ Server Actions (preview / create)
      â†’ crm-manual-lead-service
        â†’ authenticated Supabase SSR client
          â†’ public INVOKER RPC
            â†’ private DEFINER implementation
```

No service-role client. No browser direct RPC or table INSERT.

## Routes & UI

- **New:** `/admin/crm/leads/new` â€” form, duplicate preview, role-specific assignee controls, consent notice
- **Updated:** `/admin/crm/leads` â€” "New lead" link when `canCreateLeads`

## Test & QA results (local)

| Gate | Result |
|------|--------|
| `npm run check` | PASS |
| `npm run test:app` | **376** tests PASS (baseline 363 + 13 new) |
| `npm run test:image` | **17** tests PASS |
| `npm run db:reset` | PASS (migration 14 applied) |
| `npm run check:db` | **350** pgTAP tests PASS (baseline 289 + 61 in file 08) |
| `phase-5c2b-owner-qa.mjs` | **20/20** PASS |
| `phase-5c2b-browser-qa.mjs` | **21/21** PASS (5 roles Ã— 4 viewports + duplicate flow) |
| `git diff --check` | PASS |

Artifacts: `.artifacts/phase-5c2b/` (gitignored)

## Managed migration status

**LOCAL ONLY.** Do not `db push --linked` until separate owner authorization after PR merge.

## Phase boundaries

- **5C2C:** not implemented (no status/note/follow-up mutation UI)
- **5D:** not implemented (no bulk/import)
- **Public intake:** regression suite unchanged; no activation

## Remaining risks

- Owner QA requires `PHASE_5C1_QA_PASSWORD` in shell (not committed).
- Browser QA requires local Next.js dev server and Playwright chromium (installed via smoke project path fallback).
- `next-env.d.ts` dev-path drift may occur after `next dev`; reverted from working tree for scope hygiene.

## Owner-review recommendation

Approve for commit/PR after spot-check of duplicate privacy UX and executive self-assign flow. Managed migration 14 apply remains a **separate** post-merge step.
