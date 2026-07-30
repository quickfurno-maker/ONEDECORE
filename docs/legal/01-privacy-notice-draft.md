# Privacy notice draft — Phase 3A1

## Public route

Draft page: `/privacy` (`src/app/(legal)/privacy/page.tsx`)

## Content source

Canonical draft sections: `src/features/legal/privacy-policy-content.ts` (`PRIVACY_POLICY_CONTENT`).

## Status

- Publication mode: `draft-review` (`LEGAL_PUBLICATION_MODE` in `legal-publication.ts`)
- Draft banner: not yet effective; owner and Indian legal-counsel review pending
- **Not DPDP compliant — compliance is not claimed through architecture alone**

## Current vs future processing truth

### Current (as deployed)

| Area | Truth |
| --- | --- |
| Homepage planner / estimator | In-browser only; inputs remain on the user's device unless copied |
| Copied brief | Not submitted to any backend |
| Contact / lead store | None from the current homepage |
| WhatsApp | Not live |
| Groq AI | Not live |
| Campaign / marketing engine | Not live |
| Payment data | Not processed |
| Consent records | Not captured on the current website |
| Processors (verified) | Supabase for existing Portfolio CMS, auth and storage only |

### Future (planned, not active)

When enquiry forms, CRM, WhatsApp, Groq, email/SMS, analytics and related features are enabled:

- Contact identity, property requirements, messages, consultation/site-visit scheduling, proposals and project delivery data
- Purpose-specific consent records with copy versioning
- Separate optional marketing and WhatsApp channel consent
- AI-assisted consultation with human review and disclosure
- Portfolio/client media reuse with separate consent
- Processors as listed in `processor-register.ts` (Meta WhatsApp, Groq, n8n, etc. — all planned or under review)

See also `DATA_INVENTORY_CURRENT_TRUTH` in `src/features/legal/data-inventory.ts`.

## Publication blockers

All mandatory identity and contact fields in `business-identity.ts` remain null pending owner input. Grievance contacts, retention schedules and signed processor agreements are unresolved.
