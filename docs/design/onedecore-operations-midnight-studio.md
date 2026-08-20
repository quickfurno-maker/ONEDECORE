# ONEDECORE Operations — Midnight Studio

**Status:** Design spec only. **No runtime. No database. No RBAC change. No 9D-C storefront. No M35 apply. No production.**
**Date:** 2026-08-20
**Reviewed main baseline:** `304a9dd7d73720b0a570721b8ccbfec80aed3bac`
**Open governance:** PR #77 (balanced mixed homepage docs) is **OPEN**. This document does **not** compete with that gate, amend ADR-0032, allocate a DEC, or start admin implementation.
**Authority:** Presentation and workflow-cohesion target for a later UI sequence (UI-A–UI-G). Existing ADRs, RLS, permission codes, CRM identity, quotation/project/commerce boundaries, and production gates remain in force.

If this file and an ADR ever differ on security, data, or phase gates, **the ADR wins**.

---

## 1. Product vision

Transform ONEDECORE Admin from a functional internal portal into a premium, fast, role-aware operating workspace.

The finished product should feel like:

- a modern sales CRM,
- a project control centre,
- a commerce operations dashboard,
- and a premium ONEDECORE internal product,

without looking like a generic Tailwind admin template, a SaaS bento-grid demo, a banking dashboard, or a crowded ERP.

**Principle:** Beautiful enough to enjoy using every day. Fast enough to run the business.

Do **not** weaken: current RBAC, existing routes (unless a later PR migrates with compatibility), RLS, permission-based navigation, CRM identity rules, project/quotation/commerce boundaries, or production gates.

This redesign is **UI/UX architecture first**. Reuse existing data and permissions wherever possible.

**Final design statement:** ONEDECORE Admin is not a backend control panel. It is the operating system for ONEDECORE's sales, customer communication, projects, marketing, commerce, content, and people workflows.

Every screen must answer:

1. Where am I?
2. What matters now?
3. What can I do?
4. What needs attention?
5. What happened before?
6. What is the next business action?

---

## 2. Design direction — Midnight Studio

**Theme:** ONEDECORE OPERATIONS — “Midnight Studio”

Visual character: premium, architectural, calm, high contrast, data-dense without crowding, editorial hierarchy, warm ONEDECORE accents, very restrained motion.

**Default mode:** Dark.

Suggested palette:

| Token | Value |
| :--- | :--- |
| App background | `#0B0D0F` |
| Sidebar | `#0E1114` |
| Primary surface | `#12161A` |
| Elevated surface | `#161B20` |
| Hover surface | `#1A2026` |
| Border | `rgba(255,255,255,.08)` |
| Strong border | `rgba(255,255,255,.14)` |
| Primary text | `#F5F2EA` |
| Secondary text | `#B0B4B8` |
| Muted text | `#747A80` |
| Brand accent | `#C8A66A` |
| Accent hover | `#D8BC87` |
| Positive | `#59B88A` |
| Warning | `#D7A94A` |
| Danger | `#D46A6A` |
| Informational | `#6FA8DC` |

Avoid: excessive gradients, glowing neon, giant rounded cards, colorful SaaS tiles, too much gold, glass everywhere, decorative pills with no meaning.

Use accent mostly for: primary actions, selected navigation, important numbers, active focus, key progress indicators.

---

## 3. Typography

- **Serif:** ONEDECORE wordmark and occasional executive heading only.
- **Application UI:** Geist / Inter / existing clean sans-serif.
- **Never** serif for tables, forms, filters, labels, or dense CRM UI.

Recommended hierarchy:

| Role | Size |
| :--- | :--- |
| Page title | 30–34 px desktop / 24–28 px tablet |
| Section title | 18–20 px |
| Metric | 26–32 px |
| Body | 14 px |
| Table | 13–14 px |
| Label | 11–12 px uppercase only where useful |
| Microcopy | 12–13 px |

Do not make everything tiny. Current 10–12 px-heavy UI should become more readable.

---

## 4. Global app shell

Replace the current horizontal wrap-heavy admin link bar (`src/app/admin/layout.tsx`) with a professional shell.

Desktop:

```
┌───────────────────────────────────────────────────────────────┐
│ SIDEBAR │ TOP BAR                                             │
│         ├─────────────────────────────────────────────────────│
│         │                                                     │
│         │ MAIN WORKSPACE                                      │
│         │                                                     │
└───────────────────────────────────────────────────────────────┘
```

**Sidebar:** 248–264 px expanded; 76–84 px collapsed; fixed desktop; independently scrollable; collapse control; persistent selected state; grouped navigation; permission-aware.

