# ADR-0010: STAFF-ONLY PASSWORD AUTHENTICATION AND ADMIN ROUTE PROTECTION

**Status:** Approved  
**Date:** July 25, 2026  
**Phase:** Phase 2D1 — Staff Authentication & Authorization Foundation  

---

## 1. Context & Problem Statement

ONEDECORE is an internal management portal and cinematic public studio site. The `/admin/*` route tree is intended strictly for internal staff personnel (sales, designers, project operations, content managers, management, and super admins). 

Allowing public user sign-ups, password self-recovery, social OAuth logins, or client-side authorization checks on admin routes creates severe security risks, account enumeration vulnerabilities, and potential unauthorized access to business state.

---

## 2. Decision & Architecture

ONEDECORE enforces a staff-only authentication and authorization architecture:

1. **Staff-Only Login Route (`/auth/login`):**
   - Implements email/password authentication via `supabase.auth.signInWithPassword()`.
   - Disables all public sign-up paths, self-service password recovery, social OAuth, and MFA enrollment in Phase 2D1.
   - Employs generic error responses ("Invalid staff credentials") to prevent account enumeration.
   - Validates required fields and strictly caps input lengths (email: 254 chars, password: 128 chars).

2. **Strict Return-Path Sanitization (`next` parameter):**
   - The `next` query parameter is accepted only if it begins with `/admin` and contains no protocol/slash manipulation (`/admin//`).
   - Defaults to `/admin` for all other inputs.

3. **POST-Only Sign-Out Endpoint (`/auth/signout`):**
   - Sign-out is implemented as a Server Route Handler accepting `POST` requests only.
   - `GET` requests receive HTTP 405 Method Not Allowed to prevent CSRF prefetch sign-outs via img tags or standard links.
   - Clears Supabase auth session cookies and redirects to `/auth/login` with HTTP 303 See Other.

4. **Two-Tiered Route Protection:**
   - **Tier 1 (Next.js 16 Proxy):** Evaluates `supabase.auth.getClaims()` immediately upon request. Unauthenticated requests to `/admin/:path*` are redirected to `/auth/login?next=...`.
   - **Tier 2 (Server Admin Layout):** Calls `requireStaffPermission("admin.access")` in Server Components. Verifies that the authenticated staff user possesses active `admin.access` permission via `public.authorize("admin.access")`. Unauthorized staff are redirected to `/auth/forbidden`.

---

## 3. Consequences

### Positive
- Zero public self-registration risk for administrative accounts.
- Complete defense-in-depth against unauthorized URL navigation to internal CRM/admin routes.
- Prevents CSRF sign-out attacks via forced POST method on `/auth/signout`.

### Negative / Trade-offs
- Super Admin and staff account creation must be performed via controlled administrative CLI scripts or Supabase dashboard provisioning.
