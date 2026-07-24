# 00 — PROJECT TRUTH AND GOVERNANCE BASELINE

**Document Status:** Locked Governance Baseline  
**Project Name:** ONEDECORE  
**Tagline:** One Vision. Complete Interiors.  
**Domain:** `onedecore.in`  
**Initial Market:** Pune, India  
**Deployment Target:** Hostinger VPS  

---

## 1. Executive Summary & Purpose

This document defines the immutable business identity, project boundaries, and governance rules for ONEDECORE. All technical implementations in subsequent phases must adhere strictly to the rules established here.

---

## 2. Locked Brand Identity

- **Brand Name:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Primary Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services (V1 Focus):**
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- **Repository Independence:** Fully independent code, database, and infrastructure. Completely separate from QuickFurno and Jarvis.

---

## 3. Product Layers

ONEDECORE operates across five distinct product layers:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Premium Public Website (Architectural Presentation)  │
├─────────────────────────────────────────────────────────┤
│ 2. Dedicated Portfolio System (/portfolio & Case Studies)│
├─────────────────────────────────────────────────────────┤
│ 3. Sales & Client CRM (/admin Internal Application)     │
├─────────────────────────────────────────────────────────┤
│ 4. Meta WhatsApp Cloud API (Verified Communication)     │
├─────────────────────────────────────────────────────────┤
│ 5. Controlled n8n Workflows (Async Event Automation)    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Master Governance Rules & Mandatory Corrections

1. **Next.js Version Target:** Phase 2 will target the current vetted stable Next.js 16.x release (pinned during Phase 2 setup). Next.js 15 is not used.
2. **Supabase Source of Truth:** Supabase PostgreSQL is the sole permanent database for structured application data.
3. **Database-Before-Automation (Lead Persistence):** Valid public web form submissions are validated and persisted to Supabase *before* n8n webhooks or notification routines trigger. An n8n outage must never result in lost lead data.
4. **Meta WhatsApp Webhook Termination:** Inbound Meta WhatsApp webhooks terminate at a verified ONEDECORE server endpoint, persist message state to Supabase idempotently, and only then trigger optional n8n/staff alerts. Unofficial WhatsApp Web scraping is strictly prohibited.
5. **Benchmark Integrity:** "₹100-crore" is strictly an internal architectural quality and design perception benchmark. It must never appear publicly as a financial, revenue, valuation, or project volume claim.
6. **No Unverified Business Claims:** The codebase and public pages must never feature unverified claims regarding in-house factories, studio tours, specific hardware brands (e.g., Hettich, Blum, Hafele), warranty durations, GST numbers, fake client metrics, or fake testimonials.
7. **Storage Separation:** Master portfolio original assets are kept in private storage. Only approved, optimized web derivatives are exposed publicly. Private CRM/client documents use strict RLS and signed URLs.
8. **Configurable CRM Thresholds:** Qualification thresholds, response SLAs, and discount approval percentages are configurable policies and remain unset until owner approval. No hardcoded 10% discount rule.
9. **Auditable Quote Acknowledgement:** Client quotation acceptance is logged as an auditable acknowledgement (hash, timestamp, IP, client ID), not automatically a legal e-signature.
10. **Admin Route Prefix:** All internal CRM routes use the `/admin` prefix (e.g., `/admin/dashboard`, `/admin/leads`, `/admin/quotations`).

---

## 5. Decision Classification Summary

- **[LOCKED]:** Core brand identity, 5 product layers, Supabase source of truth, separate portfolio system, Hostinger VPS deployment target, single modular monolith repository (`src/`), `/admin` route prefix.
- **[RECOMMENDED — OWNER APPROVAL REQUIRED]:** Typography pairing (*Playfair Display* + *Plus Jakarta Sans*), initial Pune geo-landing locations, visual design tokens.
- **[DEFERRED / NOT IN V1]:** Full ERP modules (accounting, procurement, inventory, labor scheduling, autonomous AI sales chatbots).
- **[OPEN RISK]:** Sourcing high-res verified Pune project photography; Meta WhatsApp template approval timelines.

---

## 6. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Decision Register](10-decision-register.md)
- [ADR-0002: Supabase Source of Truth](ADR/ADR-0002-supabase-source-of-truth.md)
