# Phase 6C — Migration-Independent Prebuild Audit (K0–K3)

**Status:** migration-independent prebuild COMPLETE — formal Phase 6C runtime/persistence NOT STARTED  
**Date:** August 7, 2026  
**Start main:** `f56f6964cf6aca3a969fc731483dc75f36849d40`  
**End main:** see PR ledger / final report

## Governance alignment

- ADR-0021: Groq behind provider-independent adapter; human-controlled copilot only
- Structured schema-validated outputs; human review before customer-visible use
- No auto-send, assignment/status mutation, quotation approval, or DB credentials

## Deliverables

| Packet | Branch | Scope |
| --- | --- | --- |
| K0 | `phase-6c-prebuild-contracts` | Shared contracts + task schemas |
| K1 | `phase-6c-prebuild-ai-core` | Provider interface, fake/Groq adapters, task engine |
| K2 | `phase-6c-prebuild-context-safety` | Context bounds, PII, injection defense, audit interfaces |
| K3 | `phase-6c-prebuild-ui` | Human-controlled assist UI + inbox/quotation callbacks |

## Key paths

- `src/features/kriti/contracts/` — task types, context, provider I/O, errors, schemas, audit, human control
- `src/features/kriti/providers/` — inference provider, deterministic fake, Groq adapter (disabled by default)
- `src/features/kriti/server/` — env, `runKritiTask`, `createKritiRuntime`
- `src/features/kriti/context/`, `safety/` — bounded assembly, PII, prompt policy
- `src/features/kriti/components/` — assist panel, task picker, result card, draft editor, warnings, status, retry
- `src/features/kriti/integrations/` — inbox insert-draft, quotation wording callbacks only

## Tests

- `npm run test:phase-6c-k0` through `npm run test:phase-6c-k3`

## Non-actions

| Item | Status |
| --- | --- |
| Migrations M22+ | **None** |
| M19/M20/M21 | **Unchanged** |
| Managed Supabase writes | **None** |
| Live Groq calls / production keys | **None** |
| Kriti admin routes activated | **None** |
| WhatsApp send-intent from Kriti | **None** |
| Append-only audit persistence | **Deferred** |

## Deferred formal persistence

Interfaces only (`KritiRequestAuditEvent`, `KritiSuggestionAuditEvent`, `KritiHumanUseAuditEvent`, `KritiDismissAuditEvent`, `KritiAuditSink`). No-op sink for tests. SQL/RLS/M22+ after Phase 6B closeout.
