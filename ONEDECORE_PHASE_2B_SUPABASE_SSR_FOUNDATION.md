# ONEDECORE — PHASE 2B SUPABASE SSR CONNECTION FOUNDATION

**Project:** ONEDECORE  
**Working directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Official Supabase project:** `OneDecore`  
**Supabase project reference:** `lpurlfmpvriyvpkujvyl`  
**Supabase region:** Mumbai, India (`ap-south-1`)  
**Project URL:** `https://lpurlfmpvriyvpkujvyl.supabase.co`  
**Project status:** `ACTIVE_HEALTHY`  
**Current remote migrations:** 0  
**Current custom application tables:** 0  
**Phase 2A commit:** `14f494e411399896f8abf6fb6b9b8bf1cfeca9e9`  
**Current authorized phase:** Phase 2B — Supabase SSR package, client and environment foundation  
**Database DDL/RLS:** Not authorized  
**Authentication UI:** Not authorized  
**Portfolio/CRM implementation:** Not authorized  

---

# 1. PHASE 2B OBJECTIVE

Connect the approved Next.js App Router foundation to the new Mumbai Supabase project using Supabase's official cookie-based SSR pattern.

Phase 2B establishes:

- Exact Supabase client dependencies
- Browser client factory
- Server client factory
- Next.js 16 Proxy session-refresh boundary
- Public environment validation
- Local ignored environment configuration
- Documentation and validation
- A clean feature-branch commit

Phase 2B does not create:

- Business tables
- SQL migrations
- Storage buckets
- RLS policies
- Staff users
- Login UI
- Admin routes
- Portfolio records
- CRM records
- Secret/admin clients
- Edge Functions
- n8n or WhatsApp integration

---

# 2. OFFICIAL PACKAGE BASELINE

Pin these exact stable package versions:

```json
"@supabase/supabase-js": "2.110.8",
"@supabase/ssr": "0.12.3"
```

Important:

- `@supabase/ssr` is the official Supabase package for cookie-based sessions in Next.js SSR.
- It is currently beta and must be isolated behind ONEDECORE-owned wrapper modules.
- Do not install deprecated `@supabase/auth-helpers-nextjs`.
- Do not install `@supabase/server`; it serves stateless backend/Edge Function use cases and does not replace `@supabase/ssr` for Next.js cookie sessions.
- Do not use prerelease, canary, RC or beta-tagged package versions other than the published stable tag of `@supabase/ssr`.

---

# 3. GIT PHASE TRANSITION

Expected Phase 2A state:

- Branch: `phase-2a-engineering-scaffold`
- HEAD: `14f494e411399896f8abf6fb6b9b8bf1cfeca9e9`
- Working tree: clean
- Remote: none

Before Phase 2B changes:

1. Verify Phase 2A.
2. Check out `main`.
3. Verify `main` starts at Phase 1C commit:
   `353dad0c288cf8ed70278d35fd3353d574d5dda3`
4. Merge Phase 2A using a local non-fast-forward merge:

```text
merge: complete ONEDECORE phase 2A
```

5. Run the existing quality gate on updated `main`.
6. Create and switch to:

```text
phase-2b-supabase-ssr-foundation
```

Do not delete the Phase 2A branch in this phase.

Do not add a Git remote.

Do not merge Phase 2B into `main`.

---

# 4. LOCAL ENVIRONMENT CONTRACT