**Top bar:** ~64 px; sticky; breadcrumb left; command/search middle; notifications/help only when real; staff avatar/name/menu right.

**Main:** dashboard max ~1440–1600; tables may use full available width; 24–32 px gutters.

---

## 5. Sidebar information architecture

Top: **ONEDECORE** / **OPERATIONS**

Then (hide unauthorized items; preserve existing permission helpers; only show implemented routes):

**OVERVIEW**

- Dashboard → `/admin`

**SALES**

- CRM → `/admin/crm` (overview target) / current `/admin/crm/leads`
- Quotations → `/admin/quotations`
- Projects → `/admin/projects`

**COMMUNICATION**

- WhatsApp Inbox → `/admin/whatsapp/inbox`

**MARKETING**

- Campaigns → `/admin/campaigns`
- Landing Lab → `/admin/landing-pages`

**COMMERCE** (only if `hasAnyCommerceReadPermission`)

- Commerce Overview → `/admin/commerce`
- Products → `/admin/commerce/products`
- Categories → `/admin/commerce/categories`
- Inventory — **only if a dedicated route exists later**; do not invent one in UI-A
- Settings → `/admin/commerce/settings`

**CONTENT**

- Portfolio → `/admin/portfolio`

**PEOPLE**

- Staff → `/admin/staff`
- Attendance → `/admin/attendance`
- Leave → `/admin/leave`

**SYSTEM / MANAGEMENT**

Only if actual authorized routes exist (e.g. `/admin/holidays`, `/admin/attendance-policies`, quotation settings). Do not invent a settings universe.

Rules:

- group labels subtle
- 40–44 px nav row
- 18–20 px icon
- 8 px row radius
- selected row = thin warm accent rail + surface elevation (not a giant filled gold button)
- collapsed sidebar uses tooltips
- mobile/tablet: drawer from top-left menu; no horizontal overflow of navigation

Current permission gates to reuse (names illustrative of existing layout logic): `admin.access`, CRM lead read, WhatsApp inbox read, staff/attendance/leave nav, project read, campaign read, landing-pages read, commerce read. **UI is not authorization.** Server + RLS remain authority.

---

## 6. Top bar

**Left:** Breadcrumb, e.g. Dashboard / CRM / Lead.

**Middle:** Global command/search. MVP = **route/navigation search first**. Keyboard **Ctrl+K**. Do **not** fake cross-record search if backend is not wired.

**Right:** contextual quick action when useful; staff identity; avatar initials; role display **only if authoritative**; sign out **inside** the profile menu (not a large persistent button). Optional environment badge only if a real development/staging distinction exists.

---

## 7. Global component system

Build one reusable admin design system. Do not duplicate one-off Tailwind strings across every route.

Components: AppShell, Sidebar, SidebarGroup, SidebarItem, TopBar, Breadcrumbs, PageHeader, MetricCard, SectionHeader, Surface, DataTable, DataToolbar, FilterBar, FilterChip, EmptyState, ErrorState, Skeleton, StatusBadge, PersonAvatar, ProgressBar, MiniBarChart, MiniLineChart, Tabs, SegmentedControl, Drawer, Modal, ConfirmDialog, Toast, Field, Select, SearchInput, DateRange, Pagination, ActivityTimeline, EntityHeader, DetailRail.

Radii: surfaces 10–12 px; small controls 7–9 px; badges 999 only when a chip is semantically appropriate.

Borders subtle. Separation through spacing and tone first. Shadows: minimal dark elevation; no huge blurry shadows.

---

## 8. Admin dashboard — executive operations cockpit

Current `/admin` is a foundation-era placeholder (phase badges, “Admin Shell”, architecture copy). Target: a genuine **role-aware** dashboard.

Header: “Good afternoon, [First Name]” / “Here’s what needs attention today.” Right: **New Lead** if allowed, or another context-appropriate primary action.

**Do not use fake data.** Every card uses real current data or does not render until its read model exists.

### 8.1 Top KPI row

For Super Admin / broad business role, preferred **real** KPIs (4–6, not 12): New Leads; Open Opportunities; Quotations in Progress / Value; Active Projects; Unread WhatsApp; commerce alert later when live.

Each: label, large value, change/context only if truth-supported, sparkline only if history exists, click-through to source module.

### 8.2 Today needs attention

Most useful panel. Actionable rows aggregated from **existing** states (do not invent task objects): unassigned leads, stale leads, quotations awaiting action, project milestones due, unread/high-priority WhatsApp, low/zero ready-stock later, staff leave approvals if the workflow exists.

