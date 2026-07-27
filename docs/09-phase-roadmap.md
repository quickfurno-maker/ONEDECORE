# 09 — PHASE IMPLEMENTATION ROADMAP (PHASES 1–10)

**Document Status:** Locked Roadmap Baseline  
**Current Phase:** Phase 2F-C4 Service Stories & Editorial Featured Portfolio Complete (Ready for Phase 2F-C5)

---

## 1. Master Phase Roadmap

```
Phase 1A: Read-Only Project Baseline Audit (COMPLETED)
   │
   ▼
Phase 1B: Architecture, Scope & Decision Freeze (COMPLETED)
   │
   ▼
Phase 1C: Documentation Baseline & Clean Git Setup (COMPLETED)
   │
   ▼
Phase 2A: Next.js 16.2.11 Engineering Scaffold & Quality Baseline (COMPLETED)
   │
   ▼
Phase 2B: Supabase SSR Connection Foundation & Wrappers (COMPLETED)
   │
   ▼
Phase 2C / 2C1 / 2C2 / 2C3: Remote Identity & RBAC Migration Deployed, Event Trigger Hardened, Index Added (COMPLETED)
   │
   ▼
Phase 2D1: Staff Auth Foundation, public.authorize RPC, Proxy Guard & Admin Shell (COMPLETED)
   │
   ▼
Phase 2D2: Active Staff Authorization Hardening & First Super Admin Bootstrap (COMPLETED)
   │
   ▼
Phase 2E1 / 2E1A: Portfolio Data & Media Storage Foundation & RLS Privilege Hardening (COMPLETED)
   │
   ▼
Phase 2E2 / 2E2A: Portfolio Admin CMS, Secure Media Pipeline, Storage Orphan Purge & RPC Exposure Hardening (COMPLETED)
   │
   ▼
Phase 2E3A: Public Portfolio Experience & SEO Architecture Freeze (COMPLETED)
   │
   ▼
Phase 2E3B / 2E3C / 2E3D: Public Portfolio Implementation, Remote E2E & Merge Closeout (COMPLETED)
   │
   ▼
Phase 2F-A: Public Website Research, Visual Concepts & Owner Selection (COMPLETED)
   │
   ▼
Phase 2F-B: Direction A Design System & Implementation Architecture Freeze (COMPLETED)
   │
   ▼
Phase 2F-C1: Design Tokens, Typography & Shared Primitives (COMPLETED)
   │
   ▼
Phase 2F-C2: Header, Mobile Navigation, Footer & Shell (COMPLETED)
   │
   ▼
Phase 2F-C3: Homepage Hero & Brand Proposition (COMPLETED — hero asset replaced, rendered visual gate clean)
   │
   ▼
Phase 2F-C4: Service Stories & Editorial Featured Portfolio (COMPLETED)
   │
   ▼
Phase 2F-C5–C6: Remaining Homepage Sections & Visual QA
   │
   ▼
Phase 2F-D: Service Routes (/services/*)
   │
   ▼
Phase 2F-E: About, Process, Contact & Legal Pages
   │
   ▼
Phase 2F-F: Cross-Route QA, Accessibility, Performance, SEO & Closeout
   │
   ▼
Phase 3: CRM & Lead Capture Expansion (formerly combined design phases)
   │
   ▼
Phase 7: Internal CRM Foundation, Lead Management & Role Access
   │
   ▼
Phase 8: Commercial Quotation Engine & Versioning System
   │
   ▼
Phase 9: Meta WhatsApp Cloud API Integration & n8n Automation
   │
   ▼
Phase 10: Security Hardening, E2E Testing & Hostinger VPS Deployment
```

---

## 2. Phase Objectives & Exit Gates

- **Phase 1 (A/B/C):** Governance, audit, architecture freeze, documentation baseline, clean Git init.
- **Phase 2:** Scaffold Next.js 16.x stable, configure TypeScript, set up local Supabase CLI, draft database migrations, create RLS policies.
- **Phase 2F (A/B/C–F):** Owner-approved Direction A design research, Figma specification, architecture freeze, homepage implementation, service pages, supporting routes, hardening.
- **Phase 3:** CRM portal (`/admin/leads`), lead pipeline views, activity tracking, role-based permissions.
- **Phase 8:** Build commercial quotation builder (`/admin/quotations`), itemized pricing, version history, quote acceptance portal.
- **Phase 9:** Build verified Meta WhatsApp webhook endpoints, template triggers, n8n async outbox dispatcher.
- **Phase 10:** Comprehensive security audit, Lighthouse performance optimization, E2E test suites, Hostinger VPS deployment.

---

## 3. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Decision Register](10-decision-register.md)
