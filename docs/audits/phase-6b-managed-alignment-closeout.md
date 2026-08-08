# Phase 6B — Managed Alignment & Governance Closeout

**Status:** **COMPLETE** (August 8, 2026)
**Protected main (start/end):** `b83a2c4e529a076921e33618c016b0122f825f26`
**Managed project:** OneDecore `lpurlfmpvriyvpkujvyl` (ap-south-1)
**Owner authorization:** `PROCEED PHASE 6B M19-M21 BATCH APPLY` (fresh, post READY gate)

---

## A. Recovery & pre-write gate

| Item | Value |
| --- | --- |
| Qualified recovery | Backup **1313589467** |
| Timestamp | `2026-08-07T19:53:32.362Z` |
| Type | physical/WALG |
| Status | COMPLETED (unchanged pre-write) |
| M18 cutoff | `2026-08-07T02:28:47.5378509Z` |
| Managed start | M1–M18 only |
| Pending batch | M19, M20, M21 only |
| Project/control-plane | ACTIVE_HEALTHY |

Frozen migration hashes (UTF-8 LF SHA-256) verified unchanged pre-write:

| Migration | SHA-256 |
| --- | --- |
| M19 `20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql` | `77C8C994C8C391C1E5423584740FDAA1DA9D38064898FC1DEA0CDB99A41BB7F4` |
| M20 `20260807140000_whatsapp_shared_inbox_read_model_foundation.sql` | `A80BAB2FE5E0C7E5E2B986839573AC8881C773EF49A81B8A15EF9EB7CF5A05EB` |
| M21 `20260808140000_whatsapp_provider_dispatch_foundation.sql` | `15178D62677667CD49B08DCA9D2D9907A2AF2F24C658A56CF3ACC1D73F9900DE` |

---

## B. Sequential managed apply (CLI `supabase@2.109.1 db push --linked --yes`)

Each step applied exactly one pending migration by staging later frozen files outside `supabase/migrations/` (no frozen-file edits; no ad-hoc SQL; no migration-history repair).

| Step | Start (UTC+5:30) | End | Exit | Post-apply remote history |
| --- | --- | --- | ---: | --- |
| M19 | `2026-08-08T07:49:35` | `2026-08-08T07:49:44` | 0 | M1–M19; M20/M21 absent |
| M20 | `2026-08-08T07:52:36` | `2026-08-08T07:52:44` | 0 | M1–M20; M21 absent |
| M21 | `2026-08-08T07:53:26` | `2026-08-08T07:53:33` | 0 | M1–M21; pending none |

---

## C. Managed verification summary

### M19 (send-intent foundation)

- Tables: `whatsapp_send_intents`, `whatsapp_send_intent_events` (0 rows)
- RLS enabled on both tables
- Three `whatsapp.inbox.*` permissions present
- `create_whatsapp_service_send_intent`: anon denied; authenticated granted (invoker wrapper)
- Linked `db lint`: 0 schema errors

### M20 (read model foundation)

- Scoped SELECT policies: `whatsapp_conversations_select_scoped`, `whatsapp_messages_select_scoped`
- Authenticated SELECT granted; authenticated INSERT denied on conversations/messages
- Pre-existing conversation/message rows unchanged (0 at apply)
- Linked `db lint`: 0 schema errors

### M21 (provider dispatch foundation)

- Table: `whatsapp_provider_dispatch_attempts` (0 rows; RLS enabled)
- Dispatch RPCs (`claim`, `bind`, `record_outcome`, `reconcile`): **service_role only**; authenticated denied
- Linked `db lint`: 0 schema errors (minor unused-variable warnings in claim function only)

### Batch alignment checkpoint

| Check | Result |
| --- | --- |
| Managed migrations | M1–M21 aligned |
| Repository migrations | M1–M21 (21 files) |
| M22+ | Absent |
| Frozen hashes | Unchanged |
| Recovery 1313589467 | Retained COMPLETED |
| Project health | ACTIVE_HEALTHY |
| Fake business/dispatch rows | None inserted |

**PHASE 6B MANAGED ALIGNMENT — PASS**

---

## D. Security & performance advisors (post-M21)

| Advisor | Result |
| --- | --- |
| Security | 1 WARN — `authenticated_security_definer_function_executable` on `whatsapp_inbox_check_conversation_access` (intentional frozen M19 access resolver; not a post-apply defect) |
| Performance | No new blocking findings recorded |
| Schema lint | PASS |

No schema correction required; **no M22** created in this mission.

---

## E. Integrated local verification (I1)

`npm run qa:phase-6b-integrated-local` — **PASS**

| Step | Result |
| --- | --- |
| `db:reset` (local M1–M21) | PASS |
| `db:test` (pgTAP incl. 13/14/15) | PASS |
| `test:phase-6b-integrated` | PASS |

---

## F. Future-phase regression matrix (migration-independent prebuild)

All PASS on protected main `b83a2c4`:

| Suite | Result |
| --- | --- |
| Phase 6C K0–K3 | PASS |
| Phase 7 C0 / Lane C / Lane D | PASS |
| Phase 8 P0 / 8A / 8B / 8C / shell | PASS |
| Phase 9 P0 / 9A / 9B | PASS |

---

## G. Repository quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run build` | PASS (CI dummy public Supabase env) |
| `git diff --check` | PASS |

---

## H. Activation boundary (unchanged)

| Boundary | Status |
| --- | --- |
| Production deployment | **Not activated** |
| Meta callback/token | **Not activated** |
| Real customer outbound | **Not activated** |
| Public intake | **Inactive** (`copy-only` / `disabled`) |
| n8n correctness dependency | **Not production activated** |
| Kriti formal runtime | **Not activated** |
| Phase 9C provider execution | **Not started** |
| M22+ | **None** |

Phase 6B delivers **managed schema + repository application foundations** for role-scoped inbox, send-intent, and server-only dispatch boundaries. Production-live messaging remains Phase 10 gated.

---

## I. Next phase

**Formal Phase 6C** — Groq human-controlled copilot runtime (separate owner authorization).

**Phase 6B audit status:** **COMPLETE**
