# ADR-0009: PUBLIC SECURITY INVOKER AUTHORIZATION RPC WRAPPER

**Status:** Approved  
**Date:** July 25, 2026  
**Phase:** Phase 2D1 — Staff Authentication & Authorization Foundation  

---

## 1. Context & Problem Statement

In Phase 2C, ONEDECORE established internal security-definer helper functions (`private.has_role` and `private.has_permission`) in the non-exposed `private` schema. Because PostgREST exposes only the `public` schema via Data API RPC endpoints, client applications and server-side Supabase SDK clients cannot invoke `private.has_permission` directly.

To enforce permission checks in Server Components, Layouts, and API routes without exposing internal schema definitions or relying on stale JWT custom claims, ONEDECORE requires an authorized public RPC interface.

---

## 2. Decision & Architecture

ONEDECORE implements a public authorization wrapper function `public.authorize(requested_permission text)` defined as follows:

```sql
create function public.authorize(requested_permission text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_permission(requested_permission);
$$;

revoke execute on function public.authorize(text) from public, anon;
grant execute on function public.authorize(text) to authenticated;
```

Key Architectural Principles:
1. **SECURITY INVOKER Execution Model:** The function executes with the privileges of the calling user context. It relies on internal `SECURITY DEFINER` function `private.has_permission` to safely inspect RBAC tables while preventing unauthorized privilege escalation.
2. **Explicit Search Path Isolation:** `SET search_path = ''` prevents search path hijacking attacks.
3. **Least-Privilege Execution Grants:** Execution privilege is explicitly revoked from `public` and `anon`, and granted strictly to `authenticated` staff users.
4. **Zero Custom Claims Overhead:** Eliminates the complexity, token size bloat, and revocation latency associated with Auth Hook custom JWT claim injection.

---

## 3. Consequences

### Positive
- Enables immediate permission evaluation via standard Supabase client RPC `supabase.rpc("authorize", { requested_permission: "admin.access" })`.
- Changes to role permissions or user role assignments take effect immediately without requiring user re-authentication or token refresh.
- Anonymous Data API requests to `rpc/authorize` are rejected at the PostgREST privilege layer.

### Negative / Trade-offs
- Requires 1 database round-trip per server-side permission check (mitigated by Next.js request deduplication and efficient index lookups).
