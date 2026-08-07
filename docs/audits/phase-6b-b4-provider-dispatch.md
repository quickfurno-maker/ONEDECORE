# Phase 6B-B4 — Provider Dispatch Foundation Audit

**Status:** Repository foundation (M21) — pending managed apply  
**Migration:** `20260808140000_whatsapp_provider_dispatch_foundation.sql`  
**Managed OneDecore:** Remains M1–M18 until explicit owner authorization and DEC-0053 recovery readiness for M19+

## Scope delivered (B4)

- Provider-neutral adapter interface with deterministic fake adapter for CI/local-test
- Meta WhatsApp Cloud API adapter behind fail-closed `enabled` mode (Graph API default `v22.0`, env override)
- `ONEDECORE_WHATSAPP_OUTBOUND_MODE`: `disabled` | `local-test` | `enabled`
- Dispatch claim/bind/reconcile RPCs (service_role only) with no DB transaction across remote call
- Pre-dispatch recheck: current assignment, consent/DNC/channel suppression, 24h service window
- `WHATSAPP_SERVICE` text-only path; `template_required` remains fail-closed (no fabricated template approval)
- Provider attempt identity via `provider_attempt_key`; transient/terminal/ambiguous classification
- Outbound `whatsapp_messages` binding only with provider-returned `provider_message_id`
- `latest_status` remains null at bind time; delivery/read evidence stays webhook-driven (M18)

## SCHEMA2 review

| Check | Result |
|---|---|
| M19 send-intent model preserved | PASS — M21 extends, does not amend M19 |
| M18 message/status contracts preserved | PASS — outbound insert mirrors M18 columns |
| No outbound fabrication at intent create | PASS — unchanged B1 guard |
| Service-role-only bind path | PASS |
| RLS on dispatch attempts scoped via inbox read | PASS |
| Separate migration for managed recovery | PASS — M21 is independent of M19 apply gate |
| M18+M19+M21 relational correctness for binding | PASS in repository; managed alignment pending owner gate |

**Conclusion:** No additional repository migration required after M21 for provider binding/lifecycle correctness. Managed apply remains owner-gated per migration (M19 first, then M20, then M21).

## Explicitly not in B4

- Live Meta calls in CI
- Production secrets, callback activation, token rotation, deployment
- n8n / Kriti / Groq
- Media outbound V1
- Fabricated template approval or delivery/read status

## Owner gates

- M19 apply: requires `PROCEED PHASE 6B M19 APPLY` after DB1 recovery readiness
- M20/M21: separate recovery/authorization gates after M19
