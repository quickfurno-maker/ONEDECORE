# Final architecture certification — 2026-09-10

**Repository SHA audited:** `ec1faf481cfce1aebf5557700371d71639f7e170` (the PR #168 merge; clean worktree)
**Managed project:** `lpurlfmpvriyvpkujvyl`, 69 migrations, PostgREST 14.5
**Production deployed SHA:** `9fe5838574017aa74e5e6e2aae248b86000c0b42`
**Verdict:** certified for deployment. One blocker was found in the first pass and cleared before this one; it is recorded below rather than omitted.

Every managed query was read-only. Nothing was deployed, applied, activated or mutated.

---

## 1. Four planes

| Plane | State | Classification |
| :--- | :--- | :--- |
| REPOSITORY | `ec1faf48`, 69 migrations, Lanes 1–6 merged (#163–#168) | PASS |
| MANAGED_DB | 69 migrations, tail `20260910130000_drop_redundant_shadow_indexes` | PASS |
| PRODUCTION_RUNTIME | `9fe5838574…`, six lanes behind main | EXPECTED_PREDEPLOY_DRIFT |
| FEATURE_ACTIVATION | Owner-gated and untouched | PASS |

Repository and managed database agree. Production runs the application from before the hardening programme, which is the drift this certification exists to close.

Feature activation, read from managed row counts: `portfolio_projects` 0, `portfolio_media` 0, `campaigns` 0, `quotation_access_grants` 0, `commerce_products` 3, `quotations` 1, `leads` 66, `staff_employment_profiles` 1. Nothing was activated.

---

## 2. The blocker that was found and cleared

**`QUOTATION_CAPABILITY_SECRET` was absent from production.** (Plane: PRODUCTION_RUNTIME.)

It is one of exactly five keys the repository's own contract marks `lifecycle: required` — not activation-gated — and it signs the capability tokens that let a customer open and accept a quotation without an account. The first audit pass returned `FINAL_ARCHITECTURE_REAUDIT_BLOCKED` on it.

The failure would have been lazy and fail-closed rather than a security exposure:
`deriveQuotationCapabilityToken` throws `QUOTATION_CAPABILITY_SECRET_MISSING` only when a token is minted, so the application boots and the homepage, lead intake and CRM are unaffected. The quotation send-and-accept path would have broken at first use.

It is now present: 64 characters, above the 32-byte minimum the code enforces. The production env file holds 15 keys, up from 14.

Recorded here because a certification that quietly omits a finding it previously raised is not a certification.

---

## 3. GitHub governance

| Item | State |
| :--- | :--- |
| Visibility | public (owner's decision) |
| Default branch | `main` |
| Rulesets | **0** — empty |
| Classic branch protection | active |
| Required checks | Application Quality, Database Quality |
| Strict (up-to-date) | yes |
| Admins enforced | yes |
| Force pushes / deletions | disabled / disabled |
| Conversation resolution | required |
| Required approvals | 0 |
| PRs #163–#168 | all MERGED |
| Open PRs | 1 — #147, self-labelled DO NOT MERGE, superseded by #148 |

Both surfaces were checked. The rulesets list being empty is why a rulesets-only audit misreads this repository as unprotected; classic protection is what is in force. No governance endpoint was blocked by permission.

---

## 4. Repository inventory and isolation

1,576 tracked files · 18 feature directories · 34 API routes under `src/app/api` · 54 admin pages · 20 public pages · 144 application test files · 60 database test files · 69 migrations · 1 workflow · 83 audit documents.

**Cross-project isolation: no runtime coupling.** Searching the whole repository for QuickFurno, Jarvis and the two foreign IPs returns matches in exactly two shapes:

- **TEST_FIXTURE (negative assertion)** — five test files list `jarvis` / `QuickFurno` among *forbidden* terms, asserting they do **not** appear in rendered output or CRM analytics.
- **HISTORICAL_DOC_ONLY** — `src/features/legal/processor-register.ts` records the billing account name for the Supabase organisation and the VPS invoice. A factual processor record, not a code path, credential or shared endpoint.

No `BAD_RUNTIME_REFERENCE`. No `BAD_SECRET_REFERENCE`.

## 5. Secret hygiene

No tracked `.env` file. Credential-shaped scanning across all tracked files resolves to:

- `.github/workflows/quality-gate.yml` — a JWT that decodes to `{"iss":"supabase-demo","role":"anon"}`: the public Supabase CLI demo key, documented as such in a comment beside it, used only to satisfy build-time public env validation, and unable to reach the managed project.
- Test and tooling files — `sb_secret_`, `eyJ`, PEM headers appearing inside **forbidden-token lists**, i.e. assertions that such shapes must not appear in a module.

No service-role token, database password, SSH key or production secret is tracked.

---

## 6. Environment and production runtime

`npm run verify:env` → 47 contract keys, `.env.example` 44 active, 32 activation-gated.

| Required key (5 of 5 present) | Length | Note |
| :--- | ---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | 40 | `https://lpurlfmpvriyvpkujvyl.supabase.co` — the managed project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 46 | public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | 219 | distinct from the publishable key |
| `ONEDECORE_LEAD_HASH_SECRET` | 64 | |
| `QUOTATION_CAPABILITY_SECRET` | 64 | added since the first pass |

No secret sits under a `NEXT_PUBLIC_` name. Values were never read except for the three keys explicitly classified non-secret.

`ONEDECORE_LANDING_LAB_HMAC_SECRET`: **OPTIONAL_INACTIVE_FEATURE** — `lifecycle: activation-gated` in the contract, absent in production, and the Landing Lab is not activated. Not required for this deployment.
`ONEDECORE_CAMPAIGN_EXECUTION_SECRET`: absent and not in the 47-key registry at all.

| Runtime | Observed |
| :--- | :--- |
| Host | `onedecore-prod` |
| App path / branch / worktree | `/var/www/onedecore`, `main`, clean |
| Env file | `onedecore:onedecore`, mode `600` |
| PM2 | app `onedecore`, **online**, 3 restarts, user `onedecore`, cwd `/var/www/onedecore` |
| Next bind | `127.0.0.1:3000` only — not publicly reachable |
| Nginx | `server_name onedecore.in www.onedecore.in` → `proxy_pass http://127.0.0.1:3000` |
| Proxy headers | `Host`, `X-Real-IP`, `X-Forwarded-Proto`, and `X-Forwarded-For $remote_addr` |

`ONEDECORE_TRUST_PROXY=true` is correct **because** Nginx sets `X-Forwarded-For` to `$remote_addr` rather than appending to a client-supplied chain — a client cannot inject a spoofed forwarded address.

`ONEDECORE_LEAD_INTAKE_MODE=enabled`.

Live baseline (GET only, no form submitted): `/` 200, `www` 200, `/interiors` 200, `/portfolio` 200, `/auth/login` 200, `/admin` 307 → `/auth/login?portal=admin`, `/api/health` 200. All carry `X-Frame-Options` and `X-Content-Type-Options`.

---

## 7. Local validation on the exact SHA

Node v24.18.0 · npm 11.16.0 · Supabase CLI 2.109.1

| Check | Result |
| :--- | :--- |
| `npm ci` | clean |
| `verify:tests` | 144 files (application 142, image 1, integration 1) |
| `verify:env` | 47 keys |
| `verify:dependencies` | 0 unreviewed production high/critical |
| `lint` | **0 errors**, 39 pre-existing warnings |
| `typecheck` | clean |
| `test:app` | **3,856 pass, 0 fail** |
| `test:image` | 17 pass |
| `build` / `check` | clean |
| `db:reset` | all 69 migrations apply from zero |
| `check:db` | 60 files, **3,521 assertions, PASS** |
| Commerce D1 concurrency | 3 pass |
| `git diff --check` | clean |
| `npm audit` (full / production) | 0 critical, 0 high, 3 moderate |

`check:db` ran before the concurrency suite, and includes `verify:db-types`.

---

## 8. Rendering and HTTP security

`next build`: **11 static / 108 dynamic**. `/` and `/interiors` are both statically prerendered.

*A correction to earlier records:* Lane 5 reported 10/108 and Lane 6 reported 9/106. Both used extraction patterns that dropped tree-prefix lines from the route table; each comparison was internally consistent, so the conclusions drawn from them stand, but the accurate absolute count is 11/108. The invariant that mattered — homepage and `/interiors` static — held at every point.

Source configuration re-certified from `src/config/http-security.ts`:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()

Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lpurlfmpvriyvpkujvyl.supabase.co; font-src 'self' data:; connect-src 'self' https://lpurlfmpvriyvpkujvyl.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; manifest-src 'self'; worker-src 'self' blob:
Strict-Transport-Security: max-age=31536000
```

No `unsafe-eval`, no wildcard, no wildcard Supabase host, no `http://`, no loopback origin. HSTS carries neither `includeSubDomains` nor `preload`. Development ships four headers and neither CSP nor HSTS.

**Live production carries neither CSP nor HSTS** — `EXPECTED_PREDEPLOY_DRIFT`, because production runs a SHA that predates Lane 5. The source contract is intact; it becomes live on deployment and is mandatory in post-deploy certification.

---

## 9. Dependency security

Production audit: **0 critical, 0 high, 3 moderate.** Full audit identical.

The three moderates are the reviewed Lane 5 set, re-confirmed against the current lock graph: `csv-parse` GHSA-8cw4-87c7-c6xx at `node_modules/csv-parse` and `uuid` GHSA-w5hq-g745-h8pq at `node_modules/uuid`, with `exceljs` carrying no advisory of its own. `sharp` is **0.35.4**.

The guard matches an exception on the whole identity — advisory, package, severity and installed node path — fails stale and duplicate exceptions, and validates `reviewBy` as a real calendar date. **No exception file exists**, because nothing high or critical remains; the rules are exercised with synthetic fixtures.

---

## 10. Untrusted file boundaries

XLSX Gate 1 (structure and declarations) and Gate 2 (actual bounded decompression) both intact: 5 MiB compressed, 256 entries, 16 MiB actual per entry, 32 MiB actual aggregate, 250× declared ratio; ZIP64, encrypted entries, macro projects, traversal, absolute paths and unsupported compression methods rejected; local header signature, method agreement and byte range validated; actual-versus-declared mismatch rejected.

The lying-central-directory regression re-run: an archive declaring 1 MiB that actually inflates to 17 MiB is **accepted by Gate 1, refused by Gate 2, and the ExcelJS loader is called zero times**. 51 of 51 tests pass.

Image pipeline unchanged: JPEG/PNG/WebP only, 20 MiB, 12,000 px, 50 MP, `limitInputPixels`, single-page only, explicit output encoders, metadata stripped. 17 of 17 tests pass.

---

## 11. Managed database

| Metric | Value |
| :--- | ---: |
| Migrations (repo / managed) | 69 / 69, no drift |
| Public tables | 117 |
| Public tables without RLS | **0** |
| FORCE RLS tables | 24 |
| Policies | 148 |
| Public / private functions | 245 / 320 |
| SECURITY DEFINER / INVOKER | 429 / 136 |
| Public indexes | 322 |
| Duplicate index shapes | **0** |
| Triggers / extensions | 144 / 5 |
| Views / materialized views | 0 / 0 |

**`authenticated` holds TRUNCATE, TRIGGER and REFERENCES on zero public tables** — only DELETE (17), INSERT (11), SELECT (111) and UPDATE (10). Lane 2's hardening holds.

Grants and effective RLS are separate facts and are reported separately: a grant permits the verb, RLS decides the rows, and the six no-policy tables below are protected by the *absence* of a policy rather than by a grant.

### Advisor reconciliation

| Finding | Count | Identity | Classification |
| :--- | ---: | :--- | :--- |
| RLS enabled, no policy | 6 | `quotation_access_grants`, `whatsapp_business_accounts`, `whatsapp_message_status_events`, `whatsapp_phone_numbers`, `whatsapp_templates`, `whatsapp_webhook_events` | INFO — intentional service-only tables; no policy means no `anon`/`authenticated` row is visible |
| anon-executable SECURITY DEFINER | 7 | `accept_quotation_by_capability`, `check_public_commerce_pincode`, `get_public_commerce_product`, `get_quotation_by_capability`, `list_public_commerce_categories`, `list_public_commerce_sitemap`, `search_public_commerce_products` | WARN — exactly the approved public/capability surface |
| authenticated-executable SECURITY DEFINER | 152 | — | WARN — the application RPC surface |
| Unindexed foreign keys | 164 | public + private | DEFERRED — 98 are audit/actor columns nothing queries by |
| Zero-scan public indexes | 199 | — | DEFERRED — unused features at 66 leads, not wrong indexes |
| Multiple permissive policies | 1 | `consent_events`: `consent_events_select_crm_scoped` and `consent_events_select_marketing_staff` | WARN — intentionally distinct; a CRM-scoped read and a marketing-staff read are different authorities and were not merged to silence the advisor |

Every identity matches the approved architecture. **No new or unexplained exposure.**

An exhaustive per-function SECURITY DEFINER manifest across all 429 functions remains `OPTIONAL_FUTURE_GOVERNANCE`; the exposure-bearing subset — the 7 anonymous functions — is enumerated above and unchanged.

### Out-of-band drift

Migration sequences match at 69 with no managed-only or missing version. The Lane 6 index change is visible in the managed catalog exactly as shipped: the three plain indexes are absent, the three UNIQUE constraint indexes remain, and the public index count moved 325 → 322. No `db pull` was run and no repository file was overwritten from the managed catalog.

---

## 12. Authorization

`public.authorize_many(text[])` in the managed catalog: `SECURITY INVOKER`, `STABLE`, `search_path=""`, returns `jsonb`, `anon` EXECUTE **false**, `authenticated` EXECUTE **true**, body delegates to `public.authorize(code)`, request set bounded at 50 and deduplicated.

It does not reimplement the RBAC join. Every denial path — `auth.uid()`, `private.staff_access_denied`, active role, active permission, active profile — remains in `private.has_permission` and nowhere else.

`supabase/tests/database/59_authorize_many_equivalence_test.sql` compares the two functions code-by-code for a granted executive, a suspended profile, an inactive role, revoked app access, a user with no role and a session with no subject: 27 assertions, all passing in a full `db reset` run.

Nothing caches a permission. `authorize_many` batches one request's questions into one round trip; it does not persist an answer between requests or between identities, and an application test asserts two clients standing for two users receive two different answers.

---

## 13. API and service-role boundary

34 routes under `src/app/api`. Exactly three carry no staff-auth helper, and all three are correct by design:

| Route | Class | Mechanism |
| :--- | :--- | :--- |
| `public/lead-intake/readiness` | PUBLIC_READ | server-authoritative readiness; no secrets in the response |
| `public/lead-intake` | PUBLIC_MUTATION | schema validation, consent version pinning, network and phone rate limiting, idempotency |
| `webhooks/meta/whatsapp` | WEBHOOK | `x-hub-signature-256` HMAC verified before the payload is processed |

Every other route resolves through `resolveCrmMobileAuth`, `requireStaffPermission`, `requireCrmReadAccess` or a capability check. No GET performs a mutation; no route selects a table or RPC from the request body.

The service-role factory is `import "server-only"` and resolves through the validated runtime target. No service-role client is imported into a client component, and no `NEXT_PUBLIC_` name carries a secret or service-role value.

---

## 14. Public lead intake (v4)

One canonical path: `POST /api/public/lead-intake` with `GET /api/public/lead-intake/readiness`. No legacy alternate submit path exists.

Consent mapping is exactly the two required purposes:

```
p_consent_service_enquiry: true
p_consent_service_phone:   true
p_consent_service_email:   <only when the visitor supplied an email channel>
p_consent_whatsapp:        <only when explicitly granted>
```

The v4 form never sends `whatsappService`, and the validator **refuses** a body that claims WhatsApp consent under the v3/v4 contract rather than silently recording `false` — a request claiming a permission no visitor was offered is rejected, not normalised. Marketing consent is never inferred at intake.

No submission was made against production during this audit.

---

## 15. Domain contracts

Re-certified by the 3,856 application assertions and 3,521 database assertions on this SHA, all passing: CRM latest-first inbox and separate sales-priority pipeline, scope and budget on list and detail, assignment, first contact, My Day, notes, events, follow-ups, sales temperature, manager and super-admin boundaries, lead tombstone governance, super-admin-only bulk import; quotation draft/revision/finalisation, capability access and acceptance, PDF lifecycle, the Closed-Won invariant, project materialisation and handover, design and execution workflows; commerce catalogue, inventory, storefront, COD order state, tax, shipping, media and concurrency; workforce identity, credentials, attendance, leave, salary statements and payment ledger; WhatsApp inbox access, send intents, dispatch, status events and service-only tables; Landing Lab secret-domain separation, publication, experiment and exposure.

Portfolio holds 0 projects and 0 media in the managed database. That is an empty feature awaiting owner content, not a defect, and no content was fabricated.

---

## 16. Performance closeout

Lane 6's claims were checked against the code and the managed catalog rather than its own audit document.

Present: `authorize_many` batching in `src/server/auth/authorize-many.ts` and the ten converted probe helpers; the CRM access context resolving 21 permissions in one round trip; the admin navigation reduced from 99 authorization round trips to 26. Absent: any new performance index. Exactly three structurally redundant indexes dropped, their UNIQUE replacements present, zero duplicate shapes remaining.

**Deferred:** the My Day RLS finding. `private.crm_can_view_lead` evaluates up to four `authorize` calls per row, which costs 880–915 ms against a 10,000-lead local fixture where an InitPlan-equivalent policy shape measured 271–313 ms. The helper spans roughly 13 policies and 12 functions, so the rewrite is a security-boundary change needing its own five-role proof. Classified **DEFERRED_PERFORMANCE_HARDENING**: at 66 managed leads it is not release-blocking, and no fresh evidence contradicts that.

---

## 17. Production-versus-main drift

| Category | Repository main | Managed DB | Production | Action after certification |
| :--- | :--- | :--- | :--- | :--- |
| Application SHA | `ec1faf48` | — | `9fe58385` | Deploy `ec1faf48` |
| Migrations | 69 | 69 | — | None |
| `authorize_many` | present | present | not used by deployed app | Becomes active on deploy |
| Three dropped indexes | dropped | dropped | — | None |
| Generated types | current | — | — | None |
| CSP / HSTS | configured | — | **absent** | Becomes live on deploy; verify |
| Dependency versions | sharp 0.35.4 | — | older lock | Resolved by `npm ci` |
| XLSX Gate 2 | present | — | absent | Becomes active on deploy |
| Permission batching | present | — | absent | Becomes active on deploy |
| Route rendering | 11 static / 108 dynamic | — | older | Re-verify after deploy |
| Env contract | 47 keys | — | 15 keys, 5/5 required | None |

### Backward compatibility of migrations 68 and 69

Managed is ahead of the deployed application by two migrations. Both are safe for the running app:

- **#68 `authorize_many`** *adds* a function. `public.authorize` is untouched and still granted to `authenticated`. The deployed application never calls `authorize_many`, so the addition is invisible to it.
- **#69 index drop** removes three plain btrees whose UNIQUE constraint indexes — same table, same columns, same order — remain. Every read the dropped indexes could serve is served identically by the surviving index, so no query on the deployed application loses a path, and the constraints they backed are unchanged.

No breaking change. **Deploying is a forward step from a compatible state, not a repair of a broken one.**

---

## 18. Findings

| Classification | Count | Items |
| :--- | ---: | :--- |
| BLOCKER | **0** | `QUOTATION_CAPABILITY_SECRET` was one; cleared before this pass |
| EXPECTED_PREDEPLOY_DRIFT | 2 | production application SHA; live CSP/HSTS absent |
| DEFERRED | 3 | My Day RLS InitPlan rewrite; `has_active_role` batching; duplicate resolver overlap across staff/attendance/leave probes |
| WARN | 0 | — |
| UNVERIFIED | 0 | — |

Advisor findings (164 unindexed FKs, 199 zero-scan indexes, 6 no-policy tables, 7 anonymous SECURITY DEFINER functions, 152 authenticated ones, 1 multiple-permissive-policy) are reconciled to the approved architecture in §11 and are not defects.

---

## 19. Deployment prerequisites

1. This certification PR merged.
2. Deploy SHA recorded as the merge commit of this PR.
3. Rollback SHA recorded: `9fe5838574017aa74e5e6e2aae248b86000c0b42`.
4. Managed database still at 69 and aligned.
5. All five required production env keys present — verified in this audit.
6. Production worktree clean before pulling.
7. Deterministic `npm ci` and build; PM2 restart as the `onedecore` user via `systemctl restart pm2-onedecore` (never `pm2 restart` as root).

## 20. Post-deployment certification checklist

Not executed here.

- [ ] A — audit PR merged
- [ ] B — exact deploy SHA recorded
- [ ] C — managed DB still 69 and aligned
- [ ] D — required production env keys present
- [ ] E — rollback SHA recorded
- [ ] F — production worktree clean
- [ ] G — deterministic `npm ci` / build / deploy
- [ ] H — PM2 restart under `onedecore`
- [ ] I — `/api/health`
- [ ] J — `/`
- [ ] K — `/interiors`
- [ ] L — `/portfolio`
- [ ] M — `/auth/login`
- [ ] N — `/admin`
- [ ] O — CSP and HSTS confirmed on real production
- [ ] P — one genuine owner-controlled v4 lead submission
- [ ] Q — that lead reaches the managed database
- [ ] R — CRM list and detail show scope and budget
- [ ] S — no duplicate or lost lead
- [ ] T — auth and admin behaviour
- [ ] U — backend/API contract freeze

---

## 21. Verdict

The repository at `ec1faf481cfce1aebf5557700371d71639f7e170` and the managed database at 69 migrations agree, the security boundaries established across the six hardening lanes are present in both planes, and the two migrations the managed database holds ahead of the deployed application are backward compatible with it.

The remaining differences between the repository and production are the deployment itself. **Certified to proceed to deployment**, subject to the prerequisites in §19 and the post-deployment certification in §20.

This is a statement about the evidence gathered on this date, listed above. It is not a claim that no defect exists.
