# ADR-0031 — Phase 9C Campaign Execution, Attribution & Conversion Feedback Architecture Freeze

**Status:** ACCEPTED / ARCHITECTURE FROZEN  
**Date:** 2026-08-19  
**Phase:** 9C — Campaign Execution, Attribution & Conversion Feedback  
**Owner authorization:** recommended OD9C locks as written in the Phase 9C entry-audit gate  
**Decision:** DEC-0085 / OD9C-1–OD9C-18  
**Implementation migration:** **NEXT-AVAILABLE-FOR-9C-IMPLEMENTATION** — **NOT CREATED / NOT RESERVED** in this gate  
**Production activation:** **NONE**

This ADR **is** the Phase 9C architecture freeze. It does **not** reopen ADR-0027 / ADR-0029 / ADR-0030. It does **not** authorize schema, workers, provider SDKs, managed writes, live spend, Landing Lab public serving, public lead intake, Phase 9D-B, or Phase 10 production activation.

9D-B remains blocked until Phase 9C **implementation and certification** are complete **and** ADR-0030 remains merged.

---

## 1. Context

Phase 9A (M31) is complete: campaigns may be drafted, submitted, and approved as **immutable versions**. Phase 9B (M32) is managed-applied: Landing Lab publications, experiments, and CRM attribution enrichment exist, with public `/lp/*` still **OFF**.

ONEDECORE still cannot:

- create a governed campaign **run** from an approved version;
- activate, pause, resume, or cancel Meta Ads or Google Ads objects;
- recheck current MARKETING / DNC / suppression at export time;
- submit server-side conversion feedback;
- compare provider spend to CRM funnel outcomes.

Existing `src/features/marketing/**` is governance UI only. There is no Meta/Google Ads SDK, no `campaign_runs` table, no conversion-feedback scaffolding, and no n8n campaign correctness path. M21 WhatsApp dispatch/claim/reconcile is a **reusable pattern**, not Ads execution.

Protected baseline for this freeze:

