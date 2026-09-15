# WM-2 … WM-7 — WhatsApp control plane completion (repository audit)

- **Architecture:** [ADR-0034](../ADR/ADR-0034-complete-whatsapp-marketing-control-plane-and-crm-owned-conversation-access.md) · master plan [whatsapp-marketing-control-plane](../product/whatsapp-marketing-control-plane.md)
- **Branch:** `feat/whatsapp-complete-environment` (review branch; not merged or deployed)
- **Production:** OFF. No managed database, Meta account, VPS or other repository was touched. Every provider surface defaults to `disabled`; the marketing execution gate defaults off in the database.

No secret value appears in this document.

## 1. What exists

| Phase | Migration | Database proof | App proof |
| --- | --- | --- | --- |
| WM-2 Template Studio, UTILITY 1:1, media seam | `20260913140000_whatsapp_template_studio_utility_send.sql` | pgTAP `65` | `test:wm-7` §3 |
| WM-3 Contacts, MARKETING consent/preferences, opt-out, segments, send policy | `20260914100000_whatsapp_contacts_consent_segments_policy.sql` | pgTAP `67` | `test:wm-3` |
| WM-4 Campaign execution | `20260915100000_whatsapp_campaign_execution.sql` | pgTAP `66` | `test:wm-4` |
| WM-2/3/4 runtime hardening | `20260916100000_whatsapp_control_plane_runtime_hardening.sql` | pgTAP `66`, `67` | `test:wm-3`, `test:wm-7` |
| WM-5 Analytics and attribution | `20260917100000_whatsapp_analytics_attribution.sql` | pgTAP `68` | `test:wm-5` |
| WM-6 Automations, Flows, CTWA | `20260918100000_whatsapp_automations_flows_referrals.sql` | pgTAP `69` | `test:wm-6` |
| WM-7 Certification | — | pgTAP `01`, `57`, `64`–`69` | `test:wm-7` |

Routes: `/admin/whatsapp/{inbox,contacts,templates,campaigns,segments,automations,forms-flows,analytics,settings}`, `POST /api/internal/whatsapp-campaign-execution/dispatch` (bearer: existing `ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET`), `GET /api/admin/whatsapp/analytics/runs/[runId]/export` (Super Admin), `GET /w/c/[token]` (opaque click redirect).

## 2. Defects found in the uncommitted WM-2/3/4 work and fixed

| Defect | Effect | Fix |
| --- | --- | --- |
| Campaign reads queried `campaign_versions` directly | Sales Managers (no generic `campaigns.read` since the SM hardening) saw no campaign at all | Reads go through `list_/get_whatsapp_campaign_version(s)` (approved-only for operators) |
| App called `materialize_whatsapp_campaign_run` and passed `p_template_parameters` to test sends | Neither exists in the migration; stale generated types hid it | RPC map rebuilt; types regenerated from a clean reset |
| Spec action checked `whatsapp.campaigns.execute`, dropped bindings/segment | SQL requires `campaigns.draft`; per-recipient bindings impossible | Action checks `campaigns.draft` + `templates.read`, per-variable static/CRM binding form |
| Worker never drained test sends | Test sends stayed pending forever | Worker drains test sends (single attempt, ambiguous parks) |
| `cancel_whatsapp_campaign_run` refreshed before cancelling | Cancelling the last pending jobs auto-completed the run, then hit the terminal guard | Cancel sets status and counters in one statement |
| Preview ignored a closed execution gate | Preview reported recipients eligible that JIT would skip | Preview uses the JIT rule (`send_policy_unconfigured`) |
| Contacts search escaped only the count | `%`/`_` acted as wildcards on the page | One escaped pattern |
| Inbound opt-out lacked NFKC and Meta's opt-out button | Full-width STOP and "Stop promotions" were missed | SQL and TS classifier updated; still restrictive only |
| Channel core imported `whatsapp-marketing` | Broke the WM-0 dependency boundary | Classifier moved to `whatsapp/contracts/inbound-opt-out.ts`, re-exported |
| pgTAP `66` assumed Sales Managers draft/approve | Suite died at test 7; WM-3 had no pgTAP | Shipped grants asserted first, then an in-transaction re-grant exercises independence; `67` added |

