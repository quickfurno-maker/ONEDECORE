# ADR-0007: IMPERATIVE VERSIONED MIGRATIONS PATTERN

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Senior Software Architect, PostgreSQL Engineer  
**Technical Scope:** Database Migration Tooling & Lifecycle  

---

## Context and Problem Statement

ONEDECORE requires reproducible, version-controlled database schema changes that can be developed locally against Supabase PostgreSQL and safely deployed across environments. We must decide between imperative timestamped migrations (`supabase/migrations/*.sql`) versus maintaining declarative schema directories (`supabase/schemas/`).

---

## Decision Drivers

- Absolute determinism and auditability of schema evolution over time.
- Standard Supabase CLI workflow integration.
- Elimination of schema drift between local, staging, and production databases.

---

## Decision Outcome

**Chosen Option:** **Imperative, timestamped SQL migrations in `supabase/migrations/` serve as the single schema source of truth.**

### Key Rules

1. All DDL and seed changes execute exclusively via reviewed timestamped SQL files in `supabase/migrations/`.
2. Declarative schema subdirectories (e.g. `supabase/schemas/`) are strictly prohibited.
3. Every migration must execute cleanly from an empty local database reset (`supabase db reset`).
4. Dashboard SQL Editor execution on remote environments is prohibited except for authorized emergency operations.
