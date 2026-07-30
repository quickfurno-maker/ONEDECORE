# Lead intake public activation runbook

## Status

Public lead collection remains **disabled by default**.

Dual gates:

1. Browser UI: `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` defaults to `copy-only`
2. Server: `ONEDECORE_LEAD_INTAKE_MODE` defaults to `disabled`

Client `active` cannot bypass a disabled server.

## Unresolved activation blockers

Do **not** mark these complete until owner evidence exists.

### Owner / legal

- [ ] Owner approval to collect production leads
- [ ] Legal approval of consent copy versions (currently `draft-review`)
- [ ] Legal publication mode advanced beyond draft-review where required
- [ ] Lead intake activation gate fields complete (`getMissingLeadIntakeActivationFields` empty)
- [ ] Privacy notice / terms versions approved for live collection

### Proxy / networking

- [ ] Reverse proxy documented to overwrite `X-Forwarded-For`
- [ ] `ONEDECORE_TRUST_PROXY=true` only after proxy overwrite is verified
- [ ] Managed Supabase HTTPS URL confirmed for `enabled` mode

### Secrets

- [ ] Production `SUPABASE_SERVICE_ROLE_KEY` in host secret store only
- [ ] Production `ONEDECORE_LEAD_HASH_SECRET` (≥32 chars) in host secret store only
- [ ] HMAC rotation runbook reviewed (`docs/runbooks/lead-intake-hmac-secret-rotation.md`)

### CRM / human receiving

- [ ] Human receiving path defined (who sees new leads)
- [ ] CRM / admin UI not required for first activation, but ownership of follow-up is assigned
- [ ] No WhatsApp API / automation claimed as live unless separately authorised

### Monitoring

- [ ] Alerting for elevated 429 / 503 / 500 on `/api/public/lead-intake`
- [ ] Safe logging verified (no PII / secrets)

### Rollback

- [ ] Immediate disable path: set server mode to `disabled` and form mode to `copy-only`
- [ ] Confirm homepage returns to copy-only UX without redeploying schema
- [ ] Confirm no marketing capture paths were enabled

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
- Publicly enabling the homepage form
- WhatsApp API messaging, Groq, n8n, campaigns, or analytics wiring
