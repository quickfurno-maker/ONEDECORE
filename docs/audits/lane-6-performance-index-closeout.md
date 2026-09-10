# Lane 6 — performance and index closeout

**Date:** 2026-09-10
**Branch:** `chore/performance-index-closeout`
**Starting main:** `197381cd329e6b8329798b1f1eea3ae3bd25ed82`
**Managed telemetry snapshot:** 2026-09-10T04:20:42Z, `pg_stat_statements` accumulating since 2026-07-24T17:15:44Z (4,893 statement rows, PostgreSQL 17.6)
**Managed changes:** none. Every managed query in this lane was read-only.

---

## 1. What the telemetry actually said

The headline is not a slow query. It is a count.

| Statement | Calls | Total | Mean |
| :--- | ---: | ---: | ---: |
| `public.authorize(text)` | **65,586** | **220,276 ms** | 3.36 ms |
| *every PostgREST request (`set_config` preamble)* | 78,938 | 3,847 ms | 0.05 ms |
| `public.has_active_role(text)` | 2,487 | 7,954 ms | 3.20 ms |
| CRM deal-values RPC (`p_lead_ids`) | 128 | 6,941 ms | 54.23 ms |
| `lead_events` select | 134 | 6,564 ms | 48.99 ms |
| `crm_sla_clocks` select | 134 | 6,561 ms | 48.96 ms |
| `leads` by created-at range | 114 | 4,963 ms | 43.54 ms |
| `leads` by status, limit/offset | 1,437 | 4,049 ms | 2.82 ms |
| `public.get_crm_my_day(...)` | 48 | 3,114 ms | 64.88 ms |
| `lead_follow_ups` select | 128 | 2,904 ms | 22.69 ms |
| `list_crm_assignable_executives()` | 901 | 2,275 ms | 2.53 ms |
| `search_public_commerce_products(...)` | 120 | 1,153 ms | 9.61 ms |

**Eighty-three per cent of every database round trip this application has ever
made was an authorization check.**

Excluded as **SUPABASE DASHBOARD / INTROSPECTION**, not application traffic:
`pg_timezone_names` (330 ms mean), the `pg_meta` table and column introspection
queries (up to 9,115 ms mean), extension and function listings, domain base-type
recursion, and the `pg_backup_stop` / `pg_walfile_name_offset` backup machinery.
None of it is worth optimising and none of it is ours.

### Capacity

| Relation | Rows | Total size | seq_scan | idx_scan |
| :--- | ---: | ---: | ---: | ---: |
| `leads` | 66 | 216 kB | 2,567 | 9,528 |
| `contact_channels` | 74 | 160 kB | 50 | 853 |
| `staff_employment_profiles` | **1** | 88 kB | **98,739** | 18 |
| `role_permissions` | 199 | 96 kB | 64 | 197,280 |
| `permissions` | 90 | 80 kB | 126 | 199,919 |

The largest public relation is 216 kB. **Index bloat is not a capacity problem
here and no claim in this lane depends on size.**

`staff_employment_profiles` with one row and 98,739 sequential scans is the
clearest illustration of why this lane is about call counts: a one-row table is
*correctly* sequential-scanned, and the counter is a statement about how often
`private.staff_access_denied` runs — roughly 1.5 times per `authorize` — not
about a missing index. No index was added for it.

---

## 2. `public.authorize` — CALL_COUNT, not SQL_PLAN

The plan is fine. `role_permissions` and `permissions` each show ~200,000 index
scans, so the five-table `EXISTS` is fully index-driven, and 3.36 ms is
unremarkable for that work under RLS.

The call count is not fine, and it was measured rather than estimated. Two
harnesses stub the Supabase client and count what the real code path asks for:

| Path | Before | After |
| :--- | ---: | ---: |
| `resolveCrmAccess` (any CRM page) | **21** round trips | **1** |
| `resolveOpsNavFlags` (**every** admin page) | **99** round trips | **26** |

Both resolve exactly the same permissions afterwards — 21 and 92 respectively.
The admin navigation alone was spending roughly 92 × 3.36 ms ≈ 310 ms of
serialised authorization before the page began.

### What changed

`public.authorize_many(text[]) → jsonb` (migration
`20260910120000_authorize_many_batch_rpc.sql`) answers many codes in one round
trip. It is **a loop over `public.authorize`**, not a reimplementation:

```sql
select coalesce(jsonb_object_agg(code, public.authorize(code)), '{}'::jsonb)
from (select distinct trim(code) as code from unnest($1) as code
      where code is not null and trim(code) <> '' limit 50) as codes;
```

Same `SECURITY INVOKER`, same `STABLE`, same `search_path=""`, same grant to
`authenticated` only. Every denial path — `auth.uid()`,
`private.staff_access_denied`, active role, active permission, active profile —
still lives in `private.has_permission` and nowhere else.

A batch endpoint that inlined the join would be faster still and would be a
second copy of the authorization matrix. That trade was declined.

