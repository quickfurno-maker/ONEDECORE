# ADR-0015: Private SECURITY DEFINER Helper with Public SECURITY INVOKER Wrapper Pattern

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** ONEDECORE Security & Database Engineering Team

---

## Context

In Phase 2E2, `public.set_portfolio_project_status(uuid, text)` was implemented as a `SECURITY DEFINER` function in the `public` schema to perform column updates on `portfolio_projects.status` and `published_at` (on which direct `UPDATE` privileges are revoked from `authenticated`). While functional and authorized, Supabase Security Advisor flags functions in the `public` schema that are `SECURITY DEFINER` and executable by `authenticated` with `authenticated_security_definer_function_executable`.

---

## Decision

We adopt a two-tier RPC architecture separating the PostgREST-exposed API surface from the elevated state mutation helper:

1. **Public API Surface (`public.set_portfolio_project_status`):**
   - **Schema:** `public` (exposed to PostgREST API under `/rest/v1/rpc/set_portfolio_project_status`).
   - **Security Mode:** `SECURITY INVOKER` (`set search_path = ''`).
   - **ACLs:** `GRANT EXECUTE TO authenticated; REVOKE FROM PUBLIC, anon`.
   - **Role:** Acts as an un-elevated public wrapper that delegates execution to the internal private helper. Resolves Security Advisor alert `authenticated_security_definer_function_executable` 100%.

2. **Internal Private Implementation Helper (`private.set_portfolio_project_status_impl`):**
   - **Schema:** `private` (NOT in PostgREST exposed schemas; inaccessible from `/rest/v1/rpc/`).
   - **Security Mode:** `SECURITY DEFINER` (owner: `postgres`, `set search_path = ''`).
   - **ACLs:** `GRANT EXECUTE TO authenticated; REVOKE FROM PUBLIC, anon`.
   - **Role:** Performs elevated column updates (`status`, `published_at`, `is_featured`, `updated_by`) after independently enforcing:
     - `public.authorize('portfolio.manage')`
     - non-null `auth.uid()`
     - Row locking (`FOR UPDATE`)
     - Publication prerequisites ($\ge 1$ assigned service, $\ge 1$ ready cover image with public WebP path)
     - Reset semantics for `draft` and `archived` statuses.

---

## Consequences

- **Security Advisor Clean:** Zero security advisor warnings (`authenticated_security_definer_function_executable` eliminated).
- **PostgREST Isolation:** The `private` schema is unexposed via HTTP REST endpoints.
- **Least Privilege:** Direct column `UPDATE` on `status` and `published_at` remains 100% revoked from `authenticated`.
