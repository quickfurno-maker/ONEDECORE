# CRM 2E — Management Analytics (design)

Branch `crm-2e-management-analytics`. Baseline `53bbd7bca94345872857c07f4a3501702ae275b1`.

Scope: first-response SLA compliance, sales velocity, conversion, forecast and
target achievement, on the existing `/admin/crm/reports` surface. No second
analytics application, no new charting dependency, no AI/ML/LLM, no external
enrichment, no WhatsApp identity work.

---

## 1. Canonical sources (audit result)

| Concern | Canonical source | Established by |
| :--- | :--- | :--- |
| SLA policy + non-retroactive activation | `public.crm_sla_policies` (`is_active`, `effective_from`, `activated_at`, business-hours config) | CRM 2A-2 `20260827140000` |
| Per-lead SLA clock | `public.crm_sla_clocks` (`clock_started_at`, `sla_due_at`, `first_contact_attempt_at`) | CRM 2A-2 `20260827140000` |
| First contact **attempt** | `private.mark_first_contact_attempt_if_qualifying` — qualifying call outcome (`closes_contact_attempt`) or governed WhatsApp send. Immutable once set. | CRM 2A-3 `20260828140000` |
| Stage history | `public.lead_events` (append-only) | Phase 4A `20260729162245`, extended `20260730184426` |
| Current stage entry | latest `lead.created` / `lead.assigned` / `lead.status_changed` / `lead.on_hold` / `lead.resumed` event | CRM 2B `CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES` |
| Deal value + probabilities + weighted pipeline | `private.crm_lead_deal_values`, `private.crm_stage_probability_bp`, `public.get_crm_pipeline_value_summary` | CRM 2D `20260831140000` |
| Closed-Won commercial truth + sales credit | `public.quotation_acceptances` (`credited_sales_executive_id`, `taxable_base_paise`, `sales_achievement_month`) | Phase 7B `20260813140000` |
| Sales targets | `public.sales_targets` + RLS via `private.crm_can_view_sales_target` | Phase 5E `20260803140000` |
| Report filters + IST semantics | `reporting-contracts.ts`, `reporting-date-range.ts` (`Asia/Kolkata`, `+05:30` boundaries) | Phase 5E |
| CRM authorization | `crm-auth.ts` → `CrmAccessContext`; `private.crm_can_view_lead`, `private.crm_has_broad_lead_read` | Phase 5B / 5E |

### Findings that shaped the implementation

1. **`lead.status_changed` carries two payload spellings.**
   `private.transition_lead_status_impl` writes `{from, to}`.
   `private.accepted_quotation_close_won_impl` (Phase 7B) writes
   `{from_status, to_status}`. Stage reach reads
   `coalesce(event_data->>'to', event_data->>'to_status')`; reading only one
   spelling would silently drop every accepted-quotation Closed-Won out of the
   funnel.

2. **`crm_sla_clocks.breached_at` has no writer.** CRM 2A-2 explicitly deferred
   the breach daemon and nothing since writes the column. Breach is therefore
   derived from `sla_due_at` versus the attempt (or versus now), never read from
   `breached_at`.

3. **SLA eligibility is already non-retroactive in the data.**
   `private.ensure_first_contact_sla_clock` writes `sla_due_at` once, at
   receipt, and only when the policy was active, hours were configured and
   `created_at >= effective_from`; existing NULL dues are never rescoped later.
   Using `sla_due_at IS NOT NULL` as the denominator therefore inherits
   non-retroactivity instead of re-deriving it.

4. **Sales credit and lead visibility can never disagree.**
   `credited_sales_executive_id` is a snapshot of `leads.assigned_to` taken at
   acceptance, and `crm_assignment_mutation_hardening` refuses any assignment
   change on a `closed_won` lead. So an RLS-scoped SUM over
   `quotation_acceptances` is exactly the caller's own credited achievement —
   no under-count, no second credit rule needed.

5. **PostgREST is capped at 1000 rows** (`supabase/config.toml max_rows`).
   Whole-cohort denominators cannot be derived client side.

---

## 2. Architecture

```
/admin/crm/reports  (unchanged route)
  └─ CrmReportsPanel                    filter form (unchanged filters)
       ├─ CrmManagementAnalyticsPanel   ← CRM 2E
       └─ existing factual reports      (unchanged metrics)
```

Server reads, both scoped by the caller's own RLS:

