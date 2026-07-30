# Processor register — Phase 3A1

Code mirror: `src/features/legal/processor-register.ts`.

**No signed DPA claims.** `noSignedDpaClaimed()` must return `true` for all entries.

## Current

| Provider | Status | Purpose |
| --- | --- | --- |
| **Supabase** | `current` | Database, authentication and Portfolio media storage for existing admin and public Portfolio features |

Supabase notes:

- Project region: verify with owner — not asserted here
- Cross-border transfer assessment: `OWNER_DECISION_REQUIRED`
- Contract/DPA: **not claimed signed**
- Security review: `PARTIAL` — server-only keys; encryption verification pending
- Do **not** claim India-only processing

## Under review

| Provider | Status |
| --- | --- |
| Hosting provider | `under-review` — include only when verified for production |

## Planned (not active)

| Provider | Purpose | Live? |
| --- | --- | --- |
| Meta WhatsApp Business Platform | WhatsApp service communication | No |
| Groq | AI-assisted consultation drafting / summarisation | No |
| n8n | Workflow automation | No |
| Monitoring (TBD) | Uptime, error and performance monitoring | No |
| Email / SMS (TBD) | Transactional and service communication | No |
| Analytics (TBD) | Website usage analytics if separately approved | No |

All planned entries: `contractDpa: "Not signed — not active"`, `securityReview: "NOT IMPLEMENTED"`.

## Transfer and location

Processor locations and cross-border transfers will be documented before relevant features go live. India-only processing is **not** claimed.
