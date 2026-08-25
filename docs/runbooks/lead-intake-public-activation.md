# Lead intake public activation runbook

## Status

Legal/consent activation state is **published and effective from 2026-08-25** in the production-launch code slice (owner authorized production lead collection 2026-08-25 IST).

Public lead collection remains **disabled by default at runtime** until VPS deployment sets environment variables.

Dual gates:

1. Browser UI: `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` defaults to `copy-only`
2. Server: `ONEDECORE_LEAD_INTAKE_MODE` defaults to `disabled`

Client `active` cannot bypass a disabled server.

Canonical activation decision source (fail-closed):

- `src/features/legal/lead-intake-activation.ts` → `LEAD_INTAKE_ACTIVATION`
- Identity facts: `src/features/legal/business-identity.ts` → `BUSINESS_IDENTITY`
- Consent registry: lead-path v1.0 effective from **2026-08-25**
- Publication mode: `LEGAL_PUBLICATION_MODE = published`
- Privacy/Terms effective date: **2026-08-25**
- Server wiring: `getLeadIntakeServerEnv(..., LEAD_INTAKE_ACTIVATION)`

Generic business completeness alone never enables production intake.

## Recorded decisions

### PR #92 (merged)

- [x] Owner APPROVE of published-mode Privacy/Terms/consent package at head `2609bbca…` (2026-08-25)
- [x] Processor diligence (Supabase + Hostinger, 2026-08-25)
- [x] `leadProcessorsRegistered = true`

### Production launch PR (legal/consent effective in code)

- [x] Owner authorized production lead collection **2026-08-25 IST**
- [x] `LEGAL_PUBLICATION_MODE = published`
- [x] `privacy-notice-v1.0` / `terms-of-use-v1.0` effective **2026-08-25**
- [x] `service-enquiry-v1.0`, `service-communication-v1.0`, `whatsapp-service-v1.0` → `effectiveFrom = 2026-08-25`
- [x] Counsel reference null — **NO COUNSEL REVIEW YET**
- [ ] VPS deployment with production env (see below)
- [ ] Controlled post-deploy E2E certification

### Processor evidence recorded (2026-08-25)

**Current website-lead processors:** Supabase + Hostinger VPS (both `current`). Planned Meta/Groq/n8n/analytics/email-SMS are out of scope for this gate.

1. **Supabase (project OneDecore / `lpurlfmpvriyvpkujvyl` / ap-south-1 Mumbai)**
   - Owner reviewed current Supabase Terms + published DPA (`https://supabase.com/legal/dpa`) and Schedule 3 sub-processors
   - Historical account-acceptance timestamp not independently available; current owner review confirmed 2026-08-25
   - Bespoke countersigned DPA is **not** claimed
2. **Hostinger VPS**
   - Contracting entity: **HOSTINGER PTE LTD** (India Group No. 1 per official Hostinger list)
   - VPS location: Mumbai, India (`srv1927220.hstgr.cloud`, IPv4 91.108.105.192, geofeed 91.108.104.0/21)
   - Owner reviewed current Hostinger Terms, Hosting Agreement, and published DPA
   - Historical account-acceptance timestamp not independently available; current owner review confirmed 2026-08-25

## Post-merge deployment prerequisites (VPS — not performed from Cursor)

Code gates are satisfied after merge. Production intake still requires live verification:

### Owner / legal

- [x] Identity / contact / jurisdiction / retention / rate limits / CRM manual assignment
- [x] Privacy/Terms published with effective date 2026-08-25
- [x] Lead-path consent v1.0 effective from 2026-08-25
- [x] Processor diligence complete
- [x] Owner authorized production lead collection 2026-08-25

See: `docs/legal/pr92-owner-legal-copy-review.md`

### Proxy / networking

- [ ] Reverse proxy documented to overwrite `X-Forwarded-For`
- [ ] `ONEDECORE_TRUST_PROXY=true` only after proxy overwrite is verified
- [ ] Managed Supabase HTTPS URL confirmed for `enabled` mode

### Secrets (never print values)

- [ ] Production `SUPABASE_SERVICE_ROLE_KEY` in host secret store only
- [ ] Production `ONEDECORE_LEAD_HASH_SECRET` (≥32 chars) in host secret store only
- [ ] HMAC rotation runbook reviewed (`docs/runbooks/lead-intake-hmac-secret-rotation.md`)

Safe presence checks (no value echo):

