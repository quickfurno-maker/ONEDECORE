# ADR-0027 — Phase 9A Campaign Consent, Audience & Approval Foundation

**Status:** Accepted (architecture freeze — **M31 NOT CREATED**)  
**Date:** August 17, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Phase 9A campaign consent, audience rule versioning, and approval governance  
**Owner authorization:** `LOCK PHASE 9A OWNER DECISIONS AS RECOMMENDED`  
**Depends on:** [ADR-0002](ADR-0002-supabase-source-of-truth.md), [ADR-0004](ADR-0004-crm-before-n8n-persistence.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md), [ADR-0007](ADR-0007-imperative-versioned-migrations.md), [ADR-0008](ADR-0008-database-backed-rbac.md), [ADR-0018](ADR-0018-secure-lead-intake-data-plane.md), [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0021](ADR-0021-groq-copilot-and-whatsapp-boundary.md)

This ADR **is** Phase 9A architecture authority. Existing migration-independent scaffolding under `src/features/marketing/**` and `src/features/landing-lab/**` is **not** architecture truth, permission truth, lifecycle truth, or production readiness. Those trees must be reconciled during later implementation. In particular, prebuild lifecycle states `scheduled`, `paused`, and `completed` are **non-canonical for Phase 9A** and belong to Phase 9C.

This ADR does **not** reopen ADR-0026 / OD8C locks. Phase 8C is complete on protected main.

Conceptual future migration name (not created): `campaign_consent_audience_approval_foundation` (M31 reserved).

---

## Context

