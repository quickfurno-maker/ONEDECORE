-- ONEDECORE Phase 6D — Staff Attendance Idempotency Order Repair (M24)
-- Forward-only repair migration to evaluate idempotency replay lookup
-- before open-session state guards in check_in_attendance and check_out_attendance.

create or replace function public.check_in_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_profile public.staff_employment_profiles%rowtype;
  v_policy public.attendance_policies%rowtype;
  v_attendance_date date;
  v_existing public.attendance_events%rowtype;
  v_event_id uuid;
  v_day public.attendance_days%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  v_profile := private.staff_assert_attendance_eligible(v_actor);

  select * into v_policy
  from public.attendance_policies
  where id = v_profile.attendance_policy_id;

  if not found then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  perform private.staff_validate_attendance_location(
    v_policy, p_location_category, p_latitude, p_longitude, p_location_accuracy_m
  );

  select * into v_existing
  from public.attendance_events
  where staff_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    v_attendance_date := v_existing.attendance_date;
    perform private.derive_attendance_day(v_actor, v_attendance_date);
    select * into v_day
    from public.attendance_days
    where staff_id = v_actor and attendance_date = v_attendance_date;

    return jsonb_build_object(
      'staffId', v_actor,
      'attendanceDate', v_attendance_date,
      'primaryStatus', v_day.primary_status,
      'eventId', v_existing.id,
      'openSession', v_day.open_session,
      'idempotentReplay', true,
      'occurredAt', v_existing.occurred_at
    );
  end if;

  if exists (
    select 1 from public.attendance_days ad
    where ad.staff_id = v_actor and ad.open_session = true
  ) then
    raise exception 'ATTENDANCE_ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;

  v_attendance_date := private.staff_attendance_business_date(now());

  perform 1
  from public.attendance_days
  where staff_id = v_actor
    and attendance_date = v_attendance_date
  for update;

  v_event_id := gen_random_uuid();

  insert into public.attendance_events (
    id, staff_id, attendance_date, event_type, idempotency_key,
    location_category, latitude, longitude, location_accuracy_m,
    client_reported_at, attendance_policy_id
  )
  values (
    v_event_id, v_actor, v_attendance_date, 'check_in', p_idempotency_key,
    p_location_category,
    case when p_latitude is null then null else round(p_latitude::numeric, 3) end,
    case when p_longitude is null then null else round(p_longitude::numeric, 3) end,
    p_location_accuracy_m,
    p_client_reported_at,
    v_policy.id
  );

  perform private.derive_attendance_day(v_actor, v_attendance_date);

  select * into v_day
  from public.attendance_days
  where staff_id = v_actor and attendance_date = v_attendance_date;

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', v_attendance_date,
    'primaryStatus', v_day.primary_status,
    'eventId', v_event_id,
    'openSession', v_day.open_session,
    'idempotentReplay', false,
    'occurredAt', now()
  );
end;
$$;

create or replace function public.check_out_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_profile public.staff_employment_profiles%rowtype;
  v_policy public.attendance_policies%rowtype;
  v_attendance_date date;
  v_existing public.attendance_events%rowtype;
  v_event_id uuid;
  v_day public.attendance_days%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  v_profile := private.staff_assert_attendance_eligible(v_actor);

  select * into v_policy
  from public.attendance_policies
  where id = v_profile.attendance_policy_id;

  if not found then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  perform private.staff_validate_attendance_location(
    v_policy, p_location_category, p_latitude, p_longitude, p_location_accuracy_m
  );

  select * into v_existing
  from public.attendance_events
  where staff_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    v_attendance_date := v_existing.attendance_date;
    perform private.derive_attendance_day(v_actor, v_attendance_date);
    select * into v_day
    from public.attendance_days
    where staff_id = v_actor and attendance_date = v_attendance_date;

    return jsonb_build_object(
      'staffId', v_actor,
      'attendanceDate', v_attendance_date,
      'primaryStatus', v_day.primary_status,
      'eventId', v_existing.id,
      'openSession', v_day.open_session,
      'idempotentReplay', true,
      'occurredAt', v_existing.occurred_at
    );
  end if;

  if not exists (
    select 1 from public.attendance_days ad
    where ad.staff_id = v_actor and ad.open_session = true
  ) then
    raise exception 'ATTENDANCE_NOT_CHECKED_IN' using errcode = 'P0001';
  end if;

  select attendance_date into v_attendance_date
  from public.attendance_days
  where staff_id = v_actor and open_session = true
  limit 1;

  perform 1
  from public.attendance_days
  where staff_id = v_actor
    and attendance_date = v_attendance_date
  for update;

  v_event_id := gen_random_uuid();

  insert into public.attendance_events (
    id, staff_id, attendance_date, event_type, idempotency_key,
    location_category, latitude, longitude, location_accuracy_m,
    client_reported_at, attendance_policy_id
  )
  values (
    v_event_id, v_actor, v_attendance_date, 'check_out', p_idempotency_key,
    p_location_category,
    case when p_latitude is null then null else round(p_latitude::numeric, 3) end,
    case when p_longitude is null then null else round(p_longitude::numeric, 3) end,
    p_location_accuracy_m,
    p_client_reported_at,
    v_policy.id
  );

  perform private.derive_attendance_day(v_actor, v_attendance_date);

  select * into v_day
  from public.attendance_days
  where staff_id = v_actor and attendance_date = v_attendance_date;

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', v_attendance_date,
    'primaryStatus', v_day.primary_status,
    'eventId', v_event_id,
    'openSession', v_day.open_session,
    'idempotentReplay', false,
    'occurredAt', now()
  );
end;
$$;
