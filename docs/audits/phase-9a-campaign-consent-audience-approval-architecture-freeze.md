# Phase 9A — Campaign Consent, Audience & Approval Architecture Freeze

**Date:** 2026-08-17  
**Branch:** `phase-9a-campaign-consent-audience-approval-architecture-freeze`  
**Owner authorization:** `LOCK PHASE 9A OWNER DECISIONS AS RECOMMENDED`  
**Architecture:** ADR-0027 / DEC-0077 / OD9A-1–OD9A-6  
**Gate:** docs-only freeze — **no M31**, **no managed write**, **no campaign UI mount**, **architecture PR not merged**

---

## A. Identity

| Item | Value |
| :--- | :--- |
| Protected main (branch base) | `8f4f3ecf082450e82ab15f02703c951e50f0817e` |
| Phase 8A | **COMPLETE** — PR #57 merged `db879b5ca27fe9d26543c23d8f130811c7feadab` |
| Phase 8B | **COMPLETE** — PR #59 merged `6b31052973cf9e50e25803b232ce446308c1fa3a` |
| Phase 8C | **COMPLETE** — PR #61 true merge `8f4f3ecf082450e82ab15f02703c951e50f0817e` (2026-08-17T08:25:54Z) |
| Merge parents (PR #61) | `5b4a7f300e63b438884a2b440a69a569d91b9e5d` + `a9983c1f70eff66572f8cf7810f951e650ad341c` |
| Post-merge CI | `32010340601` ONEDECORE Quality Gate SUCCESS (Application Quality SUCCESS; Database Quality SUCCESS) |
| Repository migrations | **M1–M30** |
| Managed OneDecore `lpurlfmpvriyvpkujvyl` | **M1–M30**; pending **NONE** |
| M30 file | `supabase/migrations/20260817140000_project_execution_workspace.sql` (immutable) |
| M31 | **ABSENT / NOT CREATED** (conceptual name `campaign_consent_audience_approval_foundation`) |
| Production activation | **NONE** |
| Public lead intake | **OFF** (`copy-only` / server `disabled`) |
| Phase 9A implementation | **NOT STARTED** (architecture freeze only) |
| Phase 9B / 9C | **NOT STARTED** |

No M31 fingerprint is recorded because M31 does not exist.

---

## B. Entry audit

- `PHASE_9A_ENTRY_AUDIT: PASS` (2026-08-17) on protected main `8f4f3ecf…`.
- Canonical CRM identity present: `contacts`, `contact_channels`, `consent_events`.
- `consent_events.purpose_code` already includes `MARKETING`; public intake does not write it.
- Global DNC = `contacts.status = 'do_not_contact'`. Channel suppression = `contact_channels.status = 'suppressed'`.
- `contact_suppressions` **absent**.
- WhatsApp M18–M21 managed foundation; M19 purpose **WHATSAPP_SERVICE**; MARKETING send-intent denied.
- `lead_source_touchpoints.campaign_reference` opaque; no campaign FK.
- Campaign tables, campaign/marketing permissions, admin Campaigns route **absent**.
- Migration-independent prebuild present on main (`src/features/marketing/**`, `src/features/landing-lab/**`, `test:phase-9a` / `test:phase-9b`) and is **not** architecture authority.
- Prebuild lifecycle mismatch: includes `scheduled` / `paused` / `completed`; Phase 9A canonical lifecycle does not. Do not edit prebuild in this docs-only gate; later M31 implementation must reconcile.

### Managed row counts at entry audit (2026-08-17T09:02:52Z, read-only)

| Object | Count |
| :--- | ---: |
| contacts | 0 |
| contact_channels | 0 |
| consent_events | 0 |
| MARKETING consent_events | 0 |
| WHATSAPP_SERVICE consent_events | 0 |
| contacts DNC | 0 |
| channels suppressed | 0 |
| leads | 0 |
| lead_source_touchpoints | 0 |
| whatsapp_send_intents | 0 |

Managed writes in this architecture gate: **NONE**.

---

## C. Owner locks (OD9A-1–OD9A-6)

### OD9A-1 — Suppression foundation

**LOCK:** `EXISTING_DNC_AND_CHANNEL_SUPPRESSION_NO_PARALLEL_TABLE`

Use `contacts.status = 'do_not_contact'` and `contact_channels.status = 'suppressed'`. Do not create `contact_suppressions` in Phase 9A. Consent `event_type = 'suppressed'` is historical evidence only. Approval never overrides later DNC/withdrawal/suppression. Phase 9C rechecks eligibility before export/send.

### OD9A-2 — MARKETING capture

**LOCK:** `EXISTING_APPEND_ONLY_CONSENT_EVENTS_STAFF_CAPTURE_NO_PUBLIC_ACTIVATION`

Reuse `public.consent_events` / `purpose_code = 'MARKETING'`. Future staff grant/withdraw RPC (SA/SM only) records actual instruction evidence. No public MARKETING checkbox. No implied consent from service enquiry, WHATSAPP_SERVICE, or inbound WhatsApp. SE/PM/Designer have no consent-management authority.

### OD9A-3 — Audience freeze

**LOCK:** `RULE_VERSION_NOT_RECIPIENT_PII_SNAPSHOT`

Approval freezes a versioned rule (normalized JSON + SHA-256 hash), not a PII member list. No `campaign_audience_members`, recipient snapshots, CRM export tables, or provider custom-audience member tables in 9A.

### OD9A-4 — Phase 9B coupling

**LOCK:** `OPTIONAL_OPAQUE_DESTINATION_NO_9B_FK`

Optional bounded `destination_reference` only. No landing/experiment/form FK. Do not retrofit `lead_source_touchpoints.campaign_reference`.

### OD9A-5 — Channels

**LOCK:** `METADATA_ONLY_NO_M19_PURPOSE_CHANGE`

Intended channels (`meta_ads`, `google_ads`, `email`, `whatsapp`) are approval metadata. No execution. M19 WHATSAPP_SERVICE unchanged. MARKETING WhatsApp send-intent is 9C+. No Meta/Google provider write in 9A.

### OD9A-6 — Budget / creative / window

**LOCK:** `APPROVAL_SNAPSHOT_EXECUTION_DEFERRED_9C`

Approved version freezes budget/creative/window/channels/destination/rule/targeting snapshots. No scheduled/active/paused/completed/provider_failed/spend states in 9A.

---

## D. Canonical 9A lifecycle and conceptual persistence

Lifecycle: `draft → pending_approval → approved | rejected`.

`approved` and `rejected` are terminal **within Phase 9A**. Execution states belong to 9C.

Conceptual tables (not created): `campaigns`, `campaign_versions`, `campaign_audience_rule_versions`, `campaign_approvals`.

Conceptual permissions (not seeded): `campaigns.read`, `campaigns.draft`, `campaigns.request_approval`, `campaigns.approve`, `marketing_consents.manage`. Absent in 9A: execute / publish / schedule / pause / send.

Do not create: `campaign_runs`, delivery jobs, member snapshots, provider objects, spend/conversion tables, 9B tables.

---

## E. Audience eligibility (no recipient snapshot)

| Mode | CRM PII export in 9A | MARKETING gate | DNC / channel |
| :--- | :--- | :--- | :--- |
| `broad_public` | Denied | Not a membership gate (no CRM members exported) | N/A for CRM export |
| `direct_or_custom` | Denied in 9A (preview only) | Current grant required | DNC and invalid/suppressed/archived channel deny |

V1 rule fields (engineering detail, ADR-0027 authority): `lead_source`, `lead_stage`, `service_interest`, `locality`. Operators: equals / not_equals / in / not_in. Group: AND / OR. No arbitrary SQL.

---

## F. Boundaries

- **No provider execution** in 9A.
- **No 9B FK** / landing schema.
- **No 9C** runs, spend, conversion, WhatsApp MARKETING send-intent.
- **n8n** is not campaign/consent/approval truth.
- **No-ERP** locked.
- **Production none.** Public MARKETING capture off.

---

## G. Docs-only changed files

Expected (this freeze):

- `docs/00-project-truth.md`
- `docs/02-architecture.md`
- `docs/05-supabase-data-domains.md`
- `docs/06-security-privacy-and-rls.md`
- `docs/07-crm-and-quotation-boundary.md`
- `docs/08-whatsapp-and-n8n-boundary.md`
- `docs/09-phase-roadmap.md`
- `docs/10-decision-register.md`
- `docs/ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md`
- `docs/audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md`

Forbidden in this gate: `supabase/**`, `src/**`, `package.json`, env/config.

DEC-0075 / DEC-0076 historical rows are **not rewritten**. Current Phase 8C merge truth lives here, project truth, roadmap, and DEC-0077.

---

## H. Validation / CI

- Existing `test:phase-9a` / `test:phase-9b` validate prebuild scaffolding only; passing tests do **not** make prebuild architecture truth.
- This docs-only gate **does not** modify `src/features/marketing` or `src/features/landing-lab`. A pre-existing date-dependent prebuild HMAC fixture now reports `Publication context expired` (today 2026-08-17). That is **not** an architecture defect and is **not** repaired here (src edits are forbidden). Reconciliation belongs to later implementation.
- Exact-head ONEDECORE Quality Gate required on the architecture PR (record run ID in the PR).
- Managed recheck at end of this gate: M1–M30, pending NONE, M31 absent, campaign tables/permissions absent, no managed writes.

---

## Related Documents

- [ADR-0027](../ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [Decision Register](../10-decision-register.md)
- [Phase 8C M30 implementation](phase-8c-m30-project-execution-workspace-implementation.md)