**Nothing is cached.** No memoisation, no request-scoped store, no browser
state. A revoked grant is revoked on the next call, exactly as before.

`supabase/tests/database/59_authorize_many_equivalence_test.sql` (27 assertions)
compares the two functions code-by-code for a granted executive, a suspended
profile, an inactive role, revoked app access, a user with no role, and a session
with no subject — plus the function's own contract (invoker, stable, search_path,
grants).

### Application changes

Ten probe helpers were converted. `crm-permissions.ts` was restructured into code
lists plus **pure mappers**, so `resolveCrmAccess` resolves the union once and
each mapper reads its own answers from the same result. A code missing from the
answers reads as `false`, so a partial response can only deny.

`project-permissions` and `campaign-permissions` also check roles; only the
permission half is batched, and the two now run concurrently instead of in
series. `has_active_role` is 2,487 calls against 65,586 — a second batch endpoint
for it would be machinery bought for a thirtieth of the traffic. **Deferred.**

---

## 3. `get_crm_my_day` — the largest remaining cost, and why it is not shipped

Managed shows 64.88 ms mean at 66 leads. Against the local fixture at **10,000
leads** it is **880–915 ms**, in both team and owner scope — and the fact that
owner scope is no faster is itself the clue.

`EXPLAIN (ANALYZE, BUFFERS)` on the attention CTE:

```
Index Scan Backward using idx_leads_active_created_at on leads l
      (actual time=4.870..91.648 rows=63 loops=1)
  Filter: ((assigned_to IS NOT NULL) AND (status <> ALL (...)) AND (SubPlan 1))
  Rows Removed by Filter: 683
  Buffers: shared hit=67127
  SubPlan 1
    ->  Result (actual time=0.146..0.146 rows=1 loops=622)   <-- the RLS check
Execution Time: 95.999 ms   Buffers: shared hit=69858
```

**The index is already correct and already used.** 683 rows removed, 63 returned.
The 96 ms and 69,858 buffer hits are the RLS policy, evaluated per row:

```sql
-- private.crm_can_view_lead(p_assigned_to)
select (select private.crm_has_broad_lead_read())
    or ((select public.authorize('leads.read_assigned'))
        and p_assigned_to is not null and p_assigned_to = (select auth.uid()));

-- private.crm_has_broad_lead_read()
select (select public.authorize('leads.read_all'))
    or ((select public.authorize('leads.read')) and not (select public.authorize('leads.read_assigned')));
```

Up to **four `authorize` evaluations per row**. Only one term is actually
row-dependent (`p_assigned_to = auth.uid()`); the rest are constant for the whole
query but cannot be hoisted, because they sit inside a function that takes a
per-row argument.

**No index can fix this**, which is why none was added for My Day.

### The fix, measured but deferred

Rewriting the policy so the constant terms become uncorrelated subqueries —
InitPlans evaluated once per query rather than once per row — was tried on a
throwaway copy of the policy and rolled back:

| | Team scope | Owner scope |
| :--- | ---: | ---: |
| current policy | 915 / 897 / 882 ms | 875 / 881 ms |
| InitPlan shape | 313 / 271 ms | 272 ms |

**~3× faster from an identical boolean expression.**

It is not in this PR. `private.crm_can_view_lead` backs **13 RLS policies and 12
functions**; getting the hoisting requires the expression to appear in the policy
rather than behind a per-row function call, and doing that for one policy forks a
rule used in twenty-five places, while doing it for all thirteen is a
security-boundary rewrite that needs its own five-role × thirteen-table proof.

That is its own lane, not a rider on an authorization refactor. **It is the
single highest-value performance change identified in Lane 6** and it is recorded
here in full so the next lane starts from evidence rather than from scratch.

---

## 4. Indexes

### Added: none

No query in the audited set was short of an index. My Day's scan is already
served by `idx_leads_active_created_at`; the CRM timeline, follow-up, SLA and
pipeline reads all match existing composite and partial indexes listed in the
handoff. Adding one to make a counter look better would be the "blind index" this
lane exists to avoid.

### Dropped: three exact duplicates

A fresh inventory of 325 public indexes found three pairs with the **same table,
same columns, same order** — contradicting the handoff's "zero exact duplicates",
which is worth stating plainly:

| Dropped (plain) | Covered by (UNIQUE constraint) | Table |
| :--- | :--- | :--- |
| `idx_attendance_events_staff_idempotency` | `uq_attendance_events_staff_idempotency` | `attendance_events` |
| `commerce_order_items_order_idx` | `commerce_order_items_order_id_line_number_key` | `commerce_order_items` |
| `idx_lead_import_rows_batch_row` | `uq_lead_import_rows_batch_row` | `lead_import_rows` |

A unique btree serves every read a plain btree on the same columns serves. The
plain copies were pure write amplification.

The test applied is **redundancy, not usage**: `commerce_order_items_order_idx`
had been scanned twice and is still dropped, because the constraint index answers
those two scans identically.

