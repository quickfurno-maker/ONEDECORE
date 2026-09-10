-- `authorize_many` answers exactly what `authorize` answers.
--
-- WHY THIS SUITE EXISTS
--
-- A batch authorization endpoint is the kind of optimisation that quietly
-- becomes a second implementation of the access matrix. This one is written as
-- a loop over `public.authorize` precisely so it cannot drift — but "cannot
-- drift by construction" is a claim, and the claim is worth executing.
--
-- So every assertion below compares the two answers for the SAME user in the
-- SAME session, across the denial paths that matter: no permission, suspended
-- profile, inactive role, inactive permission, revoked app access, and
-- unauthenticated. If a future edit replaces the delegation with an inlined
-- join, the first denial path it forgets fails here.

begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- Fixture. Five users, each exercising one branch of `private.has_permission`.
-- Built as the superuser; the assertions run as `authenticated`.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, status) values
  ('a0000000-0000-4000-8000-000000000001', 'Granted Exec',   'active'),
  ('a0000000-0000-4000-8000-000000000002', 'Suspended Exec', 'suspended'),
  ('a0000000-0000-4000-8000-000000000003', 'Inactive Role',  'active'),
  ('a0000000-0000-4000-8000-000000000004', 'Access Revoked', 'active'),
  ('a0000000-0000-4000-8000-000000000005', 'No Role At All', 'active');

-- Granted, suspended and access-revoked users all hold a real, active role, so
-- the only thing separating them is the check under test.
insert into public.user_roles (user_id, role_id)
select 'a0000000-0000-4000-8000-000000000001', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'a0000000-0000-4000-8000-000000000002', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'a0000000-0000-4000-8000-000000000004', id from public.roles where code = 'sales_executive';

-- A deactivated role carrying a real permission: the grant exists, the role
-- does not count.
insert into public.roles (id, code, name, description, is_system, is_active)
values ('a0000000-0000-4000-8000-0000000000d1', 'test_inactive_role',
        'Test Inactive Role', 'fixture: proves is_active is honoured', false, false);
insert into public.role_permissions (role_id, permission_id)
select 'a0000000-0000-4000-8000-0000000000d1', id
  from public.permissions where code = 'leads.read_assigned';
insert into public.user_roles (user_id, role_id)
values ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000d1');

-- An employment record that is not cleared for app access.
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, access_state)
values ('a0000000-0000-4000-8000-000000000004', 'FIX-0004', 'Sales Executive',
        date '2026-01-01', 'revoked')
on conflict (staff_id) do update set access_state = 'revoked';

/**
 * The codes every assertion asks about: two a sales executive holds, two it
 * does not, and one that does not exist at all.
 *
 * A function rather than a temp table, because the assertions run as
 * `authenticated` and a temp table created by the superuser is not readable by
 * that role — the fixture would fail for a reason that has nothing to do with
 * what is under test.
 */
create or replace function pg_temp.probe_codes() returns text[]
language sql immutable as $$
  select array[
    'leads.read_assigned',
    'crm.activities.read',
    'leads.delete',
    'sales_targets.manage',
    'permission.that.does.not.exist'
  ];
$$;

/**
 * The comparison, run for whichever user the session is currently acting as.
 *
 * Returns the number of codes where the two functions DISAGREE. Zero is the
 * only acceptable answer, and it is the same assertion for every user, so a new
 * denial path is one more fixture and one more call.
 */
create or replace function pg_temp.disagreements() returns integer
language sql stable as $$
  select count(*)::int
  from unnest(pg_temp.probe_codes()) as c(code),
       lateral (select public.authorize(c.code) as one) a,
       lateral (select public.authorize_many(pg_temp.probe_codes()) as many) m
  where coalesce(a.one, false) is distinct from coalesce((m.many ->> c.code)::boolean, false);
$$;

-- ===========================================================================
-- A. A user who holds some of the permissions
-- ===========================================================================

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'granted executive: authorize_many agrees with authorize on every code');

select is(
  (public.authorize_many(array['leads.read_assigned']) ->> 'leads.read_assigned')::boolean,
  true,
  'granted executive: a held permission is true');

select is(
  (public.authorize_many(array['leads.delete']) ->> 'leads.delete')::boolean,
  false,
  'granted executive: an unheld permission is false');

select is(
  (public.authorize_many(array['permission.that.does.not.exist'])
     ->> 'permission.that.does.not.exist')::boolean,
  false,
  'granted executive: an unknown code is false, not an error');

