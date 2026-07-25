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

## 2. Identity & RBAC RLS Contract (Phase 2C1 Baseline)

- **Least-Privilege Privilege Reset:** Explicit `REVOKE ALL ON TABLE ... FROM public, anon, authenticated` executed prior to explicit grants.
- **Column-Level Write Security:**
  - `profiles`: `UPDATE` restricted to (`display_name`, `phone_e164`, `status`). `id`, `created_at`, `updated_at` cannot be updated via Data API.
  - `roles` & `permissions`: `INSERT`/`UPDATE` restricted to non-system records (`is_system = false`) and non-key columns (`name`, `description`, `is_active`).
  - `user_roles`: `INSERT` restricted to (`user_id`, `role_id`). `assigned_by` defaults to `auth.uid()` and cannot be forged.
- **System Record Immutability:** Seeded system roles (`super_admin`, `management`, `sales`, `designer`, `project_operations`, `content_manager`) and permissions are protected from Data API modification or deletion.
- **Platform Helper Hardening (Phase 2C3):** Direct API execution on platform helper `public.rls_auto_enable()` revoked from `public`, `anon`, and `authenticated`. Event trigger `ensure_rls` remains active and owned by `postgres`.
- **Actor Foreign Key Coverage (Phase 2C3):** Added covering index `idx_user_roles_assigned_by` on `public.user_roles(assigned_by)` for actor-based audit query optimization.
- **Public Authorization RPC (Phase 2D1):** `public.authorize(requested_permission text)` wrapper (`SECURITY INVOKER`, `STABLE`, `SET search_path = ''`) delegating to `private.has_permission()`. Granted to `authenticated`, revoked from `anon` and `public`.
- **Active Staff Profile Enforcement (Phase 2D2):** Hardened `private.has_role(text)` and `private.has_permission(text)` to require `public.profiles.status = 'active'`. Pending, suspended, or disabled staff profiles are automatically denied authorization even if active role assignments exist.

## 3. Policy Enforcement Matrix

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

## 5. Phase 2E1 Portfolio & Storage RLS Policies

- **Portfolio System Permissions:** `portfolio.read` and `portfolio.manage` mapped to system `super_admin` role.
- **Table RLS Enforcement:**
  - `portfolio_projects`: Public `SELECT` allowed when `status = 'published'`. Staff `SELECT` allowed with `portfolio.read` or `portfolio.manage`. Staff mutations (`INSERT`, `UPDATE`, `DELETE`) require `portfolio.manage` with audit anti-spoofing (`created_by = auth.uid()`, `updated_by = auth.uid()`).
  - `portfolio_project_services`: Public `SELECT` allowed when parent project is published. Staff mutations require `portfolio.manage`.
  - `portfolio_media`: Public `SELECT` allowed when `status = 'ready'` and parent project is published. Staff mutations require `portfolio.manage`.
  - `portfolio_media_sources`: Private table. `SELECT`, `INSERT`, `UPDATE`, `DELETE` strictly restricted to staff with `portfolio.manage` and `uploaded_by = auth.uid()`. Inaccessible to anonymous visitors.
- **Storage Bucket RLS Policies:**
  - `portfolio-originals` (Private, 20 MiB limit): `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies on `storage.objects` strictly check `bucket_id = 'portfolio-originals' AND public.authorize('portfolio.manage')`.
  - `portfolio-public` (Public, 8 MiB limit): Direct HTTP GET enabled. `INSERT`, `UPDATE`, `DELETE` policies on `storage.objects` check `bucket_id = 'portfolio-public' AND public.authorize('portfolio.manage')`.

---

## 6. Phase 2E2 / Phase 2E2A Portfolio CMS Publication & RPC Security Contracts

- **Direct Status Column Revocation:** `REVOKE UPDATE (status, published_at) ON public.portfolio_projects FROM authenticated;`
- **Public Wrapper RPC (`public.set_portfolio_project_status`):** Defined as `SECURITY INVOKER` (`set search_path = ''`). Exposed under `/rest/v1/rpc/set_portfolio_project_status`. `EXECUTE` granted to `authenticated` only; revoked from `anon` and `public`. Delegates execution to private definer helper. Resolves Security Advisor warning `authenticated_security_definer_function_executable`.
- **Private Helper (`private.set_portfolio_project_status_impl`):** Defined as `SECURITY DEFINER` (owner `postgres`, `set search_path = ''`). Unexposed in PostgREST. Executable by `authenticated`; revoked from `anon` and `public`. Requires `public.authorize('portfolio.manage')`, non-null `auth.uid()`, locks target row (`FOR UPDATE`), and validates publication prerequisites ($\ge 1$ assigned service, $\ge 1$ ready cover image) before setting `status = 'published'` and `published_at = NOW()`.
- **Atomic Service Replacement RPC (`public.replace_portfolio_project_services`):** Defined as `SECURITY INVOKER` (`set search_path = ''`). `EXECUTE` granted to `authenticated` only. Validates service array bounds ($1 \le count \le 3$) and executes atomic service replacement.
- **Published Cover Guard Trigger (`trg_prevent_published_cover_mutation`):** `BEFORE UPDATE OR DELETE ON public.portfolio_media` (`SECURITY INVOKER`, `set search_path = ''`). Blocks deletion or mutation of ready cover images on `published` projects.
- **Published Final Service Guard Trigger (`trg_prevent_published_service_deletion`):** `BEFORE DELETE ON public.portfolio_project_services` (`SECURITY INVOKER`, `set search_path = ''`). Blocks deletion of the final service on a `published` project.

---

## 7. Related Governance Documents

- [Supabase Data Domains](05-supabase-data-domains.md)
- [ADR-0011: Portfolio Publication Model](ADR/ADR-0011-portfolio-publication-model.md)
- [ADR-0012: Two-Bucket Media Architecture](ADR/ADR-0012-private-originals-public-derivatives.md)
- [ADR-0013: Server-Side Portfolio Image Processing Pipeline](ADR/ADR-0013-server-side-portfolio-image-processing.md)
- [ADR-0014: Database-Controlled Portfolio Publication](ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0015: Private Definer Status Transition Helper Pattern](ADR/ADR-0015-private-definer-status-transition-helper.md)
- [Phase 2E2 Audit Report](audits/phase-2e2-portfolio-admin-cms.md)
- [Phase 2E2A Audit Report](audits/phase-2e2a-status-rpc-exposure-hardening.md)
