# ONEDECORE INT-9A/B/C — Internal acceptance (source-only, HOLD)

Date: 2026-10-23 IST. Branch: `feat/onedecore-int9-final-closure`. All execution remained isolated to the JARVIS worktree and disposable local Supabase `OneDecoreInt9Cert`, with both WhatsApp inbound/webhook and outbound disabled. No remote managed DB, Meta API, or customer messaging was touched.

## A. Historical source reconciliation — completed inventory, provenance gap remains

- Enumerated **230** published origin branch references and local ONEDECORE worktrees; no separate `INT-7` or `INT-8` implementation branch was identifiable. Previous narrative reported INT-7 changes but the actual original patch set and final test artifacts are **not available** in the connected evidence.
- Current source contains the service-role worker architecture, SQL `FOR UPDATE SKIP LOCKED` claims, request-start before provider dispatch, stale-lease reconciliation, CRM pages, and INT-9 hold-preflight.
- The disposable Postgres catalog returned **622 SECURITY DEFINER** functions, all **622** with explicit search_path. Counted **15** anon-executable and **333** authenticated-executable definer functions; role-callability alone does not certify their authorization or historical parity.
- No prior INT-7 commit has been cherry-picked or claimed as integrated without source. **INT-9A provenance status: UNVERIFIED**, requirements/current-source analysis documented.

## B. Actual simultaneous worker certification — PASS

Command from uniquely isolated local Supabase fixture (run only with `ONEDECORE_WHATSAPP_OUTBOUND_MODE=disabled` and `ONEDECORE_WHATSAPP_WEBHOOK_MODE=disabled`):

```powershell
node scripts/int9-worker-contention-lab.mjs
```

- **11/11 PASS** with two independent `docker exec ... psql` processes and overlapping SQL transactions.
- Each claimed exactly one distinct synthetic job/recipient/lease token; active-lease reclaims returned zero.
- Staff-authenticated attempts denied; expired *pre-provider* claims reissued new tokens/attempt 2; stale token rejected.
- An expired *post-provider-start* claim reached `needs_reconcile`, never requeued as an automatic send.
- Zero provider message rows with INT9 ids; no Graph API, WhatsApp or actual outbound network send was called.
- The two-worker result proves the tested simultaneous SQL claim/recovery cases, **not** an independent security approval or full production load test.

## C. CRM owner and browser accessibility

- First CRM 2E owner run gave 29/30 because B synthetic leads were present in the same disposable cohort. This was test-environment contamination.
- After a fresh database reset, with B synthetic leads absent, **30/30 CRM 2E owner QA PASS**. Analytics SQL was unchanged.
- Browser QA must verify actual local rendered pages, 360/390/430 mobile and 768/1024/1366/1440 desktop, clipping/scroll/touch targets, plus keyboard focus and a role-specific accessibility check. Do not infer all these from React source tests alone.
- Actual authenticated Chrome DOM/keyboard audit across **4 routes × 4 viewports**: **13/16 PASS** before the focused CSS patch. Leads, Nurture, and Reports passed at 360, 390, 768 and 1366px; all interactive visible controls examined had names; first Tab reached an anchor on 360/1366. The Scheduler produced root overflow **447px at 360**, **417px at 390**, **69px at 768** (1366 passed).
- Patched `campaign-scheduler.css`: outer grid and child calendar shell/month now set `min-width:0` / `max-width:100%`; retained the intended scrollable 760px month grid on narrow screens. Source regression `whatsapp-campaign-scheduler.test.ts` passes **11/11** with new layout assertion.
- The previous management reports browser suite also passed seven viewport layout probes, but timed out when switching from Super Admin to Sales Executive (twice). This role-switch/browser-session failure was **not resolved** here and its accessibility certification remains pending.
- After the patch, a **separate real Chrome layout-rendering test** using the shipped scheduler CSS and representative calendar DOM returned **4/4 PASS** at 360/390/768/1366px: root overflow zero at all widths; month scroll widths 760px on mobile/tablet. This confirms CSS layout mechanics, **not** the complete authenticated CRM page.
- A final authenticated whole-page browser rerun was **not obtained**. The focused source CSS test and offline Chrome fixture do not replace it; INT-9C remains **NOT CERTIFIED** until the actual logged-in scheduler and keyboard/role transition tests pass.
- No RLS, Auth grants, managed database, provider or campaign execution flags were changed.

## Current release decision

**Superseded by INT-10 acceptance:** See `INT10-FINAL-INTERNAL-CERTIFICATION-20261023.md` for the passing authenticated Scheduler and role-transition browser retests. The historical observations above remain accurate for their earlier test runs. Deployment/activation remains HOLD pending independent security and release approvals.
