# PR #92 - Owner legal approval + activation readiness (internal)

## Internal review status (NOT customer-facing)

- Owner decision on published-mode package at `2609bbca1ba661989fd0e8f468b0724a47adcd5d`: **APPROVE** (2026-08-25)
- This is **OWNER APPROVAL only** — **NO COUNSEL REVIEW YET**
- `legalCounselApprovalReference` = null
- `LEGAL_PUBLICATION_MODE` = **owner-approved** (not published)
- Effective dates = null (set only on authorized production activation)
- Approval flags:
  - `privacyTermsVersionApproved = true`
  - `serviceEnquiryCopyApproved = true`
  - `serviceCommunicationCopyApproved = true`
  - `leadProcessorsRegistered = false`
- Lead intake: not activated
- Shop gate: fail-closed / unchanged
- M38 / online payments: untouched

## Exact approved versions

| Instrument | Version | State |
|---|---|---|
| Privacy Notice | `privacy-notice-v1.0` | owner-approved, not effective |
| Terms of Use | `terms-of-use-v1.0` | owner-approved, not effective |
| Service enquiry | `service-enquiry-v1.0` | owner-approved, effectiveFrom null |
| Service communication | `service-communication-v1.0` | owner-approved, effectiveFrom null |
| WhatsApp (optional) | `whatsapp-service-v1.0` | owner-approved, effectiveFrom null |

## Approval vs effective separation

- Owner-approved publication mode shows customer copy with "not yet effective" chrome
- Published mode is fail-closed without a real `YYYY-MM-DD` effective date
- Approved consent v1.0 cannot be treated as effective evidence until `effectiveFrom` is set
- `getEffectiveConsentVersionByPurpose` throws while pre-activation
- `enabled` intake requires: activation flags + processor diligence + effective consents + published dates

## OWNER_PROVIDER_EVIDENCE_REQUIRED

Current website-lead processors only:

1. Supabase — confirm account Terms/DPA acceptance date/version for published DPA at `https://supabase.com/legal/dpa`; review current sub-processor list (project `lpurlfmpvriyvpkujvyl`, ap-south-1 / Mumbai already recorded)
2. Hostinger VPS — legal/contracting entity from account/invoice; VPS region/location from account/panel; applicable privacy/DPA terms

Do not invent. Do not flip `leadProcessorsRegistered` until recorded.

Exact customer-facing published Privacy/Terms/consent texts remain those approved at head `2609bbca…` (see prior revision report / content modules).