Row: icon | issue | entity | owner | age/due | action. Left marker: red urgent / amber attention / neutral informational.

### 8.3 Sales pipeline snapshot

Horizontal funnel or compact stage columns. Stage, lead count, potential value **only if authoritative**, conversion **only if existing reporting supports it**. Click stage → CRM filtered view. No giant pie chart.

### 8.4 Sales performance

If reporting permission: monthly target, achieved, remaining, progress %. Top contributors only with broad visibility. Sales-rep personal: My Target, My Converted Leads, My Pipeline.

### 8.5 Project health

Active projects, upcoming milestones, delayed/risk **if state exists**, design/manufacture/execution distribution if data supports. Compact timeline bars or rows. Click → `/admin/projects`.

### 8.6 WhatsApp snapshot

Unread, waiting on team, recent conversations — **only if permitted**. Do not expose content to unauthorized roles.

### 8.7 Commerce snapshot

Once M35 + authorized commerce data are **active**: published/draft products, ready-stock SKUs, zero-stock ready-stock, featured, media readiness. **No orders/payments cards** until those phases exist.

### 8.8 Campaign snapshot

If user can read campaigns: drafts, pending approval, approved, recent performance **where authority exists**. Production-spend messaging must respect Phase 10 / off status.

---

## 9. CRM — product identity

CRM should feel like a focused application inside Admin, not a wrap-heavy tab bar (`CrmNav`).

Preferred header: **CRM** / “Sales workspace” + **New Lead** / **Import** depending permission.

Subnavigation (only if permitted): Overview, Leads, Targets, Reports, Imports, Assignment Rules.

Map to existing routes:

| Subnav | Current route |
| :--- | :--- |
| Overview | `/admin/crm` (today redirects to leads; target is a real overview) |
| Leads | `/admin/crm/leads` |
| Targets | `/admin/crm/targets` |
| Reports | `/admin/crm/reports` |
| Imports | `/admin/crm/imports` |
| Assignment Rules | `/admin/crm/settings/assignment-rules` |

Integrate into sidebar/module context or a contextual secondary nav — not a disconnected chip bar.

---

## 10. CRM overview

Make `/admin/crm` a real overview rather than only `redirect("/admin/crm/leads")`.

Recommended modules: My / Team Pipeline; New Leads Today; Needs Follow-up; Unassigned; Lead source performance; Target progress; Recent lead activity.

Role-aware: salesperson self; sales manager team if broad permission; super admin broad. **Do not leak other users’ leads through UI queries.** RLS remains final authority.

---

## 11. Leads page — professional operating queue

Retain current functionality (filters, table, mobile cards, pagination). Redesign presentation.

Header: **Leads** / “Track, qualify and move opportunities forward.” Action: **+ New Lead** → `/admin/crm/leads/new`.

Toolbar: search, Status, Source, Assignee, Date, More Filters; optional **Table | Pipeline**. Pipeline only if canonical lead stages map **without inventing statuses**.

Below: result count, active filter chips, Clear all.

### 11.1 Table view

Sticky header. Suggested columns: Lead/Client, Contact, Requirement/Service, Stage/Status, Source, Assignee, Location, Age/Last activity, Next action **only if a real field exists**, Created, row action.

Row 54–60 px. Lead name primary; phone/email secondary; semantic status badge; assignee initials; source as small text/icon (not rainbow). Stale age amber/red **only where the rule is authoritative**. Click row → `/admin/crm/leads/[leadId]`.

Optional compact/comfortable density later. Do not overbuild initially.

### 11.2 Pipeline / kanban

If existing canonical statuses support it: columns **mirror exact backend lifecycle values**. Do **not** invent a new sales lifecycle.

Column: stage name, count, potential value only if data supports. Cards: name, service, area, assignee, age, source.

**Do not add drag-and-drop** unless stage mutation already exists and can be safely authorized. Initial board may be read-only with click-through.

---

## 12. Lead detail — CRM command centre

Most polished CRM page. Desktop ~70% main / ~30% right rail (sticky on large desktop). Tablet/mobile: single column, rail below.

**Entity header:** client name, lead reference, status, source, created. Actions **WhatsApp / Create Quote / Edit / More** only if routes, actions, and permissions exist.

### 12.1 Summary band

Service, budget if captured, property/project type if captured, area/location, source, assignee, stage. Hide empty fields or group under “Not provided.”

### 12.2 Activity timeline

