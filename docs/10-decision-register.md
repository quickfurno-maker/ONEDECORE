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
| **DEC-0033** | Server-only RSC DTO data repository pattern for public portfolio showcase (`/portfolio`, `/portfolio/[slug]`) | LOCKED | Prevents internal database column and user UUID leakage to public clients while consuming server-resolved WebP image URLs | No | Phase 2E3A | N/A |
| **DEC-0034** | Outcome A RLS verification & tag-based cache revalidation for public portfolio performance | LOCKED | Confirms existing RLS policies safely permit public read access to published items (zero migration) and invalidates Next.js cache tags on CMS edit | No | Phase 2E3A | N/A |
| **DEC-0035** | Public portfolio delivery without route-level loading boundary; true HTTP 404 for invalid public portfolio requests | LOCKED | Whole-route Suspense loading shell committed HTTP 200 before notFound() could set status; removed loading.tsx to preserve true 404 semantics | No | Phase 2E3B | N/A |
| **DEC-0036** | Database-side displayable filtering before bounded listing pagination (12 cards/page) | LOCKED | Prevents malformed projects from occupying page slots and hiding valid published projects from paginated results | No | Phase 2E3B | N/A |
| **DEC-0037** | Phase 5A Five-Role CRM Authorization Model (`super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer`) | LOCKED | Locks owner-approved operating roles with RLS-enforced isolation; excludes ERP operational roles | No | Phase 5A | Legacy PRD role names |
| **DEC-0038** | Closed-Won requires Accepted quotation before project creation; PM acceptance before execution | LOCKED | Prevents premature operations without commercial truth and PM accountability | No | Phase 5A | Prior advance-payment wording |
| **DEC-0039** | Source-based lead assignment with Unassigned fallback; round-robin excluded | LOCKED | Predictable routing without random executive assignment | No | Phase 5A | N/A |
| **DEC-0040** | Sales Manager bulk import requires Super Admin approval; Super Admin direct import without secondary approval | LOCKED | Reduces import risk while preserving admin operational speed | No | Phase 5A | N/A |
| **DEC-0041** | Sales Manager monthly targets are team-only in V1 (no separate personal target) | LOCKED | Aligns manager metrics with team performance responsibility | No | Phase 5A | N/A |
| **DEC-0042** | Groq human-controlled copilot only; provider-independent adapter; no autonomous business mutations | LOCKED | Permits AI assistance without autonomous sales/ops risk | No | Phase 5A | N/A |
| **DEC-0043** | Official Meta WhatsApp Cloud API only; unofficial Web automation prohibited | LOCKED | Meta policy compliance and deliverability | No | Phase 5A | N/A |
| **DEC-0044** | Public lead intake remains disabled by default post-4B2 merge; activation requires Phase 5F separate authority | LOCKED | Prevents accidental public collection before legal/owner gates | No | Phase 5A | N/A |
| **DEC-0045** | CRM workflow states documented as state graphs with explicit branch/terminal semantics (not misleading serial chains) | LOCKED | Prevents implementation of impossible linear transitions | No | Phase 5A | Serial diagram wording |
| **DEC-0046** | Phase 5E configures targets and non-commercial reporting only; authoritative achievement activates in Phase 7B | LOCKED | Prevents fabricated or stub performance metrics before quotation acceptance exists | No | Phase 5A | Phase 5E stub achievement |
| **DEC-0047** | Phase 5B CRM foundation implemented locally (migration 11): assignment-scoped RLS, source catalogue, RPC-only pipeline mutations; legacy roles retained without user remapping; sales targets deferred to 5E | LOCKED | Establishes auditable CRM data plane without managed apply or public activation | No | Phase 5B | N/A |
| **DEC-0048** | Managed CRM migrations 11–13 applied to OneDecore Supabase (`lpurlfmpvriyvpkujvyl`) on 2026-08-01 in ordered push; remote history aligned 1–13; no production application deployment; public lead intake remains inactive | LOCKED | Records authoritative managed database state after Phase DB-2 | No | Phase DB-2 | N/A |
| **DEC-0049** | Managed migration 14 (`20260801140000_crm_manual_lead_duplicate_safe_flow`) applied to OneDecore Supabase on 2026-08-02 (Phase DB-3B); remote history aligned 1–14; fresh WALG backup gate passed; no production deployment; public lead intake remains inactive | LOCKED | Records authoritative managed database state after manual-lead RPC apply | No | Phase DB-3B | N/A |

---

## Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Phase Implementation Roadmap](09-phase-roadmap.md)
- [ADR-0013: Server-Side Portfolio Image Processing Pipeline](ADR/ADR-0013-server-side-portfolio-image-processing.md)
- [ADR-0014: Database-Controlled Portfolio Publication](ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0015: Private Definer Status Transition Helper Pattern](ADR/ADR-0015-private-definer-status-transition-helper.md)
- [ADR-0016: Public Portfolio Data Delivery Architecture](ADR/ADR-0016-public-portfolio-data-delivery.md)
- [ADR-0017: Public Portfolio Cache & Revalidation Strategy](ADR/ADR-0017-public-portfolio-cache-and-revalidation.md)
- [ADR-0019: Five-Role CRM Authorization Model](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0020: Closed-Won Project Handover Invariants](ADR/ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0021: Groq Copilot and WhatsApp Boundary](ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [Phase 5B Audit](audits/phase-5b-crm-identity-core-foundation.md)
