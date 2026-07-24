# ADR-0005: VERSION 1 NO-ERP SCOPE BOUNDARY

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Senior Product Architect, Business Owner  
**Technical Scope:** Product Scope & Feature Boundaries  

---

## Context and Problem Statement

Interior design applications frequently suffer from scope creep by attempting to build full Enterprise Resource Planning (ERP) software (accounting, vendor purchase orders, inventory management, factory machinery integration, labor attendance). We must lock a strict boundary for Version 1.

---

## Decision Drivers

- Focus Version 1 resources on client acquisition, portfolio storytelling, sales CRM, and official WhatsApp communication.
- Reduce technical complexity and maintenance overhead.
- Ensure rapid execution and delivery for the Pune launch.

---

## Decision Outcome

**Chosen Scope Boundary:** **Version 1 is explicitly scoped as a marketing web application and sales CRM. All full ERP modules are deferred.**

### Explicit Exclusions (Not in V1)

1. **Accounting & General Ledger:** No double-entry accounting or GST filing systems (Use external accounting software).
2. **Procurement & POs:** No raw material vendor ordering or purchase order tracking.
3. **Inventory & Warehouse:** No stock level tracking or warehouse barcode scanning.
4. **Labor & Site Scheduling:** No daily worker attendance or complex construction labor dispatching.
5. **Autonomous AI Chatbots:** No unmonitored AI agents responding to leads over WhatsApp.

### Included V1 Boundaries

- Client acquisition public website and dedicated portfolio system.
- Sales CRM (lead management, pipeline stages, site visit logs).
- Commercial quotation builder (itemized estimates, versioning, discount approval locks).
- Official Meta WhatsApp Cloud API integration (message logging, templates, consent management).
