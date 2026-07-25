# ONEDECORE — PHASE 2C LOCAL DATABASE MIGRATION & IDENTITY/RBAC FOUNDATION

**Project:** ONEDECORE  
**Working directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Official Supabase project:** `lpurlfmpvriyvpkujvyl`  
**Region:** Mumbai, India (`ap-south-1`)  
**Verified remote state before Phase 2C:** 0 migrations, 0 public tables  
**Phase 2B feature commit:** `e236589c9b192677fb69388c965e593c2ee17971`  
**Phase 2A merge commit on main:** `675dff2a822ef3368a82e7e4eb57a785e9d163d2`  
**Current authorized phase:** Phase 2C — local migration tooling and identity/RBAC migration only  
**Remote migration application:** NOT AUTHORIZED  
**Auth UI / user creation:** NOT AUTHORIZED  
**Portfolio, CRM and storage schemas:** NOT AUTHORIZED  

---

# 1. PHASE 2B VERDICT

Phase 2B is accepted.

The following were completed:

- Phase 2A merged into local `main`
- Supabase SSR/browser wrapper packages installed
- Browser and server clients created
- Next.js 16 Proxy session-refresh boundary created
- Modern publishable key stored only in ignored `.env.local`
- Mumbai project connection verified without mutation
- Feature commit created and working tree left clean

One documentation inconsistency must be corrected in Phase 2C:

- Phase 2B's report says server client factories are deferred to Phase 2D, although `src/lib/supabase/server.ts` was already created in Phase 2B.
- Phase 2C documentation must state that the server client factory already exists; authentication policy and UI remain deferred.

---

# 2. WHY PHASE 2C IS NARROW

Do not create all six business domains in one migration.

Phase 2C establishes only:

1. Version-controlled Supabase CLI configuration
2. Reproducible local migration workflow
3. Staff profile foundation
4. Roles and permissions foundation
5. Row-Level Security for these identity tables
6. Typed database client integration
7. Local database tests

The following remain separate later gates:

- Phase 2D: authentication UI, admin route protection and first Super Admin bootstrap
- Phase 2E: portfolio schema and storage boundaries
- Phase 2F: lead/CRM foundation
- Later phases: quotations, WhatsApp records, automation and audit expansion

---

# 3. MIGRATION APPROACH

**LOCKED:** Use imperative, timestamped SQL migrations as the single schema source of truth.

Use:

```text
supabase/migrations/<timestamp>_identity_rbac_foundation.sql
```

Do not maintain a second declarative schema representation under `supabase/schemas/`.

Rules:

- All DDL changes occur through reviewed migration files.
- Dashboard/SQL Editor changes are prohibited except explicitly approved emergency actions.
- Every migration must be replayable from an empty local database.
- Every migration must pass local reset, database lint and database tests.
- Remote application occurs only after owner/reviewer approval.
- No remote `db push`, reset, pull or migration apply in Phase 2C.

---

# 4. SUPABASE CLI BASELINE

Pin the project-local stable CLI:

```json
"supabase": "2.109.1"
```

Install only as a development dependency:

```powershell
npm install --save-dev --save-exact supabase@2.109.1
```

Use `npx supabase ...`.

Do not install Supabase CLI globally with npm.

Create the local Supabase project configuration using:

```powershell
npx supabase init
```

Commit:

- `supabase/config.toml`
- `supabase/migrations/`
- `supabase/tests/`

Ignore:

- `supabase/.temp/`
- `supabase/.branches/`
- local secrets and runtime files

Do not run `supabase link`.

Do not run `supabase login`.

Do not store a platform access token or database password.

---

# 5. LOCAL RUNTIME PRECONDITION

A Docker-compatible runtime must already be installed, running and healthy.

Preflight commands:

```powershell
docker version
docker info
```

Requirements:

- Do not install or reconfigure Docker automatically.
- Do not expose the local Supabase stack to the network.
- Do not print local secret keys in the report.
- If Docker is unavailable, stop before merging Phase 2B or modifying files.

Blocked marker:

`PHASE_2C_BLOCKED_DOCKER_REQUIRED`

