# Lead intake public activation runbook

## Status

Public lead collection remains **disabled by default**.

Dual gates:

1. Browser UI: `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` defaults to `copy-only`
2. Server: `ONEDECORE_LEAD_INTAKE_MODE` defaults to `disabled`

Client `active` cannot bypass a disabled server.

Canonical activation decision source (fail-closed):

- `src/features/legal/lead-intake-activation.ts` → `LEAD_INTAKE_ACTIVATION`
- Identity facts: `src/features/legal/business-identity.ts` → `BUSINESS_IDENTITY`
- Consent registry: owner-approved v1.0 with `effectiveFrom=null` until launch day
- Publication mode: `LEGAL_PUBLICATION_MODE = owner-approved` until launch day
- Server wiring: `getLeadIntakeServerEnv(..., LEAD_INTAKE_ACTIVATION)`

Generic business completeness alone never enables production intake.

## Current recorded decisions (PR #92)

- [x] Owner APPROVE of published-mode Privacy/Terms/consent package at head `2609bbca…` (2026-08-25)
- [x] `privacyTermsVersionApproved = true` (OWNER approval only; not counsel)
- [x] `serviceEnquiryCopyApproved = true`
- [x] `serviceCommunicationCopyApproved = true`
- [x] Consent candidates: `service-enquiry-v1.0`, `service-communication-v1.0`, `whatsapp-service-v1.0` (approved, **not effective**)
- [x] Privacy/Terms versions: `privacy-notice-v1.0`, `terms-of-use-v1.0` (owner-approved, **not effective**; dates null)
- [x] `LEGAL_PUBLICATION_MODE = owner-approved` (not `published`)
- [x] Counsel reference null — **NO COUNSEL REVIEW YET**
- [ ] `leadProcessorsRegistered = false` until provider evidence below is complete
- [ ] Owner authorize-to-collect / launch-day sequence

### OWNER_PROVIDER_EVIDENCE_REQUIRED (blocks processor flag)

**Current website-lead processors:** Supabase (current) + Hostinger VPS (under-review). Planned Meta/Groq/n8n/analytics/email-SMS are out of scope for this gate.

1. **Supabase (project OneDecore / `lpurlfmpvriyvpkujvyl` / ap-south-1 Mumbai)**
   - Confirm account acceptance of current Supabase Terms + published DPA (`https://supabase.com/legal/dpa`) — record acceptance/version date (bespoke countersigned DPA is **not** claimed)
   - Confirm review of current official sub-processor list/schedule
2. **Hostinger VPS**
   - Contracting / legal entity name from the ONEDECORE Hostinger account, invoice, or contract
   - VPS / server region or location from Hostinger account or server panel
   - Applicable Hostinger privacy / data-processing terms or DPA for this account

Do **not** invent any of the above. Do **not** set `leadProcessorsRegistered=true` until these are recorded in `processor-register.ts`.

## Unresolved activation blockers

### Owner / legal

- [x] Identity / contact / jurisdiction / retention / rate limits / CRM manual assignment (recorded)
- [x] Privacy/Terms + lead-path consent owner approvals (recorded; not effective)
- [ ] Processor diligence (above)
- [ ] Launch-day: set published mode + real effective dates + effectiveFrom on v1.0 consents
- [ ] Owner approval to collect production leads / execute launch sequence

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

## Launch-day atomic invariant (DO NOT run from this PR)

In one controlled code/config activation commit + production build:

```text
LEGAL_PUBLICATION_MODE = published
PRIVACY_NOTICE_EFFECTIVE_DATE = <ACTUAL YYYY-MM-DD activation date>
TERMS_OF_USE_EFFECTIVE_DATE = <same date>
service-enquiry-v1.0 / service-communication-v1.0 / whatsapp-service-v1.0 → effectiveFrom = <same date>
privacyTermsVersionApproved = true
serviceEnquiryCopyApproved = true
serviceCommunicationCopyApproved = true
leadProcessorsRegistered = true   # only after evidence recorded
```

Production environment **before** build:

```text
NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=active
ONEDECORE_LEAD_INTAKE_MODE=enabled
ONEDECORE_TRUST_PROXY=true
ONEDECORE_SHOP_PUBLIC_ENABLED=false
NEXT_PUBLIC_SUPABASE_URL=<managed ONEDECORE project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<public key>
SUPABASE_SERVICE_ROLE_KEY=<server secret, never printed>
ONEDECORE_LEAD_HASH_SECRET=<server secret >=32 chars, never printed>
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
