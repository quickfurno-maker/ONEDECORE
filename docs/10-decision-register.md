# 10 — MASTER DECISION REGISTER

**Document Status:** Locked Decision Register  
**Scope:** Architectural & Business Scope Decisions  

---

## Master Decision Table

| Decision ID | Decision Summary | Status | Rationale | Owner Approval Req. | Target Phase | Supersedes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **DEC-0001** | Brand identity locked as ONEDECORE with tagline "One Vision. Complete Interiors." | LOCKED | Establishes core brand positioning for Pune market | No | Phase 1A | N/A |
| **DEC-0002** | Target framework set to vetted stable Next.js 16.x release (pinned in Phase 2) | LOCKED | Next.js 16.x provides modern React 19 / App Router performance | No | Phase 2 | Phase 1B (Next.js 15) |
| **DEC-0003** | Supabase PostgreSQL established as sole structured data source of truth | LOCKED | Centralizes persistent state and security in relational database | No | Phase 2 | N/A |
| **DEC-0004** | Valid public submissions persisted to Supabase *before* n8n triggers | LOCKED | Prevents lead loss during automation outages | No | Phase 2/9 | Phase 1B Diagram |
| **DEC-0005** | Meta WhatsApp webhooks terminate at verified ONEDECORE server endpoint | LOCKED | Ensures signature verification and idempotent persistence | No | Phase 9 | Phase 1B |
| **DEC-0006** | "₹100-crore" established as internal design benchmark only, never public claim | LOCKED | Maintains brand truthfulness and prevents false public claims | No | Phase 1C | Phase 1B Report |
| **DEC-0007** | Admin CRM routes prefixed with `/admin` | LOCKED | Establishes clear URL boundary separating public and admin routes | No | Phase 2 | Phase 1B (`/crm`) |
| **DEC-0008** | Single modular monolith repository using `src/` directory layout | LOCKED | Maintains clean code organization without microservice overhead | No | Phase 2 | N/A |
| **DEC-0009** | Portfolio storage split between private master assets and public web derivatives | LOCKED | Protects master high-res files while serving fast web assets | No | Phase 5 | Phase 1B Storage |
| **DEC-0010** | RLS mandatory on 100% API-exposed application tables; anon access denied | LOCKED | Ensures complete database security and privacy compliance | No | Phase 2 | N/A |
| **DEC-0011** | Typography pairing recommendation (*Playfair Display* + *Plus Jakarta Sans*) | RECOMMENDED | Pending Phase 3 design showroom evaluation & owner sign-off | YES | Phase 3 | N/A |
| **DEC-0012** | Qualification & discount approval thresholds remain configurable | LOCKED | Prevents hardcoded business rules; thresholds set by Management | YES | Phase 7 | Phase 1B (Hardcoded 10%) |
| **DEC-0013** | Quotation acceptance defined as auditable client acceptance acknowledgement | LOCKED | Accurately describes digital acknowledgement boundary without e-sig claims | No | Phase 8 | Phase 1B |
| **DEC-0014** | V1 No-ERP Boundary (accounting, procurement, inventory, labor scheduling excluded) | LOCKED | Preserves core V1 focus on customer acquisition & sales CRM | No | Phase 1B | N/A |
| **DEC-0015** | Framework baseline scaffolded on Next.js 16.2.11 with Node 24 LTS & npm 11.16.0 | LOCKED | Establishes reproducible engineering foundation and quality script contracts | No | Phase 2A | N/A |
| **DEC-0016** | Supabase SSR cookie connection established using @supabase/ssr behind ONEDECORE wrappers | LOCKED | Provides secure browser/server cookie-based Supabase integration for Mumbai project | No | Phase 2B | N/A |
| **DEC-0017** | Imperative timestamped migrations in supabase/migrations/ established as single schema source | LOCKED | Ensures version-controlled, reproducible schema evolution across all environments | No | Phase 2C | N/A |
| **DEC-0018** | Database-backed RBAC with private.has_role() and private.has_permission() security-definer helpers | LOCKED | Implements immediate permission enforcement without relying on stale JWT claims | No | Phase 2C | N/A |
| **DEC-0020** | Shared-Docker Desktop policy with strict project isolation and least-privilege column-level RBAC hardening | LOCKED | Ensures zero resource contention with Jarvis/QuickFurno and enforces strict SQL schema drift protection | No | Phase 2C1 | N/A |
| **DEC-0021** | Phase 2C2 Controlled Remote Migration Deployment to Mumbai Supabase Project lpurlfmpvriyvpkujvyl | LOCKED | Establishes the initial remote identity & RBAC schema baseline with zero Auth users or business tables | No | Phase 2C2 | N/A |
| **DEC-0022** | Phase 2C3 Remote RBAC Post-Deployment Hardening (RLS Event Trigger & User Roles Index) | LOCKED | Revokes direct execution on platform helper public.rls_auto_enable() and covers user_roles.assigned_by foreign key | YES | Phase 2C3 | N/A |
| **DEC-0023** | Public SECURITY INVOKER authorization RPC wrapper (public.authorize) for server-side permission checks | LOCKED | Provides safe public Data API RPC endpoint delegating to private.has_permission with zero JWT custom claims overhead | No | Phase 2D1 | N/A |
| **DEC-0024** | Staff-only password authentication and POST-only sign-out with Proxy authentication guard | LOCKED | Restricts authentication to staff signInWithPassword, disallows public sign-up, and protects /admin routes in Proxy | No | Phase 2D1 | N/A |
| **DEC-0025** | Hardened active staff profile status requirement (status = 'active') in database authorization functions | LOCKED | Prevents pending, suspended, or disabled staff profiles from passing role or permission authorization checks | No | Phase 2D2 | N/A |
| **DEC-0026** | Guarded one-time operational Super Admin bootstrap for ONEDECORE owner account | LOCKED | Establishes single initial owner Super Admin user with active profile status and super_admin role assignment | No | Phase 2D2 | N/A |
| **DEC-0027** | Portfolio publication state & access control model (published status required for public access) | LOCKED | Ensures draft and archived projects remain 100% invisible to public site visitors via database RLS | No | Phase 2E1 | N/A |
| **DEC-0028** | Two-bucket media storage architecture (portfolio-originals private vs portfolio-public web derivatives) | LOCKED | Isolates master raw photographs from public web assets without depending on paid image transformations | No | Phase 2E1 | N/A |
| **DEC-0029** | Column-level privilege hardening & RLS subquery optimization for Portfolio tables | LOCKED | Enforces database-level immutability on audit fields and eliminates RLS init-plan and multiple policy warnings | No | Phase 2E1A | N/A |
| **DEC-0030** | Server-side Sharp 0.35.3 image processing pipeline with automatic metadata stripping & WebP derivatives | LOCKED | Ensures private master images have EXIF privacy metadata stripped and generates cover/gallery/thumb WebP derivatives | No | Phase 2E2 | N/A |
| **DEC-0031** | Database-controlled publication workflow with SECURITY DEFINER status RPC and trigger guards | LOCKED | Revokes direct UPDATE on status/published_at columns and enforces publication prerequisites via SECURITY DEFINER RPC and triggers | No | Phase 2E2 | N/A |
| **DEC-0032** | Two-tier RPC architecture separating PostgREST-exposed SECURITY INVOKER wrapper from private SECURITY DEFINER helper | LOCKED | Resolves Security Advisor alert authenticated_security_definer_function_executable while preserving privilege escalation bounds | No | Phase 2E2A | DEC-0031 (Refined RPC Structure) |

---

## Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Phase Implementation Roadmap](09-phase-roadmap.md)
- [ADR-0013: Server-Side Portfolio Image Processing Pipeline](ADR/ADR-0013-server-side-portfolio-image-processing.md)
- [ADR-0014: Database-Controlled Portfolio Publication](ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0015: Private Definer Status Transition Helper Pattern](ADR/ADR-0015-private-definer-status-transition-helper.md)
