# ADR-0011: Portfolio Publication State & Access Control Model

**Status:** Approved  
**Date:** July 25, 2026  
**Context:** Phase 2E1 Portfolio Data & Media Storage Foundation  

## Context & Problem Statement

ONEDECORE requires a secure, high-performance portfolio system to present curated interior design projects. Content creators and staff must be able to draft projects, attach media, and organize services privately before publishing them to the public website. Anonymous site visitors must only view published projects and ready media derivatives.

## Decision Drivers

1. Absolute data privacy for draft and archived projects.
2. Complete prevention of unauthorized access to unpublished client content.
3. Strict separation of public visitor access from administrative staff controls.
4. Database-level enforcement via Row Level Security (RLS).

## Considered Options

1. **Option A: Application-level filtering only** (Filter draft projects in Next.js page queries).
2. **Option B (Chosen): Database RLS publication gate with RBAC policies** (Enforce publication status check in database RLS policies for `anon` and `public` roles).

## Decision Outcome

Chosen Option: **Option B**.

### Publication Rules
1. `portfolio_projects`: Public queries return rows only when `status = 'published'` and `published_at` is non-null.
2. `portfolio_project_services`: Public queries return service codes only for published parent projects.
3. `portfolio_media`: Public queries return derivative media metadata only when `status = 'ready'` and parent project `status = 'published'`.
4. `portfolio_media_sources`: Table access is strictly restricted to active staff with `portfolio.manage` permission.

## Consequences

- **Positive:** Public visitors can never discover or retrieve draft or archived projects, regardless of client API requests.
- **Negative:** RLS subqueries check parent project status on media joins; indexed foreign keys (`project_id`) ensure query execution remains sub-millisecond.