| Read | Function | Origin |
| :--- | :--- | :--- |
| SLA, velocity, conversion, targets | `public.get_crm_management_analytics` | **CRM 2E — the one new migration** |
| Forecast | `public.get_crm_pipeline_value_summary` | CRM 2D, reused verbatim |

`get_crm_management_analytics` is **SECURITY INVOKER**. Every base relation it
reads (`leads`, `crm_sla_clocks`, `lead_events`, `sales_targets`,
`quotation_acceptances`) is read as the caller, so existing five-role RLS is the
only scope authority and no aggregate can span a scope the caller could not
already enumerate row by row. No table, column, permission, role grant or RLS
policy is added or altered. Stage probabilities are **not** re-declared; the
forecast keeps its single home in CRM 2D.

Owner scope is resolved three times over: the page pins a non-broad caller to
their own id, the RPC refuses a foreign `p_owner_id`, and RLS refuses it again.

### Measurement frames

* **Cohort** — leads *received* in `[start, end]` (`leads.created_at`),
  optionally narrowed by owner and primary source. SLA, conversion and
  stage-to-stage velocity are cohort measures.
* **Current** — the open book right now; the date range is not applied. Active
  lead age, days in current stage and the whole forecast are current measures.

The status filter is deliberately **not** applied to cohort analytics: filtering
a funnel by current status destroys its denominators.

All percentages are integer **basis points** (1/100 of a percent) and are `null`
whenever the denominator is zero. `null` renders as an explicit unknown, never
as `0%`.

---

## 3. Formulas

### A. First-response SLA (cohort)

```
eligible   = cohort ∧ sla_due_at IS NOT NULL
met        = eligible ∧ attempt IS NOT NULL ∧ attempt <= sla_due_at
breached   = eligible ∧ ( (attempt IS NOT NULL ∧ attempt >  sla_due_at)
                        ∨ (attempt IS NULL     ∧ now      >  sla_due_at) )
pending    = eligible ∧ attempt IS NULL ∧ now <= sla_due_at
outOfPolicy= cohort ∧ sla_due_at IS NULL
decided    = met + breached
compliance = met / decided            (null when decided = 0)
```

`attempt` is `crm_sla_clocks.first_contact_attempt_at` — the first *qualifying
contact attempt*, not a connection. A pending lead is undecided and is excluded
from both sides of the compliance ratio, so the number cannot move while nobody
has acted.

### B. Sales velocity

Medians throughout, defined exactly as `percentile_cont(0.5)`: sort ascending,
average the two middle values on an even sample, `null` on an empty sample.

| Metric | Frame | Sample |
| :--- | :--- | :--- |
| Median time to first contact | cohort | `first_contact_attempt_at − clock_started_at`, leads with an attempt |
| Median active lead age | current | `now − created_at`, open leads |
| Median days in current stage | current | `now − latest stage-entry event` (fallback receipt), open leads |
| Stage-to-stage medians | cohort | `entry(S₂) − entry(S₁)` where both first entries exist and `S₂ ≥ S₁` |

Open = not `closed_won`, not `closed_lost`, not `on_hold`. Time-to-first-contact
is wall clock; business-window arithmetic exists only for computing
`sla_due_at` and is not reused. Measured pairs: received→contacted,
contacted→qualified, qualified→consultation_scheduled,
consultation_scheduled→proposal_sent, proposal_sent→negotiation,
negotiation→closed_won. A pair with no reconstructable history reports no data,
never zero.

### C. Conversion (cohort)

`reached(S)` = a first-entry instant for `S` exists in `lead_events`, **or** the
lead currently stands in `S`. First entry is `MIN(occurred_at)`, so an on-hold
pause and resume can neither inflate nor reset a stage.

Ladder: `received → contacted → qualified → consultation_scheduled →
proposal_sent → negotiation → closed_won`, where `received` is the whole cohort.

```
stepConversion(Sᵢ)    = reached(Sᵢ) / reached(Sᵢ₋₁)     (null when denominator = 0)
overallConversion(Sᵢ) = reached(Sᵢ) / received          (null when received = 0)
wonRate               = reached(closed_won) / received
```

`closed_lost` (reach) and `on_hold` (current status) are reported beside the
funnel, never inside it: a lost or parked lead keeps every stage it reached.

### D. Forecast (current snapshot)

