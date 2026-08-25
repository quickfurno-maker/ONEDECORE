# Processor register — Phase 3A1 / PR #92

Code mirror: `src/features/legal/processor-register.ts`.

**No bespoke signed DPA claims.** `noSignedDpaClaimed()` must remain true.

## Current website-lead processors

| Provider | Status | Notes |
| --- | --- | --- |
| **Supabase** | `current` | DB/auth/Portfolio + lead-intake/CRM. Project `lpurlfmpvriyvpkujvyl`, region **ap-south-1 / Mumbai**. Public DPA URL documented; account acceptance/version + sub-processor review still **OWNER_PROVIDER_EVIDENCE_REQUIRED**. |
| **Hostinger VPS** | `under-review` | Website hosting/TLS/logs. Brand from repo deployment docs. Legal entity, region, and terms still **OWNER_PROVIDER_EVIDENCE_REQUIRED**. |

## Planned (not active for website lead path)

Meta WhatsApp, Groq, n8n, monitoring, email/SMS, analytics — not required for `leadProcessorsRegistered` until they receive website lead data.

## Gate

`leadProcessorsRegistered` stays **false** until `getMissingWebsiteLeadProcessorEvidence()` is empty.