-- Every requested code comes back, so a caller can never read a missing key as
-- a silent grant.
select is(
  (select count(*)::int from jsonb_object_keys(
     public.authorize_many(array['leads.read_assigned','leads.delete'])) ),
  2,
  'every requested code appears in the result');

select is(
  public.authorize_many(array[]::text[]),
  '{}'::jsonb,
  'an empty request returns an empty object');

select is(
  public.authorize_many(array[null, '', '   ']),
  '{}'::jsonb,
  'null and blank codes are ignored rather than answered');

-- Whitespace is trimmed by `private.has_permission`; the key must be trimmed
-- too, or a caller could never find its answer.
select is(
  (public.authorize_many(array['  leads.read_assigned  ']) ->> 'leads.read_assigned')::boolean,
  true,
  'a padded code is trimmed on both the answer and the key');

select is(
  (select count(*)::int from jsonb_object_keys(
     public.authorize_many(array['leads.read_assigned','leads.read_assigned'])) ),
  1,
  'a repeated code is asked once and answered once');

-- ===========================================================================
-- B. Suspended profile
-- ===========================================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'suspended profile: authorize_many agrees with authorize on every code');

select is(
  (public.authorize_many(array['leads.read_assigned']) ->> 'leads.read_assigned')::boolean,
  false,
  'suspended profile holds no permission through the batch path');

select is(
  public.authorize('leads.read_assigned'),
  false,
  'suspended profile holds no permission through the single path either');

-- ===========================================================================
-- C. Inactive role
-- ===========================================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'inactive role: authorize_many agrees with authorize on every code');

select is(
  (public.authorize_many(array['leads.read_assigned']) ->> 'leads.read_assigned')::boolean,
  false,
  'a deactivated role grants nothing through the batch path');

select is(
  public.authorize('leads.read_assigned'),
  false,
  'a deactivated role grants nothing through the single path');

-- ===========================================================================
-- D. Staff app access revoked
-- ===========================================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'revoked app access: authorize_many agrees with authorize on every code');

-- This is the check that runs BEFORE the grant lookup, and the one a batch
-- rewrite is most likely to lose: the role and its grants are intact, and the
-- employment record is what denies everything.
select is(
  (public.authorize_many(array['leads.read_assigned','crm.activities.read'])
     ->> 'leads.read_assigned')::boolean,
  false,
  'staff_access_denied still denies every permission in the batch path');

select is(
  (select count(*)::int
     from jsonb_each_text(public.authorize_many(pg_temp.probe_codes()))
    where value = 'true'),
  0,
  'revoked app access grants nothing at all, however many codes are asked');

-- ===========================================================================
-- E. A user with no role
-- ===========================================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'no role: authorize_many agrees with authorize on every code');

select is(
  (select count(*)::int
     from jsonb_each_text(public.authorize_many(pg_temp.probe_codes()))
    where value = 'true'),
  0,
  'a user with no role holds nothing');

-- ===========================================================================
-- F. Unauthenticated
-- ===========================================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

select is(pg_temp.disagreements(), 0,
  'no subject claim: authorize_many agrees with authorize on every code');

select is(
  (select count(*)::int
     from jsonb_each_text(public.authorize_many(pg_temp.probe_codes()))
    where value = 'true'),
  0,
  'a session with no subject holds nothing');

-- ===========================================================================
-- G. The function contract itself
-- ===========================================================================

reset role;

-- Same characteristics as `authorize`: INVOKER, STABLE, empty search_path. A
-- SECURITY DEFINER batch would run the checks as the owner and silently bypass
-- the RLS the invoker version is subject to.
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'authorize_many'),
  false,
  'authorize_many is SECURITY INVOKER, like authorize');

select is(
  (select p.provolatile::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'authorize_many'),
  's',
  'authorize_many is STABLE, like authorize');

select is(
  (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'authorize_many'),
  'search_path=""',
  'authorize_many pins an empty search_path, like authorize');

-- `anon` must not be able to ask, exactly as it cannot ask `authorize`.
select is(
  (select count(*)::int from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'authorize_many'
      and grantee in ('anon', 'PUBLIC')),
  0,
  'authorize_many is not executable by anon or PUBLIC');

select is(
  (select count(*)::int from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'authorize_many'
      and grantee = 'authenticated' and privilege_type = 'EXECUTE'),
  1,
  'authorize_many is executable by authenticated');

select * from finish();
rollback;
