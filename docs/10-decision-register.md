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

---

## Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Phase Implementation Roadmap](09-phase-roadmap.md)
