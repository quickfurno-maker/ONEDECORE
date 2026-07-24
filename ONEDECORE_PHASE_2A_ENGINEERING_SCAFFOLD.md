# ONEDECORE — PHASE 2A ENGINEERING SCAFFOLD & QUALITY BASELINE

**Project:** ONEDECORE  
**Working directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Phase 1C baseline commit:** `353dad0c288cf8ed70278d35fd3353d574d5dda3`  
**Current authorized phase:** Phase 2A — Framework scaffold and local quality baseline  
**Supabase project creation:** Not authorized in Phase 2A  
**Production UI:** Not authorized in Phase 2A  
**Deployment:** Not authorized in Phase 2A  

---

# 1. PHASE 1C VERDICT

Phase 1C is accepted.

Verified from the execution report:

- Governance documents were created.
- The original blueprint documents were preserved.
- Git was initialized on `main`.
- The baseline commit was created.
- The working tree was clean.
- No application source, package manifest, environment file, migration or external integration was created.
- No remote is configured.

## Non-blocking Git identity note

The baseline commit used:

- `user.name`: `quickfurno-maker`
- `user.email`: `quickfurno@gmail.com`

This is commit metadata and does not create technical coupling with QuickFurno.

Do not rewrite the Phase 1C commit in Phase 2A.

Do not change Git identity automatically.

Before connecting a GitHub remote, the owner may choose either:

1. Keep the existing personal Git identity, or
2. Configure a repository-local neutral identity such as the owner's real name and an approved email.

This is an owner decision, not a Phase 2A blocker.

---

# 2. CURRENT VETTED FRAMEWORK BASELINE

As of July 24, 2026:

- Next.js stable target: `16.2.11`
- Node.js target: current Node.js `24.x` LTS line
- Package manager: npm with committed `package-lock.json`
- App Router
- TypeScript
- ESLint
- Tailwind CSS 4.x
- `src/` directory
- Import alias: `@/*`
- Turbopack default
- React Compiler: disabled until deliberately evaluated
- Modular-monolith architecture
- Server Components by default

The exact generated dependency versions must be recorded in the Phase 2A report.

---

# 3. PHASE 2A OBJECTIVE

Establish a minimal, production-oriented Next.js engineering foundation inside the existing governance repository without:

- Overwriting documentation
- Creating a Supabase project
- Connecting external services
- Implementing the final website
- Implementing Portfolio, CRM, WhatsApp or n8n features
- Introducing fake business content
- Generating premium UI
- Adding fonts, images or animations

The result should be a clean technical shell that builds, lints and type-checks.

---

# 4. PHASE 2A TARGET FILES

The exact generated file list may vary slightly with the vetted CLI version, but the intended application baseline is:

```text
OneDecore/
├── .git/
├── .editorconfig
├── .gitignore
├── .npmrc
├── .nvmrc
├── .node-version
├── .env.example
├── package.json
├── package-lock.json
├── next.config.ts
├── next-env.d.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── src/
│   └── app/
│       ├── favicon.ico              # only if generated safely by scaffold
│       ├── globals.css
│       ├── layout.tsx
│       ├── page.tsx
│       ├── error.tsx
│       └── not-found.tsx
└── docs/
    └── audits/
        └── phase-2a-engineering-scaffold.md
```

Do not create the complete route hierarchy yet.

Do not create empty implementation directories merely to match the future blueprint.

---

# 5. MINIMAL PAGE RULE

The initial page must be a neutral engineering placeholder only.

Allowed content:

- ONEDECORE
- One Vision. Complete Interiors.
- “Engineering foundation initialized”
- A clear statement that public experience implementation begins in later phases

Not allowed:

- Fake portfolio projects
- Fake testimonials
- Fake statistics
- Fake Pune locations
- Factory claims
- Studio claims
- Hardware-brand claims
- Stock photography
- Cinematic animation
- Final design-system decisions
- Final logo
- Final font pairing

The page must be a Server Component unless a technical requirement proves otherwise.

---

# 6. ENVIRONMENT CONTRACT

Phase 2A may create `.env.example` with names and comments only.

Use the current Supabase API-key model:

