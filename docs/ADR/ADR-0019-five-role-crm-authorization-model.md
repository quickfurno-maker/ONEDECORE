# ADR-0019: Five-Role CRM Authorization and Manual Assignment Model

**Status:** Accepted  
**Date:** July 30, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** CRM & Operations Architecture (Phase 5A freeze)  
**Supersedes:** Informal role sketches in early PRD (`management`, `sales`, `operations` as operational CRM roles)

---

## Context and Problem Statement

ONEDECORE has database-backed RBAC (`public.authorize`, `private.has_permission`, active staff profiles) and a secure lead-intake data plane (Phase 4A–4B2). The next implementation phases require a locked, role-aware operating model for sales, WhatsApp, quotations, project execution, design collaboration, and marketing — without scope creep into ERP or autonomous automation.

Historical seed roles (`management`, `sales`, `project_operations`) do not match the approved V1 operating model. Phase 5B will extend RBAC; Phase 5A freezes behaviour and visibility rules only.

---

## Decision Drivers

- Owner-approved five-role model with explicit exclusions (no accountant, site supervisor, factory manager, installer, procurement, inventory, labour dispatch).
- Server-side and database-enforced authorization; UI hiding is never sufficient.
- Sales Executive lead isolation, PM project isolation, and Designer project isolation via RLS.
- Manual assignment for leads, PMs, and Designers; source-based automated lead assignment without round-robin.
- Bulk import approval workflow with Super Admin gate for manager-submitted batches.
- Append-only audit for material changes; no hard-delete of business history.

---

## Decision Outcome

### V1 roles (locked)

| Role | Scope summary |
| :--- | :--- |
| `super_admin` | Complete operational control except erasing immutable audit history. Manages staff, permissions, sources, assignment rules, imports, targets, quotation overrides, project/design assignments, campaigns, reports, audit. |
| `sales_manager` | All sales leads/conversations and unassigned queue. Create/assign/reassign leads. Submit bulk imports (Super Admin approval required). Approve quotations within policy. Assign/reassign PM and Designers after project exists. Draft campaigns (cannot approve own). Team-only monthly targets in V1. |
| `sales_executive` | Assigned leads only. One manual lead at a time (self-assigned). No bulk upload, reassignment, unassigned queue, quotation approval, project staff assignment, campaigns, targets, or user management. |
| `project_manager` | Assigned projects only. Accept handover; update permitted milestones, notes, files, delays, snags. Cannot assign/reassign PMs or Designers, change commercial truth, or manage leads/campaigns/targets/staff. |
| `designer` | Explicitly assigned projects only. Exactly one Lead Designer plus zero or more Supporting Designers per project. Lead Designer coordinates design and production-ready approval. Cannot self-assign, add/replace staff, change PM, or make pricing/commercial commitments. |

### Authentication

- Invitation-only Supabase Auth email/password.
- No public staff signup.
- Inactive or suspended staff lose access (`profiles.status = 'active'` required — already enforced in Phase 2D2).

### Authorization conventions

- Reuse `public.authorize(permission_code)` and permission naming pattern `domain.action` (e.g. `leads.read`, `leads.manage`).
- All mutations remain server-only; browser never holds service-role credentials.
- RLS enforces row visibility; application checks are additive, not substitutive.

### Lead sources

- Each lead has one primary source, zero or more touchpoints, optional source detail/campaign reference, entry method, entered-by identity, and first-touch/latest-touch timestamps.
- Initial controlled catalogue (Website, Website Planner, Google Organic/Ads, Google Business Profile, Instagram/Facebook Organic/Ads, WhatsApp, Phone Call, Walk-in, Client/Vendor/Architect Referral, Interior Partner, Housing Society, Event or Exhibition, Offline Advertisement, Manual Entry, Other).
- Only Super Admin manages source definitions. Disabled sources remain on historical records. No uncontrolled free text as authoritative source.

### Manual leads

| Actor | Rules |
| :--- | :--- |
| Sales Executive | One at a time; auto-assigned to creator; cannot choose another assignee or leave unassigned; duplicate check and audit required; no bulk permission. |
| Sales Manager | One lead; assign to self, any active executive, or leave unassigned; no approval for single manual lead. |
| Super Admin | Create, assign to any eligible sales user, leave unassigned, audited overrides. |

