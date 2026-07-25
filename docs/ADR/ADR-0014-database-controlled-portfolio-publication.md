# ADR-0014: Database-Controlled Portfolio Project Publication and RPC Security Model

- **Status:** Accepted (With Security Definer Rationale Correction)
- **Date:** 2026-07-25
- **Deciders:** ONEDECORE Security & Database Engineering Team

---

## Context

Publishing a portfolio project makes its metadata, service assignments, and cover images publicly visible on ONEDECORE's Showcase homepage and service landing pages. Direct authenticated table updates on sensitive project status fields (`status`, `published_at`) present a security risk if clients can bypass publication prerequisites or alter publication timestamps directly.

---

## Decision

We revoke direct `UPDATE (status, published_at)` permissions from `authenticated` users on `public.portfolio_projects` and implement a database-controlled publication workflow using dedicated RPC functions and database triggers.

### 1. Direct Column Update Revocation
```sql
revoke update (status, published_at) on public.portfolio_projects from authenticated;
```

### 2. Status Management RPC: `public.set_portfolio_project_status(uuid, text)`
- **Security Mode:** `SECURITY DEFINER` (owner: `postgres`).
  - *Accepted Security Correction:* `SECURITY DEFINER` is intentionally required because direct `UPDATE` on `status` and `published_at` columns is revoked from `authenticated`. The RPC executes with owner privileges to perform the column update after enforcing strict business logic guards.
- **Search Path:** Pinned to empty string (`set search_path = ''`).
- **Grants:** `EXECUTE` granted to `authenticated` only; explicitly revoked from `anon` and `public`.
- **Publication Prerequisites Enforced:**
  1. Authorizes caller via `public.authorize('portfolio.manage')`.
  2. Locks target project row (`FOR UPDATE`).
  3. Validates status parameter (`draft`, `published`, `archived`).
  4. Requires at least 1 assigned service in `portfolio_project_services`.
  5. Requires at least 1 ready cover image (`media_role = 'cover'`, `status = 'ready'`, `public_object_path IS NOT NULL`) in `portfolio_media`.
  6. Sets `published_at = COALESCE(published_at, NOW())` on publication, or clears `published_at = NULL` and `is_featured = false` on return to draft/archive.
  7. Derives `updated_by` from `auth.uid()`.

### 3. Atomic Service Replacement RPC: `public.replace_portfolio_project_services(uuid, text[])`
- **Security Mode:** `SECURITY INVOKER`.
- **Search Path:** Pinned to empty string (`set search_path = ''`).
- **Grants:** `EXECUTE` granted to `authenticated` only; explicitly revoked from `anon` and `public`.
- **Guards:** Validates service code array length ($1 \le count \le 3$), validates service code values, performs atomic insert of new codes and deletion of removed codes within a single row-level lock transaction.

### 4. Database Trigger Guards
- **Published Cover Guard (`trg_prevent_published_cover_mutation`):** Before `UPDATE` or `DELETE` on `public.portfolio_media`, blocks deletion or mutation of ready cover images on `published` projects without returning to draft first.
- **Published Final Service Guard (`trg_prevent_published_service_deletion`):** Before `DELETE` on `public.portfolio_project_services`, blocks removal of the final service on a `published` project.

---

## Consequences

- **Integrity:** Incomplete or unready projects can never be published.
- **Security:** Clients cannot forge publication timestamps, set invalid status strings, or mutate cover assets of published projects via direct API calls.
- **Auditability:** `updated_by` is strictly derived from `auth.uid()`.
