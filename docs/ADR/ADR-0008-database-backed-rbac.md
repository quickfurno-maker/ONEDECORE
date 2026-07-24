# ADR-0008: DATABASE-BACKED ROLE-BASED ACCESS CONTROL (RBAC)

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Security Architect, Software Architect  
**Technical Scope:** Authorization & Permission Enforcement  

---

## Context and Problem Statement

ONEDECORE requires multi-role staff authorization for internal CRM management (`super_admin`, `management`, `sales`, `designer`, `project_operations`, `content_manager`). We must decide how user permissions are evaluated at the database and RLS boundary.

---

## Decision Drivers

- Immediate permission revocation without waiting for JWT token refresh cycles.
- Granular permission mapping (`roles`, `permissions`, `role_permissions`, `user_roles`).
- Zero anonymous access to internal administrative tables.

---

## Decision Outcome

**Chosen Option:** **Database-backed security-definer helper functions (`private.has_role`, `private.has_permission`) checking relational RBAC tables.**

### Key Rules

1. RLS policies invoke `private.has_permission('permission.code')` for authorization decisions.
2. Helper functions execute with `security definer` and explicit `set search_path = ''` to prevent search path hijacking.
3. Custom JWT claims and Supabase Auth Hooks are deferred to avoid stale token state during initial schema evolution.
4. Anonymous role (`anon`) receives 0 table grants or RLS policies on identity and RBAC tables.
