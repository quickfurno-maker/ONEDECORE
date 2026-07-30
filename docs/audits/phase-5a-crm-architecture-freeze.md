# Phase 5A — CRM & Operations Architecture Freeze

**Date:** July 30, 2026  
**Branch:** `phase-5a-crm-architecture-freeze`  
**Base SHA:** `8733c587b96c0504a047d0d68d00121901338a3f` (main after Phase 4B2 merge)  
**Scope:** Documentation and architecture freeze only — no application code, migrations, Supabase changes, integrations, deployment, or public lead activation.

---

## 1. Purpose

Reconcile stale roadmap and governance documentation with merged repository history and lock the approved ONEDECORE Sales, WhatsApp, Quotation, Project Execution, Design, and Marketing operating-system scope before Phase 5B implementation.

---

## 2. Repository Evidence Reviewed

| Area | Evidence | Status at freeze |
| :--- | :--- | :--- |
| Identity & RBAC | Migrations 1–4, `public.authorize`, pgTAP 01 | Live — legacy seed roles (`management`, `sales`, `project_operations`) pending Phase 5B remap |
| Staff auth | `/auth/login`, Proxy guard, `/admin` layout | Live |
| Portfolio CMS & public portfolio | Migrations 5–8, Phase 2E3 | Live |
| Lead intake data plane | Migration 9 (`20260729162245`) | Schema live locally + managed |
| Lead intake indexes | Migration 10 (`20260730053756`) | Applied managed 10/10 |
| Public lead form | Phase 4B2 dual gates | **Merged; defaults copy-only; server disabled** |
| CRM workspace | — | **Not implemented** |
| WhatsApp / Groq / campaigns / quotations / projects | — | **Not implemented** |

---

## 3. Locked Five-Role Model

See [ADR-0019](../ADR/ADR-0019-five-role-crm-authorization-model.md).

| Role | Key boundaries |
| :--- | :--- |
| `super_admin` | Full operational control; cannot erase immutable audit |
| `sales_manager` | All leads + unassigned queue; bulk import submit (not approve own); team-only targets V1 |
| `sales_executive` | Assigned leads only; one manual lead self-assigned; no bulk/reassign/approve |
| `project_manager` | Assigned projects only; accept handover; no commercial/assignment authority |
| `designer` | Assigned projects only; one Lead Designer + Supporting Designers; no self-assign |

**Excluded roles:** accountant, site supervisor, factory manager, installer, procurement, inventory manager, labour dispatch.

---

## 4. Authorization & RLS Principles

- Invitation-only staff auth; inactive/suspended denied (Phase 2D2).
- `public.authorize(permission_code)` + RLS row scoping — UI hiding is not authorization.
- Server-only mutations; no service-role key in browser.
- Append-only consent/events/audit; no hard-delete of business history.
- Duplicate checks must not leak cross-executive PII.
- PM/Designer access only after explicit assignment.

---

## 5. Lead Operations (Future Implementation)

### Sources
Controlled catalogue; Super Admin manages definitions; disabled sources on historical records; no free-text authoritative source.

### Manual leads
Executive: one, self-assigned. Manager: one, flexible assignee. Super Admin: full audited override.

### Bulk import
Executive: rejected. Manager: batch → Super Admin approval. Super Admin: direct import after preview. Lifecycle states locked in ADR-0019.

### Assignment
Manual by Manager/Admin; source-based rules by Super Admin; Unassigned fallback; **no round-robin**.

### Pipeline (state graph)

Primary active progression: `New` → `Assigned` → `Contacted` → `Qualified` → `Consultation Scheduled` → `Proposal Sent` → `Negotiation`.

Branches (not sequential): **Closed-Won** (terminal; Accepted quotation required), **Closed-Lost** (terminal; reason), **On Hold** (non-terminal pause). Project creation only from Closed-Won. See ADR-0019.

---

## 6. Premium Role-Aware CRM IA (Document Only)

| Role | Primary navigation surfaces |
| :--- | :--- |
| Super Admin | Command Centre, Leads, WhatsApp Inbox, Follow-ups, Quotations, Projects, Campaigns, Sales Targets, Team, Reports, Settings, Audit |
| Sales Manager | Dashboard, Leads, WhatsApp Inbox, Follow-ups, Quotations, Projects, Campaigns, Sales Targets, Team Performance |
| Sales Executive | My Dashboard, My Leads, My WhatsApp, My Follow-ups, My Quotations, My Projects, My Target |
| Project Manager | Dashboard, My Projects, Milestones, Client Updates, Files, Snag Lists, Notifications |
| Designer | Dashboard, My Projects, My Design Tasks, Design Reviews, Client Approvals, Revisions, Files, Notifications |

No UI built in Phase 5A.

---

## 7. Commercial & Execution Handover

See [ADR-0020](../ADR/ADR-0020-closed-won-project-handover-invariants.md).

