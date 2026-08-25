# Processor register — Phase 3A1 / PR #92

Code mirror: `src/features/legal/processor-register.ts`.

**No bespoke signed DPA claims.** `noSignedDpaClaimed()` must remain true.

## Current website-lead processors

| Provider | Status | Notes |
| --- | --- | --- |
| **Supabase** | `current` | DB/auth/Portfolio + lead-intake/CRM. Project `lpurlfmpvriyvpkujvyl`, region **ap-south-1 / Mumbai**. Owner review confirmed 2026-08-25; historical acceptance timestamp not independently available. |
| **Hostinger VPS** | `current` | Website hosting/TLS/logs. VPS `srv1927220.hstgr.cloud`, Mumbai India (geofeed). Contracting entity **HOSTINGER PTE LTD** (India Group No. 1). Owner review confirmed 2026-08-25. |

## Planned (not active for website lead path)

Meta WhatsApp, Groq, n8n, monitoring, email/SMS, analytics — not required for `leadProcessorsRegistered` until they receive website lead data.

## Gate

`leadProcessorsRegistered` is **true** (2026-08-25) — `getMissingWebsiteLeadProcessorEvidence()` is empty.