Unified chronological timeline from **authoritative** events only: created, assignment, status, notes, quotation lifecycle, WhatsApp if linked, project conversion. Icon, event, actor, timestamp, optional short detail. Do not manufacture generic activity.

### 12.3 Contact rail

Client, phone, email, location. Call `tel:`; email `mailto:`; WhatsApp only if authorized integration supports it.

### 12.4 Assignment panel

Owner avatar/name, team/role, assigned timestamp if available. Change assignment only if mutation permission exists.

### 12.5 Commercial panel

Linked quotations: reference, status, amount, date. Create Quotation if permission and route exist. If Closed-Won converted: linked Project card. Chain: Lead → Quote → Project.

---

## 13. CRM targets

Clean performance UI. Manager: monthly target, achieved, pipeline coverage, team rows (salesperson, target, achieved, %, open pipeline, converted) with horizontal progress bars. Personal: large target progress, converted amount/count, remaining, month timeline. No gamification fireworks. Do not change achievement/commercial-truth rules.

---

## 14. CRM reports

Analytical, not a pile of cards. Date range, scope, export **only if real**. Charts: simple line, horizontal bar, stacked bar — 3–4 colors max. No 3D, no donuts everywhere. Tables below for exact numbers. Visualize only metrics that existing reporting supports.

---

## 15. CRM imports

Professional 3-step flow aligned to existing pages (`/admin/crm/imports/new`, batch review): **1 Upload → 2 Map + Validate → 3 Review + Import**. Drop zone. Validation: Valid / Warnings / Rejected. Rows requiring correction. **Do not change backend bulk-import semantics.**

---

## 16. Assignment rules

Present as business rules, not raw config. Row: priority, name, condition summary, destination/assignee, status, updated. Edit: When… / Then assign to… / Priority…. Display authoritative constraints and warnings. **Do not invent condition types beyond backend.**

---

## 17. Quotations — visual alignment

Same shell. List: reference, client, lead, status, amount, owner, updated. Detail: commercial summary, status timeline, totals, client details, version/finalization controls. **Presentation only.** Do not redesign quotation domain behavior. Existing routes: `/admin/quotations`, draft workspace, settings.

---

## 18. Projects — visual alignment

List: project, client, stage, designer, owner, health, next milestone, updated. Detail: summary, milestone timeline, designer collaboration, execution workspace, handover/status — **only what the domain supports**. Routes: `/admin/projects`, `/admin/projects/[projectId]`.

---

## 19. WhatsApp inbox — visual alignment

Three-pane desktop when space permits: Conversations | Chat | Context (client/lead, assignee, status, linked quote/project). Mobile: list → full chat → detail drawer. Keep provider / send-intent / consent safety intact. Routes: `/admin/whatsapp/inbox`, conversation detail.

---

## 20. Commerce admin — visual alignment

Same shell. Overview + products + categories + settings as implemented. Product list: image, name, SKU count, category, status, featured, price, available stock, readiness. Product detail tabs: General, Variants & Price, Media, Specifications, Related, Inventory, Publication. Follows ADR-0032 **look only**. No orders/payments UI until later phases. Inventory nav item only when a route exists.

---

## 21. Portfolio CMS — visual alignment

Media-aware rows/cards: hero thumbnail, title, location, status, featured, room count, last updated. Editor: large media preview, content form, room tags, SEO, publication state. **Not a page-builder.** Routes: `/admin/portfolio`, new, `[projectId]`.

---

## 22. People / attendance / leave

Lighter operational layouts. Staff directory: initials, role, status. Attendance: today summary + table; keep calendar/team/corrections/policies as authorized. Leave: my leave / approvals / types / holidays as authorized. Calendar/list toggle only if existing data supports. Approvals prominent for authorized managers.

---

## 23. Forms

Never 25 fields in one unbroken panel. Logical sections; 2-column desktop / 1-column mobile; sticky save footer for long forms; dirty-state indicator; inline validation; clear required labels; helper text only where needed.

Buttons: primary = gold accent; secondary = neutral; destructive = red outline + confirm.

---

## 24. Tables

Sticky header; horizontal scroll only when necessary; optional sticky first column on wide operational tables; 52–60 px rows; truncation with accessible title/tooltip; numeric right-align; semantic status badges; visible hover; keyboard focus; clear pagination. Mobile: structured cards (already present on leads — keep, restyle).

---

## 25. Empty / loading / error

Loading: skeleton matching the real page. Empty: one useful sentence + action if allowed (e.g. “No leads match these filters.” / Clear filters). Errors: calm actionable language, retry if safe, **no stack traces**.

---

## 26. Motion

