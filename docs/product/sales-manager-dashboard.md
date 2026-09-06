# Sales Manager dashboard (V1)

`/manager` is the Sales Manager's landing page. Until this change it was a list
of links with a note saying the dashboard had not been designed yet. It is now
a dashboard.

## What it is, and what it deliberately is not

It is a **dedicated** dashboard. It is **not** the Super Admin dashboard with
cards hidden.

That distinction is the whole design. Hiding a card is a rendering decision, and
a rendering decision is not a boundary: the Sales Manager role lost its boundary
once already by acquiring "just one more" owner surface at a time. So the
manager's dashboard has its own snapshot service, its own shell, its own
sidebar and its own panels, and a test suite asserts that none of the owner's
symbols appear anywhere in that module graph.

It is also **read only**. Nothing on the page mutates anything. Every link leads
to a route that re-checks its own permissions when opened.

## Where the numbers come from

Every value is produced by a canonical read model that already enforces its own
permission. This change added **no migration**, **no permission**, **no
SECURITY DEFINER shortcut** and no SQL of any kind.

| Source | Used for |
| --- | --- |
| `get_crm_my_day` via `fetchCrmMyDaySnapshot` | SLA breaches, overdue, due today, unassigned, and the whole Needs Attention queue |
| `fetchCrmReportingSnapshotForContext` | enquiries received, Closed-Won, Closed-Lost, follow-ups, team workload |
| `fetchCrmManagementAnalyticsSnapshot` (`get_crm_management_analytics`) | SLA compliance, won rate, median first contact, target attainment |
| `listProjectHighLevelStatus` / `readProjectHighLevelStatus` | high-level project status rows |
| `fetchOpsIdentity` | display name and role label |

The composing layer is
`src/features/manager-workspace/server/manager-dashboard.ts`. It imports none of
`loadOpsDashboardSnapshot`, `MetricCard`, `PipelinePanel`, `NeedsAttentionPanel`,
`ActivityFeed`, `SourceDonut`, `RecentLeadsPanel` or `TargetPanel`.

### The period

Every "this month" figure comes from
`resolveReportDateRange({ preset: "this_month" })` — the same canonical
`Asia/Kolkata` helper the reports page uses. There are no hand-built UTC
boundaries, and the client never recomputes a period.

## Failure isolation

| Failure | Result |
| --- | --- |
| Identity or CRM access refused | **Fail closed.** `/auth/forbidden`. |
| Primary CRM read (`get_crm_my_day`) fails | **Fail closed.** The route error boundary at `src/app/manager/error.tsx` renders. |
| Reporting snapshot fails | Sales Performance and Team Workload say **Unavailable**. The rest renders. |
| Management analytics fails | The SLA/won-rate/target block says **Unavailable**. The rest renders. |
| Project read fails | Project Status says **Unavailable**. The rest renders. |

My Day is the primary read because the first four KPI cards and the entire
Needs Attention queue come from it. A dashboard that lost it and rendered zeros
would report *no breaches, no overdue work, nothing unassigned* — good news it
has no basis for. Failing closed is the honest outcome.

## Four absences, never conflated

| Shown | Means |
| --- | --- |
| `0` | The source answered. The answer is none. |
| `No data` | The source answered, but the ratio has no denominator. A won rate over zero enquiries is **not** `0%`. |
| `Unavailable` | The read failed. We do not know the number. |
| `Not configured` | No sales target exists for the period. |

Every value on the page carries its own state alongside its number, and the
display string is derived from that state — never from `value ?? 0`. The tests
assert each case explicitly, including that a genuine zero rate still renders
`0%` and a genuine zero count still renders `0`.

## The panels

**KPI strip (6 cards)** — SLA breaches, overdue follow-ups, due today,
unassigned enquiries, new this month, won rate. The first four come from the
primary read and are always known; the last two carry their own availability.

**Needs attention** — one queue, priority ordered: SLA breach → overdue
follow-up → unassigned → no next action → new/uncontacted. Oldest first within a
reason. A lead that qualifies twice appears once, at its worst reason. The list
is bounded (8 rows); the count above it is not, because it comes from the read
model's own counters rather than from a capped list.

No email address, no phone number, no message body. The panel answers "which
enquiry, whose, how late" and hands off to the lead itself.

**Team workload** — enquiry counts per owner for the period. Ordered
**alphabetically**, not by volume: sorting people by a number invents a
performance metric whether or not anybody calls it one. There is no conversion
rate per person, no response time per person and no ranking. Unassigned is
lifted out of the people list and shown distinctly, because an unowned enquiry
is nobody's workload. When nothing is unassigned there is no row at all, rather
than a zero.

**Sales performance** — this month's volume and outcome, SLA compliance, won
rate, median first contact, and target attainment. The two halves fail
independently.

**Project status** — up to 8 rows from the dedicated high-level read model,
most recently updated first, with the total count reported. Status only: the
stage a project has reached and who is running it. No raw project rows, no
commercial detail, no evidence, no task lists. Execution belongs to the assigned
Project Manager.

**Quick actions** — the workspaces the role holds, one click away.

## Deliberate omissions

These were considered and left out rather than engineered around. None of them
justified a new permission or a broader read.

- **Revenue forecast / weighted pipeline.** `get_crm_pipeline_value_summary`
  exists and the manager can read it, but a forecast on a sales manager's
  landing page invites it to be read as a commitment. The CRM reports page
  already carries it for the same caller.
- **Activity feed.** The owner dashboard has one. A per-person activity stream
  on a manager's dashboard is a supervision surface, not a work surface, and the
  brief excluded productivity and ranking metrics.
- **Per-person conversion, response time, or any leaderboard.** Excluded by
  design — see Team workload above.
- **Campaign, commerce and portfolio figures.** Not the role's.
- **Project commercial values.** The high-level read model exposes them, but a
  sales dashboard showing per-project money is a commercial surface, and the
  panel is a status panel.
- **Lead deletion or any mutation.** The dashboard is a read surface.

## Boundary regression tests

- `src/features/manager-workspace/__tests__/sales-manager-dashboard.test.ts` —
  the behaviour of the derivations, and the composition of the module graph.
- `src/features/manager-workspace/__tests__/sales-manager-control-plane.test.ts`
  — the role gate, the navigation, the redirect rules, and the assertion that
  the landing page is a *dedicated manager dashboard, not the owner dashboard*.
- `supabase/tests/database/49_sales_manager_control_plane_test.sql` — what the
  role may do. Unchanged by this work; it is the role-drift check that proves
  the dashboard needed no new authority.

Run the application side with `npm run test:manager-dashboard`.
