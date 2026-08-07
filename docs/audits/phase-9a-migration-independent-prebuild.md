# Phase 9A — Migration-Independent Prebuild Audit

**Status:** Phase 9A migration-independent prebuild COMPLETE — formal Phase 9A NOT STARTED  
**Date:** August 7, 2026  
**Base:** P9-0 commit `6365f39`  
**Branch:** `phase-9a-prebuild-campaign-governance`

## Governance

- `docs/legal/02-consent-architecture.md` — MARKETING optional; WHATSAPP_SERVICE ≠ MARKETING
- `docs/08-whatsapp-and-n8n-boundary.md` — Super Admin approval mandatory
- `docs/ADR/ADR-0019-five-role-crm-authorization-model.md` — campaign role matrix
- `docs/ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md` — Kriti copy-draft only

## Delivered (P9-A)

| Area | Location |
| --- | --- |
| Marketing eligibility evaluator | `src/features/marketing/domain/marketing-eligibility.ts` |
| Campaign capability rules | `src/features/marketing/domain/campaign-capabilities.ts` |
| Lifecycle transition validation | `src/features/marketing/domain/campaign-lifecycle.ts` |
| Draft config validators | `src/features/marketing/domain/campaign-validators.ts` |
| Audience version freeze/immutability | `src/features/marketing/domain/audience-version.ts` |
| In-memory fixtures | `src/features/marketing/fixtures/campaign-fixtures.ts` |
| Campaign governance UI | `src/features/marketing/components/` |

## UI components (callback-only, PREBUILD banners)

- `CampaignDraftEditor`, `AudienceRuleBuilder`, `AudienceVersionSummary`
- `MarketingEligibilitySummary`, `CampaignApprovalPanel`, `CampaignBudgetPanel`
- `CampaignCreativePreview`, `CampaignVersionTimeline`, `PrebuildBanner`

## Tests

- `npm run test:phase-9a` (includes `test:phase-9-p0`)

## Non-actions (verified)

| Item | Status |
| --- | --- |
| M22+ | **None** |
| M19/M20/M21 modified | **No** |
| Managed writes | **0** |
| Provider mutations | **0** |
| Spend | **0** |
| CRM PII exports | **0** |
| Public routes / landing serving | **0** |
| Consent fabrication | **0** |
| Auto optimization | **0** |
| Formal Phase 9A persistence | **Deferred** |
| Phase 9C execution | **NOT STARTED** |

## Deferred formal persistence

Future Phase 9A runtime will likely need campaign/version records, audience definition versions, approval events, budget/creative snapshots, RLS, and execution authorization. **No SQL in this prebuild.**