Phase 8C is complete on protected main `8f4f3ecf082450e82ab15f02703c951e50f0817e` (PR #61 true merge; parents `5b4a7f300e63b438884a2b440a69a569d91b9e5d` + `a9983c1f70eff66572f8cf7810f951e650ad341c`; post-merge ONEDECORE Quality Gate `32010340601` SUCCESS). Repository and managed OneDecore `lpurlfmpvriyvpkujvyl` are **M1–M30**; pending **NONE**; **M31 absent**. Production is not activated. Public lead intake remains off.

Canonical CRM identity already exists: `public.contacts`, `public.contact_channels`, append-only `public.consent_events` (purpose set includes `MARKETING`). Public intake does **not** write MARKETING. Global DNC is `contacts.status = 'do_not_contact'`. Channel suppression is `contact_channels.status = 'suppressed'`. There is **no** `contact_suppressions` table. `lead_source_touchpoints.campaign_reference` is an opaque ≤120 character string with **no** campaign FK. WhatsApp M18–M21 remain service/shared-inbox/provider foundation; M19 send-intent purpose is **WHATSAPP_SERVICE only**; MARKETING send-intent is denied. Campaign tables, campaign/marketing permissions, and an admin Campaigns route are **absent**.

Phase 9A entry audit **PASS** (2026-08-17). Managed business rows at that audit were all zero (contacts, consent including MARKETING, leads, touchpoints, send-intents).

---

## Decision Outcome

Owner authorization received: `LOCK PHASE 9A OWNER DECISIONS AS RECOMMENDED`.

### OD9A-1 — Suppression foundation

Use existing canonical suppression truth. Do **not** create `contact_suppressions` in Phase 9A.

- Global DNC: `contacts.status = 'do_not_contact'`
- Channel suppression: `contact_channels.status = 'suppressed'`
- A `consent_events` row with `event_type = 'suppressed'` may remain historical consent evidence; it is **not** a second authoritative suppression store.

For `direct_or_custom` CRM-member eligibility: DNC blocks; invalid/suppressed/archived target channel blocks; current MARKETING consent is required; eligibility is rechecked in Phase 9C immediately before any export/send. Approval never overrides later DNC, withdrawal, or suppression.

### OD9A-2 — MARKETING consent capture

Do **not** create a new marketing-consent table. Reuse append-only `public.consent_events` with `purpose_code = 'MARKETING'`.

Later Phase 9A implementation may add a hardened staff recording RPC for MARKETING granted/withdrawn. It records evidence of an actual contact instruction and must never fabricate consent. Required dimensions retain the existing consent model: `contact_id`, `purpose_code`, `channel`, `event_type`, `copy_version`, `notice_version`, `source`, `locale`, `actor_type = 'staff'`, `occurred_at`, bounded evidence JSON.

Phase 9A does **not** activate a public MARKETING checkbox. No implicit consent from service enquiry, WHATSAPP_SERVICE, or inbound WhatsApp.

V1 staff authority for that future RPC: Super Admin and Sales Manager only. Sales Executive / Project Manager / Designer have no Phase 9A consent-management authority.

### OD9A-3 — Freeze rules, not recipients

At approval, the approved audience artifact is a frozen, versioned **rule** definition. Do **not** freeze or store a PII recipient list in Phase 9A.

Do **not** create `campaign_audience_members`, `campaign_recipient_snapshots`, CRM export tables, or provider custom-audience member tables in 9A.

Approval may persist normalized rule JSON, rule hash, targeting mode, and bounded **non-PII** preview metadata. Recipient PII membership is not approval truth. Phase 9C re-evaluates every export/send candidate against current MARKETING consent, DNC, channel suppression/status, channel eligibility, and execution/provider safety rules.

### OD9A-4 — Phase 9A to Phase 9B coupling

Phase 9A may store an optional bounded opaque `destination_reference`. It is informational configuration only. No Phase 9A FK to landing pages, variants, experiments, forms, or any Phase 9B schema. No existence guarantee and no claim the destination is live. Existing `lead_source_touchpoints.campaign_reference` remains opaque; do not retrofit a campaign FK in 9A.

### OD9A-5 — Marketing channels in 9A

Phase 9A stores intended channel(s) as approval metadata only. Initial V1 vocabulary may align to `meta_ads`, `google_ads`, `email`, `whatsapp`. This does **not** authorize execution. Do **not** change M19: WHATSAPP_SERVICE remains the only existing send-intent purpose. MARKETING WhatsApp send-intent is Phase 9C or later. No Meta/Google provider write in 9A.

### OD9A-6 — Budget / creative / window

The approved campaign version freezes the reviewed proposal snapshot including budget metadata, creative metadata, intended execution window metadata, intended channels, destination metadata, audience rule version/hash, and targeting mode. These are approval/configuration snapshots only.

Phase 9A **must not** persist execution lifecycle such as scheduled, active/running, paused, completed, provider_failed, or spend/reconciled. Scheduling, pause/resume, provider dispatch, spend, conversions, and attribution belong to Phase 9C.

---

## Existing locks preserved (do not reopen)

A. MARKETING is optional.  
B. WHATSAPP_SERVICE ≠ MARKETING.  
C. Super Admin has final approval authority.  
D. Sales Manager may approve other campaigns but **must not** approve their own.  
E. Sales Executive / PM / Designer have no Phase 9A campaign authority.  
F. Kriti has no authoritative campaign approval/execution authority.  
G. Phase 9B follows 9A.  
H. Phase 9C execution is later.  
I. Production remains Phase 10.  
J. Supabase/CRM is system of record; n8n is never campaign truth.  
K. No-ERP remains locked (ADR-0005).

---

## Canonical Phase 9A responsibility

Phase 9A covers: MARKETING consent recording/revocation using existing CRM consent; campaign draft identity/versioning; audience rule versioning; approval submission; approval/rejection evidence; immutable approved configuration snapshot; staff campaign RBAC; read-only audience eligibility/preview; later staff-only campaign governance UI.

Phase 9A is **not**: campaign execution/provider scheduling/ad publishing; spend/attribution engine; landing-page lab; bulk WhatsApp marketing; email delivery platform; CRM recipient export run; ERP.

---

## Canonical Phase 9A lifecycle

```
draft → pending_approval → approved | rejected
```

This **supersedes** the Phase 9A interpretation of current prebuild states `scheduled`, `paused`, and `completed`. Those states are non-canonical for 9A and belong to 9C.

- **draft:** mutable by authorized draft staff; optimistic concurrency recommended.
- **request approval:** validates complete configuration; seals exact candidate snapshot; freezes normalized audience rule/hash and configuration hash; records requester/time; moves to `pending_approval`; content becomes immutable.
- **pending_approval:** exact frozen candidate only; no silent edit; no provider action.
- **approved:** terminal within Phase 9A governance; immutable; may become input to later Phase 9C; does not execute.
- **rejected:** terminal for that version; bounded rejection reason required; changes require new draft version n+1; history preserved.

Do not use pending → mutable draft rollback for an already reviewed snapshot.

---

## Conceptual future persistence (architecture only — do not create)

Exact SQL remains later M31 implementation after this architecture merges.

- `public.campaigns` — stable UUID identity, name, created_by / timestamps; **no** execution/provider state in 9A.
- `public.campaign_versions` — campaign_id, version_no, status `draft|pending_approval|approved|rejected`, targeting_mode, intended_channels, nullable destination_reference, budget/creative/intended_window snapshots, audience_rule_version_id, configuration_hash, created_by / requested_by / requested_at / frozen_at; content immutable after submission.
- `public.campaign_audience_rule_versions` — campaign_version_id UNIQUE, normalized rule JSON, SHA-256 rule_hash, targeting_mode, frozen_by/frozen_at; **no PII member rows**.
- `public.campaign_approvals` — append-only; campaign_version_id; decision `approved|rejected`; decided_by/decided_at; reason/note; configuration_hash/rule_hash proof; one authoritative decision per frozen version in V1.

Do **not** create in 9A: `campaign_runs`, `campaign_delivery_jobs`, `campaign_members`, recipient snapshots, provider objects, spend/conversion tables, landing-page FK.

Historical conceptual names `campaign_audiences` / `campaign_recipients` / `campaign_runs` in earlier data-domain planning are **superseded for 9A**: 9A uses rule versions, not recipient lists; runs are 9C.

---

## Targeting modes

- **broad_public:** provider/public targeting without identified CRM export. CRM PII export forbidden. Person-level MARKETING consent is not a membership gate because CRM members are not exported. No contact/channel data leaves CRM in 9A.
- **direct_or_custom:** targeting derived from identifiable CRM contacts/leads or a future custom audience. Current MARKETING consent required. DNC denies. Target channel must be active/eligible where relevant. Suppression denies. 9C rechecks current eligibility. No export in 9A.

---

## Audience rule V1 (engineering detail)

Architecture may adopt the current prebuild allowlist as V1 engineering detail: fields `lead_source`, `lead_stage`, `service_interest`, `locality`; operators `equals`, `not_equals`, `in`, `not_in`; group logic AND/OR. Later implementation must bound rule/value counts; use a deterministic normalized representation and SHA-256 hash; remain immutable after submission; forbid arbitrary SQL/user-supplied columns/scripts; generate preview queries only from allowlisted fields; put no PII in hash or log reasons. **This ADR, not the prebuild, is architecture authority.**

---

## Consent current-state evaluation

`consent_events` remains append-only evidence. Current effective MARKETING grant is derived from canonical event history. Later withdrawn/expired/suppressed means no current MARKETING grant. DNC and channel suppression independently override. Do not mutate historical consent rows. Do not add a mutable current-consent truth table in 9A architecture.

Future staff recording must require active authorized staff; insert only; record actual evidence/source/copy/notice version; be auditable and idempotent where needed; never edit/delete old consent history.

---

## Campaign RBAC

Conceptual future permissions: `campaigns.read`, `campaigns.draft`, `campaigns.request_approval`, `campaigns.approve`, `marketing_consents.manage`.

No Phase 9A: `campaigns.execute`, `campaigns.publish`, `campaigns.schedule`, `campaigns.pause`, `campaigns.send`.

- **Super Admin:** read / draft / request / approve / manage MARKETING consent; may approve any pending version.
- **Sales Manager:** read / draft / request; may approve **other** submitted versions; manage MARKETING consent; **must not** approve own version. Own means a frozen version where the manager is creator/author or request-for-approval actor. Identity shuffle must not bypass four-eyes control. Self-approval denial is a **database authority** requirement, not UI-only.
- **Sales Executive / Project Manager / Designer:** no Phase 9A campaign permission; no `marketing_consents.manage`.
- **Kriti:** no authoritative mutation/approval.
- **Legacy roles:** no automatic Phase 9A grants.

Future mutation RPCs: active staff; internal authorization; RLS; fail closed; no browser service role.

---

## Approval invariants

A. Approval targets exact `campaign_version_id`.  
B. Version must be `pending_approval`.  
C. Configuration/rule hashes must match the frozen candidate.  
D. Submitted/approved/rejected content cannot mutate.  
E. Rejection reason required and bounded.  
F. Sales Manager self-approval denied at DB authority.  
G. Super Admin may approve any pending version.  
H. Approval has no provider side effect.  
I. Approval creates no schedule, run, or recipient list.  
J. Approval never overrides future consent changes.

Approvals are append-only; no update/delete.

---

## Budget / creative / window snapshot boundary

- **Budget:** integer minor-unit amount preferred (paise for INR); currency explicit; no spend ledger or provider billing sync.
- **Creative:** bounded provider-neutral JSON/config snapshot; no provider creative creation; no large marketing storage bucket requirement unless later implementation proves it.
- **Window:** intended start/end metadata; validates ordering; no scheduler; no scheduled lifecycle state.

---

## Phase 9B / 9C / 10 / WhatsApp / n8n

**9B:** 9A must not define landing_pages / versions, route publishing, variants/experiments, forms/A-B allocation, landing analytics/storage, or a campaign → landing FK. Opaque `destination_reference` only.

**9C later owns:** `campaign_runs`; provider scheduling/account/object IDs; Meta/Google execution; CRM/custom-audience export; email dispatch; WhatsApp MARKETING send-intent design; pause/resume/provider retry; spend/delivery/conversion metrics; campaign attribution feedback; execution-time consent/DNC/suppression recheck.

**Phase 10 remains OFF:** public intake; public MARKETING capture; production Meta/Google campaign execution; WhatsApp marketing sends; production activation of campaign capabilities. This freeze does not claim production readiness.

**WhatsApp:** M19 WHATSAPP_SERVICE unchanged. MARKETING consent does not authorize the current send-intent RPC. 9A approval creates no send intent. WhatsApp marketing requires later 9C design.

**n8n:** never campaign, consent, or approval truth. Database-before-automation remains locked (ADR-0004). n8n cannot decide consent or approval.

**Security / RLS principles (later M31):** 100% RLS on exposed tables; direct authenticated DML denied; no browser service role; no provider tokens in campaign rows; consent minimization; no recipient PII snapshot; `broad_public` CRM export denied; `direct_or_custom` requires current MARKETING + DNC/channel checks; no legacy-role grants.

---

## Deferred items

- M31 SQL, RPCs, RLS, permission seeds, and staff UI
- Prebuild reconciliation (`scheduled`/`paused`/`completed` vs canonical 9A lifecycle)
- Phase 9B landing lab persistence and public serving
- Phase 9C execution, export, spend, conversion
- Public MARKETING capture and public intake activation
- Production activation

---

## Consequences

- Campaign governance can be implemented later without inventing a parallel consent or suppression store.
- Approval cannot be mistaken for execution or for a CRM export.
- Prebuild TypeScript remaining on main cannot silently become schema or lifecycle truth.

---

## Related Documents

- [Phase 9A architecture freeze](../audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md)
- [ADR-0019: Five-Role CRM Authorization](ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0021: Groq Copilot and WhatsApp Boundary](ADR-0021-groq-copilot-and-whatsapp-boundary.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR-0005-version-1-no-erp-boundary.md)
- [WhatsApp / n8n boundary](../08-whatsapp-and-n8n-boundary.md)
- [Decision Register](../10-decision-register.md)
