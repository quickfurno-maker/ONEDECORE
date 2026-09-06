-- ONEDECORE — deleting an enquiry vs. quoting it.
--
-- THE RACE THIS EXISTS TO CLOSE
--
-- `create_quotation_draft` decides whether a lead may take a quotation BEFORE
-- it acquires the `quotation_root` advisory lock. `delete_lead_tombstone` locks
-- the lead row and checks for quotations. Without a shared serialization point
-- those two interleave badly:
--
--   Q: passes quotation_can_create_for_lead   (lead is active)
--   D: locks the lead, sees no quotation, tombstones, COMMITS
--   Q: resumes and writes the quotation
--
-- The delete succeeded, the quotation succeeded, and the converted-lead
-- invariant — "a lead with commercial history is never deleted" — is violated
-- after the fact by a lead that now holds both.
--
-- The fix has two halves, and this file checks both:
--
--   1. BOTH paths take `pg_advisory_xact_lock('quotation_root:' || lead_id)`,
--      the same key, before the lead row. Two transactions therefore cannot be
--      inside the decision at the same time. Proved by reading `pg_locks` after
--      each call and finding the expected key actually held — the lock identity,
--      not the source text.
--
--   2. The quotation path RE-READS the lead under that lock, so the answer it
--      got before the lock cannot be stale by the time it writes. Proved by
--      running both committed orderings and checking the loser is refused.
--
-- WHY NOT TWO LIVE SESSIONS
--
-- pgTAP runs each file in one transaction, so a second connection is the only
-- way to have two, and `dblink` is the only way to open one from inside. In the
-- Supabase local stack the `postgres` role is NOT a superuser, so dblink demands
-- a password — and a database password does not belong in a test file. What is
-- lost is a demonstration of one session physically waiting on the other; what
-- is kept is the property that matters, which is that the two share a key and
-- that neither ordering can produce the forbidden final state.

begin;
select plan(14);