- `origin/main`: `aaaa1236447d213e13b0170f669bc6e83ae2f872` (PR #68 true merge);
- repository / managed: **M1–M32**, latest `20260819140000`, pending **NONE**;
- M31 and M32 **immutable**;
- Landing Lab production **OFF**;
- Phase 9C **not implemented**;
- 9D-A architecture frozen (ADR-0030); 9D-B **not started**.

---

## 2. Decision Summary

Phase 9C will add **provider-independent campaign execution** inside the existing modular monolith and Supabase data plane.

The design deliberately avoids:

- mutating approved campaign versions;
- n8n as campaign / consent / attribution / retry truth;
- multi-tenant ad-agency OAuth;
- email marketing and WhatsApp MARKETING in 9C MVP;
- a parallel CRM attribution or conversion-stage store;
- autonomous AI spend, bidding, or creative publishing;
- production provider writes before Phase 10.

MVP providers: **Meta Ads** and **Google Ads** only.

---

## 3. Owner Locks

### OD9C-1 — Execution from immutable approved version only

**LOCK:** `APPROVED_VERSION_ONLY_EXECUTION`

A provider execution run may be created only from a Phase 9A `campaign_version` with `status = approved`.

Run creation must verify:

- exact `campaign_version_id`;
- exact configuration hash / approved snapshot identity;
- exact audience rule hash;
- approval still authoritative (`campaign_approvals.decision = approved`);
- requested provider channels ⊆ approved `intended_channels`;
- budget / creative / intended window come from the approved snapshot;
- no silent mutation of the approved version.

Any substantive change to audience, creative, budget, destination, or provider channel configuration requires a **new governed campaign version** and approval (ADR-0027). Sales Manager self-approval denial remains database authority.

---

### OD9C-2 — Authoritative campaign run lifecycle

**LOCK:** `CANONICAL_RUN_LIFECYCLE`

```
scheduled → running ↔ paused → completed
exceptions: failed | cancelled
```

- `scheduled` only after execution eligibility checks pass.
- `running` means provider execution was successfully activated/confirmed.
- `paused` means no new paid delivery should continue after provider pause acknowledgement.
- Resume is `paused → running`.
- `completed` is terminal successful close.
- `failed` is terminal unrecoverable execution failure.
- `cancelled` is terminal operator cancellation before completion.
- Retries do **not** create duplicate runs or duplicate provider campaigns.
- Provider status is **evidence**, not sole database truth.
- Adapters map native provider states into this canonical set.

No generic workflow engine.

---

### OD9C-3 — Provider-independent port; Meta + Google first

**LOCK:** `PROVIDER_PORT_META_GOOGLE_MVP`

Server-only port, conceptually `CampaignExecutionProvider`:

- create provider objects from the approved snapshot;
- activate / pause / resume / stop-or-cancel when supported;
- fetch execution status and delivery/spend metrics;
- submit conversion feedback where supported;
- verify/normalize provider responses.

No provider SDK types leak into campaign domain types.

**EMAIL MARKETING:** deferred from 9C MVP (`email` remains 9A metadata only).  
**WHATSAPP MARKETING:** deferred from 9C MVP. **Do not change M19 `WHATSAPP_SERVICE`.** ADR-0027’s “9C later owns WhatsApp MARKETING send-intent design” is satisfied by **explicit deferral**, not by implementing it now.

---

### OD9C-4 — Direct server adapters; n8n not correctness path

**LOCK:** `SUPABASE_RUN_TRUTH_DIRECT_PROVIDER_ADAPTER`

ONEDECORE server adapters own correctness. n8n may later receive non-authoritative notifications. n8n may never decide campaign state, consent, provider success, retry/idempotency, or be the only record of dispatch.

---

### OD9C-5 — Single business account per provider for MVP

**LOCK:** `SINGLE_ONEDECORE_PROVIDER_ACCOUNT_MVP`

V1 is not an ad-agency multi-tenant platform.

- one configured Meta business/ad-account context;
- one configured Google Ads customer/account context.

Non-secret account IDs may live in server configuration. Tokens/secrets: server-only env/secret store. Never in campaign rows, Git, or the browser.

No account-onboarding OAuth UI in 9C MVP.

---

### OD9C-6 — Execution-time eligibility recheck

**LOCK:** `CURRENT_ELIGIBILITY_RECHECK_BEFORE_EXPORT_OR_SEND`

Approval never freezes recipient eligibility.

For `direct_or_custom`, immediately before any provider export/action, re-evaluate:

- current MARKETING consent;
- `contacts.status != do_not_contact`;
- target `contact_channels` active/valid and not suppressed/archived;
- campaign/version still approved;
- audience rule still the exact frozen hash;
- provider policy eligibility.

Never export an approval-time PII snapshot.

For `broad_public`: no CRM recipient export; provider targeting only; CRM PII must not be sent merely because a campaign exists.

---

### OD9C-7 — Minimal provider audience export

**LOCK:** `NO_PERSISTENT_PROVIDER_PII_RECIPIENT_SNAPSHOT`

If direct/custom audience support is implemented in 9C-C:

- derive candidates at execution time;
- minimize fields; normalize; hash identifiers when the provider requires hashed matching;
- no raw PII logs; no CRM export files in Git;
- no long-lived recipient snapshot table unless implementation proves unavoidable;
- provider audience membership IDs/evidence may be stored without duplicating raw contact PII;
- post-upload DNC/suppression requires a governed removal/reconcile path before further execution where the provider allows it.

CRM eligibility truth ≠ provider audience membership evidence.

---

### OD9C-8 — Campaign run / provider evidence data model

**LOCK:** `LEAN_RUN_EVIDENCE_NO_WAREHOUSE`

Conceptual persistence (NO SQL in this gate):

| Concept | Role |
| :--- | :--- |
| `public.campaign_runs` | UUID; `campaign_version_id`; canonical state; timestamps; requested_by / activated_by; immutable approved hashes; bounded failure/cancel reason; **no secret; no PII list** |
| `public.campaign_run_targets` | run + provider/channel; non-secret account ref; provider campaign/ad-set/ad-group IDs; provider lifecycle snapshot; last sync; **no secret** |
| `public.campaign_run_operations` | claimable command queue (create/activate/pause/resume/cancel/sync/export/feedback) |
| `public.campaign_execution_events` | append-only operation/event evidence; bounded safe metadata |
| `public.campaign_metric_snapshots` | append-only or upsert-by-window; impressions/clicks/`spend_minor`/provider conversions; currency; fetched_at; **not a finance ledger** |
| `public.campaign_conversion_feedback_events` | append-only feedback evidence; CRM source identity; provider submission status |
| `private.marketing_execution_idempotency_requests` | dedicated execution ledger |

Do **not** reuse `landing_lab_idempotency_requests` or `marketing_idempotency_requests` unless a later implementation ADR proves identical operation semantics (this freeze assumes they differ).

No generic event-sourcing platform. No analytics warehouse.

---

### OD9C-9 — Landing / destination resolution

**LOCK:** `OPAQUE_APPROVAL_REFERENCE_RESOLVED_AT_EXECUTION_NO_M31_REWRITE`

M31 remains immutable. `campaign_versions.destination_reference` remains an opaque approval snapshot.

At run preparation, the server may resolve:

- an approved external URL, **or**
- a ONEDECORE Landing Lab publication identity.

For Landing Lab destinations:

- resolve server-side;
- require a valid publication identity;
- require production-live eligibility at **actual production activation** (Phase 10 public gate);
- snapshot the resolved URL/reference into execution evidence;
- do **not** retrofit an M31 FK;
- do **not** let provider/browser self-assert canonical landing identity.

---

### OD9C-10 — Attribution authority

**LOCK:** `CRM_TOUCHPOINT_TRUTH_PROVIDER_METRICS_EVIDENCE`

CRM attribution truth remains `leads.landing_path`, `leads.attribution`, `lead_source_touchpoints`, verified Landing Lab context, and UTM/click identifiers.

Provider metrics are delivery evidence. Never force provider conversion counts to equal CRM counts. Do not create another authoritative lead attribution store.

---

### OD9C-11 — Server-side conversion feedback

**LOCK:** `CRM_TRANSITION_DERIVED_FEEDBACK`

MVP conversion events:

1. `LeadCreated`
2. `QualifiedLead`
3. `ConsultationScheduled`
4. `ProposalSent`
5. `CommercialConversion`

**Canonical commercial trigger:** emit `CommercialConversion` **once** from the authoritative `accept_quotation_by_capability` transition that simultaneously proves **accepted quotation** and **Closed-Won**, keyed by `quotation_acceptance_id`. Value = `quotation_acceptances.taxable_base_paise` (post-discount, GST excluded; DEC-0056 / ADR-0024). Do **not** emit again on project materialization. Do **not** create a parallel CRM stage.

Each event: deterministic idempotency identity from the CRM source event; exactly-once logical intent; provider retries replay the same identity; provider rejection does **not** roll back CRM.

---

### OD9C-12 — Privacy-safe feedback identifiers

**LOCK:** `CLICK_ID_FIRST_PII_MINIMIZED`

Prefer existing verified `gclid` / `fbclid` (and bounded UTM). Do not modify M32 in this gate.

Forward-only 9C implementation may add bounded capture of `wbraid` / `gbraid` / `fbc` / `fbp` **only if** the chosen provider contract requires them for matching — without rewriting M32 attribution authority.

Hashed customer identifiers: normalize server-side; hash exactly per provider contract; never log raw PII; send only under explicit data-sharing eligibility. Purchase/lead does **not** grant MARKETING consent. Conversion measurement ≠ outbound MARKETING consent, but provider sharing must still be policy-safe.

---

### OD9C-13 — Metrics / cost model

**LOCK:** `PROVIDER_SPEND_PLUS_CRM_CONVERSION_DERIVED_METRICS`

Provider snapshots: impressions, clicks, `spend_minor`, provider-reported conversions, currency.

CRM-derived: leads, qualified, consultations, proposals, commercial conversions.

Dashboard may derive CPC, CPL, cost per qualified / consultation / proposal / commercial conversion, and funnel rates.

No finance ledger. No ROAS claim unless using canonical `taxable_base_paise` and clearly labeling methodology. Never double-count quotation acceptance vs project.

---

### OD9C-14 — RBAC

**LOCK:** `SA_SM_EXECUTE_PAUSE_METRICS_NO_SCHEDULE_PERM`

Minimal new permission codes (collision-checked against M31/M32):

- `campaigns.execute`
- `campaigns.pause`
- `campaigns.metrics.read`

No separate `campaigns.schedule` in MVP (schedule is part of execute).

| Role | 9C authority |
| :--- | :--- |
| Super Admin | execute / pause / resume / cancel / metrics; all existing 9A campaign permissions |
| Sales Manager | execute **approved immutable versions**; pause / resume; metrics; existing 9A permissions; **self-approval denial unchanged**; execution cannot mutate approved snapshot |
| Sales Executive / PM / Designer / Kriti / legacy | none |

**Spend-activation tradeoff:** SA-only would be safer against accidental spend, but would bottleneck daily marketing ops that 9A already trusts SM to draft/submit (and to approve *others*). **Lock: SM may start paid runs of already-approved versions.** Mitigations: Phase 10 production gate; fail-closed missing config; immutable snapshot; no approval bypass; SE/Kriti have zero execute authority.

---

### OD9C-15 — Idempotency / retry / reconciliation

**LOCK:** `REPLAY_SAFE_PROVIDER_OPERATIONS`

Every provider mutation: deterministic operation identity, request hash, stored outcome, provider object reference, bounded retry/backoff. No duplicate provider campaigns after timeout ambiguity.

Error classes:

1. validation/business denial → no retry;
2. auth/configuration denial → fail closed, operator action;
3. rate limit / transient / 5xx → bounded retry;
4. timeout / unknown outcome → **reconcile before create-retry**;
5. provider drift / external manual change → record drift; do not silently overwrite.

Reuse the M21 claim/bind/reconcile *pattern*, not WhatsApp tables.

---

### OD9C-16 — Scheduling / processing model

**LOCK:** `DB_RUN_TRUTH_SERVER_WORKER_DISPATCH`

Database owns due run/operation state. Workers claim rows atomically (`FOR UPDATE SKIP LOCKED` or equivalent single-row status CAS). Crash-safe. n8n not required. Production scheduler activation is **Phase 10**. Local/staging may use explicit/manual trigger. No Redis/Kafka/Temporal unless a later ADR proves unavoidable.

Compatible with Hostinger VPS cron + ONEDECORE server route/worker.

---

### OD9C-17 — Secrets / webhook / callback security

**LOCK:** `SERVER_SECRETS_VERIFIED_CALLBACKS`

Provider secrets: env/secret store only. Verify account/customer IDs against server config. Signature-verify callbacks where the provider supplies them. Prefer preconfigured credentials over OAuth UI. Rate-limit public/callback endpoints. Persist raw provider payloads only if strictly needed, redacted, and bounded. Conceptual mode: `ONEDECORE_CAMPAIGN_EXECUTION_MODE=disabled|mock|sandbox|live` (default **disabled**).

---

### OD9C-18 — Production gate

**LOCK:** `PHASE10_PRODUCTION_ACTIVATION`

Phase 9C implementation/certification does **not** activate Meta/Google live spend, public Landing Lab, public lead intake, WhatsApp marketing, or email marketing. Sandbox/mock adapters may be used before Phase 10.

---

## 4. Resolved architecture questions

| # | Decision |
| :--- | :--- |
| 1 | `CommercialConversion` once from `accept_quotation_by_capability` / `quotation_acceptance_id`; value `taxable_base_paise`; not project create |
| 2 | Sales Manager **may** start paid runs of approved versions; Super Admin all; not SA-only |
| 3 | Claim `campaign_run_operations` (or equivalent) with atomic `pending → claimed` + `SKIP LOCKED` |
| 4 | Unknown provider-create: reconcile by ONEDECORE run/operation tag; bind if found; else `needs_reconcile`; never blind re-create |
| 5 | Missing provider config: fail closed; run cannot become `running` |
| 6 | Unresolvable destination: fail closed; no provider activate; `DESTINATION_UNAVAILABLE` |
| 7 | Zero `direct_or_custom` eligibility: fail closed; do not silently switch to `broad_public` |
| 8 | MARKETING withdrawn after upload: eligibility truth updates immediately; enqueue governed provider removal; pause further export of that contact |
| 9 | Meta: `fbclid`/`fbc` first; Google: `gclid`/`wbraid`/`gbraid` if present; hashed PII only when required and eligible |
| 10 | Monetary value **only** on `CommercialConversion` |
| 11 | Unique `(conversion_type, source_entity_id)` / CRM event id; provider retries reuse it |
| 12 | Store UTC windows; `spend_minor` + provider currency as reported; V1 no FX conversion; flag currency mismatch vs configured INR |
| 13 | Sync compares desired vs provider snapshot; append `provider_drift`; operator resolves |
| 14 | Logs: run/operation/provider object ids, error class, HTTP status — never tokens, raw PII, or unredacted payloads |
| 15 | MVP: **polling** for status/metrics both providers; **outbound** conversion upload/CAPI; inbound Ads webhooks deferred |
| 16 | Minimum surface: create/status, pause/resume, insights/metrics, conversion upload; custom audience create/add/remove only if `direct_or_custom` is in 9C-C scope |
| 17 | See §7 deferred list |

---

## 5. Conceptual schema (NO SQL)

Forward-only 9C implementation may add one or more migrations using the **next available timestamp after then-current main**. Do **not** call that migration **M33** from this document. Do not modify M31/M32. 9D-B later takes the next available timestamp **after 9C completes**.

Tables listed in OD9C-8 are conceptual. RLS on all API-exposed tables. Direct authenticated DML denied. Staff mutations via permission-checked RPC/server. `service_role` only for worker/provider dispatch helpers analogous to M21.

---

## 6. Provider adapter architecture

```text
approved campaign_version
        │
        ▼
campaign_runs + campaign_run_operations   (Supabase truth)
        │
        ▼
CampaignExecutionProvider (server port)
   ├─ MetaAdsAdapter
   └─ GoogleAdsAdapter
        │
        ▼
provider APIs (Phase 10 live / mock-sandbox before)
```

Admin: extend `/admin/campaigns/[campaignId]` with run controls and metrics. No public campaign-execution API for browsers.

---

## 7. Explicitly deferred

Multi-tenant ad-account onboarding; agency hierarchy; marketing-automation builder; Kafka/Redis/Temporal; warehouse; ML/autonomous bidding or creative; auto winner / auto spend redistribution; email delivery platform; WhatsApp MARKETING bulk-send; SMS; TikTok/LinkedIn/Pinterest; multi-touch/probabilistic attribution; CDP/identity graph; finance ledger / ad-invoice reconciliation; generic webhook framework; long-lived raw provider payload archive.

---

## 8. Implementation gates

| Gate | Entry | Exit | Forbidden |
| :--- | :--- | :--- | :--- |
| **9C-A** | this freeze | merged docs-only ADR/DEC | schema, SDK, spend |
| **9C-B** | 9C-A merged | run/target/event/idempotency schema, RBAC, ports, admin controls, worker/manual trigger, mocked tests | production provider writes |
| **9C-C** | 9C-B complete | Meta+Google adapters, conversion feedback, metric sync, retry/reconcile, staging/mock evidence, managed apply **if** a migration exists (recovery gate), Phase 9C closeout | production spend; 9D-B |

If 9C-C is too large for review, split once into provider execution vs conversion/metrics/certification. Do not fragment further.

---

## 9. n8n / WhatsApp / Landing Lab / commerce

- n8n: notifications only; never correctness.
- WhatsApp: M19 `WHATSAPP_SERVICE` unchanged; MARKETING send-intent **deferred**.
- Landing Lab public gate remains OFF until Phase 10.
- Commerce: 9D-B still blocked; no shop pixels as campaign truth (ADR-0030 §15).

---

## 10. Consequences

**Positive:** lean path to Meta/Google execution without weakening 9A/9B CRM truth; replay-safe operations; Phase 10 still owns live spend.

**Trade-offs:** email/WhatsApp marketing not in 9C MVP; SM can start approved paid runs; polling not real-time webhooks; no FX conversion; custom-audience export is minimized and eligibility-rechecked, not a CDP.

These are intentional.

---

## 11. Related

- [ADR-0027](ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [ADR-0029](ADR-0029-phase-9b-landing-page-lab.md)
- [ADR-0030](ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)
- [Phase 9C architecture freeze audit](../audits/phase-9c-campaign-execution-attribution-feedback-architecture-freeze.md)
- DEC-0085
