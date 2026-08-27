# CRM 2A-5 — Lead Detail Activity UX Implementation Plan

**Goal:** Activate CRM 2A-4 activity server actions on the lead-detail page with premium next-action UX, structured completion, and governed WhatsApp evidence — **no SQL migration**.

**Document date:** 2026-08-27  
**Baseline SHA:** `1797cf1299f3efba41cda30b1ff8710157520162` (protected `origin/main`, PR #102 merged)  
**Branch:** `crm-2a5-lead-detail-activity-ux`  
**Managed Supabase tip:** `20260828140000` / `crm_activity_rpc_workflows` (unchanged)  
**SQL migration:** **NONE**

---

## Audit summary

| Area | Finding |
| :--- | :--- |
| Lead detail page | Server component; legacy `LeadDetailFollowUps` + basic follow-up composer/actions |
| 2A-4 backend | Present: contracts, service, five server actions, enriched `CrmLeadDetailFollowUp` DTO |
| Assignment / status / notes | Unchanged legacy islands retained |
| WhatsApp evidence | No CRM read helper existed; inbox tables + RLS allow scoped SELECT of `dispatch_bound` intents by lead conversation |
| Tests | Extended `phase-5c2c-lifecycle-collaboration.test.ts`; added `crm-activity-ui.test.ts` for targeted runs |
| Lane collisions | No open 2A-5 PR; worktree clean at baseline |

---

## Component / file map

| File | Role |
| :--- | :--- |
| `src/app/admin/crm/leads/[leadId]/page.tsx` | Fetches outcomes + WhatsApp intents; renders `LeadActivityWorkspace` after lifecycle panel |
| `src/features/crm/components/activities/LeadActivityWorkspace.tsx` | Orchestrates primary card, no-action banner, create/list/history, dialogs |
| `PrimaryNextActionCard.tsx` | Prominent primary next action (Complete, Reschedule only) |
| `NoNextActionBanner.tsx` | Risk state + Create next action CTA |
| `CreateActivityForm.tsx` | Structured create via `createLeadActivityAction` |
| `CompleteActivityDialog.tsx` | Outcome + resolution subforms via `completeLeadActivityAction` |
| `RescheduleActivityDialog.tsx` | Keep/set/clear reminder via `rescheduleLeadActivityAction` |
| `OpenActivityRow.tsx` | Secondary open activities + Make Primary / Transfer |
| `TransferActivityDialog.tsx` | Secondary transfer via `transferActivityOwnershipAction` |
| `activity-ui-utils.ts` | Labels, due-state, outcome filter, defaults |
| `src/features/crm/lib/local-datetime-to-iso.ts` | Client `datetime-local` → absolute ISO boundary |
| `src/features/crm/server/crm-whatsapp-evidence-queries.ts` | Governed send-intent list for lead (RLS-gated) |

Legacy `LeadDetailFollowUps` / `LeadFollowUpComposer` remain in repo but are **not wired** on lead detail.

---

## UX behaviors

### Primary card
Open primary shown in gold-bordered card near top with type, title, due state (overdue/today/upcoming), owner, priority, reminder, optional quotation. Actions: **Complete**, **Reschedule** only.

### No next action
When assigned, non-terminal, non–on-hold lead has no open primary: red **No next action** banner with **Create next action** CTA (scrolls to create form, defaults primary checkbox).

### Create activity
Types, title, due, priority, duration, reminder, optional owner (broad scope), optional quotation link, make-primary toggle. Default durations per type; suggested titles editable.

### Complete activity
Structured outcome from DB catalogue (filtered by activity type). Resolution matrix via `getCompletionResolutionOptions`:

| Lead state | Activity | Options |
| :--- | :--- | :--- |
| Terminal | primary or secondary | `NONE` only |
| Active primary | open primary | `NEXT_PRIMARY`, `ON_HOLD`, `CLOSED_LOST` |
| Active secondary + surviving primary | secondary | `NONE`, `NEXT_PRIMARY`, `ON_HOLD`, `CLOSED_LOST` |
| Active secondary without primary | secondary | `NEXT_PRIMARY`, `ON_HOLD`, `CLOSED_LOST` |
| `on_hold` | any | same as active, but `ON_HOLD` omitted |

Defaults: terminal / secondary-with-primary → `NONE`; otherwise → `NEXT_PRIMARY`. **Never CLOSED_WON.**

Resolution-specific FormData only: `nextActivityType` and other next fields submit only when `NEXT_PRIMARY` is selected (no cross-resolution leakage).

### Create activity owner
Broad-scope owner select defaults to empty string (“Assign to me”) → parser `null` → service `context.userId`. Real UUIDs unchanged. Do not send `"self"`.

### Timestamp boundary
All forms use `datetime-local` in UI; `appendAbsoluteTimestampsFromLocalFields` converts to ISO with `Z` before server actions.

### WhatsApp evidence
`fetchGovernedWhatsappSendIntentsForLead`: conversations by `lead_id` → `whatsapp_send_intents` where `lifecycle_status = dispatch_bound`. No CRM migration; RLS authoritative. Lead page does **not** swallow arbitrary query failures with `.catch(() => [])`.

### Capability-driven controls
- `canManageLeadFollowUps`: mutations
- `canReadBroad` (`canChooseFollowUpOwner`): owner select + secondary transfer
- Primary never shows transfer or Make Primary

---

## Pre-merge UX contract corrections (2026-08-27)

| Fix | Result |
| :--- | :--- |
| Create owner `"self"` | Replaced with empty option; strict 2A-4 parser unchanged |
| Always-submitted `nextActivityType` | Rendered only inside NEXT_PRIMARY branch |
| Resolution matrix | Pure helper matches 2A-3; terminal + secondary paths corrected |
| WhatsApp `.catch(() => [])` | Removed from lead-detail page |
---

## Tests

- `src/features/crm/__tests__/phase-5c2c-lifecycle-collaboration.test.ts` — 2A-5 architecture block (in `test:app`)
- `src/features/crm/__tests__/crm-activity-ui.test.ts` — datetime, filtering, component static proofs (targeted)

---

## Overlap / exclusions

| Lane | Status |
| :--- | :--- |
| 2A-6 My Day | Not touched |
| 2A-7 Assignment automation | Not touched |
| M38 / payment | Not touched |
| `package.json` | Not edited |
| `supabase/migrations/**` | Not edited |

---

## Final changed files (implementation)

See git diff at commit time — expected new/edited paths listed in component map above plus this document and test extensions.