```dotenv
# Public Supabase configuration — safe for browser use only with correct RLS
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server-only elevated key — never prefix with NEXT_PUBLIC_
SUPABASE_SECRET_KEY=
```

Rules:

- Do not create `.env`, `.env.local`, `.env.production` or real secrets.
- Do not use the legacy anon/service-role names for a new project unless a later Supabase compatibility need is documented.
- Do not import or validate these variables in runtime code during Phase 2A.
- Supabase packages and clients belong to Phase 2B.

---

# 7. QUALITY BASELINE

Create scripts for:

- `dev`
- `build`
- `start`
- `lint`
- `typecheck`
- `check`

`check` must run:

1. Lint
2. TypeScript type-check
3. Production build

Use the ESLint CLI, not the removed `next lint` command.

Create `.npmrc` with project-local reproducibility and safety settings only:

```ini
save-exact=true
engine-strict=true
fund=false
audit=true
```

Do not change global npm settings.

Use:

- `.nvmrc`: `24`
- `.node-version`: `24`
- `package.json` engines: `>=24 <25`

Record the exact Node and npm versions used in the audit document.

---

# 8. GIT WORKFLOW

Phase 2A must run on a feature branch.

Expected starting state:

- Branch: `main`
- HEAD: `353dad0c288cf8ed70278d35fd3353d574d5dda3`
- Working tree: clean
- Remote: none

Create:

`phase-2a-engineering-scaffold`

Do not merge it into `main`.

Create exactly one Phase 2A commit:

`feat(foundation): scaffold Next.js engineering baseline`

Stop with:

- Feature branch checked out
- Clean working tree
- Main unchanged
- No remote configured

---

# 9. SAFE SCAFFOLD STRATEGY

The repository is not empty, so do not run `create-next-app` directly over the root without a controlled merge.

Use a temporary sibling or operating-system temporary directory.

Recommended command:

```powershell
npx create-next-app@16.2.11 <temporary-directory> `
  --ts `
  --eslint `
  --tailwind `
  --app `
  --src-dir `
  --import-alias "@/*" `
  --use-npm `
  --empty `
  --disable-git `
  --no-react-compiler `
  --yes
```

Before copying:

- Inspect every generated file.
- Do not copy the generated README over the governance README.
- Do not replace the existing `.gitignore` blindly.
- Merge required ignore rules without deleting governance rules.
- Do not copy a nested `.git` directory.
- Do not copy generated cache/build directories.
- Confirm no generated file contains sample branding or irrelevant demo content.

After copying and reconciling:

- Remove the temporary scaffold directory.
- Run `npm install` only inside ONEDECORE.
- Preserve exact package versions in `package-lock.json`.

---

# 10. STOP CONDITIONS

Stop without modifying the repository if:

- `main` is not clean.
- HEAD is not the expected Phase 1C commit.
- A Git remote unexpectedly exists.
- Node.js is not in the supported 24.x LTS line.
- The scaffold would overwrite governance documents.
- The CLI resolves to a prerelease/canary dependency.
- Secret files or credentials unexpectedly exist.
- QuickFurno or Jarvis application code appears.
- Installation produces unresolved high or critical production dependency vulnerabilities.
- Build, lint or type-check failures cannot be corrected within the Phase 2A scope.

Report the exact stop condition.

Do not auto-install or upgrade Node.js system-wide.

---

# 11. VALIDATION

Run and report:

```powershell
node --version
npm --version
git branch --show-current
git rev-parse HEAD
git status --short
git remote -v
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

- No `.env` or `.env.local` exists.
- `.env.example` contains no values.
- No Supabase package is installed yet.
- No Supabase client is created.
- No SQL or migration exists.
- No external service connection exists.
- No final UI, portfolio, CRM or animation exists.
- No blueprint/governance document was accidentally overwritten.
- The generated page remains a Server Component.
- The build output does not expose `SUPABASE_SECRET_KEY`.

---

# 12. COMPLETION MARKER

Successful Phase 2A:

`PHASE_2A_ENGINEERING_SCAFFOLD_COMPLETE`

Blocked preflight:

`PHASE_2A_BLOCKED_PRECONDITION`

Failed validation:

`PHASE_2A_VALIDATION_FAILED`
