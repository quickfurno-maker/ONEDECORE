# Lead intake HMAC secret rotation

## Purpose

`ONEDECORE_LEAD_HASH_SECRET` derives request, network, and phone fingerprints for lead intake rate limiting and idempotent replay detection. Rotate only when compromised, leaked, or scheduled for periodic renewal.

## Ownership

- Owner: ONEDECORE platform owner / security owner
- Secret must have at least 32 characters of high entropy
- Never commit the secret to source control
- Never log the secret value, partial secret, or derived fingerprints in application logs

## Staging test

1. Apply the candidate secret in a non-production environment with `ONEDECORE_LEAD_INTAKE_MODE=local-test` only.
2. Confirm local synthetic create and identical-payload replay still succeed.
3. Confirm rate-limit paths still return HTTP 429 with `Retry-After`.
4. Confirm conflict recovery still works when the payload changes under the same key.

## Maintenance window

1. Schedule a short maintenance window if public intake is enabled.
2. Prefer disabling public collection (`ONEDECORE_LEAD_INTAKE_MODE=disabled`) during cutover so in-flight clients receive a safe 503 UX.
3. Update the secret in the hosting secret store only (never in git).
4. Restart the application process so all workers load the new secret.
5. Re-enable intake only after owner/legal activation gates are still satisfied.

## Continuity impact

- **Rate-limit continuity:** Existing fingerprint windows based on the old secret will not match new fingerprints. Callers may receive a fresh rate-limit window after rotation.
- **Idempotent replay:** In-flight clients retrying with an old request hash cannot collide with new hashes. Treat post-rotation retries as new fingerprints for hash-derived keys; database idempotency keys (UUID) remain authoritative for request identity.
- **Replay-window policy:** Do not attempt to dual-read old and new secrets in this phase. Accept a clean break at rotation time.

## Rollback

1. Restore the previous secret from the secure store.
2. Restart application workers.
3. Keep public intake disabled until verification completes.
4. Record the incident and rotation outcome in the security log (no secret material).

## Production sign-off

Required before rotating a production secret while intake is enabled:

- Owner approval for the maintenance window
- Confirmation that legal publication / lead activation gates remain unchanged by this rotation
- Confirmation that monitoring/alerts will catch elevated 429/503 rates
- Confirmation that the secret is not present in git history, CI logs, or chat transcripts

Do not implement multi-key dual-HMAC storage in this phase.
