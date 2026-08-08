# Phase 6D — Staff Administration, Attendance & Leave (Roadmap Lock)

**Status:** ROADMAP-LOCKED — **runtime NOT STARTED**  
**Date:** August 8, 2026  
**Governance packet:** 6C-G (docs only; no schema, routes, or runtime)

---

## Placement (owner-locked)

```
Phase 6B — Premium Shared Inbox & Controlled Outbound     COMPLETE
    ↓
Phase 6C — Groq Human-Controlled Copilot (Kriti)          IN PROGRESS / formal runtime
    ↓
Phase 6D — Staff Administration, Attendance & Leave       NEXT after 6C (NOT STARTED)
    ↓
Phase 7A — Commercial Quotation Data & Draft Foundation
    ↓
Phase 7B — Quotation Finalization, PDF, Delivery & Acceptance
    ↓
Phases 8A / 8B / 8C — Project lifecycle
    ↓
Phases 9A / 9B / 9C — Marketing & Landing Page Lab
    ↓
Phase 10 — Security hardening, E2E, deployment
```

Phase 6D is **not** moved after Phase 7 unless the owner explicitly changes this decision.

---

## Scope (high level — future implementation only)

### Staff administration
- Super Admin manual staff onboarding
- Employee ID, name, phone, email, joining date, designation
- Existing ONEDECORE role linkage (`user_roles` / RBAC)
- Reporting manager reference
- Active / suspended / inactive status
- Supabase Auth invite/activation linkage
- **No plaintext password storage**

### Attendance
- Mobile-friendly check-in / check-out
- Timestamps, working duration
- Statuses: Present, Absent, Half Day, Leave, Weekly Off, Holiday, Late, Early Checkout
- Staff own attendance view
- Manager team attendance view
- Super Admin full attendance view
- Monthly calendar / summary
- Audited manual corrections

### Location (future-ready, not continuous GPS)
- One-time location capture at check-in/check-out when enabled
- Categories: Office, Field, Client Site
- **No continuous GPS tracking**

### Leave & holidays
- Leave request workflow
- Manager / admin approval or rejection
- Leave types catalogue
- Holiday calendar
- Attendance reflection after approved leave

---

## Explicit boundaries

Attendance and leave are **separate** from:
- Sales targets and achievement (Phase 5E / 7B)
- Commission, payroll, salary, accounting
- ERP / full HRMS expansion

**No automatic target, pay, or commission adjustment from attendance.**

Phase 6D does **not** in this governance packet:
- Create schema or migrations
- Create API routes or UI
- Modify staff auth behavior
- Start runtime or managed apply

Formal Phase 6D receives its own master mission after Phase 6C closeout.

---

## Dependencies

- Phase 6C complete (Kriti formal runtime + M22 managed)
- Existing identity/RBAC foundation (Phases 2C–2D, 5B)
- Staff auth invitation model (Phase 2D)

---

## Decision reference

See **DEC-0059** in `docs/10-decision-register.md`.
