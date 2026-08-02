# 05 — SUPABASE DATA DOMAINS AND SCHEMA SPECIFICATION

**Document Status:** Locked Data Domain Baseline (truth-synced post DB-2, August 1, 2026)
**Source of Truth:** Supabase PostgreSQL
**Enforcement:** 100% RLS Coverage on Exposed API Schemas
**Migrations Applied (Managed):** 13 / 13

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
│ 6. Project & Design Domain (projects, milestones, design)  │ PLANNED Phase 8
├─────────────────────────────────────────────────────────┤
│ 7. Communication Domain (WhatsApp, templates, opt-out)    │ PLANNED Phase 6
├─────────────────────────────────────────────────────────┤
│ 8. AI Copilot Domain (requests, suggestions, approvals) │ PLANNED Phase 6C
├─────────────────────────────────────────────────────────┤
│ 9. Marketing Domain (campaigns, audiences, runs)          │ PLANNED Phase 9
├─────────────────────────────────────────────────────────┤
│ 10. Operations Domain (import batches, audit, settings) │ PLANNED Phase 5D+
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
- **`consent_events`:** Append-only; marketing capture deferred.
- **`lead_events`:** Append-only history.
- **`lead_intake_requests`:** Idempotency + HMAC fingerprint ledger.
- **`submit_lead_intake`:** Service-role-only atomic RPC.
- Public route `/api/public/lead-intake` exists; **defaults disabled** (`ONEDECORE_LEAD_INTAKE_MODE` empty/disabled).
- Homepage form default: **`copy-only`** (`NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE`).
- `contact_suppressions` not yet created (deferred).

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
| `quotations` / `quotation_versions` | Immutable versioned commercial documents |
| `quotation_sections` / `quotation_line_items` | Room/area line structure |
| `quotation_approvals` | Manager policy approvals |
| `quotation_acceptances` | Client acknowledgement evidence |

### 3.3 Project & Design (Phase 8)
| Concept | Purpose |
| :--- | :--- |
| `projects` | Created from Closed-Won; execution container |
| `project_handover_events` | PM acceptance audit |
| `project_manager_assignments` | One primary PM; assignment history |
| `designer_assignments` | Lead Designer + Supporting Designers |
| `design_tasks` / `design_deliverables` / `design_deliverable_versions` | Versioned design artifacts |
| `design_approvals` | Lead Designer production-ready; client evidence |
| `project_milestones` / `project_files` | PM execution tracking |
| `project_delays` / `project_snags` | Operational issue tracking |
| `client_decisions` | Documented client approvals |

### 3.4 Communication (Phase 6)
| Concept | Purpose |
| :--- | :--- |
| `whatsapp_conversations` / `whatsapp_messages` | Official API message store |
| `whatsapp_templates` / `whatsapp_delivery_events` | Template and delivery state |
| `whatsapp_consent_records` / `whatsapp_opt_outs` | Consent and suppression |

### 3.5 AI Copilot (Phase 6C)
| Concept | Purpose |
| :--- | :--- |
| `ai_requests` / `ai_suggestions` | Provider-independent adapter audit |
| `ai_suggestion_approvals` | Human approval before customer-visible use |

### 3.6 Marketing (Phase 9)
| Concept | Purpose |
| :--- | :--- |
| `campaigns` / `campaign_audiences` / `campaign_recipients` | Consent-eligible audiences |
| `campaign_approvals` / `campaign_runs` / `campaign_events` | Approval chain and execution audit |

### 3.7 Operations & Audit
| Concept | Purpose |
| :--- | :--- |
| `system_audit_logs` | Material mutation audit (existing pattern) |
| `automation_events` | n8n outbox after persistence |

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
