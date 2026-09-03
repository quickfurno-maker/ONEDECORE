-- ONEDECORE Workforce V1 — allow publishing a policy with no weekly-off weekday
--
-- Forward-only. Edits nothing: M23 (20260810140000), M51 (20260902160000) and
-- M52 (20260903120000) are all applied and remain untouched.
--
-- THE CONTRADICTION
-- -----------------
-- M51 relaxed the TABLE constraint so `attendance_policies.weekly_off_days`
-- may be empty, and states the legacy column is not consulted by Workforce V1,
-- where Weekly Off is chosen day-by-day and capped at 4 per month.
--
-- The supported creation path never got the matching change. M23's
-- `publish_attendance_policy` still rejects an empty array:
--
--     if p_weekly_off_days is null
--       or coalesce(array_length(p_weekly_off_days, 1), 0) < 1
--       ...
--
-- so the only sanctioned way to create a policy cannot express the V1 default.
-- With zero policies in production, no policy can currently be published at all
-- without inventing a fixed weekly-off weekday the business does not have.
--
-- THIS MIGRATION CHANGES EXACTLY ONE THING: the weekly-off validation branch.
-- Authorization, SECURITY DEFINER, `search_path = ''`, the timezone rule, the
-- insert column list, `is_current = false` (no automatic activation), the
-- returned JSON contract, ownership and grants are all reproduced verbatim.
--
-- New weekly-off rule:
--   NULL                -> invalid (unchanged)
--   {}                  -> VALID: the Workforce V1 default, no fixed weekday
--   non-empty           -> legacy ISO weekdays only, 1=Mon .. 7=Sun
--   duplicates / 0 / 8  -> invalid, fail closed
--
-- No weekly-off scheduling system is introduced, and no policy is activated:
-- `set_current_attendance_policy` remains the only activation path.

create or replace function public.publish_attendance_policy(
  p_code text,
  p_name text,
  p_timezone text,
  p_workday_start_local time,
  p_workday_end_local time,
  p_late_grace_minutes integer,
  p_half_day_threshold_minutes integer,
  p_missing_checkout_cutoff_local time,
  p_weekly_off_days smallint[],
  p_location_required boolean,
  p_supersedes_policy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_policy_id uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.policies.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_timezone <> 'Asia/Kolkata' then
    raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  -- A missing array is still invalid: the caller must state its intent, and an
  -- empty array is how "no fixed weekly-off weekday" is stated.
  if p_weekly_off_days is null then
    raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  -- Only a NON-EMPTY legacy array is content-checked. The array must already be
  -- sorted, distinct and within ISO 1..7, so duplicates, 0 and 8 fail closed
  -- rather than being silently normalised away. An EMPTY array skips this and
  -- is accepted as the Workforce V1 default.
  if coalesce(array_length(p_weekly_off_days, 1), 0) > 0 then
    if exists (select 1 from unnest(p_weekly_off_days) as d where d < 1 or d > 7) then
      raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
    end if;

    if p_weekly_off_days <> (
      select coalesce(array_agg(distinct d order by d), '{}'::smallint[])
      from unnest(p_weekly_off_days) as d
    ) then
      raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
    end if;
  end if;

  insert into public.attendance_policies (
    code, name, timezone,
    workday_start_local, workday_end_local,
    late_grace_minutes, half_day_threshold_minutes,
    missing_checkout_cutoff_local, weekly_off_days,
    location_required, is_current, supersedes_policy_id
  )
  values (
    lower(trim(p_code)), trim(p_name), p_timezone,
    p_workday_start_local, p_workday_end_local,
    p_late_grace_minutes, p_half_day_threshold_minutes,
    p_missing_checkout_cutoff_local, p_weekly_off_days,
    coalesce(p_location_required, false), false, p_supersedes_policy_id
  )
  returning id into v_policy_id;

  return jsonb_build_object('policyId', v_policy_id, 'code', lower(trim(p_code)));
end;
$$;

comment on function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) is
  'Publishes an inactive attendance policy. weekly_off_days may be empty (Workforce V1 default, no fixed weekly-off weekday); a non-empty legacy array must be sorted, distinct ISO weekdays 1=Mon..7=Sun. Never activates a policy.';

-- Reproduced verbatim so privileges cannot drift with the replacement.
revoke all on function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) from public, anon;
grant execute on function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) to authenticated;
alter function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) owner to postgres;
