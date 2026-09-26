-- Premium WhatsApp campaign scheduler.
-- Adds a governed reschedule operation only; delivery remains on the existing
-- WM-4 run/materialisation/dispatch pipeline.
begin;

create or replace function public.reschedule_whatsapp_campaign_run(
  p_run_id uuid,
  p_scheduled_for timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.whatsapp_campaign_runs%rowtype;
  v_previous timestamptz;
begin
  if v_actor is null or not private.has_permission('whatsapp.campaigns.execute') then
    raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode = '42501';
  end if;

  if p_run_id is null or p_scheduled_for is null then
    raise exception 'WHATSAPP_CAMPAIGN_SCHEDULE_INVALID' using errcode = '22023';
  end if;

  select * into v_run
  from public.whatsapp_campaign_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform private.whatsapp_campaign_raise_operator_denial(
    v_actor,
    v_run.campaign_version_id
  );

  if v_run.status <> 'scheduled' then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_RESCHEDULABLE' using errcode = '22023';
  end if;

  if p_scheduled_for < clock_timestamp() + interval '2 minutes'
     or p_scheduled_for > clock_timestamp() + interval '90 days' then
    raise exception 'WHATSAPP_CAMPAIGN_SCHEDULE_INVALID' using errcode = '22023';
  end if;

  v_previous := v_run.scheduled_for;

  update public.whatsapp_campaign_runs
  set scheduled_for = p_scheduled_for
  where id = v_run.id;

  perform private.whatsapp_campaign_append_event(
    v_run.id,
    null,
    null,
    'run_rescheduled',

    'scheduled',
    'scheduled',
    null,
    'staff',
    v_actor,
    jsonb_build_object(
      'previous_scheduled_for', v_previous,
      'scheduled_for', p_scheduled_for
    )
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'status', 'scheduled',
    'scheduled_for', p_scheduled_for
  );
end;
$$;

revoke all on function public.reschedule_whatsapp_campaign_run(uuid,timestamptz)
  from public,anon;
grant execute on function public.reschedule_whatsapp_campaign_run(uuid,timestamptz)
  to authenticated;

comment on function public.reschedule_whatsapp_campaign_run(uuid,timestamptz) is
  'Moves a not-yet-materialised WhatsApp campaign run. Audience membership remains live until due-time materialisation.';

commit;

begin;

create or replace function public.list_whatsapp_campaign_scheduler_runs(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_permission('whatsapp.campaigns.execute') then
    raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode = '42501';
  end if;

  if p_from is null or p_to is null
     or p_to <= p_from
     or p_to > p_from + interval '120 days' then
    raise exception 'WHATSAPP_CAMPAIGN_SCHEDULER_RANGE_INVALID' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(x.item order by x.scheduled_for, x.created_at, x.run_id)
    from (

      select
        r.scheduled_for,
        r.created_at,
        r.id as run_id,
        jsonb_build_object(
          'run_id', r.id,
          'campaign_version_id', v.id,
          'campaign_name', c.name,
          'version_title', v.title,
          'version_number', v.version_number,
          'template_name', snap.name,
          'scheduled_for', r.scheduled_for,
          'status', r.status,
          'total_count', r.total_count,
          'eligible_count', r.eligible_count,
          'sent_count', r.sent_count,
          'failed_count', r.failed_count,
          'reconcile_count', r.reconcile_count,
          'created_at', r.created_at
        ) as item
      from public.whatsapp_campaign_runs r
      join public.campaign_versions v on v.id = r.campaign_version_id
      join public.campaigns c on c.id = v.campaign_id
      join public.whatsapp_campaign_specs s on s.id = r.spec_id
      left join public.whatsapp_template_snapshots snap on snap.id = s.template_snapshot_id

      where r.scheduled_for >= p_from
        and r.scheduled_for < p_to
        and v.intended_channels = array['whatsapp']::text[]
        and v.targeting_mode = 'direct_or_custom'
        and private.whatsapp_campaign_version_visible(v.status)
      order by r.scheduled_for, r.created_at, r.id
      limit 1000
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_whatsapp_campaign_scheduler_runs(timestamptz,timestamptz)
  from public,anon;
grant execute on function public.list_whatsapp_campaign_scheduler_runs(timestamptz,timestamptz)
  to authenticated;

comment on function public.list_whatsapp_campaign_scheduler_runs(timestamptz,timestamptz) is
  'Bounded calendar read for every governed WhatsApp campaign run in the requested delivery window.';

commit;