```bash
test -n "$SUPABASE_SERVICE_ROLE_KEY" && test "${#SUPABASE_SERVICE_ROLE_KEY}" -ge 20 && echo service_role_present_ok
test -n "$ONEDECORE_LEAD_HASH_SECRET" && test "${#ONEDECORE_LEAD_HASH_SECRET}" -ge 32 && echo hash_secret_present_ok
test "$SUPABASE_SERVICE_ROLE_KEY" != "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" && echo service_role_not_publishable_ok
```

### Rate limits — OWNER CONFIRMED FOR MVP

| Scope | Threshold | Window | Retry-After |
|-------|-----------|--------|-------------|
| Network | 5 | 15 minutes | 900s |
| Network | 20 | 24 hours | 3600s |
| Phone (CREATED) | 3 | 24 hours | 3600s |

Do not change SQL thresholds without a new owner decision.

### CRM / human receiving

- [x] Assignment model for MVP: **MANUAL ASSIGNMENT**
- [x] Automatic assignment rule: **NONE FOR MVP**
- [ ] Named primary owner/admin who monitors unassigned `status=new` website leads

### Monitoring

- [ ] Alerting for elevated 429 / 503 / 500 on `/api/public/lead-intake`
- [ ] Safe logging verified (no PII / secrets)

### Commerce safety (unchanged)

- [ ] `ONEDECORE_SHOP_PUBLIC_ENABLED=false`
- [ ] No M38 / online-payment worktree changes

### Rollback

- [ ] Immediate disable path: set server mode to `disabled` and form mode to `copy-only`
- [ ] Confirm homepage/interiors returns to copy-only UX without redeploying schema

## Launch-day atomic invariant (code merged; env set on VPS at deploy)

Canonical code state after production-launch PR merge:

```text
LEGAL_PUBLICATION_MODE = published
PRIVACY_NOTICE_EFFECTIVE_DATE = 2026-08-25
TERMS_OF_USE_EFFECTIVE_DATE = 2026-08-25
service-enquiry-v1.0 / service-communication-v1.0 / whatsapp-service-v1.0 → effectiveFrom = 2026-08-25
leadProcessorsRegistered = true
```

Production environment **on VPS before** build (no secret values in git):

```text
NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=active
ONEDECORE_LEAD_INTAKE_MODE=enabled
ONEDECORE_TRUST_PROXY=true
ONEDECORE_SHOP_PUBLIC_ENABLED=false
NEXT_PUBLIC_SUPABASE_URL=https://lpurlfmpvriyvpkujvyl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<existing public key>
SUPABASE_SERVICE_ROLE_KEY=<server secret only>
ONEDECORE_LEAD_HASH_SECRET=<server secret >=32 chars>
```

`enabled` mode additionally requires:

- website lead processor diligence complete
- lead-path consent versions effective
- Privacy/Terms published with real effective dates

## Post-merge deployment sequence (DO NOT run from Cursor during PR)

1. Confirm current deployed head
2. Confirm clean worktree
3. Confirm shop OFF
4. Back up `.env.production.local` on the VPS with mode 600
5. Set/verify lead activation variables without echoing secrets
6. Fetch exact approved main merge commit
7. ff-only update
8. `npm ci`
9. Production build
10. Restart PM2 with `--update-env`
11. `pm2 save`
12. Health check
13. Public form rendering check
14. API disabled/validation semantics check without creating a lead (pre-enable) / controlled checks post-enable
15. Controlled browser E2E with owner participation
16. CRM verification (unassigned `new` website leads visible; manual assign only)
17. Logs/security verification

## Controlled real production E2E (after merge/deploy only)

Owner enters one real test enquiry in the live browser UI.

Before submission: read-only counts for `leads`, `lead_intake_requests`, `consent_events`, `lead_events`.

After submission verify read-only:

- one intended intake result
- lead.status = `new`
- source/attribution preserved
- consent events only for granted channels
- no marketing consent invented
- submission reference returned
- no raw fingerprints exposed to client

Then owner verifies `/admin/crm/leads` visibility. Optional controlled CRM ops: manual assign / note / follow-up. No outbound WhatsApp/email/SMS.

## Forbidden without new authority

- Production deployment of enabled intake
- Setting `ONEDECORE_LEAD_INTAKE_MODE=enabled` while legal/processor/publication gates are incomplete
- Fabricating owner/legal/processor approval
- Setting `LEGAL_PUBLICATION_MODE=published` without a real effective date
- Publicly enabling the homepage form while Privacy/Terms remain non-effective
- WhatsApp API messaging, Groq, n8n, campaigns, or analytics wiring
- Changing shop gate or touching M38 / online payments