### Bulk import

- Sales Executive: no UI; backend rejection.
- Sales Manager: CSV/XLSX → private import batch (not leads); validate, map, duplicates, preview; submit for Super Admin approval; cannot approve own batch.
- Super Admin: direct import after validation, preview, explicit confirmation; approve/reject manager batches.
- Lifecycle: Draft → Validation Failed → Ready for Review → Pending Super Admin Approval → Approved / Rejected → Importing → Completed / Completed with Errors / Cancelled.
- Never fabricate consent on imported rows.

### Duplicate handling

- Check normalized phone, normalized email, existing contact, active lead, recent similar enquiry.
- Prefer linking to existing contact.
- Never expose another executive's lead data during duplicate checking.

### Lead assignment

- Manual: Super Admin and Sales Manager assign/reassign; Sales Executive cannot; every assignment audited.
- Automated source-based assignment: Super Admin configures rules (primary: source; optional service/locality/budget); target must be active and eligible; invalid/missing rule → Unassigned queue; never random executive; manual override remains audited.
- **Round-robin excluded.**

### Lead pipeline (locked — state graph, not a single line)

**Primary active progression:**

```
New → Assigned → Contacted → Qualified → Consultation Scheduled → Proposal Sent → Negotiation
```

**Branch transitions (from permitted active stages unless noted):**

| State | Type | Rules |
| :--- | :--- | :--- |
| **Closed-Won** | Terminal success | Requires an **Accepted authoritative quotation**. Project creation occurs **only** from Closed-Won. Must not transition to Closed-Lost or On Hold as the normal next state. |
| **Closed-Lost** | Terminal loss | Reachable from any permitted active stage; **reason required**. No project creation. |
| **On Hold** | Non-terminal pause | Reachable from permitted active stages; resumes only through an **audited transition** to a permitted active stage. |

**Reopening:** Any terminal state (Closed-Won, Closed-Lost) requires an explicit audited transition with reason and must follow the future transition policy.

Every transition and reopening is audited. No project from Closed-Lost or incomplete sales states.

### Monthly targets

- Only Super Admin sets, revises, locks, or reopens.
- Sales Executive: personal monthly revenue target + Closed-Won count target (configuration only in Phase 5E).
- Sales Manager: team monthly revenue + team Closed-Won count only (no separate personal target in V1).
- **Phase 5E:** Target configuration, history, lock/reopen, and non-commercial CRM reporting only. Revenue and Closed-Won **achievement** display as unavailable/not activated until Phase 7B (accepted-quotation source). No manual self-reported achievement; no placeholder numbers presented as real performance.
- **Phase 7B:** Activates authoritative quotation-accepted revenue and Closed-Won achievement calculations.
- **Phase 8A (optional):** Project-value reconciliation when business chooses project value as authoritative measure; no double counting with quotation acceptance.
- Target changes append-only with old/new value, actor, time, reason.

### Premium role-aware CRM information architecture (document only — not built in 5A)

Documented nav surfaces per role (Command Centre, Leads, WhatsApp Inbox, Follow-ups, Quotations, Projects, Campaigns, Sales Targets, Team, Reports, Settings, Audit, etc.) — see Phase 5A audit.

---

## Consequences

### Positive

- Clear implementation contract for Phase 5B–5E.
- RLS-first isolation prevents cross-executive PII leaks.
- Import and campaign approval chains reduce operational risk.

### Negative / trade-offs

- Requires RBAC migration from legacy seed role codes in Phase 5B.
- Source-based assignment without round-robin may leave unassigned queue workload for managers.

### Implementation phases

- **Phase 5A:** Documentation freeze only (this ADR).
- **Phase 5B:** RBAC extension, core schemas, RLS, server repositories.
- **Phase 5C–5E:** Workspaces, import/assignment, targets/reporting.

---

## Related Documents

- [ADR-0008: Database-Backed RBAC](ADR-0008-database-backed-rbac.md)
- [ADR-0009: Public Invoker Authorization RPC](ADR-0009-public-invoker-authorization-rpc.md)
- [ADR-0018: Secure Lead Intake Data Plane](ADR-0018-secure-lead-intake-data-plane.md)
- [Phase 5A Audit](../audits/phase-5a-crm-architecture-freeze.md)