---

# 6. GIT TRANSITION

Expected initial state:

- Branch: `phase-2b-supabase-ssr-foundation`
- HEAD: `e236589c9b192677fb69388c965e593c2ee17971`
- Working tree: clean
- No Git remote

After all preflight checks:

1. Check out `main`.
2. Verify `main` is at:
   `675dff2a822ef3368a82e7e4eb57a785e9d163d2`
3. Merge Phase 2B with a local non-fast-forward merge:

```text
merge: complete ONEDECORE phase 2B
```

4. Run `npm ci` and `npm run check`.
5. Create:

```text
phase-2c-identity-rbac-foundation
```

Do not delete prior branches.

Do not add a remote.

Do not merge Phase 2C.

---

# 7. SCHEMA CONTRACT

Create a private, non-API schema:

```sql
private
```

The `private` schema must not be added to exposed API schemas.

Create exactly these public tables:

1. `public.profiles`
2. `public.roles`
3. `public.permissions`
4. `public.role_permissions`
5. `public.user_roles`

No other application tables are authorized in Phase 2C.

## 7.1 `public.profiles`

Purpose: staff application profile associated one-to-one with `auth.users`.

Required columns:

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text null`
- `phone_e164 text null`
- `status text not null default 'pending'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `display_name` trimmed length must be between 1 and 120 when present.
- `phone_e164` must be a plausible E.164 value when present.
- `status` allowed values:
  - `pending`
  - `active`
  - `suspended`
  - `disabled`

Do not duplicate email from `auth.users`.

Do not add public client/customer profiles in this table.

## 7.2 `public.roles`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `name text not null`
- `description text null`
- `is_system boolean not null default true`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Role code grammar:

```text
^[a-z][a-z0-9_]*$
```

Seed exactly these roles:

- `super_admin`
- `management`
- `sales`
- `designer`
- `project_operations`
- `content_manager`

## 7.3 `public.permissions`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `name text not null`
- `description text null`
- `is_system boolean not null default true`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Permission grammar:

```text
^[a-z][a-z0-9_.]*$
```

Seed exactly these foundation permissions:

- `admin.access`
- `users.read`
- `users.manage`
- `roles.read`
- `roles.manage`
- `audit.read`

## 7.4 `public.role_permissions`

Required columns:

- `role_id uuid not null references public.roles(id) on delete cascade`
- `permission_id uuid not null references public.permissions(id) on delete cascade`
- `created_at timestamptz not null default now()`
- Composite primary key: `(role_id, permission_id)`

Seed grants:

### `super_admin`

All six foundation permissions.

### `management`

- `admin.access`
- `users.read`
- `roles.read`
- `audit.read`

### `sales`

- `admin.access`

### `designer`

- `admin.access`

### `project_operations`

- `admin.access`

### `content_manager`

- `admin.access`

No business-domain permissions are added before their domains exist.

## 7.5 `public.user_roles`

Required columns:

- `user_id uuid not null references auth.users(id) on delete cascade`
- `role_id uuid not null references public.roles(id) on delete restrict`
- `assigned_by uuid null references auth.users(id) on delete set null`
- `assigned_at timestamptz not null default now()`
- Composite primary key: `(user_id, role_id)`

No user-role assignment is seeded.

Do not hardcode an owner UUID.

The first Super Admin assignment is deferred to controlled Phase 2D bootstrap.

---

# 8. PRIVATE FUNCTIONS AND TRIGGERS

Create:

## `private.set_updated_at()`

- Trigger function
- Sets `new.updated_at = now()`
- Used by `profiles`, `roles` and `permissions`

## `private.handle_new_auth_user()`

- Trigger function
- Inserts `public.profiles(id)` for a newly created `auth.users` row
- Uses `on conflict (id) do nothing`
- Must be `security definer`
- Must set an empty search path
- Must use fully qualified object names
- Revoke execution from `public`, `anon` and `authenticated`

Create an `after insert` trigger on `auth.users`.

Also backfill a profile row for any pre-existing auth user using an idempotent insert.

## `private.has_role(requested_role text)`

