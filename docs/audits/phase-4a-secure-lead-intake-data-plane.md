# Phase 4A — Secure Lead Intake Data Plane Audit

## Summary

Local data plane for CRM-ready lead intake with consent evidence, idempotency, DB rate limits, and a disabled public endpoint.

## Security

- Service-role-only RPC; anon/authenticated execute revoked.
- Atomic transaction; all writes roll back on failure.
- Idempotency key + request hash; conflict on payload mismatch.
- HMAC fingerprints only; no raw network identifiers persisted.
- DB rate limits marked `OWNER_REVIEW_REQUIRED_BEFORE_PRODUCTION`.
- Append-only consent and lead events.

## Migration state

- Before: LOCAL 8 / REMOTE 8
- After: LOCAL 9 / REMOTE 8 — expected pending review
- Do not synchronize remotely in Phase 4A.

## Production blockers

`getMissingLeadIntakeActivationFields()` remains non-empty (identity, privacy/terms, consent copies, retention, processors).

## Suppression decision

`contact_suppressions` deferred to Phase 5 / WhatsApp — no weak placeholder table.