Premium and nearly invisible. Hover 120–160 ms; panel 180–220 ms; drawer 220–260 ms. Opacity, 2–6 px translate, subtle selected indicator. Avoid bouncing metrics, looping decoration, particles, excessive counters, parallax. Respect `prefers-reduced-motion`.

---

## 27. Responsive strategy

| Breakpoint | Behaviour |
| :--- | :--- |
| 1440+ | full sidebar, wide dashboards, detail rails |
| 1100–1439 | optional collapsed sidebar, fewer dashboard columns |
| Tablet | drawer, 2-column metrics, rails below main |
| Mobile | top bar + drawer, 1-column, tables as cards, sticky primary action only when useful |

Desktop-first; must remain usable on phone.

---

## 28. Accessibility

WCAG-minded contrast. Visible focus. ~44 px touch targets where practical. Semantic tables. `aria-current` for nav. Keyboard navigation. Dialog focus trapping. No information by color alone. Tooltips for collapsed sidebar icons. Keep existing skip links.

---

## 29. Performance

Beautiful must not mean heavy. Prefer current server-component benefits; minimal client JS; lazy-load charts; no giant animation framework; no large background images in operational admin; route-level loading; permission-scoped queries; **do not fetch dashboard modules the user cannot see**.

---

## 30. RBAC / security — non-negotiable

UI is not authorization.

Retain: server-side permission resolution, RLS, CRM broad/self visibility, feature permission checks, commerce permission codes, project/WhatsApp/campaign permissions.

Sidebar hides unauthorized modules; **server remains authority**. Do not centralize permissions into unsafe client-side booleans.

---

## 31. Design signature motifs

1. **Thin warm-gold active rail** — selected nav and tabs.
2. **Architectural divider** — 1 px lines, deliberate whitespace.
3. **Strong entity headers** — name / reference / status / actions.
4. **Activity timeline** — shared visual language for leads, quotes, projects.

Distinctive without gimmicks.

---

## 32. What to remove from the current experience

- Horizontal wrap-heavy global nav
- “Admin Shell” foundation badge
- Phase numbers as dashboard content
- Foundation-era placeholder dashboard cards
- Tiny 10 px-heavy typography
- Disconnected CRM tab-bar appearance
- Repeated neutral cards with no hierarchy
- Large persistent Sign Out button
- Technical architecture copy in normal operational views
- “Read-only/RLS” descriptions as primary page marketing copy

Technical/security details may remain in help, tooltips, or diagnostics — not the main visual story.

---

## 33. What to preserve

All current routes unless a later PR migrates with compatibility; permission-based visibility; lead filters; table + mobile cards; pagination; imports; targets; reports; assignment rules; quotations; projects; WhatsApp; campaigns; landing lab; commerce; portfolio; staff/attendance/leave; accessibility skip links; RLS/RBAC.

This is primarily a **presentation and workflow-cohesion** redesign.

---

## 34. Implementation phasing — do not overengineer

Do **not** redesign every module in one giant runtime PR. **Do not start UI-A while PR #77 is unresolved**, and do not start 9D-C storefront, M35 apply, or production from this spec.

Recommended later sequence:

| Gate | Scope |
| :--- | :--- |
| **UI-A** | Design system + global Admin shell: tokens, sidebar, top bar, page header, shared surfaces, mobile drawer |
| **UI-B** | Admin dashboard: role-aware real widgets, attention panel |
| **UI-C** | CRM navigation + Leads list: filters, table/cards, density |
| **UI-D** | Lead detail command centre: entity header, facts, timeline, quote/project links |
| **UI-E** | CRM targets / reports / imports / assignment rules |
| **UI-F** | Align Quotations + Projects + WhatsApp |
| **UI-G** | Align Commerce + Portfolio + People |

Each later implementation PR: exact head; **no DB migration unless independently required**; **no RBAC weakening**; visual/browser QA desktop + mobile; lint / typecheck / tests / build.

---

## 35. Current project gate

This file is **DESIGN SPEC ONLY**.

- PR #77 remains the open homepage-docs lock; do not create a competing **admin runtime** PR until that sequence is intentionally resolved.
- Does not apply M35, start 9D-C storefront runtime, deploy, activate production, change the database, or change CRM business logic.
- Does not allocate a decision ID (DEC-0093 is in flight on PR #77). A later owner lock/DEC may cite this spec after that gate.

---

## 36. Target quality bar

Usable daily by founder, sales manager, salesperson, designer, operations, and commerce admin — without training them on technical architecture.

**Do not start Midnight Studio runtime in this documentation PR.**
