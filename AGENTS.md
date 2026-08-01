# AGENTS.md

## Cursor Cloud specific instructions

ONEDECORE is a Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind v4
web app backed by Supabase (Postgres). It serves a public marketing site, a portfolio,
a portfolio admin CMS, staff auth, and a CRM/lead-intake foundation. Standard commands
live in `package.json` `scripts` and `CONTRIBUTING.md`; this section only records the
non-obvious startup caveats for this cloud environment.

### Toolchain / Node
- Node **24.x** is required (`package.json` `engines` + `.npmrc` `engine-strict=true`), so
  Node 22 will make `npm ci`/`npm install` fail. Node 24 is installed via `nvm` and set as
  the nvm `default`, so **login shells** (`bash -l`, which source `~/.profile` → `~/.bashrc`
  → nvm) already resolve Node 24. A bare non-interactive `bash -c` does **not** initialize
  nvm; in that case run `. "$HOME/.nvm/nvm.sh" && nvm use 24` first. The startup update
  script already handles this for dependency installs.

### Local Supabase requires Docker (started manually)
- `npm run db:*` and `supabase start` need Docker. This VM has no systemd, so the daemon
  must be started manually and left running, e.g. in a tmux session:
  `sudo dockerd` (logs to your chosen file). If the socket is not usable as the `ubuntu`
  user, run `sudo chmod 666 /var/run/docker.sock` (resets whenever dockerd restarts).
- This is Docker **29+**, which defaults to the containerd snapshotter that is incompatible
  with the VM's kernel. `/etc/docker/daemon.json` is configured with
  `storage-driver: fuse-overlayfs` and `features.containerd-snapshotter: false`, and
  iptables is switched to `iptables-legacy`. Keep these; without them containers fail to start.
- The Supabase CLI is a dev dependency (not global); invoke it via the `db:*` npm scripts
  or `npx supabase ...`.

### Environment file for `next dev` / `npm run check`
- `.env.local` is **git-ignored** and not committed, so recreate it for local dev. Minimum
  for a build/dev run against local Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key from `supabase start` output>`
  The `NEXT_PUBLIC_*` values are validated at build time (`src/config/env.ts`); local/dev
  accepts loopback URLs and the demo `eyJ...` anon key. CI (`.github/workflows/quality-gate.yml`)
  passes these inline instead of using `.env.local`.

### Running services / typical loop
- Dev server: `npm run dev` (http://localhost:3000). App tests need no DB:
  `npm run test:app`, `npm run test:image`. DB gate needs local Supabase running:
  `npm run db:reset` then `npm run check:db` (pgTAP). `npm run check` = lint + typecheck +
  production build.
- Seed portfolio content for local browsing:
  `docker exec -i supabase_db_OneDecore psql -U postgres -d postgres < scripts/seed-local-fixtures.sql`.
  Note: these fixtures insert DB rows only — the referenced image objects are **not** uploaded
  to local Storage, so portfolio images render as broken placeholders locally while all text/data
  render correctly. That is expected, not a bug.

### Lead intake (CRM) is disabled by default
- `ONEDECORE_LEAD_INTAKE_MODE` defaults to `disabled` (server returns 503). For local
  end-to-end lead submission set `local-test` in `.env.local` plus
  `SUPABASE_SERVICE_ROLE_KEY` (local service_role key) and
  `ONEDECORE_LEAD_HASH_SECRET` (>= 32 chars). `local-test` only accepts loopback
  `NEXT_PUBLIC_SUPABASE_URL` and same-origin requests to `localhost`/`127.0.0.1`
  (`Origin` host must equal `Host`). A successful `POST /api/public/lead-intake` returns
  `201 LEAD_CREATED` and inserts a row into `public.leads`.
