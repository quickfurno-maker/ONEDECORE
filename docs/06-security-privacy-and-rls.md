# 06 — SECURITY, PRIVACY AND ROW LEVEL SECURITY (RLS) POLICIES

**Document Status:** Locked Security Baseline  
**RLS Target:** 100% Coverage on API-Exposed Application Tables  
**Default Access:** Anonymous Access Denied for Private Schemas  

---

## 1. Security Architecture & RLS Model

Following mandatory corrections in Phase 1B, RLS policies are applied to all API-exposed Supabase PostgreSQL tables.

```
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                      │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │ Public Portfolio Tables│  │ CRM & Private Tables   │  │
│  │ (portfolio_projects,   │  │ (leads, quotations,    │  │
│  │  portfolio_media)      │  │  whatsapp_messages)    │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  │
│              │                           │               │
│              ▼                           ▼               │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │ Public Read Allowed    │  │ Anon Access Denied     │  │
│  │ (status = 'published') │  │ (Authenticated Staff   │  │
│  │                        │  │  Only via RBAC)        │  │
│  └────────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Policy Enforcement Matrix

1. **Anonymous Role (`anon`):**
   - Read access permitted exclusively for `portfolio_projects` and `portfolio_media` where `status = 'published'`.
   - Write access denied on 100% of database tables. Public lead form submissions execute via server-side API endpoints (`/api/leads`), which use sanitized server contexts.
2. **Authenticated Staff Roles (`authenticated`):**
   - Access restricted by assigned user role via helper functions (`auth.jwt() -> role`).
   - Sales reps access owned/assigned leads and quotations.
   - Designers access assigned projects.
   - Operations access assigned site visits and handoff tasks.
   - Content Managers access portfolio CMS tables.
   - Management & Super Admin access broad operational tables.

---

## 3. Storage Security & Signed URLs

- **Private Master Assets:** Master high-res portfolio images (`private-portfolio-masters`) and client documents (`private-crm-documents`) reside in non-public storage buckets.
- **Signed URL Access:** Client access to private project documents is restricted to short-lived signed URLs (15-minute expiry).
- **Public Optimized Derivatives:** Public site assets (`public-portfolio-derivatives`) are served via CDN with immutable caching headers.

---

## 4. Privacy & Consent Safeguards

- **WhatsApp Consent:** Opt-in consent logged with timestamp and source IP during web form submission. Opt-out request (`STOP`) immediately updates consent status to `false`.
- **PII Protection:** Customer names, phone numbers, and addresses masked in non-essential CRM administrative views.
- **Audit Trails:** All sensitive mutations (role changes, discount overrides, lead status changes) logged to `system_audit_logs`.

---

## 5. Related Governance Documents

- [Supabase Data Domains](05-supabase-data-domains.md)
- [ADR-0003: Portfolio Storage Boundaries](ADR/ADR-0003-portfolio-storage-boundaries.md)
