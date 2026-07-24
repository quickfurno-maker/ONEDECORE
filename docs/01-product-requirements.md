# 01 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Document Status:** Locked PRD Baseline  
**Scope:** ONEDECORE Version 1  
**Target Market:** Pune, India  

---

## 1. Product Vision & Goals

ONEDECORE is built to deliver a premium architectural experience for high-end residential interior clients in Pune. The web application balances an editorial public presence with a disciplined internal CRM for lead conversion, quotation management, and client onboarding.

---

## 2. Included Product Capabilities (V1 Scope)

### 2.1 Premium Public Website
- **Cinematic Homepage:** High-impact visual positioning, selected signature project highlights, 4-step execution narrative, and consultation lead capture.
- **Service Pages:** Dedicated landing pages for Complete Home Interiors, Modular Kitchens, and Custom Wardrobes.
- **Geo-Targeted Landing Pages:** Location-specific landing pages for Pune key areas (e.g., Baner, Koregaon Park, Kharadi, Wakad, Kothrud).
- **Lead Booking & Consultation:** Interactive consultation request form with explicit Meta WhatsApp opt-in consent.

### 2.2 Dedicated Portfolio System
- **Main Listing (`/portfolio`):** Faceted filtering by Service (`complete-home`, `modular-kitchen`, `custom-wardrobe`) and Room Tags (`living-room`, `kitchen`, `bedroom`, `wardrobe`, `dining`, `foyer`, `study`, `tv-unit`, `utility`, `other`).
- **Project Case Studies (`/portfolio/[slug]`):** Individual project storytelling pages with verified ONEDECORE project origin records, before/after comparisons, and high-res media galleries.
- **CMS Management (`/admin/portfolio`):** Internal 6-state workflow (Draft -> Review -> Approved -> Published -> Unpublished -> Archived).

### 2.3 Internal Administrative CRM (`/admin`)
- **Lead Lifecycle Management:** Track leads through pipeline stages (`New Lead` -> `Contacted` -> `Qualified` -> `Consultation` -> `Site Visit` -> `Design Discussion` -> `Estimate` -> `Negotiation` -> `Won / Lost`).
- **Activity & SLA Tracking:** Log calls, emails, site visits, and consultation notes with auditable timelines.
- **Configurable Qualification:** Dynamic lead scoring criteria; initial thresholds configurable by Management.
- **Flexible Exit Boundaries:** Leads can transition to `Lost` from any active stage with a mandatory reason log.

### 2.4 Commercial Quotation Engine
- **Itemized Estimation:** Builder for line-item room estimates with version history (`v1`, `v2`).
- **Approval Guardrails:** Configurable discount threshold triggers a mandatory Management review lock state.
- **Client Acceptance Acknowledgement:** Secure online quote preview with client acceptance recording (immutable document hash, timestamp, client ID, IP log).

### 2.5 Meta WhatsApp Integration & n8n Automation
- **Official Meta Cloud API:** Verified server endpoint for inbound/outbound WhatsApp message logs and consent tracking.
- **n8n Async Event Dispatcher:** Stateless automation bus triggered after database persistence for internal staff notifications and SLA breach alerts.

---

## 3. Explicit Exclusions (V1 No-ERP Boundary)

To preserve focus and maintain technical stability, the following modules are explicitly excluded from Version 1:

- **Accounting & General Ledger:** No double-entry accounting or GST filing systems (Deferred to external software).
- **Procurement & POs:** No raw material vendor ordering or purchase order tracking.
- **Inventory & Warehouse:** No stock level tracking or warehouse barcode scanning.
- **Labor & Site Scheduling:** No daily worker attendance or complex construction labor dispatching.
- **Autonomous AI Chatbots:** No unmonitored AI agents responding to leads over WhatsApp.

---

## 4. Non-Functional Requirements

- **Performance:** Core Web Vitals targets: Lighthouse Performance ≥ 90, LCP < 2.5s, CLS < 0.1 on mobile 4G.
- **Security:** 100% RLS coverage on API-exposed Supabase tables; zero anonymous access to CRM/private data.
- **Privacy:** Data minimization for customer PII; explicit opt-in consent for WhatsApp messaging.

---

## 5. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Public Site & Sitemap](03-public-site-and-sitemap.md)
- [CRM & Quotation Boundary](07-crm-and-quotation-boundary.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
