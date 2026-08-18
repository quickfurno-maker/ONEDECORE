# 01 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Document Status:** Locked PRD Baseline (truth-synced through Phase 9B architecture freeze, August 18, 2026)
**Scope:** ONEDECORE Version 1 Operating System
**Target Market:** Pune, India

---

## 1. Product Vision & Goals

ONEDECORE delivers a premium architectural public presence and a disciplined internal operating system for sales, quotations, project execution, design collaboration, and consent-controlled communication — without ERP scope creep.

---

## 2. Live Capabilities (Merged)

### 2.1 Premium Public Website
- Production homepage with interior planner, indicative estimator, and legal pages.
- **Lead form:** dual-gated (`copy-only` default); server intake **disabled**; no public collection without Phase 5F authorization.

### 2.2 Dedicated Portfolio System
- Public listing (`/portfolio`), detail routes (`/portfolio/[slug]`), CMS (`/admin/portfolio`).
- Six-state publication workflow with database-controlled guards.

### 2.3 Staff Authentication & RBAC Foundation
- Invitation-only email/password (`/auth/login`).
- `public.authorize(permission_code)` with active-profile enforcement.
- Portfolio permissions live; CRM permissions extended through Phase 5C2C merged; managed migrations 1–14 applied.

### 2.4 Secure Lead Intake Data Plane (Schema Only — Not Publicly Active)
- Contacts, leads, consent events, intake requests, `submit_lead_intake` RPC.
- Migration 10 covering indexes applied; managed aligned through migration 13.
- Public route exists; production defaults **disabled**.

### 2.5 Partial CRM Workspace (Merged — Not Production-Deployed)
- Read-only lead workspace under `/admin/crm` (Phase 5C1).
- Lead assignment mutations: assign, reassign, safe-unassign (Phase 5C2A).
- Managed database foundation applied; application not deployed to Hostinger VPS.
- Manual lead creation, duplicate-safe flows, and remaining Phase 5C scope **not complete**.

---

## 3. Planned Product Capabilities (Phase 5B+)

### 3.1 Internal CRM & Lead Operations (Phase 5B–5E)
- Five-role model: Super Admin, Sales Manager, Sales Executive, Project Manager, Designer.
- Controlled lead sources and touchpoints.
- Manual leads (executive self-assign one at a time; manager flexible; admin override).
- Bulk import with manager → Super Admin approval chain.
- Source-based assignment rules (no round-robin).
- Pipeline state graph: primary active progression `New` → … → `Negotiation`; branches to **Closed-Won** (terminal; requires Accepted quotation), **Closed-Lost** (terminal; reason), **On Hold** (non-terminal pause). Not a single serial line — see ADR-0019.
- Role-aware premium CRM navigation (documented in Phase 5A audit).
- Monthly target **configuration** (Phase 5E); authoritative achievement activation deferred to Phase 7B/8A.

### 3.2 Commercial Quotation Engine (Phase 7)
- Lead/client/property linkage; room sections and line items.
- Materials, measurements, tax, discount, validity, inclusions/exclusions, payment schedule.
- Immutable finalized versions; premium PDF; auditable client acceptance.
- **V1 has no internal quotation approval:** assigned Sales Executive may create, finalize/freeze, and send quotations for currently assigned leads without Sales Manager or Super Admin approval (see ADR-0022).
- Lifecycle state graph: main path **Draft → Finalized/Frozen → Sent**; client outcomes Viewed / Accepted / Rejected / Expired; revision loop creates new draft — see ADR-0020 and ADR-0022.
- Send uses Phase 6B controlled `WHATSAPP_SERVICE` outbound (planned); Phase 7 does not call Meta directly.
- Closed-Won requires Accepted quotation (unchanged).

### 3.3 Project Execution & Design (Phase 8)
- Closed-Won → project creation → PM assignment (Manager/Admin) → PM acceptance → execution.
- One primary PM; one Lead Designer + Supporting Designers (manual assignment).
- Design and project execution as **state graphs** with hold/cancel/revision branches — see ADR-0020 (not serial post-completion tails).
- PM coordinates execution; designers handle design deliverables.

### 3.4 Meta WhatsApp Integration (Phase 6)
- Official Cloud API; verified webhook; idempotent persistence.
- Role-scoped shared inbox; consent and opt-out enforcement.
- No unofficial WhatsApp Web automation.

### 3.5 Groq Human-Controlled Copilot (Phase 6C)
- Provider-independent adapter; Groq initial provider.
- Draft assistance only; human approval required; full audit trail.
- No autonomous sends, assignments, approvals, or DB credentials.

### 3.6 Marketing Campaigns (Phase 9)
- Super Admin approval mandatory for manager drafts.
- Consent, suppression, template eligibility required.
- No executive bulk messaging; no fabricated consent.

### 3.7 Controlled n8n Automation
- Async notification bus after database persistence.
- n8n does not own lead, message, or project state.

### 3.8 Controlled Public Lead Activation (Phase 5F)
- Separate owner/legal authorization after readiness evidence.
- Not part of Phase 5A or default configuration.

---

## 4. Explicit Exclusions (No-ERP Boundary)

The following remain **out of scope** for all Version 1 phases:

- Accounting & general ledger / GST filing
- Procurement & purchase orders
- Inventory & warehouse management (ERP/WMS). Phase 9D later adds **bounded ready-made SKU stock** for `/shop` only (ADR-0028).
- Labour attendance & site dispatch
- Autonomous AI sales agents or unsupervised WhatsApp bots
- Accountant, site supervisor, factory manager, installer, procurement, inventory, labour-dispatch **roles**

Project Manager and Designer roles **are in scope** for execution and design collaboration (ADR-0020).

---

## 5. Non-Functional Requirements

- **Performance:** Core Web Vitals targets per Phase 2F performance budget when applicable.
- **Security:** 100% RLS on API-exposed tables; no anonymous CRM access; server-only mutations.
- **Privacy:** Data minimization; explicit consent for WhatsApp and campaigns; duplicate checks must not leak cross-executive PII.
- **Auditability:** Append-only business history; no hard-delete of material records.

---

## 6. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [CRM & Quotation Boundary](07-crm-and-quotation-boundary.md)
- [Phase Roadmap](09-phase-roadmap.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Product Requirement — Landing Page Lab

ONEDECORE will provide an internal Landing Page Lab for Super Admin and Sales Manager to create controlled campaign-specific landing pages from reusable structured blocks, freeze immutable versions, preview them, publish/pause/archive them, and compare deterministic A/B or A/B/C variants.

V1 must optimize for **qualified CRM outcomes**, not just raw form submissions. Public landing submissions reuse the existing secure lead-intake boundary. Landing/campaign attribution must flow into existing CRM truth without creating a parallel lead or consent system.

V1 excludes unrestricted HTML/code embeds, autonomous AI publishing/winner selection, provider campaign execution, spend/ROAS calculations, and production activation before Phase 10.

Canonical architecture: ADR-0029 / DEC-0081.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->
