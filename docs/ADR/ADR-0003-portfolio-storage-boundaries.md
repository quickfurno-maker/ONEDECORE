# ADR-0003: PORTFOLIO AND CRM STORAGE BOUNDARY SEPARATION

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Security Architect, Portfolio Architect  
**Technical Scope:** File Storage & Media Distribution  

---

## Context and Problem Statement

ONEDECORE handles master high-resolution architectural photography, client CAD floorplans, private site visit photos, commercial PDF quotations, and public web image assets. Exposing master files in public storage creates IP loss and performance risks.

---

## Decision Drivers

- Protection of original uncompressed architectural photography and CAD drawings.
- Fast web loading performance (Core Web Vitals LCP target < 2.5s).
- Strict access control for private client documents and quotations.

---

## Decision Outcome

**Chosen Option:** **Logical separation into four distinct storage boundaries with strict RLS and access models.**

### Storage Bucket Classification

1. **`private-portfolio-masters` (Private):** Stores master uncompressed photography and RAW renders. Accessible only by authorized staff via short-lived signed URLs.
2. **`public-portfolio-derivatives` (Public CDN):** Stores approved, optimized responsive WebP/AVIF web assets. World-readable.
3. **`private-crm-documents` (Private):** Stores client floorplans, site photos, and PDF quotations. Restricted via RLS and signed URLs.
4. **`controlled-brand-assets` (Private/Public Managed):** Stores official brand logos, icons, and marketing collateral.

### Key Rules

- Publishing a portfolio project does **not** expose master original assets.
- Unlinked portfolio media stored for >30 days without project association is automatically flagged for cleanup.
