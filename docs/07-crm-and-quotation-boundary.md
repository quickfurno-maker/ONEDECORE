# 07 — CRM PIPELINE AND COMMERCIAL QUOTATION BOUNDARY

**Document Status:** Locked CRM & Quotation Baseline  
**Internal Prefix:** `/admin`  
**Scope:** Lead Conversion & Quotation Engine  

---

## 1. CRM Pipeline Workflow

The CRM manages leads from acquisition to project handoff through 10 defined pipeline stages:

```
[New Lead] ──► [Contacted] ──► [Qualified] ──► [Consultation] ──► [Site Visit]
                                                                        │
[Won / Handoff] ◄── [Negotiation] ◄── [Estimate] ◄── [Design Discussion] ◄┘
       │
       ▼
   [Lost] (Requires Mandatory Reason Log)
```

### 1.1 Stage Transitions & Rules
- **New Lead:** Initial web form submission or WhatsApp inquiry.
- **Contacted:** Initial staff contact attempt logged.
- **Qualified:** Lead verified against configurable budget and Pune location criteria.
- **Consultation:** Virtual or studio design consultation scheduled/completed.
- **Site Visit:** Measurement team dispatched to site.
- **Design Discussion:** Layout options & 3D material selections presented.
- **Estimate:** Commercial quotation generated and delivered to client.
- **Negotiation:** Scope adjustments and estimate revisions.
- **Won:** Advance payment received; converted to active Client & Basic Project handoff.
- **Lost:** Lead marked inactive. **Can transition to Lost from any active stage with a mandatory reason log.** Reopening requires an auditable transition.

---

## 2. Commercial Quotation Engine

### 2.1 Estimation Builder
- Supports line-item pricing for Complete Home Interiors, Modular Kitchens, and Custom Wardrobes.
- Maintains immutable quotation version history (`v1`, `v2`, `v3`).

### 2.2 Approval Thresholds (Configurable Policy)
- Discount approval thresholds are configurable by Management.
- Quotations exceeding the threshold trigger a mandatory `Pending Management Approval` lock state. No hardcoded 10% rule.

### 2.3 Client Acceptance Acknowledgement
- Client quote acceptance records an **auditable client acceptance acknowledgement** (immutable document hash, timestamp, client identifier, IP log).
- Formal legal e-signatures are deferred unless a compliant third-party provider is integrated.

---

## 3. Version 1 Scope Boundary (No ERP)

The CRM is designed strictly for sales conversion and commercial estimation. Accounting ledgers, vendor purchase orders, inventory tracking, and site labor dispatching are explicitly deferred to future phases or external dedicated software.

---

## 4. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
