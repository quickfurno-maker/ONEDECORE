# Phase 9C — Campaign Execution, Attribution & Conversion Feedback Architecture Freeze

**Date:** 2026-08-19  
**Gate:** 9C-A docs-only entry audit  
**Starting `origin/main`:** `aaaa1236447d213e13b0170f669bc6e83ae2f872` (PR #68 two-parent merge)  
**Worktree:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase9c`  
**Branch:** `phase-9c-architecture-freeze`  
**Authority:** ADR-0031 / DEC-0085 / OD9C-1–OD9C-18  
**Managed project:** `lpurlfmpvriyvpkujvyl`

This document freezes architecture. It does **not** implement schema, workers, SDKs, or provider writes.

---

## 1. Preflight

| Check | Result |
| :--- | :--- |
| `git fetch origin` | performed |
| `origin/main` | `aaaa1236447d213e13b0170f669bc6e83ae2f872` |
| Branch base | exact that SHA |
| Protected stashes | `phase-9d-roadmap-lock-pending-after-pr63`; `pre-phase-5c local residue 2026-07-31` |
| Open PRs | none colliding with ADR-0031 / DEC-0085 at freeze time |
| Next ADR | **ADR-0031** (ADR-0030 last) |
| Next DEC | **DEC-0085** (DEC-0084 last) |

---

## 2. Managed database truth (read-only; no writes this gate)

As certified by DEC-0084 / M32 closeout:

- history **M1–M32**;
- latest `20260819140000`;
- pending **NONE**;
- M32 fingerprints unchanged from closeout;
- Landing Lab production **OFF**;
- Phase 9C objects **absent**.

This freeze does not re-query managed Supabase. No `db push`, SQL, or provider API calls.

---

## 3. Repository findings

### 3.1 Phase 9A (CANONICAL)

M31 tables: `campaigns`, `campaign_versions`, `campaign_audience_rule_versions`, `campaign_approvals`, `private.marketing_idempotency_requests`.

Version lifecycle: `draft → pending_approval → approved | rejected`. **No** run states on versions.

Intended channels: `meta_ads | google_ads | email | whatsapp` (metadata only).

Permissions: `campaigns.read`, `campaigns.draft`, `campaigns.request_approval`, `campaigns.approve`, `marketing_consents.manage` — SA + SM. SM self-approval denied at DB.

`destination_reference`: opaque, no landing FK.

Audience: frozen **rules**, not PII lists. Targeting `broad_public | direct_or_custom`.

MARKETING: existing `consent_events`. DNC: `contacts.status = do_not_contact`. Channel suppression: `contact_channels.status = suppressed`.

### 3.2 Phase 9B (CANONICAL)

M32 Landing Lab tables + `private.landing_lab_idempotency_requests`. Signed publication context. Attribution into `leads.landing_path` / `leads.attribution` / `lead_source_touchpoints` (UTM, `fbclid`, `gclid`). Public gate `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` default OFF.

### 3.3 CRM commercial truth (CANONICAL)

Lead stages include `qualified`, `consultation_scheduled`, `proposal_sent`, `negotiation`, `closed_won`. Closed-Won requires accepted quotation (`accept_quotation_by_capability`). Authoritative value: `taxable_base_paise`. Project materialization must not double-count (DEC-0052 / ADR-0024).

### 3.4 Existing execution / provider code

| Finding | Classification |
| :--- | :--- |
| `/admin/campaigns` governance UI | CANONICAL |
| `domain/marketing-eligibility.ts` | REUSABLE for 9C recheck |
| M21 WhatsApp claim/bind/reconcile | REUSABLE **pattern** |
| Meta WhatsApp webhook + `META_WHATSAPP_*` | REUSABLE (service only); OUT-OF-SCOPE for Ads |
| Meta/Google Ads SDK in `package.json` | absent — OUT-OF-SCOPE |
| `campaign_runs` / conversion-feedback tables | absent — OUT-OF-SCOPE |
| n8n campaign hooks | absent — OUT-OF-SCOPE |
| campaign cron/workers | absent — OUT-OF-SCOPE |
| Prebuild `scheduled/paused/completed` on **versions** | historical; RECONCILE already done in M31 (those states belong to **runs**) |
| Landing publication `scheduled` | denied in M32 — not campaign runs |

### 3.5 External account model

No Ads account tables. WhatsApp uses a single-tenant WABA pattern. **Lock:** one Meta ad account + one Google Ads customer per deployment (OD9C-5).

---

## 4. Frozen OD9C decisions

See [ADR-0031](../ADR/ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md). Summary:

| Code | Lock |
| :--- | :--- |
| OD9C-1 | Approved immutable version only |
| OD9C-2 | `scheduled → running ↔ paused → completed`; `failed` / `cancelled` |
| OD9C-3 | Port + Meta/Google MVP; email & WhatsApp MARKETING deferred |
| OD9C-4 | Direct adapters; n8n not correctness |
| OD9C-5 | Single ONEDECORE account per provider |
| OD9C-6 | Current eligibility recheck before export |
| OD9C-7 | No persistent raw PII recipient snapshot |
| OD9C-8 | Lean run/target/operation/event/metric/feedback + private execution idempotency |
| OD9C-9 | Resolve opaque destination at execution; no M31 rewrite |
| OD9C-10 | CRM touchpoints = attribution truth; provider = evidence |
| OD9C-11 | Five CRM-derived events; commercial once from acceptance/Closed-Won |
| OD9C-12 | Click-ID first; hashed PII minimized |
| OD9C-13 | Provider spend + CRM funnel derived metrics |
| OD9C-14 | `campaigns.execute` / `pause` / `metrics.read`; SA + SM |
| OD9C-15 | Replay-safe operations; reconcile unknown creates |
| OD9C-16 | DB truth + server worker; Phase 10 activates scheduler |
| OD9C-17 | Server secrets; verified callbacks |
| OD9C-18 | Phase 10 production gate |

---

## 5. Lifecycle / provider / worker

**Run lifecycle:** OD9C-2. Adapters map provider native states.

**Port:** `CampaignExecutionProvider` — Meta + Google adapters. SDK types stay inside adapters.

**Worker:** `campaign_run_operations` claimed atomically; Hostinger-compatible cron; default execution mode `disabled`; local manual trigger allowed.

---

## 6. Audience / destination / attribution / conversion

**broad_public:** provider targeting only; no CRM PII export.

**direct_or_custom:** derive at execution; recheck MARKETING/DNC/suppression; hash as required; membership evidence without raw PII snapshot; withdrawal → governed removal.

Zero eligible recipients → fail closed (no silent `broad_public` conversion).

**Destination:** server resolves opaque `destination_reference` to URL or live Landing Lab publication; snapshot evidence; fail if unavailable. Production `/lp/*` still Phase 10.

**Attribution:** existing CRM/Landing Lab stores only.

**Feedback events:** `LeadCreated`, `QualifiedLead`, `ConsultationScheduled`, `ProposalSent`, `CommercialConversion`.

**Commercial trigger:** `quotation_acceptance_id` from `accept_quotation_by_capability`; value `taxable_base_paise`; never again on project create.

**Identifiers:** `fbclid`/`gclid` first; `wbraid`/`gbraid`/`fbc`/`fbp` only if 9C implementation proves required (forward-only; no M32 rewrite in this gate).

**Value:** only `CommercialConversion`.

---

## 7. Metrics / RBAC / retry / drift

Metrics: OD9C-13. RBAC: OD9C-14 (SM execute approved runs; not SA-only). Retry/drift: OD9C-15.

Polling for status/metrics; outbound conversion APIs; Ads inbound webhooks deferred.

---

## 8. Conceptual schema / migration sequencing

Conceptual tables: ADR-0031 §5 / OD9C-8.

**Do not reserve M33.** Implementation after this PR merges allocates **NEXT-AVAILABLE-FOR-9C-IMPLEMENTATION** from then-current main. 9D-B remains unreserved until after 9C complete.

---

## 9. Deferred scope

Listed in ADR-0031 §7 (agency tenancy, warehouses, autonomous spend, email/WhatsApp marketing engines, extra ad networks, CDP, finance ledger, etc.).

---

## 10. Implementation subphases

- **9C-A** — this docs freeze (no merge automation).
- **9C-B** — execution foundation, mocked providers, no production writes.
- **9C-C** — Meta + Google adapters, feedback, metrics, certification; production still OFF.

Optional one-time split of 9C-C if review size requires it.

---

## 11. Collisions

- Permission codes `campaigns.execute` / `pause` / `metrics.read` are **absent** today (M31).
- Idempotency: new `private.marketing_execution_idempotency_requests` (do not reuse 9A/9B ledgers).
- Run states live on **runs**, not on `campaign_versions` (avoids 9A collision).
- WhatsApp MARKETING deferred (avoids M19 collision).
- Commerce migration still unreserved (ADR-0030).

---

## 12. Application gates

`C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase9c` has no `node_modules`. `npm run lint`, `npm run typecheck`, and `npm run test:app` were run from `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c`, which shares identical `src/**`, `supabase/migrations/**`, and `package.json` with `aaaa1236447d213e13b0170f669bc6e83ae2f872` (this freeze is docs-only). Result: lint 0 errors / 11 pre-existing warnings; typecheck pass; `test:app` 839 pass / 0 fail.

---

## 13. This gate did not

- create a migration or call it M33;
- modify M1–M32 or application source;
- write managed Supabase;
- call Meta/Google Ads APIs;
- enable Landing Lab public or public intake;
- start 9D-B;
- touch protected stashes;
- auto-merge this PR.