Delegated unchanged to `get_crm_pipeline_value_summary`. Locked probabilities:
`new 5, assigned 10, contacted 20, qualified 35, consultation_scheduled 50,
proposal_sent 65, negotiation 80, on_hold 0 (PARKED), closed_won 100 (actual),
closed_lost 0`. Active totals exclude `on_hold`, `closed_won` and `closed_lost`.
Rounding is per lead then summed, in paise. A lead with unknown value is
excluded from value totals and surfaced through the known/total counts — it is
never treated as ₹0. Probability is a function of stage alone and is never
derived from the lead score.

### E. Target achievement

```
period          = Asia/Kolkata month containing the range start (YYYY-MM)
achieved(row)   = Σ quotation_acceptances.taxable_base_paise
                  where sales_achievement_month = period
                    and (scope = sales_team  or  credited_sales_executive_id = target_user_id)
attainment      = achieved / sales_targets.revenue_target_paise   (null when target <= 0)
remaining       = max(target − achieved, 0)
```

Exact integer paise throughout. `sales_achievement_month` is already derived
`Asia/Kolkata` at acceptance and is used verbatim. The acceptance row set is
RLS-scoped, so an executive sums only their own credited acceptances.

Without `quotations.read`, no acceptance row is visible; achieved, remaining and
attainment are reported as **`null` (unknown)** rather than a truthful-looking
zero.

---

## 4. Authorization

No permission, role grant or RLS policy changes. `crm.reporting.read` continues
to gate the page and now also gates the RPC. Managers, management and
super-admin (broad lead read) see Management Analytics and may filter by
assignee; a sales executive sees My Performance pinned to their own id and can
neither request another owner nor read a team target row.

Deliberately untouched: the WhatsApp conversation→lead identity blocker, and the
pre-existing `crm-2b-owner-qa` local `service_role` issue.

---

## 5. Files

| File | Change |
| :--- | :--- |
| `supabase/migrations/20260901140000_crm_management_analytics_read_model.sql` | new — the single migration |
| `supabase/tests/database/38_crm_management_analytics_read_model_test.sql` | new — pgTAP |
| `src/features/crm/contracts/management-analytics-contracts.ts` | new — contracts + pure metric helpers |
| `src/features/crm/server/crm-management-analytics-queries.ts` | new — read model |
| `src/features/crm/components/reports/CrmManagementAnalyticsPanel.tsx` | new — UI |
| `src/features/crm/components/reports/CrmReportsPanel.tsx` | analytics slot + CRM design tokens; metrics unchanged |
| `src/app/admin/crm/reports/page.tsx` | wires analytics; Management Analytics / My Performance titles |
| `src/features/crm/__tests__/crm-2e-management-analytics.test.ts` | new — focused tests |
| `scripts/crm-2e-owner-qa.mjs` + `.sql` | new — local fixture + independent metric verification |
| `scripts/crm-2e-browser-qa.mjs` | new — authenticated CDP QA at seven widths |
| `src/types/database.generated.ts` | one generated RPC signature added |
| `package.json` | `test:app` entry + `test:crm-2e`, `test:crm-2a-2e`, `qa:crm-2e-owner`, `qa:crm-2e-browser` |
| 4 migration-ledger tests | count 46 → 47 and the new filename added to the allowlist |

## 6. Two defects the rendered QA surfaced, and their fixes

1. **A money aggregate over an empty set rendered as `₹0`.**
   `get_crm_pipeline_value_summary` coalesces an empty `SUM` to `0` so its
   payload stays integer-typed. A stage with `valuedLeadCount = 0` therefore
   rendered "₹0" beside "0 / 3 leads valued" — a claim of a measurement that was
   never made. `knownAggregatePaise` in the panel now returns `null` whenever the
   contributing set is empty, and `formatCompactInrFromPaise(null)` renders
   "Value unknown". A target with a real, readable achievement of zero is a
   genuine `₹0` and still renders as one; the two cases are not interchangeable.

2. **The reports footer link missed the 32px mobile touch-target floor** at 360,
   390 and 430px. It is now an `inline-flex min-h-11` link on its own line.

## 7. Local QA notes

`scripts/crm-2b-owner-qa.mjs` fails locally with `permission denied for table
crm_sla_clocks`: it writes SLA clocks through the service-role client, and the
table revokes everything from `authenticated` and grants nothing to
`service_role`. CRM 2E does **not** widen that grant. `crm-2e-owner-qa.mjs` is
self-contained instead, and its privileged fixture writes run in psql as
postgres — the pattern `supabase/tests/database/*.sql` already uses. Every state
a CRM user could set is still set through the canonical RPCs under a real
authenticated role and JWT claim.
