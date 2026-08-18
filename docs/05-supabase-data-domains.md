# 05 — SUPABASE DATA DOMAINS AND SCHEMA SPECIFICATION

**Document Status:** Locked Data Domain Baseline (truth-synced through Phase 9B architecture freeze and Phase 9D-A conceptual commerce freeze, August 18, 2026)
**Source of Truth:** Supabase PostgreSQL
**Enforcement:** 100% RLS Coverage on Exposed API Schemas
**Migrations Applied (Managed):** M1–M31 on OneDecore `lpurlfmpvriyvpkujvyl`. Pending **NONE**. M31 **MANAGED_APPLIED_IMMUTABLE**.

---

## 1. Domain Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ 1. Identity & Permissions (profiles, roles, permissions)  │ LIVE
├─────────────────────────────────────────────────────────┤
│ 2. Portfolio Domain                                     │ LIVE
├─────────────────────────────────────────────────────────┤
│ 3. Lead Intake Domain (contacts, leads, consent, intake)│ LIVE (schema); public route DISABLED
├─────────────────────────────────────────────────────────┤
│ 4. CRM Operations Domain (sources, assignments, notes, etc.) │ LIVE (migrations 1–14 managed)
├─────────────────────────────────────────────────────────┤
│ 5. Commercial Domain (quotations, versions, acceptance) │ PLANNED Phase 7
├─────────────────────────────────────────────────────────┤
│ 6. Project & Design Domain (projects, design, execution)│ LIVE (M28–M30 managed)  │
├─────────────────────────────────────────────────────────┤
│ 7. Communication Domain (WhatsApp foundation + Phase 6B inbox/send/dispatch managed) │ FOUNDATION MANAGED
├─────────────────────────────────────────────────────────┤
│ 8. AI Copilot Domain (requests, suggestions, approvals) │ PLANNED Phase 6C
├─────────────────────────────────────────────────────────┤
│ 9. Marketing Domain (campaigns, audience rules, approvals) │ LIVE M31 managed (no runs)
├─────────────────────────────────────────────────────────┤
│ 10. Operations Domain (import batches, audit, settings) │ PLANNED Phase 5D+
├─────────────────────────────────────────────────────────┤
│ 11. Commerce Domain (catalogue, cart, orders, payments) │ PHASE 9D ROADMAP-LOCKED — NOT STARTED
└─────────────────────────────────────────────────────────┘
```

---

## 2. Implemented Schema (Live)

### 2.1 Identity Domain
- **`profiles`:** Staff profiles linked to `auth.users`; `status` must be `active` for authorization.
- **`roles` / `permissions` / `role_permissions` / `user_roles`:** Database-backed RBAC.
- **Legacy seed roles:** retained; canonical additions `sales_manager`, `sales_executive`, `project_manager` (migrations 11–14 managed).
- **CRM tables (managed):** `lead_sources`, `lead_closure_reasons`, `lead_source_touchpoints`, `lead_assignment_history`, `lead_notes`, `lead_follow_ups`, `lead_activities`; `leads.primary_source_id`, `leads.entry_method`.
- **`public.authorize(text)`:** SECURITY INVOKER wrapper to `private.has_permission()`.

### 2.2 Portfolio Domain (Phase 2E1+)
- **`portfolio_projects`**, **`portfolio_project_services`**, **`portfolio_media`**, **`portfolio_media_sources`**
- Publication workflow via `set_portfolio_project_status` RPC and trigger guards.

### 2.3 Lead Intake Domain (Phase 4A / 4B — schema live, not publicly active)

**Migration 9:** `20260729162245_lead_intake_data_plane.sql`
**Migration 10:** `20260730053756_lead_intake_covering_indexes.sql`

- **`contacts` / `contact_channels`:** CRM identity; phone dedupe key; email never auto-merges.
- **`leads`:** Planner-backed requirements; `submission_reference`; `assigned_to` FK.
- **`consent_events`:** Append-only; staff MARKETING grant/withdraw via M31 RPC (SA/SM); public MARKETING capture remains off.
- **`lead_events`:** Append-only history.
- **`lead_intake_requests`:** Idempotency + HMAC fingerprint ledger.
- **`submit_lead_intake`:** Service-role-only atomic RPC.
- Public route `/api/public/lead-intake` exists; **defaults disabled** (`ONEDECORE_LEAD_INTAKE_MODE` empty/disabled).
- Homepage form default: **`copy-only`** (`NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE`).
- `contact_suppressions` not created (deferred historically; **not planned in Phase 9A** — OD9A-1 reuses DNC + channel suppression).

### 2.4 WhatsApp Foundation Domain (Phase 6A — migration 18 managed)

**Migration 18:** `20260804150000_meta_whatsapp_data_webhook_foundation.sql` (applied managed August 7, 2026)

**Public tables (RLS-enabled; no direct `anon`/`authenticated` table access):**
- `whatsapp_business_accounts`, `whatsapp_phone_numbers`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_status_events`, `whatsapp_webhook_events`, `whatsapp_templates`