Accepted quotation → Closed-Won → Project (Awaiting PM Assignment) → PM assigned by Manager/Admin → Awaiting PM Acceptance → PM accepts → execution active.

One primary PM; one Lead Designer + Supporting Designers; manual assignment only.

---

## 8. WhatsApp, Groq, Campaigns

See [ADR-0021](../ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md). **Not live.** Official Meta API only; Groq copilot human-controlled; campaigns require consent and Super Admin approval chain.

---

## 9. Public Lead Intake Truth (Unchanged)

| Control | Default |
| :--- | :--- |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | `copy-only` |
| `ONEDECORE_LEAD_INTAKE_MODE` | `disabled` (empty in `.env.example`) |
| Public collection | **Off** |
| Deployment | **Not authorized** |
| Legal/owner activation gates | Incomplete |

Activation requires separate explicit authority (Phase 5F).

---

## 10. Forward Roadmap (Post-5A)

| Phase | Title |
| :--- | :--- |
| **5A** | CRM & Operations Architecture Freeze **[CURRENT — docs only]** |
| **5B** | CRM Identity, Authorization & Core Data Foundation |
| **5C** | Lead Workspace & Premium Role-Aware CRM |
| **5D** | Bulk Import Approval & Source-Based Assignment |
| **5E** | Sales Target Configuration & CRM Reporting Foundation (achievement inactive until 7B) |
| **5F** | Controlled Public Lead Activation Gate |
| **6A** | Meta WhatsApp Data & Webhook Foundation |
| **6B** | Premium Shared Inbox & Controlled Outbound Messaging |
| **6C** | Groq Human-Controlled Copilot |
| **7A** | Commercial Quotation Data Foundation |
| **7B** | Quotation Workflow, Premium PDF & Acceptance |
| **8A** | Closed-Won Project Conversion & PM Handover |
| **8B** | Designer Assignment & Design Collaboration |
| **8C** | Project Execution Workspace |
| **9A** | Campaign Consent, Audience & Approval Foundation |
| **9B** | Campaign Execution, Replies & Attribution |
| **10** | Security Hardening, Full E2E, Performance & Deployment |

---

## 11. Contradictions Corrected

| Stale statement | Correction |
| :--- | :--- |
| Phase 2E3 shown as current | Superseded by Phases 3–4B2 completion |
| Product limited to five layers as complete | Layers are architectural domains; most CRM/ops modules are planned |
| CRM as simple lead conversion only | Full operating-system scope locked in 5A |
| Project execution roles globally excluded | PM and Designer roles included; ERP operational roles still excluded |
| Autonomous AI exclusion = all AI excluded | Human-controlled Groq copilot planned (Phase 6C) |
| Phase 4B2 exclusions permanent for all future work | 4B2 scoped public activation only; CRM/ops proceed in Phase 5+ |
| Won tied to advance payment | Closed-Won requires Accepted quotation |
| Serial pipeline/quotation/design diagrams | Corrected to state-graph semantics (independent review) |
| Phase 5E authoritative achievement before 7B | Achievement inactive in 5E; activated in 7B |
| Intake/WhatsApp/Groq/campaigns live | Explicitly not live; defaults disabled |

Historical phase audits preserved unchanged.

---

## 12. Documentation Deliverables

Updated: README, `00`–`10` governance docs (except `03`/`04` portfolio-specific), three new ADRs (`0019`–`0021`), this audit.

---

## 13. Explicit Non-Actions

- No migrations created or applied (managed or local).
- No application/feature code.
- No environment or secret changes.
- No PR opened or merged.
- No deployment or public intake enablement.

---

## 15. Independent Review Correction (July 30, 2026)

Independent remote review found the Phase 5A branch documentation-only and correctly one commit ahead of main, but identified misleading **serial arrow diagrams** for lead, quotation, design, and project workflows, and premature Phase 5E authoritative achievement claims.

**Corrections applied (same branch, new commit):**
- Lead pipeline: state graph with terminal (Closed-Won, Closed-Lost) and non-terminal (On Hold) branches — not a single line.
- Quotation lifecycle: main path + alternative outcomes (Accepted/Rejected/Expired) + revision loop.
- Design and project execution: hold/cancel as branches from active stages, not post-completion serial tails.
- Phase 5E: target configuration and non-commercial reporting only; authoritative achievement deferred to Phase 7B (quotation acceptance) and optional Phase 8A (project value, no double counting).

**Unchanged:** Locked business decisions, five-role model, assignment rules, public intake disabled defaults.

**No code, migrations, database changes, deployment, or public activation in this correction.**

---

## 16. Next Phase Entry Gate (5B)

Phase 5B may begin when:

1. Owner approves this architecture freeze.
2. RBAC remap plan from legacy seed roles to five-role model is accepted.
3. Core schema naming checkpoint completed for sources, assignments, activities, targets, and import batches.
