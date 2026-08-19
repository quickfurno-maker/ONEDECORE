# Phase 9C-C — Providers, Conversion Feedback & Metrics Implementation

**Status:** `REPOSITORY_IMPLEMENTED` + **CORRECTION GATE** (PR #71 open, not merged)
**Authority:** ADR-0031 / DEC-0085 / DEC-0086 / **DEC-0087** / OD9C-1–OD9C-18 / OD9C-A / OD9C-B / OD9C-C
**Date:** 2026-08-19
**Branch:** `phase-9c-c-providers-feedback-metrics`
**Starting main:** `fa18a362b6eb05356ccd011686ca2cf3e49dd771` (PR #70 true merge)

## Scope

Repository-only Phase 9C-C: Meta Ads + Google Ads adapters behind the existing provider port, trusted run/target attribution into existing CRM attribution, local conversion-feedback evidence, metric snapshots, fail-closed production/sharing gates, lean admin metrics UI.

## Explicitly out of scope / not done in this gate

- Managed Supabase apply (`lpurlfmpvriyvpkujvyl` remains M1–M32)
- Production Landing Lab `/lp/*` activation
- Real Meta or Google Ads mutations, spend, custom audiences, hashed PII, live conversion upload
- Production scheduler
- Phase 9D-B
- Weakening ADR-0031

## Official provider contract assumptions (2026-08-19 correction recheck)

- **Meta Marketing / Graph API:** Graph changelog fetch timed out during the correction gate. Continue **v26.0** from the prior official changelog plus loaded Marketing API v26.0 references: [Ad Campaign Group](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/), [Ad Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign), [Ad](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup), [Lead ads create](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create/). Lean website/traffic MVP uses nested `POST /act_{id}/ads` with `campaign_spec.objective=OUTCOME_TRAFFIC`, approved budget/window/geo/destination/creative only; native ON_AD lead forms are **not** invented. Insights unchanged. CAPI builder uses captured `fbc`/`fbp` only — **transport blocked**.
- **Google Ads API:** latest released major **v25** per [sunset dates](https://developers.google.com/google-ads/api/docs/sunset-dates). Search create uses `customers/{id}/googleAds:mutate` with CampaignBudget (approved `amountMicros`), PAUSED SEARCH campaign, ad group, approved keyword, RSA (official minimum 3 headlines / 2 descriptions). Click conversions: [upload clicks](https://developers.google.com/google-ads/api/docs/conversions/upload-clicks) — `conversionAction` resource from server config; exactly one of `gclid`/`gbraid`/`wbraid`. `cost_micros` → `spend_minor` by `micros / 10000`. **Transport blocked**.
- No ADR-0031 contradiction. Insufficient approved snapshot fails closed with `CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE`.

## Migration

- File: `supabase/migrations/20260821140000_campaign_metrics_conversion_feedback_foundation.sql` (repository M34, corrected in place; **no M35**)
- Git blob: `6103f3cede63eb59b82e1154e9b0475ed5ef4c0e`
- Raw SHA-256 (LF): `208626BAB69A10136F9AA214CB5D4F75F3BBEBDEF321985884DF0A1BF78E06C5`
- Pre-correction blob `f00d88277297a2234f4d07300dd11e257579fb0e` / SHA-256 `8407F056873E0C5AF642737DDE220FFEEB12A1E257C7BE22AEA80BF7556E6C46` superseded in-place
- M1–M33 **unchanged** (M33 remains blob `326ef4f2770ca5021f9e273605f0e7a5f6aaf992`)
- Forward-only. **Not** managed-applied.

M34 correction: window-keyed `metrics_sync` (UTC calendar day); campaign-scoped unattributed; mixed-currency spend not combined; attributable pending events enqueue `conversion_feedback` once.

Later recovery-gated managed apply must apply, in order:

1. `20260820140000_campaign_execution_foundation.sql`
2. `20260821140000_campaign_metrics_conversion_feedback_foundation.sql`

Requires a qualified recovery checkpoint newer than post-M32 managed truth.

## Tables / extensions

| Object | Notes |
| :--- | :--- |
| `public.campaign_metric_snapshots` | target + window unique; integer spend; ISO currency; no FX; no raw payload |
| `public.campaign_conversion_feedback_events` | local evidence; `source_event_key` unique; not a CRM stage |
| `campaign_run_operations.operation_type` | forward-only add `metrics_sync`, `conversion_feedback` |
| No `campaign_attributions` | existing `leads.attribution` + touchpoints only |

## Conversion sources

| Type | Source | Exactly-once key |
| :--- | :--- | :--- |
| LeadCreated | `leads` INSERT trigger | `lead:{id}:LeadCreated` |
| QualifiedLead | status transition into `qualified` | `lead:{id}:QualifiedLead` |
| ConsultationScheduled | status transition into `consultation_scheduled` | `lead:{id}:ConsultationScheduled` |
| ProposalSent | status transition into `proposal_sent` | `lead:{id}:ProposalSent` |
| CommercialConversion | `quotation_acceptances` INSERT (`taxable_base_paise`, INR) | `quotation_acceptance:{id}` |

Attribution resolution: trusted `campaign_run_reference` + `campaign_run_target_reference` only → `attributable` / `not_attributable` / `ambiguous_target`. Unattributed events are `not_applicable` for provider submit.

## Gates

- `ONEDECORE_CAMPAIGN_EXECUTION_MODE=disabled\|mock\|sandbox\|live`
- `ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED` (live requires `true`; credentials alone do not enable)
- `ONEDECORE_CAMPAIGN_SANDBOX_TRANSPORT_ENABLED` (sandbox requires `true`)
- `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED` remains separate; 9C-C still blocks customer-linked outbound transport
- `direct_or_custom` create/activate → `PROVIDER_CUSTOM_EXPORT_DISABLED` (no silent broad_public)

## Attribution bridge

Signed context via `/lp/[slug]?odecx=` (opaque). Unsigned `run_reference` query ignored. Server verifies HMAC + DB binding **and** `execution_context.landingPublicationReference` equals the already server-trusted current Landing Lab `publication_reference`. Context A on publication B does not enrich run identity. Public lead gate otherwise unchanged.

## Managed

Read-only dry-run (`db push --linked --dry-run`, not applied) proposes **only**:

1. `20260820140000_campaign_execution_foundation.sql`
2. `20260821140000_campaign_metrics_conversion_feedback_foundation.sql`

Remote history remains M1–M32. Later apply requires a qualified recovery checkpoint newer than post-M32.

`/admin/campaigns/[campaignId]` Metrics / Conversion Feedback panel. `campaigns.metrics.read`. Production/sharing OFF banners. No secrets rendered.
