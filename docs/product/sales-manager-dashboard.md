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

## Navigation

The workspace has its own grouped navigation contract
(`src/features/manager-workspace/contracts/manager-nav.ts`). It is not
`resolveOpsNavFlags`: the owner's sidebar is assembled from permission flags
across the whole product, and a boundary that depends on which flags happened to
be `false` is a boundary that opens when one flips.

Every entry is a workspace the role already holds. The list decides what is
**offered**; the route's own guard decides what is **allowed**.

| Group | Entry | Route | Admitted by |
| --- | --- | --- | --- |
| Overview | Dashboard | `/manager` | `requireSalesManager` |
| Sales | My Day | `/admin/crm/my-day` | `requireCrmReadAccess` |
| Sales | Enquiries | `/admin/crm/leads` | `requireCrmReadAccess` |
| Sales | Pipeline | `/admin/crm/pipeline` | `requireCrmReadAccess` |
| Sales | Calendar | `/admin/crm/calendar` | `requireCrmReadAccess` |
| Sales | Quotations | `/admin/quotations` | the quotations workspace guard |
| Sales | Sales Targets | `/admin/crm/targets` | `requireCrmSalesTargetsAccess` |
| Sales | Reports | `/admin/crm/reports` | `crm.reporting.read` |
| Communication | WhatsApp | `/admin/whatsapp/inbox` | the inbox guard |
| Projects | Project Status | `/admin/projects` | `projects.read_high_level` |
| Team | Attendance | `/admin/attendance` | `attendance.self`, `attendance.team.read` |
| Team | Leave | `/admin/leave` | `leave.self`, `leave.team.approve` |
| My account | My Salary | `/admin/salary` | `requireSalaryAccess` |

**New Enquiry** (`/admin/crm/leads/new`, `requireCrmCreateAccess`) is a dashboard
quick action rather than a sidebar entry: it is something the manager does
occasionally, not a place they live. It is a link to a route that carries its own
form and its own guard — the dashboard itself stays a read surface.

**Sales Targets is read-only for this role.** It holds `sales_targets.read` and
not `sales_targets.manage`; setting a target remains the owner's.

**My Salary is self-only.** The role holds `salary.self` and not
`salary.manage`, so the entry is the manager's own statements and payment
history. No payroll administration is offered anywhere in the workspace, and the
tests assert that neither the nav contract nor the dashboard reaches for
`salary.manage` or `requireSalaryManageAccess`.

Not offered, in the navigation or the quick actions: Campaigns, Landing Lab,
Commerce, Portfolio, Imports, Assignment Rules, SLA Settings, staff
credentials/administration, Attendance Policies, Holidays, salary management, and
enquiry deletion.

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

**Needs attention** — captioned "Team priorities for today", with **Open My Day**
(`/admin/crm/my-day`) as the panel's call to action. Individual rows still link
straight to the lead they are about.

Above the queue sit the read model's own **per-reason counts**, reported one by
one: SLA breached, follow-up overdue, unassigned, no next action, new/uncontacted.

The queue below them is priority ordered — SLA breach → overdue follow-up →
unassigned → no next action → new/uncontacted, oldest first within a reason — and
**de-duplicated by lead**, keeping the worst reason. It is bounded at 8 rows.

Those two facts do not add up, and the panel does not pretend they do. A lead
that is both unassigned and uncontacted is **one enquiry with two signals**. So:

- the sum of the per-reason counters is reported as `N attention signals`,
  never as `N enquiries`;
- the only count described as enquiries is the displayed, bounded one —
  `Showing 8 highest-priority enquiries`;
- no unique-enquiry total is offered at all. The upstream row arrays are bounded
  independently, so a union over them would silently under-count, and a number
  that might be wrong is worse than a number that is absent.

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

**Project status** — up to 8 rows from the dedicated high-level read model, most
recently updated first, with the total count reported. Each row carries the
project number, the client, the **status**, the **design state**, the
**execution state**, the **current Project Manager** and the **current Lead
Designer** — every one of them a field the read model enumerates in its own SQL.
A collapsed one-line "furthest stage" summary is kept as a secondary field; it
does not stand in for the explicit ones.

`Not assigned` is used for an unheld PM or Lead Designer, `Not started` for a
phase that has not begun. Nothing infers a business state beyond what the read
model reported.

Rows link to `/admin/projects/[projectId]`, which already branches to the
high-level-only detail for this role. On narrow screens the table becomes stacked
cards; on wider screens it scrolls inside its own container, never the page.

No raw project rows, no quotation number, no commercial value, no evidence, no
events, no assignment history, no deliverables, no execution logs, no snags — and
no controls. Execution belongs to the assigned Project Manager.

**Quick actions** — New Enquiry first, then the workspaces the role holds.

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
