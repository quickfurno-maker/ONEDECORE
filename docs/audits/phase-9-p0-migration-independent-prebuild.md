# Phase 9 P0 — Migration-Independent Prebuild Audit

**Status:** Phase 9A/9B migration-independent prebuild — P0 shared contracts COMPLETE  
**Date:** August 7, 2026  
**Start main:** `0c21c285005f271e9db43e06fc600ae158a97d06`  
**Branch:** `phase-9-prebuild-shared-contracts`

## Governance sources

- `docs/legal/02-consent-architecture.md` — MARKETING optional; WHATSAPP_SERVICE ≠ MARKETING
- `docs/09-phase-roadmap.md` — 9A audience/governance; 9B Landing Page Lab; 9C deferred; Phase 10 gates public serving
- `docs/08-whatsapp-and-n8n-boundary.md` — campaign approval authority
- `docs/ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md` — Kriti copy-draft only

## Shared contracts delivered

| Contract | Location |
| --- | --- |
| MarketingChannel | `src/features/marketing/contracts/channel.ts` |
| CampaignRef / CampaignVersionRef | `src/features/marketing/contracts/campaign-ref.ts` |
| CampaignLifecycleState | `src/features/marketing/contracts/lifecycle.ts` |
| CampaignTargetingMode | `src/features/marketing/contracts/targeting.ts` |
| AudienceRule / AudienceRuleGroup / AudienceVersion | `src/features/marketing/contracts/audience-rule.ts` |
| AudienceEligibilityDecision | `src/features/marketing/contracts/eligibility.ts` |
| CampaignBudgetConfig | `src/features/marketing/contracts/budget.ts` |
| CampaignCreativeSnapshot | `src/features/marketing/contracts/creative-snapshot.ts` |
| Landing refs / experiment / variant | `src/features/landing-lab/contracts/references.ts` |
| AttributionTouchpoint | `src/features/landing-lab/contracts/attribution.ts` |
| PublicationContext / SignedPublicationContext | `src/features/landing-lab/contracts/publication-context.ts` |
| TrafficDestination | `src/features/landing-lab/contracts/attribution.ts` |
| FormSubmitSuccessEvent + idempotency | `src/features/landing-lab/contracts/form-submit-success.ts` |

## Primitives

- `canonicalizeAudienceRule` / `hashAudienceRule` / `validateAudienceRule` — `src/features/marketing/domain/audience-rule-engine.ts`
- HMAC publication context sign/verify — `src/features/landing-lab/server/publication-context-crypto.ts`
- Attribution normalization — `src/features/landing-lab/domain/normalize-attribution.ts`

## Tests

- `npm run test:phase-9-p0` — 17 passing

## Non-actions (verified)

| Item | Status |
| --- | --- |
| M22+ | **None** |
| M19/M20/M21 modified | **No** |
| Managed writes | **0** |
| Provider mutations | **0** |
| Spend | **0** |
| CRM PII exports | **0** |
| Public landing serving | **0** |
| Public intake activation | **0** |
| Browser tracking SDKs | **0** |
| Consent fabrication | **0** |
| Formal Phase 9A/9B persistence | **Deferred** |
| Phase 9C | **NOT STARTED** |