- Returns boolean
- `stable`
- `security definer`
- `set search_path = ''`
- Uses the current authenticated user from `auth.uid()`
- Checks active role membership
- Returns false when unauthenticated

## `private.has_permission(requested_permission text)`

- Returns boolean
- `stable`
- `security definer`
- `set search_path = ''`
- Uses the current authenticated user
- Checks active role, active permission and mapping
- Returns false when unauthenticated

Function security:

- Grant `usage` on schema `private` only to `authenticated`.
- Grant execute on `has_role` and `has_permission` only to `authenticated`.
- Revoke from `public` and `anon`.
- The `private` schema must not become an exposed PostgREST schema.
- Do not create JWT custom claims or an Auth Hook in Phase 2C.

Rationale: database-backed permission checks avoid stale authorization claims while the role model is being established.

---

# 9. INDEXES

Create only justified indexes:

- Index `public.user_roles(role_id)`
- Index `public.role_permissions(permission_id)`
- Any index required by a foreign key or permission query not already covered by a primary/unique key

Do not add speculative business indexes.

---

# 10. ROW-LEVEL SECURITY AND PRIVILEGES

Enable RLS on all five public tables.

Anonymous rules:

- `anon` receives no table privileges.
- No anonymous RLS policy exists.
- Public website users must not read staff identity or RBAC data.

Authenticated privileges and policies:

## Profiles

Grant authenticated:

- `select`
- `update`

Policies:

- Select own profile
- Select any profile with `users.read`
- Update any profile only with `users.manage`

Do not allow authenticated insert or delete.

Self-service profile editing is deferred; do not let users directly change arbitrary profile fields.

## Roles

Grant authenticated:

- `select`
- `insert`
- `update`

Policies:

- Select with `roles.read` or `roles.manage`
- Insert/update with `roles.manage`

Do not grant delete. Use `is_active` instead.

## Permissions

Grant authenticated:

- `select`
- `insert`
- `update`

Policies:

- Select with `roles.read` or `roles.manage`
- Insert/update with `roles.manage`

Do not grant delete.

## Role permissions

Grant authenticated:

- `select`
- `insert`
- `delete`

Policies:

- Select with `roles.read` or `roles.manage`
- Insert/delete with `roles.manage`

## User roles

Grant authenticated:

- `select`
- `insert`
- `delete`

Policies:

- A user may select their own role assignments.
- Users with `users.read`, `roles.read` or `roles.manage` may select assignments.
- Insert/delete requires `roles.manage`.

Do not grant update; role assignments are inserted or removed.

Use `(select auth.uid())` in policies where appropriate.

Do not rely on UI checks for authorization.

---

# 11. MIGRATION QUALITY RULES

The migration must:

- Be transactional where Supabase migration execution permits.
- Be idempotent only where needed for seed/backfill operations.
- Fail loudly on unexpected conflicts.
- Use explicit schema qualification.
- Include comments for tables and security-definer functions.
- Avoid dynamic SQL.
- Avoid `serial`.
- Avoid hardcoded generated UUID values for roles/permissions; seed through code-based lookup.
- Avoid secrets and project-specific credentials.
- Avoid `drop` statements.
- Avoid remote-only object references.
- Avoid unsupported extensions unless required and documented.
- Avoid blanket grants.
- Avoid `grant all`.
- Avoid granting table access to `anon`.
- Avoid a service-role-specific policy; elevated keys bypass RLS by design.
- Avoid custom JWT claims and auth hooks in this phase.

---

# 12. DATABASE TESTS

Create SQL tests under:

```text
supabase/tests/database/
```

At minimum test:

1. All five public tables exist.
2. The `private` schema exists.
3. RLS is enabled on all five public tables.
4. All six roles are seeded.
5. All six permissions are seeded.
6. Role-permission seed mappings match the contract.
7. `public.user_roles` begins empty.
8. Anonymous has no table privileges.
9. Authenticated table privileges match the contract.
10. `private.has_role` and `private.has_permission` are not executable by `anon`.
11. Security-definer helper functions have a safe explicit search path.
12. The `auth.users` profile trigger exists.
13. No Portfolio, CRM, quotation, WhatsApp or automation table exists.
14. Migration replay succeeds from an empty local database.