*(A first counting query reported 55 duplicate groups. That was wrong — the join
to `pg_constraint` multiplied rows, because a foreign key also records
`conindid` against the index on the referenced side. Corrected to three by
querying `pg_index` directly.)*

`supabase/tests/database/60_index_redundancy_contract_test.sql` asserts the rule
rather than the three names, so the fourth one somebody adds next quarter fails.

### Not dropped: 201 zero-scan indexes

89 of them are not constraint-backed. **None is dropped.** A zero scan count on a
project holding 66 leads means the feature has not been used yet, not that the
index is wrong.

### Foreign keys: 157 without left-prefix support, none indexed

| Classification | Count | Decision |
| :--- | ---: | :--- |
| AUDIT/ACTOR FIELD (`created_by`, `actor_id`, `approver`, …) | 98 | **NO BENEFIT** — never queried by that column; parent rows are not deleted |
| DOMAIN FK | 52 | **FUTURE SCALE** — no audited query filters or joins on them today |
| TINY CONFIG (`policy_code`, `*_type_id`, …) | 7 | **NO BENEFIT** — parent tables hold single-digit rows |

---

## 5. Local scale fixture

`scripts/performance/seed-crm-scale-fixture.sql` — deterministic, generated, and
local-only.

| Relation | Rows |
| :--- | ---: |
| `leads` | 10,000 |
| `lead_follow_ups` (open, primary) | 1,667 |
| `crm_sla_clocks` | 8,334 |
| `profiles` (executives) | 12 |

Every vocabulary in it was read from the table's own `CHECK` constraints rather
than assumed — five separate constraint violations during authoring, each one a
value that looked plausible and was not real: `service_code` is
`complete-home-interiors`, not `interiors`; `source` is `bulk-import`, not
`perf-fixture`. Status and assignment are derived together because
`chk_leads_status_assignment_invariant` ties them, and closed states are left out
because `chk_leads_closed_lost_invariant` requires a real closure reason and
inventing one would be inventing business data.

No real customer data, no consent recorded against any row, and `db reset` clears
it entirely.

---

## 6. Frontend

`next build` route classification, same method both sides:

| | Static | Dynamic |
| :--- | ---: | ---: |
| before | 9 | 106 |
| after | 9 | 106 |

**Identical.** The homepage and `/interiors` remain statically prerendered. No
`force-dynamic` was added, no client boundary changed, and no UI was touched.

Local production smoke (`next start`, port 4733):

| Path | Status | Headers |
| :--- | :--- | :--- |
| `/` | 200 | CSP + HSTS, `s-maxage=300` |
| `/interiors` | 200 | CSP + HSTS, `s-maxage=300` |
| `/portfolio` | 200 | CSP + HSTS |
| `/api/health` | 200 | CSP + HSTS, `no-store` |
| `/auth/login` | **500** | — |
| `/admin` | **500** | — |

The two 500s are the Lane 1 runtime-target guard correctly refusing a loopback
Supabase URL under `NODE_ENV=production`, exactly as in Lane 5. The guard was not
weakened to make a smoke test prettier. **Carried forward:** `/`, `/interiors`,
`/auth/login`, `/admin` and `/api/health` still need CSP and HSTS verified
against the real production environment after an owner-authorised deployment.

No Lighthouse run: a score from this machine would be directional at best and
would invite being quoted as a production Core Web Vitals number.

---

## 7. Deferred, with evidence

1. **RLS InitPlan rewrite** — 880 ms → 271 ms on My Day at 10k leads, measured.
   Needs its own lane: 13 policies, 12 functions, five-role proof. **Highest
   value remaining.**
2. **`has_active_role` batching** — 2,487 calls; a thirtieth of `authorize`.
3. **Duplicate resolver overlap** — `probeStaffPermissions` (13 codes),
   `resolveAttendanceAccess` (7) and `resolveLeaveAccess` overlap on ten
   attendance and leave codes in one request. Each is now one round trip instead
   of N, but the overlap remains. Request-scoped memoisation would remove it and
   was deliberately not added: a cache in the authorization path is where a
   cross-identity leak comes from, and it deserves more care than a lane closeout.
4. **CRM deal-values RPC** — 54.23 ms mean, 128 calls. Not investigated at scale;
   below the two targets above.
5. **`search_public_commerce_products`** — 9.61 ms mean over 120 calls against an
   empty catalogue. No `pg_trgm`/GIN decision is possible without a realistic
   catalogue, and none was invented.

---

## 8. What this lane did not do

- No managed mutation of any kind. No `ANALYZE`, no `VACUUM`, no
  `pg_stat_statements_reset()`, no index creation, no setting change.
- No deployment, no SSH, no production env change.
- No blind index. No index dropped on a zero scan count alone.
- No RLS, `authorize` semantics, `staff_access_denied`, five-role matrix,
  consent, CSP/HSTS, XLSX gate or dependency guard weakened.
- No new infrastructure — no Redis, cache, queue, search service or replica.
- No UI change, no rendering-mode change, no pagination or count-query rewrite:
  nothing in the audited set showed deep-offset degradation at 10,000 rows.
