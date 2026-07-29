# Data inventory — Phase 3A1

Code mirror: `src/features/legal/data-inventory.ts`.

Separates **current operational truth** from **future planned processing**.

## Current truth (`DATA_INVENTORY_CURRENT_TRUTH`)

1. The homepage planner and estimator run **in-browser only**.
2. Copied brief text is **not submitted** to any backend.
3. **No contact or lead store** exists from the current homepage.
4. **WhatsApp integration is not live.**
5. **Groq AI processing is not live.**
6. **No campaign data** is collected.
7. **No payment-card or payment data** is processed.

## Inventory categories

| Category | Timing | Current truth summary |
| --- | --- | --- |
| Contact identity | future | No contact data collected from homepage |
| Property requirements | current-and-future | Planner in-browser; not submitted |
| Estimate / budget | current-and-future | Indicative only; not submitted |
| Consent | future | Not captured on current website |
| Messages | future | No message store from homepage |
| Media | current-and-future | Portfolio CMS only; homepage project proof pending |
| Campaign data | future | No campaign engine |
| AI runs / summaries | future | Groq not live |
| Consultation / proposal / project | future | No booking from current website |
| Logs | current-and-future | Supabase auth and Portfolio admin logs |
| Device / network | future | No backend capture from homepage planner |
| Cookies | current | Essential / auth only; no analytics or advertising |
| Payment data | future | Not processed now |

Every entry uses `retentionDecision: "OWNER_DECISION_REQUIRED"`.

## Not in current scope

No lead store, WhatsApp, Groq, campaign engine, or payment processing on the live homepage path.
