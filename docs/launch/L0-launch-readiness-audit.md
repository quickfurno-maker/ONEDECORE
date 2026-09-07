# L0 — Public Launch Readiness Audit and Blocker Register

**Phase:** L0 (Launch Scope Freeze + Baseline Audit)
**Audit date:** 2026-09-07
**Audited repository head:** `96ee6da586fe1dc89eb7a628260ed8815fe23fed` (`origin/main`, merge of PR #153)
**Production URL:** https://onedecore.in
**Live deployed SHA:** `96ee6da586fe1dc89eb7a628260ed8815fe23fed` - verified on the production VPS with `git rev-parse HEAD` on 2026-09-07

This phase changes no production behaviour. It records what exists, what is
missing, and which of the missing things stand between ONEDECORE and paid
traffic.

Evidence is of two kinds and both are marked as such:

- **CODE** — read from the repository at the audited head.
- **LIVE** — observed from `https://onedecore.in` by unauthenticated read-only
  HTTP GET on the audit date. No form was submitted and no lead was created.

---

## 1. Launch surface — what is actually public

### 1.1 Public pages (all verified LIVE 200)

| Route | Purpose | Ad landing candidate |
| --- | --- | --- |
| `/` | Homepage, discovery + consultation capture | Yes |
| `/interiors` | Interiors conversion page | Yes — primary |
| `/portfolio` | Portfolio listing | Supporting |
| `/portfolio/[slug]` | Portfolio detail | Supporting |
| `/privacy` | Privacy Notice | No |
| `/terms` | Terms of Use | No |
| `/communication-consent` | Communication consent explainer | No |
| `/data-rights` | Data rights | No |
| `/warranty` | Warranty | No |
| `/shop`, `/shop/*` | COD storefront (7 routes) | Out of launch scope — see §6 |
| `/lp/[slug]` | Landing Lab pages | `noindex, nofollow`; campaign-bound |
| `/q/[token]` | Customer quotation view | Token-gated, not marketing |

`/shop` returned LIVE 200, which means `ONEDECORE_SHOP_PUBLIC_ENABLED=true` in
production. The storefront is therefore part of the public surface today even
though it is not part of the interiors acquisition funnel.

### 1.2 Public API routes

| Route | Notes |
| --- | --- |
| `POST /api/public/lead-intake` | The only public write path. Mode-gated. |
| `GET /api/health` | Process probe. Returns `{ok, service}` only — **no SHA**. |
| `POST /api/webhooks/meta/whatsapp` | Meta webhook. Mode-gated, currently unproven in production. |
| `GET /api/quotations/pdf` | Capability-secret gated. |
| `/api/internal/campaign-execution/dispatch` | Internal worker, secret-gated. |

### 1.3 Live infrastructure observations

- TLS valid; `nginx/1.24.0 (Ubuntu)`.
- Present: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- **Absent: `Strict-Transport-Security`.**
- Homepage responds with `Cache-Control: s-maxage=31536000` (one year shared
  cache). See RISK-02 — this interacts badly with adding tags.
- **No `Set-Cookie` on any public page.** The public site sets no cookies today.
  That is a clean baseline for the L2 consent design and should be stated as
  such in the Privacy Notice update.

---

## 2. What is already built and working

Recording these prevents rebuilding them and narrows the blocker list.

| Capability | State | Evidence |
| --- | --- | --- |
| Consultation lead form, 3 steps, live | **Working** | LIVE: `data-lead-form-mode="active"` on `/` and `/interiors` |
| Indian 10-digit phone UX | **Built** | LIVE: `data-od-lead-phone-ux="national-10"` |
| Separated consent (service enquiry / phone / WhatsApp) | **Built** | CODE: `ConsultationLeadForm.tsx` — `serviceEnquiryConsent`, `servicePhoneConsent`, `whatsappService`. **No marketing consent is fabricated.** |
| UTM + `fbclid`/`gclid`/`wbraid`/`gbraid` capture | **Built** | CODE: `lead-form-attribution.ts` |
| Attribution persisted to `leads.attribution` and projected to a first touchpoint | **Built** | CODE: migration `20260821140000` |
| Lead-intake legal/consent activation gate | **GREEN** | CODE: executed — activation complete, processors ready, consent versions effective, legal mode `published` |
| `robots.ts` + dynamic `sitemap.ts` | **Built** | CODE + LIVE 200 |
| Canonical + OpenGraph on `/`, `/interiors`, `/portfolio`, portfolio detail | **Built** | CODE |
| Meta WhatsApp webhook, inbox, send-intent, provider dispatch | **Built, disabled** | CODE: mode-gated, fail-closed |
| Meta Ads + Google Ads campaign adapters (create PAUSED) | **Built, unconfigured** | CODE: `provider-config.ts` |

---

## 3. Blocker register

Status values: `OPEN`, `OWNER-INPUT`, `VERIFY`, `DONE`.
Owner values: `OWNER` (business/account action), `ENG` (repository work),
`OWNER+ENG` (both).

### 3.1 Launch blockers — no paid spend until every one is DONE

| ID | Blocker | Owner | Status | Required evidence |
| --- | --- | --- | --- | --- |
| **BLOCK-01** | **Live deployed SHA verified.** Production `/var/www/onedecore` is serving `96ee6da586fe1dc89eb7a628260ed8815fe23fed`, matching the audited `origin/main`. `/api/health` still omits a build identifier; that is an operational improvement rather than a paid-launch blocker. | OWNER+ENG | DONE | **VPS:** `git rev-parse HEAD` returned `96ee6da586fe1dc89eb7a628260ed8815fe23fed` on 2026-09-07. |
| **BLOCK-02** | **No browser tagging of any kind exists.** Zero GTM, GA4, Meta Pixel, `dataLayer` or `next/script` in the entire `src/` tree, confirmed absent on the live homepage. There is no measurement layer at all. | ENG | OPEN | GTM container ID live; GTM Preview showing container load on `/`, `/interiors`, `/portfolio`; GA4 Realtime receiving `page_view`. |
| **BLOCK-03** | **Published legal text positively asserts that no analytics or Pixel exists.** `data-inventory.ts` records *"No analytics, Meta Pixel, advertising cookies or fingerprinting approved"*; `processor-register.ts` repeats it; the analytics processor is `"provider TBD"`; `retention-matrix.ts` has analytics retention pending. Installing tags before updating these makes the published Privacy Notice false. **L2 must precede L3.** | OWNER+ENG | OPEN | Updated `data-inventory`, `processor-register` (GA4/Google + Meta as named processors), `retention-matrix`; new Privacy Notice effective date; owner approval recorded. |
| **BLOCK-04** | **No consent mechanism for non-essential cookies.** No cookie or consent banner component exists anywhere. There is no way to load ad tags consent-aware, and no way to prove consent was obtained. | OWNER+ENG | OPEN | Consent decision recorded (opt-in / opt-out / region rule); banner implemented; tags gated on it; lead submission proven to work with analytics consent **refused**. |
| **BLOCK-05** | **Attribution does not survive navigation.** `collectLeadFormAttribution()` reads only `window.location.search` at submit time. A visitor who lands on `/interiors?gclid=…` and submits from `/` loses the click ID entirely. There is no cookie, `sessionStorage` or first-touch persistence anywhere. Real ad traffic browses before converting, so a large share of paid leads will arrive with **no attribution**. | ENG | OPEN | First-touch attribution persisted across a same-session multi-page journey; test lead landing on `/interiors?utm_*&gclid=…`, navigating to `/portfolio` then `/`, submitting, and arriving in CRM with the original values intact. |
| **BLOCK-06** | **`fbc` / `fbp` are read from the URL query string.** These are first-party cookies written by the Meta Pixel (`_fbc`, `_fbp`), never URL parameters. With no Pixel installed they are always empty, and the current code would not read them even once the Pixel exists. Meta CAPI match quality depends on them. | ENG | OPEN | `_fbc`/`_fbp` read from `document.cookie`; `_fbc` derived from `fbclid` when the cookie is absent; a test lead in CRM carrying both. |
| **BLOCK-07** | **Cross-origin referrer is discarded.** `sameOriginReferrerPath()` returns `undefined` for any external referrer, so Google organic, Instagram organic and referral traffic reach CRM with **no source signal at all**. L7 requires distinguishing exactly those. | ENG | OPEN | Referrer host (not full URL) captured for external referrers; CRM source mapping distinguishing Google organic, Instagram/Facebook organic, referral and direct. |
| **BLOCK-08** | **No public WhatsApp CTA exists.** `PUBLIC_WHATSAPP_HREF` is hard-coded `null`; the sticky dock hides the button; live HTML contains no `wa.me`. Journey D of L8 is impossible and the Meta Click-to-WhatsApp campaign has no destination. | OWNER+ENG | OPEN | Approved WhatsApp business number recorded; `wa.me` CTA live with service-enquiry prefill (not marketing wording); click measurable. |
| **BLOCK-09** | **WhatsApp legal activation is neither recorded nor enforced.** `getMissingWhatsAppActivationFields()` reports all seven fields missing — `WhatsAppBusinessPhoneE164`, `whatsappConsentVersionApproved`, `whatsappNoticeVersionApproved`, `metaProcessorReviewComplete`, `whatsappOptOutSuppressionWorkflowReady`, `whatsappTemplatePolicyApproved`, `serviceCommunicationPolicyApproved`. Unlike lead intake there is **no activation constant** and **nothing calls `isWhatsAppActivationReady()` at runtime**, so the gate exists on paper only. | OWNER+ENG | OPEN | A `WHATSAPP_ACTIVATION` record mirroring `LEAD_INTAKE_ACTIVATION`, all fields owner-recorded; the gate wired into the outbound/webhook env so `enabled` fails closed without it. |
| **BLOCK-10** | **WhatsApp production configuration absent.** Required and currently unset: `ONEDECORE_WHATSAPP_WEBHOOK_MODE=enabled`, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET`, `ONEDECORE_WHATSAPP_OUTBOUND_MODE=enabled`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, and `SUPABASE_SERVICE_ROLE_KEY` on the managed project URL. | OWNER | OPEN | The full L5 certification list: real inbound message, signature validated, idempotent persistence, CRM contact/lead link, inbox render, authorised reply, provider send, `sent`/`delivered`/`read`, replay produces no duplicate, unauthorised staff denied, suppression honoured. |
| **BLOCK-11** | **No conversion tag or conversion action for either ad platform.** No Meta Pixel event mapping and no Google Ads conversion tag exist. Neither platform can optimise. | OWNER+ENG | OPEN | Meta Test Events showing `PageView` and the lead event; Google Ads conversion action in "Recording conversions" after a test conversion. |
| **BLOCK-12** | **Lead-intake production mode unverified.** `ONEDECORE_LEAD_INTAKE_MODE` and `ONEDECORE_TRUST_PROXY` cannot be read remotely. All **code** gates are GREEN (activation complete, processors ready, consent versions effective, legal published), so only the environment is in question — but no lead has been proven to reach CRM from production. | OWNER+ENG | VERIFY | One real submission on production reaching CRM with correct source, consent rows and no duplicate. |
| **BLOCK-13** | **Meta business assets not verified as owned.** Business Portfolio, Page, Instagram, Ad Account, billing, domain verification, dataset/Pixel, WABA and business number. | OWNER | OPEN | Screenshots or admin confirmation of business-level (not personal) ownership, two admins, billing valid. |
| **BLOCK-14** | **Google assets not verified.** Search Console verification, sitemap submission, Google Business Profile, Google Ads account and billing, GA4 ↔ Google Ads link. | OWNER | OPEN | Search Console verified with sitemap accepted; GBP verified; Google Ads billing active; account link confirmed. |
| **BLOCK-15** | **No public phone CTA and no public business phone recorded.** `phoneIsPublicContact: false`, no phone in `BUSINESS_IDENTITY`, no `tel:` link live. Google Business Profile normally requires a real business phone, and a missing phone weakens trust on a high-consideration purchase. | OWNER | OPEN | Business phone recorded and published, or an explicit owner decision to launch WhatsApp-only with GBP implications accepted in writing. |

### 3.2 Should-fix before spend — not hard blockers

| ID | Item | Owner | Status | Required evidence |
| --- | --- | --- | --- | --- |
| RISK-01 | No `Strict-Transport-Security` header. | ENG | OPEN | HSTS present on production responses. |
| RISK-02 | Homepage serves `Cache-Control: s-maxage=31536000`. A shared cache holding the homepage for a year would freeze tag deployment and content updates. | ENG | OPEN | Confirm whether any shared cache honours it; reduce to a sane value or prove nothing caches it. |
| RISK-03 | `robots.ts` disallows `/admin/`, `/api/admin/`, `/auth/` but **not** `/manager/` or `/q/`. | ENG | OPEN | Both added to `disallow`. |
| RISK-04 | Sitemap omits the legal pages. | ENG | OPEN | Legal routes present in `sitemap.xml`. |
| RISK-05 | `getMissingEntityRegistrationFields()` reports `gstinApplicability` still `pending-owner-decision`. | OWNER | OWNER-INPUT | Owner decision recorded. |
| RISK-06 | `getMissingWarrantyPublicationFields()` reports `warrantyClaimsEmail` missing, yet `/warranty` is published and live. | OWNER | OWNER-INPUT | Warranty claims contact recorded, or the page's claims route corrected. |
| RISK-07 | Public contact identity is `onedecore@gmail.com` — a consumer mailbox on a business with a verified domain. | OWNER | OWNER-INPUT | Domain mailbox, or explicit owner decision to keep it. |
| RISK-08 | `/shop` is publicly enabled and in the sitemap while the launch funnel is interiors-only. Ad traffic can wander into commerce. | OWNER | OWNER-INPUT | Decision: keep, or set `ONEDECORE_SHOP_PUBLIC_ENABLED=false` for launch. |

### 3.3 Required by the plan, sequenced after certification

| ID | Item | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| SEQ-01 | **No server-side conversion feedback exists.** The Meta adapter does campaign CRUD and insights only; there is no Conversions API event send, and no Google offline/enhanced conversion upload anywhere in `src/`. | ENG | OPEN | L7 work. Browser conversion tags (BLOCK-11) are the launch blocker; server feedback improves optimisation and may follow first spend if the owner accepts weaker matching. |
| SEQ-02 | Downstream milestones (`qualified_lead`, `consultation_booked`, `quotation_sent`, `closed_won`) are defined in the plan but not wired to any provider. | ENG | OPEN | L7. Depends on SEQ-01. |
| SEQ-03 | Campaign provider credentials unset: `ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED`, `ONEDECORE_META_ADS_*`, `ONEDECORE_GOOGLE_ADS_*`, `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED`. | OWNER | OPEN | L9. Campaigns may also be built directly in the ad platforms; the adapters are optional at V1. |

---

## 4. Environment and gate inventory

### 4.1 Feature gates that decide whether a surface is live

| Variable / gate | Controls | Fail-closed default |
| --- | --- | --- |
| `ONEDECORE_LEAD_INTAKE_MODE` | Lead intake server path | `disabled` |
| `ONEDECORE_TRUST_PROXY` | Required `true` for `enabled` intake | `false` |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | Form UI: `copy-only` / `preview` / `active` | `copy-only` — **LIVE: `active`** |
| `ONEDECORE_WHATSAPP_WEBHOOK_MODE` | Meta inbound webhook | `disabled` |
| `ONEDECORE_WHATSAPP_OUTBOUND_MODE` | Provider dispatch | `disabled` |
| `ONEDECORE_SHOP_PUBLIC_ENABLED` | Public storefront | `false` — **LIVE: enabled** |
| `ONEDECORE_CAMPAIGN_EXECUTION_MODE` | Campaign dispatcher | `disabled` |
| `ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED` | Real provider transport | off |
| `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED` | Customer-data sharing to providers | off |

In-code activation gates (not environment — these are owner facts recorded in
source, and `enabled` mode refuses to start without them):
`LEAD_INTAKE_ACTIVATION`, `areWebsiteLeadProcessorsReady()`,
`areLeadPathConsentVersionsEffective()`, `LEGAL_PUBLICATION_MODE`,
`PRIVACY_NOTICE_EFFECTIVE_DATE`, `TERMS_OF_USE_EFFECTIVE_DATE`. **All GREEN at
the audited head.**

### 4.2 Secrets and credentials

Present in code paths: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ONEDECORE_LEAD_HASH_SECRET`, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`META_WHATSAPP_APP_SECRET`, `META_WHATSAPP_ACCESS_TOKEN`,
`META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_GRAPH_API_VERSION`,
`QUOTATION_CAPABILITY_SECRET`, `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET`,
`ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET`,
`ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET`,
`ONEDECORE_LANDING_LAB_HMAC_SECRET`, `ONEDECORE_META_ADS_*`,
`ONEDECORE_GOOGLE_ADS_*`, `NEXT_PUBLIC_APP_URL`.

New variables L3/L4 will introduce (none exist yet): a GTM container ID, and
whatever GA4/Pixel/Ads identifiers the tag strategy places in the container
rather than in code.

Governance: no secret appears in the repository, and every mode refuses
`enabled` when its credentials are absent. That property must survive the
tagging work.

---

## 5. Database readiness

Read from migrations at the audited head. **No migration is proposed by L0.**

| Need | State |
| --- | --- |
| Lead attribution storage | **Ready** — `leads.attribution` (jsonb) |
| UTM + `fbclid`/`gclid`/`wbraid`/`gbraid`/`fbc`/`fbp` normalisation | **Ready** — allow-listed key projection, migration `20260821140000` |
| First-touchpoint projection | **Ready** — trigger-driven, with campaign-reference validation |
| Campaign attribution / metrics / conversion-feedback tables | **Ready** — migration `20260821140000` |
| Consent records, versions, suppression | **Ready** — consent registry effective |
| WhatsApp identity, conversation, message, status | **Ready** — Phase 6B foundations |
| Conversion feedback **delivery** to providers | **Missing** — see SEQ-01. Tables exist; nothing sends. |

---

## 6. Explicitly deferred (L12) — must not delay launch

Recorded so they are visibly out of scope, not forgotten.

1. Sales Manager `/auth/forbidden` session/UX issue.
2. Staff portal acceptance pass.
3. Internal dashboard polish, including anything further on the Sales Manager
   dashboard shipped in PR #153.
4. Owner mobile app polish.
5. AI / copilot / automation.
6. n8n secondary workflows.
7. Additional commerce and admin refinements — **except** the RISK-08 decision
   on whether `/shop` stays publicly enabled during launch, which is a launch
   scope question and is answered in L0.

---

## 7. L0 exit gate

| Exit criterion | State |
| --- | --- |
| Exact public launch surface is known | **MET** — §1, code + live |
| Every remaining task classified blocker / post-launch / deferred | **MET** — §3.1, §3.2, §3.3, §6 |
| No ambiguous "maybe needed" items remain | **MET** — every row has an owner and required evidence |
| No production behaviour change in this phase | **MET** — audit only; read-only HTTP GET; no form submitted, no lead created |
| Production main SHA and live VPS SHA recorded | **MET** - both are `96ee6da586fe1dc89eb7a628260ed8815fe23fed` |

**L0 is complete.** BLOCK-01 is closed by direct production-VPS evidence.

---

## 8. The critical path out of L0

The audit changes the plan's emphasis in three places. The ordering below
reflects what actually blocks what.

1. **BLOCK-03 + BLOCK-04** (L2) — the legal text currently *denies* that
   tracking exists. Tags cannot be installed truthfully before this is
   corrected, so L2 is a hard predecessor of L3, exactly as the plan sequences
   it.
2. **BLOCK-05, BLOCK-06, BLOCK-07** — the attribution defects. These are the
   most consequential findings in this audit, because they are silent: the
   system will accept paid traffic, create leads, and report them as `direct`.
   Spending money against that is spending blind. They must be fixed **with**
   L3, not after it.
3. **BLOCK-02 + BLOCK-11** (L3/L4/L6) — the measurement layer itself.
4. **BLOCK-08, BLOCK-09, BLOCK-10, BLOCK-15** (L1/L5) — the WhatsApp lane and
   the public phone decision. Journey D cannot be certified without them, and
   the Click-to-WhatsApp campaign cannot exist.
5. **BLOCK-12, BLOCK-13, BLOCK-14** — verification and account ownership.

Nothing in L1 (UI/UX) surfaced as a hard blocker beyond the missing WhatsApp
and phone CTAs: the conversion form is live, active, three-step, mobile-aware
and consent-correct. L1 is therefore an acceptance pass over an existing
funnel, not a rebuild — with the exception that the WhatsApp CTA must be added
before the UI is frozen.