Create or update the ignored `.env.local` file with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://lpurlfmpvriyvpkujvyl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<COPY THE ENABLED sb_publishable_ KEY FROM THE ONEDECORE SUPABASE CONNECT/API KEYS SCREEN>
```

Rules:

- Use only the enabled modern publishable key beginning with `sb_publishable_`.
- Do not use the legacy anon JWT key for this new project.
- Do not add a secret key in Phase 2B.
- Do not add `SUPABASE_SECRET_KEY` to `.env.local`.
- Never print the full publishable key in the final report.
- Report only that its prefix and presence were validated.
- `.env.local` must remain ignored and uncommitted.
- `.env.example` must contain names and comments only, never values.
- The build must fail clearly when mandatory public environment values are absent or malformed.

The project URL must:

- Use HTTPS
- Match `lpurlfmpvriyvpkujvyl.supabase.co`
- Contain no trailing path
- Contain no embedded credentials

---

# 5. TARGET SOURCE STRUCTURE

Create:

```text
src/
├── config/
│   └── env.ts
├── lib/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── proxy.ts
└── proxy.ts
```

Do not create an admin client.

Do not create a service/secret-key client.

Do not create feature repositories or business queries yet.

---

# 6. ENVIRONMENT VALIDATION

`src/config/env.ts` must:

- Expose only the public Supabase URL and publishable key needed by the SSR/browser clients.
- Validate both values.
- Reject missing or empty values.
- Require the URL to be HTTPS.
- Require the URL hostname to equal:
  `lpurlfmpvriyvpkujvyl.supabase.co`
- Require the publishable key to start with `sb_publishable_`.
- Avoid logging complete credentials.
- Produce clear errors that name the missing variable but never print its value.
- Be safe to import from browser client code.
- Avoid adding a new schema-validation dependency in Phase 2B.

Do not read `SUPABASE_SECRET_KEY`.

---

# 7. BROWSER CLIENT

Create `src/lib/supabase/client.ts`.

Requirements:

- Use `createBrowserClient` from `@supabase/ssr`.
- Use values from the validated public environment module.
- Export a ONEDECORE-owned `createClient()` factory.
- Do not create a global client at module initialization.
- Do not query data.
- Do not add auth flows.
- Do not expose secret/admin capabilities.

---

# 8. SERVER CLIENT

Create `src/lib/supabase/server.ts`.

Requirements:

- Use `createServerClient` from `@supabase/ssr`.
- Use `cookies()` from `next/headers`.
- Use the validated public URL and publishable key.
- Implement the current cookie `getAll`/`setAll` pattern.
- Handle the Server Component cookie-write limitation only as documented by Supabase.
- Do not swallow unrelated errors.
- Export an async ONEDECORE-owned `createClient()` factory.
- Do not call `getSession()` for authorization.
- Do not query business data.
- Do not use any secret key.

---

# 9. NEXT.JS 16 PROXY

Create `src/lib/supabase/proxy.ts`.

Requirements:

- Accept `NextRequest`.
- Create a request-scoped server client.
- Copy cookies correctly between request and response.
- Refresh/validate session state using `supabase.auth.getClaims()`.
- Never use `getSession()` as an authorization decision.
- Return the correctly mutated `NextResponse`.
- Do not redirect users in Phase 2B.
- Do not protect routes in Phase 2B.
- Do not create login behavior.

Create root `src/proxy.ts`.

Requirements:

- Export the Next.js 16 `proxy(request)` function.
- Delegate to `updateSession`.
- Limit the matcher to future auth/admin surfaces:
  - `/admin/:path*`
  - `/auth/:path*`
- Do not run the Proxy over every public page yet.
- Document that Phase 2D authentication may adjust the matcher.

---

# 10. CONNECTION VALIDATION BOUNDARY

The remote project has already been independently verified as:

- Correct project reference
- Mumbai region
- Healthy
- Empty of custom migrations

Phase 2B must not create a fake database table merely to test connectivity.

Validation must include:

- Environment contract tests through controlled local commands.
- Client modules compiling.
- Next.js production build succeeding with `.env.local`.
- A safe, temporary runtime connectivity check that does not create, update or delete remote data.
- The connectivity check must not be committed as a public endpoint.
- It may verify the Supabase Auth endpoint or perform another non-mutating official client call.
- Redact all API-key values from command output and the report.

Do not add a permanent public `/api/health/supabase` endpoint in Phase 2B.

---

# 11. PACKAGE AND SCRIPT RULES

Install exact versions:

```powershell
npm install --save-exact @supabase/supabase-js@2.110.8 @supabase/ssr@0.12.3
```

Do not install:

- `@supabase/auth-helpers-nextjs`
- `@supabase/server`
- Supabase CLI
- Zod
- Test frameworks
- Form libraries
- State libraries
- UI libraries
- Animation packages

Retain existing scripts.

Add only a narrowly scoped script if needed for non-mutating local Supabase configuration verification. Do not commit credentials in scripts.

---

# 12. DOCUMENTATION

Create:

```text
docs/audits/phase-2b-supabase-ssr-foundation.md
```

Record:

- Starting state
- Phase 2A merge commit
- Feature branch
- Project reference
- Region
- Exact package versions
- Environment-variable names
- Files introduced
- Proxy/session design
- Validation results
- Confirmation of zero DDL/migrations
- Confirmation of zero secret/admin client
- Known `@supabase/ssr` beta risk
- Deferrals to Phase 2C and Phase 2D

Update accurately:

- `README.md`
- `CHANGELOG.md`
- `docs/02-architecture.md`
- `docs/05-supabase-data-domains.md`
- `docs/06-security-privacy-and-rls.md`
- `docs/09-phase-roadmap.md`
- `docs/10-decision-register.md`

Add a decision that Supabase SSR is isolated behind project-owned client factories.

Do not rewrite unrelated governance decisions.

---

# 13. VALIDATION COMMANDS

Run and report:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
git remote -v
node --version
npm --version
npm ls --depth=0
npm run lint
npm run typecheck
npm run build
npm run check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

Also verify:

- `@supabase/supabase-js` is exactly `2.110.8`.
- `@supabase/ssr` is exactly `0.12.3`.
- No deprecated Supabase auth-helper package exists.
- No `.env.local` value is tracked.
- `.env.example` has no real value.
- No secret key is present in source, Git diff, build output or report.
- No SQL, migration, bucket, Edge Function or application table was created.
- No public health endpoint was committed.
- No business query or authentication UI was added.
- No Git remote exists.
- Main contains Phase 2A but not Phase 2B.
- Feature branch working tree is clean after commit.

---

# 14. COMMIT

After all validation succeeds, create exactly one Phase 2B feature commit:

```text
feat(supabase): establish SSR connection foundation
```

Do not merge it.

Do not switch back to `main`.

Do not delete branches.

Stop on:

```text
phase-2b-supabase-ssr-foundation
```

with a clean working tree.

---

# 15. STOP CONDITIONS

Stop without Phase 2B implementation if:

- Phase 2A branch or commit is not as expected.
- The Phase 2A working tree is dirty.
- A remote unexpectedly exists.
- The official Supabase project URL does not match the locked Mumbai project.
- The modern publishable key is unavailable or disabled.
- Only a legacy anon key is available.
- A secret key appears in the workspace or prompt output.
- The package versions resolve to prerelease/canary builds.
- The merge or quality gate fails.
- A build requires database mutation.
- The remote project already contains unexpected custom migrations or tables.

Do not automatically modify the remote Supabase database.

---

# 16. COMPLETION MARKERS

Success:

`PHASE_2B_SUPABASE_SSR_FOUNDATION_COMPLETE`

Blocked precondition:

`PHASE_2B_BLOCKED_PRECONDITION`

Validation failure:

`PHASE_2B_VALIDATION_FAILED`