**Public service-role-only ingest RPCs:**
- `ingest_meta_whatsapp_message`, `ingest_meta_whatsapp_status`

**Private helpers (hardened `search_path`; not client-exposed):**
- `private.whatsapp_assert_hash`, `private.whatsapp_check_webhook_replay`, `private.whatsapp_upsert_waba_phone`

**Consent boundary:** CRM `contacts` / `contact_channels` / `consent_events` remain the **only** consent authority. Purpose codes include `SERVICE_ENQUIRY`, `SERVICE_COMMUNICATION`, `WHATSAPP_SERVICE`, and `MARKETING`. M18 does **not** create a parallel WhatsApp consent store, grant `MARKETING` consent, clear DNC, or auto-create/link CRM contacts or leads from inbound messages. A service enquiry or inbound service message is **not** marketing consent.

**Activation boundary:** Schema foundation only — no production Meta callback, token, outbound messaging, shared inbox UI, or n8n correctness dependency.

---

## 3. Conceptual Future Domains (No Migrations in Phase 5A)

Exact SQL identifiers deferred to Phase 5B implementation checkpoint. Naming must follow existing conventions: `snake_case` tables, `domain.action` permission codes, append-only event tables, `created_at`/`updated_at` audit columns.

### 3.1 CRM Core (Phase 5B–5E)
| Concept | Purpose |
| :--- | :--- |
| Role bindings / active status extensions | Five-role CRM model atop existing RBAC |
| `lead_sources` catalogue | Controlled source definitions (Super Admin managed) |
| `lead_source_touchpoints` | Attribution touchpoint history per lead |
| `lead_assignment_history` | Audited manual and rule-based assignments |
| `lead_notes` / `lead_follow_ups` | Staff collaboration on leads |
| `lead_activities` | Calls, meetings, stage transitions |
| `lead_loss_reasons` | Mandatory Closed-Lost reasons |
| `sales_targets` / `sales_target_history` | Monthly targets; append-only revisions |
| `import_batches` / `import_batch_rows` | Private bulk import lifecycle |
| `import_batch_approvals` | Manager → Super Admin approval chain |
| `lead_assignment_rules` | Source-based routing (no round-robin) |

### 3.2 Commercial (Phase 7)
| Concept | Purpose |
| :--- | :--- |
| `quotations` / `quotation_versions` | Versioned commercial documents; finalized versions immutable |
| `quotation_sections` / `quotation_line_items` | Room/area line structure |
| `quotation_payment_schedule_items` | Payment schedule reconciled to `grand_total_paise` |
| `quotation_version_terms` / `quotation_events` | Terms and append-only audit |
| `quotation_pdf_documents` | Authoritative PDF per finalized version (planned 7B) |
| `quotation_access_grants` / `quotation_client_events` | Secure client view and outcomes (planned 7B) |
| `quotation_delivery_events` | Send/delivery audit via Phase 6B boundary (planned 7B) |
| `quotation_acceptances` | Client acknowledgement evidence (planned 7B) |

**Not in V1:** `quotation_approvals`, `quotation_approval_policies`, `quotations.approve` — see ADR-0022.

### 3.3 Project & Design (Phase 8)

Live Phase 8A schema (M28) uses `public.projects`, `public.project_manager_assignments`, and `public.project_events`. Phase 8B live names from M29 are frozen in [ADR-0025](ADR/ADR-0025-phase-8b-designer-assignment-design-collaboration.md). Phase 8C live names from M30 are frozen in [ADR-0026](ADR/ADR-0026-phase-8c-project-execution-workspace.md) (OD8C-1–OD8C-12). PR #61 is **merged**.

| Concept | Purpose |
| :--- | :--- |
| `projects` | Created from Closed-Won; Phase 8A handover container (live M28) |
| `project_handover_events` | Historical planning name; live audit is `public.project_events` |
| `project_manager_assignments` | One primary PM; assignment history (live M28) |
| `designer_assignments` | Live: `project_designer_assignments` (M29) |
| `design_tasks` / `design_deliverables` / `design_deliverable_versions` | Live: `project_design_deliverable_versions` (M29) |
| `design_approvals` | Live: `project_design_evidence` (M29) |
| `project_milestones` / generic project files | **DEFERRED** (ADR-0026) |
| `project_delays` / snags | Live snags: `project_execution_snags` (M30); generic delays not a separate ERP module |
| `client_decisions` | Documented client approvals (Phase 8B evidence model, not a portal) |

