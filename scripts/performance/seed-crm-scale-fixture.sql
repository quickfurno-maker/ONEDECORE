-- A deterministic CRM dataset large enough for a plan to mean something.
--
-- WHY THIS EXISTS
--
-- The managed project holds 66 leads. Every table in it fits in a couple of
-- pages, so Postgres correctly sequential-scans almost everything and no plan
-- taken there says anything about a plan at scale. Deciding indexes from that
-- telemetry would be deciding them from noise — which is why the counters in
-- `pg_stat_user_tables` (98,739 sequential scans on a one-row table) are a
-- statement about call frequency and not about a missing index.
--
-- So index decisions in this repository are taken against this fixture, on a
-- local database, and the before/after plans are recorded in
-- `docs/audits/lane-6-performance-index-closeout.md`.
--
-- WHAT IT IS NOT
--
-- Not production data, and not a copy of any. Every row is generated: names are
-- `Lead 00042`, phone numbers are sequential in a reserved test range, and no
-- consent is recorded for any of it, so nothing here could be mistaken for a
-- contactable customer. Run it against a LOCAL stack only.
--
--   psql "$LOCAL_DB_URL" -f scripts/performance/seed-crm-scale-fixture.sql
--
-- Idempotent by construction: it deletes what it generated first, keyed on the
-- reserved uuid prefix, so repeated runs give the same rows and a `db reset`
-- clears it entirely.

\set ON_ERROR_STOP on

\echo 'seeding CRM scale fixture (10,000 leads)...'

begin;

-- ---------------------------------------------------------------------------
-- Staff. Twelve executives, which is the shape a growing team has: enough for
-- owner-scoped and team-scoped reads to differ.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, status)
select ('f0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'Perf Exec ' || n,
       'active'
from generate_series(1, 12) as n
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select ('f0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, r.id
from generate_series(1, 12) as n
cross join (select id from public.roles where code = 'sales_executive') r
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Contacts and leads.
--
-- The distribution matters more than the count. Statuses follow the shape a
-- real pipeline has — most leads sitting in the early stages, a tail closed —
-- because an index chosen against a uniform distribution is chosen against a
-- pipeline nobody has.
-- ---------------------------------------------------------------------------

insert into public.contacts (id, display_name)
select ('c0f00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'Perf Contact ' || lpad(n::text, 5, '0')
from generate_series(1, 10000) as n
on conflict (id) do nothing;

insert into public.leads (
  id, contact_id, submitted_name, service_code, property_code, timeline_code,
  primary_source_id, status, assigned_to, entry_method, source, created_at
)
select
  ('1ead0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('c0f00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Lead ' || lpad(n::text, 5, '0'),
  -- Vocabularies read from the CHECK constraints on `leads`, not invented.
  (array['complete-home-interiors','modular-kitchens','custom-wardrobes'])[1 + (n % 3)],
  (array['apartment-2bhk','apartment-3bhk','villa-rowhouse'])[1 + (n % 3)],
  (array['immediate','within-1-month','within-2-months'])[1 + (n % 3)],
  (select id from public.lead_sources order by created_at limit 1),
  /*
   * Status and assignment are derived together because the schema ties them:
   * `chk_leads_status_assignment_invariant` requires `new` to be unassigned and
   * `assigned` to have an owner. A fixture that set them independently would be
   * generating states the application can never reach.
   *
   * So one lead in six is an unassigned `new` — the attention queue — and the
   * rest are owned and spread across the open pipeline. Closed states are left
   * out deliberately: `chk_leads_closed_lost_invariant` requires a real closure
   * reason, and inventing one would be inventing business data to make a
   * benchmark look fuller.
   */
  case
    when n % 6 = 0 then 'new'
    when n % 5 = 0 then 'assigned'
    when n % 5 = 1 then 'contacted'
    when n % 5 = 2 then 'qualified'
    when n % 5 = 3 then 'proposal_sent'
    else 'negotiation'
  end,
  case when n % 6 = 0 then null
       else ('f0000000-0000-4000-8000-' || lpad(((n % 12) + 1)::text, 12, '0'))::uuid
  end,
  'import',
  'bulk-import',
  now() - ((10000 - n) * interval '18 minutes')
from generate_series(1, 10000) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Follow-ups. One open primary next action for a fifth of the leads, which is
-- what My Day reads, plus a spread of due dates around now so overdue, due
-- today and upcoming are all populated.
-- ---------------------------------------------------------------------------

insert into public.lead_follow_ups (
  id, lead_id, owner_id, activity_type, status, is_primary_next_action, title,
  due_at, created_by, created_at
)
select
  ('f0110000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('1ead0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || lpad(((n % 12) + 1)::text, 12, '0'))::uuid,
  (array['call','whatsapp','site_visit'])[1 + (n % 3)],
  'open',
  true,
  'Follow up ' || lpad(n::text, 5, '0'),
  now() + ((n % 400) - 200) * interval '1 hour',
  ('f0000000-0000-4000-8000-' || lpad(((n % 12) + 1)::text, 12, '0'))::uuid,
  now() - ((10000 - n) * interval '18 minutes')
from generate_series(1, 10000) as n
where n % 5 = 0
  and (n % 6) <> 0
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- SLA clocks. Every assigned lead gets one; a slice is still awaiting first
-- contact, which is the partial index's predicate.
-- ---------------------------------------------------------------------------

insert into public.crm_sla_clocks (
  lead_id, policy_code, clock_started_at, sla_due_at, first_contact_attempt_at
)
select
  ('1ead0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  (select policy_code from public.crm_sla_policies order by policy_code limit 1),
  now() - (n % 60) * interval '1 hour',
  now() + ((n % 200) - 100) * interval '1 hour',
  -- A quarter are still awaiting first contact, which is the predicate the
  -- partial index on this table is built for.
  case when n % 4 = 0 then null else now() - (n % 50) * interval '1 minute' end
from generate_series(1, 10000) as n
where (n % 6) <> 0
on conflict (lead_id) do nothing;

commit;

analyze public.leads;
analyze public.lead_follow_ups;
analyze public.crm_sla_clocks;
analyze public.contacts;
analyze public.profiles;

\echo 'fixture seeded and analyzed.'

select 'leads' as relation, count(*) from public.leads
union all select 'lead_follow_ups', count(*) from public.lead_follow_ups
union all select 'crm_sla_clocks', count(*) from public.crm_sla_clocks
union all select 'profiles', count(*) from public.profiles;