Use pgTAP through the supported local Supabase test command.

Tests must roll back their own temporary mutations.

Do not seed real users or personal information.

---

# 13. GENERATED TYPES

After local migration validation, generate:

```text
src/types/database.generated.ts
```

from the local database.

Use UTF-8 output.

Update:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`

to use the generated `Database` type.

Do not hand-edit generated types.

Regenerate types only from the validated local migration state.

---

# 14. PACKAGE SCRIPTS

Add:

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:lint": "supabase db lint --local --level warning",
"db:test": "supabase test db",
"check:db": "npm run db:lint && npm run db:test"
```

Do not add a remote push/reset script.

Do not make `npm run check` implicitly start Docker.

Keep application and database gates separate:

- `npm run check`
- `npm run check:db`

---

# 15. DOCUMENTATION

Create:

- `docs/audits/phase-2c-identity-rbac-foundation.md`
- `docs/ADR/ADR-0007-imperative-versioned-migrations.md`
- `docs/ADR/ADR-0008-database-backed-rbac.md`

Update:

- `README.md`
- `CHANGELOG.md`
- `docs/02-architecture.md`
- `docs/05-supabase-data-domains.md`
- `docs/06-security-privacy-and-rls.md`
- `docs/09-phase-roadmap.md`
- `docs/10-decision-register.md`

Record:

- Phase 2B merge commit
- Feature branch
- Exact CLI version
- Docker version
- Migration path and SHA-256
- Tables, functions, triggers, policies and indexes
- Seeded roles/permissions
- Generated type path
- Test results
- Confirmation of no remote mutation
- Confirmation that the server client already exists
- Deferral of Auth UI and first Super Admin bootstrap
- Risks and follow-up actions

---

# 16. VALIDATION

Run:

```powershell
docker version
docker info
node --version
npm --version
npx supabase --version
npx supabase start
npx supabase db reset
npm run db:lint
npm run db:test
npm run check:db
npm run lint
npm run typecheck
npm run build
npm run check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

Also verify:

- The local Supabase stack is not externally exposed.
- No remote project is linked.
- No remote migration was applied.
- `.env.local` remains ignored and untracked.
- No access token or database password exists in tracked files.
- No secret key exists in source.
- The obsolete Seoul project reference does not appear in executable configuration.
- No business-domain table was created.
- Generated TypeScript types match the local migration.
- All required RLS policies and grants are test-covered.

Stop the local stack after tests:

```powershell
npx supabase stop
```

Do not use `--no-backup` unless a failed local stack must be deliberately discarded and the reason is reported.

---

# 17. REMOTE SAFETY GATE

Phase 2C is local-only.

Strictly prohibited:

- `supabase login`
- `supabase link`
- `supabase db push`
- `supabase db pull`
- `supabase db reset --linked`
- Dashboard SQL execution
- Remote migration application
- Remote bucket creation
- Remote Auth user creation

After the Phase 2C report is reviewed, the migration may be applied in a separate Phase 2C2 gate.

---

# 18. COMMIT

After all local validation succeeds, create exactly one feature commit:

```text
feat(database): add identity and RBAC foundation
```

Remain on:

```text
phase-2c-identity-rbac-foundation
```

Do not merge into `main`.

Working tree must be clean.

---

# 19. REQUIRED REVIEW OUTPUT

The Phase 2C report must include:

- Migration filename
- Migration SHA-256
- Full object inventory
- Policy inventory
- Test inventory
- Exact validation results
- Confirmation of zero remote mutations
- Full migration SQL in a fenced SQL block for independent review
- No credentials or local Supabase keys

---

# 20. COMPLETION MARKERS

Success:

`PHASE_2C_LOCAL_IDENTITY_RBAC_COMPLETE`

Docker unavailable:

`PHASE_2C_BLOCKED_DOCKER_REQUIRED`

Other precondition block:

`PHASE_2C_BLOCKED_PRECONDITION`

Validation failure:

`PHASE_2C_VALIDATION_FAILED`
