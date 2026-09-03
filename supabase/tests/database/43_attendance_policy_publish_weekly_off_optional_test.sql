-- ONEDECORE — publish_attendance_policy accepts an empty weekly-off array

begin;
select plan(28);

-- -----------------------------------------------------------------------------
-- A. Contract preserved
-- -----------------------------------------------------------------------------

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'publish_attendance_policy'
  ),
  'publish_attendance_policy still exists'
);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'publish_attendance_policy'),
  true,
  'still SECURITY DEFINER'
);

select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'publish_attendance_policy')
  like '%search_path=%',
  'still pins search_path'
);

select is(
  (select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'publish_attendance_policy'),
  'postgres',
  'ownership preserved'
);

-- authenticated keeps EXECUTE; anon/public do not.
select ok(
  has_function_privilege('authenticated', 'public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE'
);
select ok(
  not has_function_privilege('anon', 'public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid)', 'EXECUTE'),
  'anon still has no EXECUTE'
);

-- -----------------------------------------------------------------------------
-- B. Fixtures
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('43aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', '43-sa@example.test', 'authenticated', 'authenticated'),
  ('43bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '43-mgr@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('43aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '43bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.user_roles (user_id, role_id)
select '43aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '43bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.roles where code = 'sales_manager';

set local role authenticated;
set local request.jwt.claim.sub = '43aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- C. The Workforce V1 default: an EMPTY weekly-off array
-- -----------------------------------------------------------------------------

select lives_ok(
  $q$select public.publish_attendance_policy(
      'wf_v1_default', 'Workforce V1 default', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[]::smallint[], false, null
    )$q$,
  'V1 policy publishes with an EMPTY weekly-off array'
);

select is(
  (select cardinality(weekly_off_days) from public.attendance_policies where code = 'wf_v1_default'),
  0,
  'the database stores {} successfully'
);

select is(
  (select weekly_off_days from public.attendance_policies where code = 'wf_v1_default'),
  array[]::smallint[],
  'stored value is exactly the empty array, not [0]'
);

-- Publishing never activates: activation stays a separate owner act.
select is(
  (select is_current from public.attendance_policies where code = 'wf_v1_default'),
  false,
  'publishing does not activate the policy'
);
select is(
  (select count(*)::integer from public.attendance_policies where is_current = true),
  0,
  'no policy is auto-activated'
);

-- Result contract unchanged.
select ok(
  (public.publish_attendance_policy(
     'wf_v1_contract', 'Contract probe', 'Asia/Kolkata',
     time '09:00', time '18:00', 15, 240, time '23:59',
     array[]::smallint[], false, null
   ) ? 'policyId'),
  'result still carries policyId'
);
select is(
  (public.publish_attendance_policy(
     'WF_V1_Case', 'Case probe', 'Asia/Kolkata',
     time '09:00', time '18:00', 15, 240, time '23:59',
     array[]::smallint[], false, null
   ) ->> 'code'),
  'wf_v1_case',
  'result still lower-cases the code'
);

-- -----------------------------------------------------------------------------
-- D. Legacy non-empty arrays remain supported, ISO 1..7
-- -----------------------------------------------------------------------------

select lives_ok(
  $q$select public.publish_attendance_policy(
      'legacy_sun', 'Legacy Sunday off', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[7]::smallint[], false, null
    )$q$,
  'legacy single ISO weekday 7 (Sunday) is accepted'
);

select lives_ok(
  $q$select public.publish_attendance_policy(
      'legacy_satsun', 'Legacy weekend off', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[6,7]::smallint[], false, null
    )$q$,
  'legacy sorted ISO weekdays 6,7 are accepted'
);

select is(
  (select weekly_off_days from public.attendance_policies where code = 'legacy_satsun'),
  array[6,7]::smallint[],
  'legacy array is stored verbatim'
);

select lives_ok(
  $q$select public.publish_attendance_policy(
      'legacy_mon', 'Legacy Monday off', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[1]::smallint[], false, null
    )$q$,
  'ISO 1 (Monday) is accepted at the lower bound'
);

-- -----------------------------------------------------------------------------
-- E. Invalid weekly-off input fails closed
-- -----------------------------------------------------------------------------

-- 0 is the exact value the old blank-parsing bug produced.
select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_zero', 'Zero weekday', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[0]::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'weekday 0 is rejected (the old blank-to-zero bug value)'
);

select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_eight', 'Eight weekday', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[8]::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'weekday 8 is rejected'
);

select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_dupe', 'Duplicate weekday', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[7,7]::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'duplicate weekdays are rejected'
);

select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_unsorted', 'Unsorted weekdays', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[7,6]::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'unsorted weekdays are rejected'
);

-- NULL remains invalid: the caller must state intent explicitly.
select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_null', 'Null weekdays', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      null::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'NULL weekly-off remains invalid'
);

-- Timezone rule untouched.
select throws_ok(
  $q$select public.publish_attendance_policy(
      'bad_tz', 'Wrong timezone', 'UTC',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[]::smallint[], false, null
    )$q$,
  'ATTENDANCE_POLICY_NOT_CONFIGURED',
  'timezone rule is unchanged'
);

-- Nothing invalid leaked into the table.
select is(
  (select count(*)::integer from public.attendance_policies
   where code in ('bad_zero','bad_eight','bad_dupe','bad_unsorted','bad_null','bad_tz')),
  0,
  'no rejected policy was written'
);

-- -----------------------------------------------------------------------------
-- F. Authorization unchanged — Super Admin only
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '43bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $q$select public.publish_attendance_policy(
      'mgr_attempt', 'Manager attempt', 'Asia/Kolkata',
      time '09:00', time '18:00', 15, 240, time '23:59',
      array[]::smallint[], false, null
    )$q$,
  'ATTENDANCE_UNAUTHORIZED',
  'a sales manager cannot publish a policy'
);

select throws_ok(
  $q$select public.set_current_attendance_policy(
      (select id from public.attendance_policies where code = 'wf_v1_default'))$q$,
  'ATTENDANCE_UNAUTHORIZED',
  'a sales manager cannot activate a policy'
);

-- Super Admin activation still works, and remains a separate deliberate act.
set local request.jwt.claim.sub = '43aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $q$select public.set_current_attendance_policy(
      (select id from public.attendance_policies where code = 'wf_v1_default'))$q$,
  'super admin activates the V1 policy explicitly'
);

select is(
  (select cardinality(weekly_off_days) from public.attendance_policies where is_current = true),
  0,
  'the active V1 policy declares no fixed weekly-off weekday'
);

reset role;

select * from finish();
rollback;