## 3. Locked boundaries and where they are enforced

- **Official Cloud API only**: every Graph URL is built by `whatsapp-graph-url.ts` (numeric ids + reviewed edges); sends are `type: "template"`.
- **Service consent is not marketing consent**: `private.whatsapp_latest_marketing_consent` reads `purpose_code='MARKETING'` only (pgTAP `67`).
- **Ownership = `leads.assigned_to`**; reassignment and tombstones are re-proved at send time (pgTAP `64`, `65`); automations stop on a tombstoned lead (`69`).
- **Legacy `management`/`sales` receive no WM code**; Project Manager/Designer see no WhatsApp section (`test:wm-7` §1–2, pgTAP matrices).
- **Kriti draft-only**: no Kriti module references a send, approval, automation, Flow, consent or opt-out path (`test:wm-6`).
- **n8n relay-only**: nothing but the bearer-authenticated worker route drives queues; SQL decides everything.
- **Ambiguity ⇒ needs_reconcile**: campaign jobs, test sends and automation enrollments; only a Super Admin records an audited decision; nothing is re-queued.
- **Tracked links**: 32 random bytes per recipient, SHA-256 stored, Super Admin-allowlisted https destinations, re-validated at click time; unknown and malformed tokens redirect identically.
- **Reply attribution**: exact inbound context first; inference only for the first reply within 72 hours of a governed send, labelled `inferred_window`.
- **Flows**: provider id/status writable only by the service-role outcome path (guard trigger); unknown statuses stay `unknown`; answers fill only empty `locality` / `budget_comfort_code` on a live lead.
- **CTWA**: host + hash of the source URL, ad id, click id; Meta CDN media URLs dropped; never identity, consent or ownership.

## 4. Activation checklist (owner-gated, in order)

1. Apply the six migrations to the managed project through the normal reviewed release, **before** deploying this code; run `npm run check:db` against a reset first. The webhook calls `record_whatsapp_inbound_evidence` (and `record_whatsapp_referral_context` when Meta sends a referral) after every inbound message; without the migrations it answers 500 and Meta retries.
2. Configure `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, confirm `META_WHATSAPP_GRAPH_API_VERSION` against current Meta docs.
3. `ONEDECORE_WHATSAPP_TEMPLATE_MODE=enabled`, sync templates, confirm APPROVED MARKETING/UTILITY rows.
4. Super Admin publishes a send policy (caps, quiet hours) with execution still **off**; allowlists tracked-link destinations; sets `ONEDECORE_WHATSAPP_CLICK_ALLOWED_HOSTS` if a destination is off the app host.
5. Run a campaign test send to an internal number with `ONEDECORE_WHATSAPP_OUTBOUND_MODE=enabled` and execution still off.
6. Turn the execution gate on; schedule a small run; watch Analytics and the reconcile backlog.
7. `ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE=enabled`; `ONEDECORE_WHATSAPP_FLOW_MODE=enabled` only when a Flow is ready for review.
8. Point the scheduler relay (e.g. n8n) at the worker route with the existing worker secret.

## 5. Rollback posture

Close gates, never delete evidence: execution gate off (new policy version), `ONEDECORE_WHATSAPP_OUTBOUND_MODE=disabled`, pause runs and automations, archive automations, deactivate destinations (queued sends skip with `click_destination_unavailable`). Schema rollback is a forward migration.

## 6. Known debt

- Flow buttons in campaign/automation templates are supported by the claim builder; the Flow token path is proved in SQL, not yet against a live Meta Flow.
- Automations are one step (trigger → delay → one send); multi-step branching is not built.
- Conversion attribution is "influenced within 30 days" on live leads; it is not causal and excludes tombstoned leads.
- `whatsapp.flows.manage` publish is available to Sales Managers per the WM-0 matrix; there is no separate Flow approval.
- The generic capability matrix still lists `campaigns.*` for Sales Manager as the M31/M33 original; the database revoked them in the SM hardening and every WhatsApp path follows the database.