### 3.4 Communication (Phase 6A foundation + Phase 6B runtime)
| Concept | Purpose |
| :--- | :--- |
| `whatsapp_business_accounts` / `whatsapp_phone_numbers` | WABA and phone registry (**M18 managed**) |
| `whatsapp_conversations` / `whatsapp_messages` | Official API message store (**M18 managed**) |
| `whatsapp_message_status_events` / `whatsapp_webhook_events` | Delivery/webhook audit (**M18 managed**; append-only triggers) |
| `whatsapp_templates` | Template registry (**M18 managed**) |
| Shared inbox UI + controlled outbound | **Phase 6B runtime — managed foundation; not production-activated** |
| CRM consent / DNC | **`consent_events` + `contact_channels` — authoritative; not duplicated in M18** |

### 3.5 AI Copilot (Phase 6C)
| Concept | Purpose |
| :--- | :--- |
| `ai_requests` / `ai_suggestions` | Provider-independent adapter audit |
| `ai_suggestion_approvals` | Human approval before customer-visible use |

### 3.6 Marketing (Phase 9A M31 — **managed-applied 2026-08-18**)

Reuse live CRM consent: `contacts`, `contact_channels`, `consent_events` (`purpose_code = 'MARKETING'`). No parallel marketing-consent table. No `contact_suppressions` in 9A.

| Concept | Purpose | 9A status |
| :--- | :--- | :--- |
| `campaigns` | Stable campaign identity `OD-C-{YYYY}-{SEQ6}` | **MANAGED M31** — certified empty at apply |
| `campaign_versions` | Draft / pending_approval / approved / rejected | **MANAGED M31** — certified empty at apply |
| `campaign_audience_rule_versions` | Frozen normalized rule JSON + SHA-256 hash; **no PII members** | **MANAGED M31** — certified empty at apply |
| `campaign_approvals` | Append-only approved/rejected evidence | **MANAGED M31** — certified empty at apply |
| `private.marketing_idempotency_requests` | Retry-safe Phase 9A mutations | **MANAGED M31** — certified empty at apply |
| `campaign_runs` / provider objects / spend | Execution | **EXCLUDED — Phase 9C** |
| Recipient / member snapshots / CRM export tables | PII lists | **EXCLUDED — not 9A** |
| Landing-page tables / campaign→landing FK | Landing Lab | **M32 in repository; no M31 FK; not managed-applied** |

See [ADR-0027](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md) and [M31 implementation audit](audits/phase-9a-m31-campaign-consent-audience-approval-implementation.md).

### 3.7 Operations & Audit
| Concept | Purpose |
| :--- | :--- |
| `system_audit_logs` | Material mutation audit (existing pattern) |
| `automation_events` | n8n outbox after persistence |

### 3.8 Commerce (Phase 9D — **ARCHITECTURE FROZEN**, implementation not started)

Ready-made furniture catalogue, variants, SKU stock, orders (`OD-O-{YYYY}-{SEQ6}`), immutable item/address snapshots, COD + online payment state. Online unpaid inventory uses a 15-minute `reserved_qty` hold; a late paid webhook after expiry must re-commit current stock or cancel without overselling (payment stays `paid`). Tax rates are explicit admin configuration (no architecture-seeded statutory GST %). **No tables in this gate.** Conceptual model and RBAC: [ADR-0030](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md). Not quotation ecommerce. Not warehouse ERP. Migration timestamp **unreserved** until 9D-B.

---

## 4. Security Contracts (All Domains)

- 100% RLS on API-exposed private tables.
- No anonymous CRM access.
- Service-role key never in browser.
- Append-only consent, events, target history, quotation versions.
- Private import files in non-public storage with signed URLs.
- Duplicate checks scoped to prevent cross-executive PII exposure.
- PM/Designer RLS: assigned projects only.

---

## 5. Related Governance Documents

- [Security, Privacy & RLS](06-security-privacy-and-rls.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [ADR-0018: Secure Lead Intake Data Plane](ADR/ADR-0018-secure-lead-intake-data-plane.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
### Phase 9B Landing Page Lab Data Domain — M32 in repository, not managed

Forward-only M32 `20260819140000_landing_page_lab_experimentation_foundation.sql` adds:

| Concept | Purpose |
| :--- | :--- |
| `landing_pages` | Stable `OD-LP-{YYYY}-{SEQ6}` identity + unique slug |
| `landing_page_versions` | Structured JSON blocks; frozen versions immutable |
| `landing_publications` | Exact frozen-version binding; `draft/live/paused/archived` |
| `landing_experiments` | `draft/running/concluded`; human winner |
| `landing_experiment_variants` | Exactly 2–3 frozen-version allocations totaling 100% |
| `landing_exposures` | Privacy-safe unique denominator (HMAC visitor hash) |
| `private.landing_lab_idempotency_requests` | Dedicated Landing Lab mutation ledger |

Existing authoritative data is reused (`leads.landing_path`, `leads.attribution`, `lead_source_touchpoints`, CRM stages). No parallel attribution table. M31 is unchanged. Managed remains **M1–M31**; M32 **NOT** managed-applied.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->
