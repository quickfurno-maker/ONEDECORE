# Phase 9C-C — Providers, Conversion Feedback & Metrics Implementation

**Status:** `REPOSITORY_IMPLEMENTED` (PR open, not merged)
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

## Official provider contract assumptions (2026-08-19)

- **Meta Marketing / Graph API:** latest version **v26.0** per [Graph API changelog](https://developers.facebook.com/docs/graph-api/changelog/) (Marketing API versions include v26.0 introduced 2026-07-29). Default `ONEDECORE_META_ADS_GRAPH_VERSION=v26.0`. Campaign create uses `POST /act_{id}/campaigns` with `objective=OUTCOME_LEADS`, pause via object `status`. Insights: `impressions`, `clicks`, `spend`, `actions`. Conversion request builder follows Conversions API-shaped `event_name` / `event_id` / optional `fbc` — **transport blocked** in 9C-C.
- **Google Ads API:** latest released major **v25** per [sunset dates](https://developers.google.com/google-ads/api/docs/sunset-dates) (v25 released 2026-07-22). REST host `googleads.googleapis.com/v25`. OAuth refresh at `oauth2.googleapis.com/token`. Campaign budget mutate then campaign mutate (`SEARCH`, `PAUSED`). Metrics GAQL `metrics.cost_micros` normalized to `spend_minor` by exact integer `micros / 10000` (1 currency unit = 1_000_000 micros = 100 minor). Offline conversion request builder is local only — **transport blocked**.
- **Dependency strategy:** no Ads SDKs. Injected `ProviderHttpTransport`; default `fetch` with live-host block unless explicitly allowed (never allowed in this gate’s factory).

No architecture contradiction with ADR-0031 was found. Custom audience / enhanced conversions remain unimplemented uploads.

## Migration

- File: `supabase/migrations/20260821140000_campaign_metrics_conversion_feedback_foundation.sql` (repository M34)
- Git blob: `f00d88277297a2234f4d07300dd11e257579fb0e`
- Raw SHA-256 (LF): `8407F056873E0C5AF642737DDE220FFEEB12A1E257C7BE22AEA80BF7556E6C46`
- M1–M33 **unchanged** (M33 remains blob `326ef4f2770ca5021f9e273605f0e7a5f6aaf992`)
- Forward-only. **Not** managed-applied.

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

Signed context via `/lp/[slug]?odecx=` (opaque). Unsigned `run_reference` query ignored. Server verifies HMAC + `verify_campaign_execution_context_binding`. Invalid context does not write run identity; public lead gate otherwise unchanged.

## Managed

Read-only dry-run (`db push --linked --dry-run`, not applied) proposes **only**:

1. `20260820140000_campaign_execution_foundation.sql`
2. `20260821140000_campaign_metrics_conversion_feedback_foundation.sql`

Remote history remains M1–M32. Later apply requires a qualified recovery checkpoint newer than post-M32.

`/admin/campaigns/[campaignId]` Metrics / Conversion Feedback panel. `campaigns.metrics.read`. Production/sharing OFF banners. No secrets rendered.