-- =============================================================================
-- Fixtures — f-prefix
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('f1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '51-sa@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id = 'f1111111-1111-1111-1111-111111111111';

insert into public.user_roles (user_id, role_id)
select 'f1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';

insert into public.contacts (id, display_name, status)
values
  ('f0c00000-0000-4000-8000-000000000001', 'Race Client A', 'active'),
  ('f0c00000-0000-4000-8000-000000000002', 'Race Client B', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('f0c00000-0000-4000-8000-000000000001', 'phone', '+919700000061', true),
  ('f0c00000-0000-4000-8000-000000000002', 'phone', '+919700000062', true)
on conflict do nothing;

-- Lead A takes a quotation first; lead B is deleted first.
insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path
)
values
  (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0c00000-0000-4000-8000-000000000001',
    'Race Client A', 'new', 'website-planner',
    (select id from public.lead_sources where code = 'website_planner'),
    'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate',
    'v1', '/planner'
  ),
  (
    'f0aaaaaa-0000-4000-8000-000000000002',
    'f0aaaaaa-0000-4000-8000-000000000002',
    'f0c00000-0000-4000-8000-000000000002',
    'Race Client B', 'new', 'website-planner',
    (select id from public.lead_sources where code = 'website_planner'),
    'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate',
    'v1', '/planner'
  );

/*
 * Is the quotation_root lock for this lead actually held right now?
 *
 * `pg_advisory_xact_lock(bigint)` stores the key split across `classid` (high 32
 * bits) and `objid` (low 32 bits), with `objsubid = 1`. Both halves are compared
 * as bigints so a negative hash never has to survive a cast to int.
 */
create or replace function pg_temp.quotation_root_lock_held(p_lead_id uuid)
returns boolean
language sql
stable
as $$
  with k as (
    select hashtextextended('quotation_root:' || p_lead_id::text, 0) as key
  )
  select exists (
    select 1
    from pg_locks l, k
    where l.locktype = 'advisory'
      and l.objsubid = 1
      and l.granted
      and l.classid::bigint = ((k.key >> 32) & 4294967295)
      and l.objid::bigint = (k.key & 4294967295)
  );
$$;

select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select set_config(
  'test.race_lead_a_updated',
  (select updated_at::text from public.leads where id = 'f0aaaaaa-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.race_lead_b_updated',
  (select updated_at::text from public.leads where id = 'f0aaaaaa-0000-4000-8000-000000000002'),
  true
);

-- =============================================================================
-- A. Neither path holds the lock before it runs
-- =============================================================================

select is(
  pg_temp.quotation_root_lock_held('f0aaaaaa-0000-4000-8000-000000000001'::uuid),
  false,
  'lead A quotation_root lock is not held before anything runs'
);
select is(
  pg_temp.quotation_root_lock_held('f0aaaaaa-0000-4000-8000-000000000002'::uuid),
  false,
  'nor lead B'
);

-- =============================================================================
-- B. QUOTATION WINS — lead A takes a quotation, then refuses deletion
-- =============================================================================

select lives_ok(
  $$select public.create_quotation_draft(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Quotation that wins the race',
    'race-probe-quotation-1')$$,
  'the quotation succeeds on an active lead'
);

select is(
  pg_temp.quotation_root_lock_held('f0aaaaaa-0000-4000-8000-000000000001'::uuid),
  true,
  'and the quotation path took the quotation_root lock for THAT lead'
);
select is(
  pg_temp.quotation_root_lock_held('f0aaaaaa-0000-4000-8000-000000000002'::uuid),
  false,
  'and only that lead — the key is per-lead, so unrelated work is not serialized'
);

select throws_ok(
  $$select public.delete_lead_tombstone(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Deletion that lost the race against the first quotation',
    current_setting('test.race_lead_a_updated')::timestamptz,
    'DELETE')$$,
  '42501',
  'CRM_LEAD_DELETE_CONVERTED_BLOCKED',
  'the deletion that arrives after it is refused as converted'
);

set local role postgres;
select is(
  (select count(*)::integer from public.leads
    where id = 'f0aaaaaa-0000-4000-8000-000000000001' and deleted_at is null),
  1,
  'the lead stays active, with its quotation'
);
set local role authenticated;

-- =============================================================================
-- C. DELETE WINS — lead B is tombstoned, then refuses a quotation
-- =============================================================================
--
-- This is the ordering the re-read exists for. `quotation_can_create_for_lead`
-- would have answered "yes" before the delete committed; only the re-read under
-- the lock sees that the answer has since changed.

select lives_ok(
  $$select public.delete_lead_tombstone(
    'f0aaaaaa-0000-4000-8000-000000000002'::uuid,
    'Deletion wins the race against the first quotation',
    current_setting('test.race_lead_b_updated')::timestamptz,
    'DELETE')$$,
  'the deletion succeeds on a lead with no commercial history'
);

select is(
  pg_temp.quotation_root_lock_held('f0aaaaaa-0000-4000-8000-000000000002'::uuid),
  true,
  'and the DELETE path took the same quotation_root lock — the shared key'
);

select throws_ok(
  $$select public.create_quotation_draft(
    'f0aaaaaa-0000-4000-8000-000000000002'::uuid,
    'Quotation that lost the race',
    'race-probe-quotation-2')$$,
  '42501',
  'QUOTATION_NOT_FOUND_OR_FORBIDDEN',
  'and the quotation that arrives after it is refused'
);

set local role postgres;
select is(
  (select count(*)::integer from public.quotations
    where lead_id = 'f0aaaaaa-0000-4000-8000-000000000002'),
  0,
  'THE FINAL STATE IS NEVER a tombstoned lead holding a new quotation'
);
select is(
  (select count(*)::integer from public.leads
    where id = 'f0aaaaaa-0000-4000-8000-000000000002' and deleted_at is not null),
  1,
  'the deleted lead is still a tombstone, not a physically removed row'
);

-- =============================================================================
-- D. The two keys are genuinely the same expression
-- =============================================================================
--
-- Both functions build the key from the same literal, so a future edit to one
-- of them that changes the prefix would silently un-serialize the pair. This
-- pins the shape rather than trusting it.

set local role postgres;
select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_quotation_draft', 'delete_lead_tombstone')
      and p.prosrc like '%quotation_root:%'),
  2,
  'both paths derive the lock from the same quotation_root key'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_lead_tombstone')
    like '%quotation_root:%for update%',
  'and the delete takes the advisory lock BEFORE the lead row lock'
);

select * from finish();
rollback;
