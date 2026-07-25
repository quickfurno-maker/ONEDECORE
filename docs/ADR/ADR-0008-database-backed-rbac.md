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
2. Helper functions (`private.has_role`, `private.has_permission`) execute with `SECURITY DEFINER` and explicit `set search_path = ''` to prevent search path hijacking.
3. Non-elevated trigger functions (`private.set_updated_at`) omit `SECURITY DEFINER`.
4. System RBAC records (`is_system = true`) are immutable through the Data API and can only be altered via version-controlled migrations.
5. Column-level write privileges restrict user modifications on `profiles`, `roles`, `permissions`, and `user_roles`.
6. Anonymous role (`anon`) receives 0 table grants or RLS policies on identity and RBAC tables.
