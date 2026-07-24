# 04 — DEDICATED PORTFOLIO AND CMS ARCHITECTURE

**Document Status:** Locked Portfolio Baseline  
**Public Listing Route:** `/portfolio`  
**Case Study Route:** `/portfolio/[slug]`  
**Internal CMS Route:** `/admin/portfolio`  

---

## 1. Portfolio System Requirements

ONEDECORE requires a completely separate public Portfolio page (`/portfolio`). The homepage features only 3–4 selected signature projects. Every published portfolio project may have a dedicated case-study page (`/portfolio/[slug]`).

---

## 2. Taxonomy & Filtering Model

### 2.1 Core Services Taxonomy
Projects are categorized under one or more primary service streams:
1. `complete-home` — Complete Home Interiors
2. `modular-kitchen` — Modular Kitchens
3. `custom-wardrobe` — Custom Wardrobes

### 2.2 Configurable Room Tags
Projects are tagged with room types to support multi-faceted user filtering:
- `living-room`
- `kitchen`
- `bedroom`
- `wardrobe`
- `dining`
- `foyer`
- `study`
- `tv-unit`
- `utility`
- `other`

---

## 3. Publication Lifecycle & State Workflow

Portfolio projects transition through 6 explicit lifecycle states in the internal CMS (`/admin/portfolio`):

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌───────────┐
│ Draft   │ ──► │ Review  │ ──► │ Approved │ ──► │ Published │
└─────────┘     └─────────┘     └──────────┘     └───────────┘
                     │                                 │
                     ▼                                 ▼
              ┌───────────┐                     ┌───────────┐
              │ Rejected  │                     │ Archived  │
              └───────────┘                     └───────────┘
```

1. **Draft:** Created by Content Manager or Designer. Hidden from public view.
2. **Review:** Submitted for Management review.
3. **Approved:** Rights and ownership verified by Management; ready for public scheduling.
4. **Published:** Live on public `/portfolio` listing and visible via public APIs.
5. **Unpublished:** Temporarily removed from public listing while preserving project records.
6. **Archived:** Hidden from active administrative views; preserved for historical auditing.

---

## 4. Ownership Verification & Media Rights Rule

> [!IMPORTANT]
> **Verified Ownership Requirement:**  
> Inspiration images, stock renders, or third-party work must **never** be published as ONEDECORE completed projects. Every published project must have a verified ownership record (`ownership_records`) linked to a genuine ONEDECORE client engagement prior to state transition to `Approved` or `Published`.

---

## 5. Storage Isolation & Derivative Architecture

As defined in [ADR-0003](ADR/ADR-0003-portfolio-storage-boundaries.md):

1. **Private Master Storage (`private-portfolio-masters`):** Master uncompressed photography, CAD files, and RAW renders are stored in non-public buckets.
2. **Public Optimized Derivatives (`public-portfolio-derivatives`):** Public pages serve approved, WebP/AVIF responsive images generated via automated storage optimization pipelines.
3. **Orphaned Media Cleanup:** Unlinked portfolio media stored for >30 days without project association will be automatically flagged for cleanup.

---

## 6. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [Supabase Data Domains](05-supabase-data-domains.md)
- [ADR-0003: Portfolio Storage Boundaries](ADR/ADR-0003-portfolio-storage-boundaries.md)
