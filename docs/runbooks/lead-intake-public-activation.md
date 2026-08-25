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
- Server wiring: `getLeadIntakeServerEnv(..., LEAD_INTAKE_ACTIVATION)`

Generic business completeness alone never enables production intake.

## Unresolved activation blockers

Do **not** mark these complete until owner evidence exists.

### Owner / legal (blocks form activation)

Record answers into `BUSINESS_IDENTITY` and `LEAD_INTAKE_ACTIVATION` only after owner confirmation.

- [x] `legalEntityName` / proprietor identity = **ONEDECORE** (owner-supplied exactly; no personal name substituted)
- [x] `entityType` = proprietorship
- [x] `registeredOfficeAddress`
- [x] `operatingOfficeSameAsRegistered=true`
- [x] `businessEmail` = onedecore@gmail.com
- [x] `privacyEmail` = onedecore@gmail.com; combined privacy/grievance/data-rights mapping **APPROVED**
- [x] `authorisedRepresentative` = ONEDECORE; `grievanceContact` = ONEDECORE, Proprietor / Grievance Contact
- [x] `jurisdictionClause` = owner-approved Pune/Maharashtra draft (**NOT COUNSEL REVIEWED**)
- [x] `legalCounselApprovalReference` — **optional**; status **NO COUNSEL REVIEW YET** (null; not fabricated)
- [ ] Privacy/Terms publication approval (`privacyTermsVersionApproved` remains false) — awaiting APPROVE | REVISE on revised published copy in `docs/legal/pr92-owner-legal-copy-review.md`
- [ ] Service enquiry consent copy approval (`serviceEnquiryCopyApproved` remains false) — revised enquiry expanded text (CRM/consent/abuse; no “solely”)
- [ ] Service communication consent copy approval (`serviceCommunicationCopyApproved` remains false)
- [x] Retention decisions: lead / consent / audit / suppression (MVP text approved 2026-08-25)
- [ ] Lead processors registered / reviewed for production intake (Supabase region recorded; DPA + Hostinger legal entity/region/terms still open)
- [ ] Owner approval to collect production leads

See final copy package: `docs/legal/pr92-owner-legal-copy-review.md`

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

Current `submit_lead_intake` thresholds (unchanged):

| Scope | Threshold | Window | Retry-After |
|-------|-----------|--------|-------------|
| Network | 5 | 15 minutes | 900s |
| Network | 20 | 24 hours | 3600s |
| Phone (CREATED) | 3 | 24 hours | 3600s |

Owner decision (2026-08-25): **APPROVE CURRENT LIMITS FOR MVP**. Do not change SQL thresholds without a new owner decision.

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
- [ ] Confirm no marketing capture paths were enabled

## Production env (set before build)

`NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` is **build-time**. Set it **before** `npm run build`.

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

Do **not** enable `ONEDECORE_LEAD_INTAKE_MODE=enabled` until `LEAD_INTAKE_ACTIVATION` + identity + rate-limit confirmation are complete.

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
14. API disabled/validation semantics check without creating a lead
15. Controlled browser E2E with owner participation
16. CRM verification
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

Then owner verifies `/admin/crm/leads` visibility (table + pipeline + detail). Optional controlled CRM ops: manual assign / note / follow-up. No outbound WhatsApp/email/SMS.

## Safe local-only exercise

For local verification only:

1. `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=active`
2. `ONEDECORE_LEAD_INTAKE_MODE=local-test`
3. Loopback `NEXT_PUBLIC_SUPABASE_URL` (`http://127.0.0.1:<port>` root path)
4. Local service-role key and hash secret
5. Clean all local synthetic rows after testing
6. Return both flags to `copy-only` + `disabled` before ending the session

## Forbidden without new authority

- Production deployment of enabled intake
- Setting `ONEDECORE_LEAD_INTAKE_MODE=enabled` while legal gates are incomplete
- Fabricating owner/legal approval
- Publicly enabling the homepage form while Privacy/Terms remain draft/not-effective
- WhatsApp API messaging, Groq, n8n, campaigns, or analytics wiring
- Changing shop gate or touching M38 / online payments
