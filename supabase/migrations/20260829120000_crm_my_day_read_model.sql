-- CRM 2A-6 — My Day read model (Lane B)
-- Forward-only after 20260828140000_crm_activity_rpc_workflows.
-- Read-only RPC; no assignment automation, SLA activation, nav, or lead-detail UI.

-- =============================================================================
-- A. private.get_crm_my_day_impl — single v_now capture, JSON payload
-- =============================================================================

create or replace function private.get_crm_my_day_impl(
  p_owner_id uuid default null,
  p_upcoming_limit integer default 50,
  p_attention_limit integer default 50
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_local_date date;
  v_tomorrow_start timestamptz;
  v_actor uuid;
  v_broad boolean;
  v_scope_owner uuid;
  v_can_manager_sections boolean;
  v_upcoming_limit integer;
  v_attention_limit integer;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('crm.follow_ups.manage'))
    or (select public.authorize('crm.reporting.read'))
    or (select public.authorize('leads.read_assigned'))
    or (select public.authorize('leads.read_all'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_broad := (select private.crm_has_broad_lead_read());
  v_can_manager_sections := v_broad;

  if not v_broad then
    if p_owner_id is not null and p_owner_id is distinct from v_actor then
      raise exception 'forbidden: cannot query other owner' using errcode = '42501';
    end if;
    v_scope_owner := v_actor;
  else
    v_scope_owner := p_owner_id;
  end if;

  v_upcoming_limit := least(greatest(coalesce(p_upcoming_limit, 50), 1), 100);
  v_attention_limit := least(greatest(coalesce(p_attention_limit, 50), 1), 100);

  v_now := clock_timestamp();
  v_local_date := (v_now at time zone 'Asia/Kolkata')::date;
  v_tomorrow_start := ((v_local_date + 1)::timestamp at time zone 'Asia/Kolkata');

  return (
    with primary_open_tasks as (
      select
        f.id as activity_id,
        f.lead_id,
        l.submitted_name as lead_display_label,
        f.owner_id,
        coalesce(nullif(trim(pr.display_name), ''), 'Staff member') as owner_label,
        f.activity_type,
        f.title,
        f.priority,
        f.due_at,
        f.reminder_at,
        f.source,
        l.status as lead_status,
        case
          when f.due_at < v_now then 'overdue'
          when f.due_at >= v_now and f.due_at < v_tomorrow_start then 'due_today'
          else 'upcoming'
        end as task_bucket
      from public.lead_follow_ups f
      join public.leads l on l.id = f.lead_id
      left join public.profiles pr on pr.id = f.owner_id
      where f.status = 'open'
        and f.is_primary_next_action = true
        and l.status not in ('closed_won', 'closed_lost')
        and (v_scope_owner is null or f.owner_id = v_scope_owner)
    ),
    task_rows as (
      select *
      from primary_open_tasks
    ),
    overdue_tasks as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'activityId', activity_id,
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'ownerId', owner_id,
          'ownerLabel', owner_label,
          'activityType', activity_type,
          'title', title,
          'priority', priority,
          'dueAt', due_at,
          'reminderAt', reminder_at,
          'source', source,
          'leadStatus', lead_status
        )
        order by due_at asc, activity_id asc
      ), '[]'::jsonb) as rows
      from task_rows
      where task_bucket = 'overdue'
    ),
    due_today_tasks as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'activityId', activity_id,
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'ownerId', owner_id,
          'ownerLabel', owner_label,
          'activityType', activity_type,
          'title', title,
          'priority', priority,
          'dueAt', due_at,
          'reminderAt', reminder_at,
          'source', source,
          'leadStatus', lead_status
        )
        order by due_at asc, activity_id asc
      ), '[]'::jsonb) as rows
      from task_rows
      where task_bucket = 'due_today'
    ),
    upcoming_tasks as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'activityId', activity_id,
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'ownerId', owner_id,
          'ownerLabel', owner_label,
          'activityType', activity_type,
          'title', title,
          'priority', priority,
          'dueAt', due_at,
          'reminderAt', reminder_at,
          'source', source,
          'leadStatus', lead_status
        )
        order by due_at asc, activity_id asc
      ), '[]'::jsonb) as rows
      from (
        select *
        from task_rows
        where task_bucket = 'upcoming'
        order by due_at asc, activity_id asc
        limit v_upcoming_limit
      ) limited
    ),
    no_next_action_base as (
      select
        l.id as lead_id,
        l.submitted_name as lead_display_label,
        l.assigned_to as assignee_id,
        coalesce(nullif(trim(ap.display_name), ''), 'Unassigned') as assignee_label,
        l.status as lead_status,
        l.created_at as received_at
      from public.leads l
      left join public.profiles ap on ap.id = l.assigned_to
      where l.status not in ('closed_won', 'closed_lost')
        and l.assigned_to is not null
        and (v_scope_owner is null or l.assigned_to = v_scope_owner)
        and not exists (
          select 1
          from public.lead_follow_ups f
          where f.lead_id = l.id
            and f.status = 'open'
            and f.is_primary_next_action = true
        )
      order by l.created_at asc, l.id asc
      limit v_attention_limit
    ),
    no_next_action as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'assigneeId', assignee_id,
          'assigneeLabel', assignee_label,
          'leadStatus', lead_status,
          'receivedAt', received_at,
          'slaDueAt', null,
          'attentionReason', 'no_next_action'
        )
        order by received_at asc, lead_id asc
      ), '[]'::jsonb) as rows
      from no_next_action_base
    ),
    new_uncontacted_base as (
      select
        l.id as lead_id,
        l.submitted_name as lead_display_label,
        l.assigned_to as assignee_id,
        coalesce(nullif(trim(ap.display_name), ''), 'Unassigned') as assignee_label,
        l.status as lead_status,
        l.created_at as received_at,
        c.sla_due_at
      from public.leads l
      left join public.profiles ap on ap.id = l.assigned_to
      left join public.crm_sla_clocks c on c.lead_id = l.id
      where l.status not in ('closed_won', 'closed_lost')
        and l.assigned_to is not null
        and (v_scope_owner is null or l.assigned_to = v_scope_owner)
        and (c.first_contact_attempt_at is null)
      order by l.created_at asc, l.id asc
      limit v_attention_limit
    ),
    new_uncontacted as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'assigneeId', assignee_id,
          'assigneeLabel', assignee_label,
          'leadStatus', lead_status,
          'receivedAt', received_at,
          'slaDueAt', sla_due_at,
          'attentionReason', 'new_uncontacted'
        )
        order by received_at asc, lead_id asc
      ), '[]'::jsonb) as rows
      from new_uncontacted_base
    ),
    unassigned_base as (
      select
        l.id as lead_id,
        l.submitted_name as lead_display_label,
        l.status as lead_status,
        l.created_at as received_at,
        c.sla_due_at
      from public.leads l
      left join public.crm_sla_clocks c on c.lead_id = l.id
      where v_can_manager_sections
        and l.status not in ('closed_won', 'closed_lost')
        and l.assigned_to is null
      order by l.created_at asc, l.id asc
      limit v_attention_limit
    ),
    unassigned_leads as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'assigneeId', null,
          'assigneeLabel', null,
          'leadStatus', lead_status,
          'receivedAt', received_at,
          'slaDueAt', sla_due_at,
          'attentionReason', 'unassigned'
        )
        order by received_at asc, lead_id asc
      ), '[]'::jsonb) as rows
      from unassigned_base
    ),
    sla_breach_base as (
      select
        l.id as lead_id,
        l.submitted_name as lead_display_label,
        l.assigned_to as assignee_id,
        coalesce(nullif(trim(ap.display_name), ''), 'Unassigned') as assignee_label,
        l.status as lead_status,
        l.created_at as received_at,
        c.sla_due_at
      from public.leads l
      join public.crm_sla_clocks c on c.lead_id = l.id
      left join public.profiles ap on ap.id = l.assigned_to
      where v_can_manager_sections
        and l.status not in ('closed_won', 'closed_lost')
        and c.sla_due_at is not null
        and c.first_contact_attempt_at is null
        and c.sla_due_at < v_now
        and (v_scope_owner is null or l.assigned_to = v_scope_owner)
      order by c.sla_due_at asc, l.created_at asc, l.id asc
      limit v_attention_limit
    ),
    sla_breaches as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'leadId', lead_id,
          'leadDisplayLabel', lead_display_label,
          'assigneeId', assignee_id,
          'assigneeLabel', assignee_label,
          'leadStatus', lead_status,
          'receivedAt', received_at,
          'slaDueAt', sla_due_at,
          'attentionReason', 'sla_breach'
        )
        order by sla_due_at asc, received_at asc, lead_id asc
      ), '[]'::jsonb) as rows
      from sla_breach_base
    ),
    counts as (
      select
        coalesce((select count(*) from task_rows where task_bucket = 'overdue'), 0) as overdue_count,
        coalesce((select count(*) from task_rows where task_bucket = 'due_today'), 0) as due_today_count,
        coalesce((select count(*) from task_rows where task_bucket = 'upcoming'), 0) as upcoming_count,
        coalesce((
          select count(*)
          from public.leads l
          where l.status not in ('closed_won', 'closed_lost')
            and l.assigned_to is not null
            and (v_scope_owner is null or l.assigned_to = v_scope_owner)
            and not exists (
              select 1
              from public.lead_follow_ups f
              where f.lead_id = l.id
                and f.status = 'open'
                and f.is_primary_next_action = true
            )
        ), 0) as no_next_action_count,
        coalesce((
          select count(*)
          from public.leads l
          left join public.crm_sla_clocks c on c.lead_id = l.id
          where l.status not in ('closed_won', 'closed_lost')
            and l.assigned_to is not null
            and (v_scope_owner is null or l.assigned_to = v_scope_owner)
            and c.first_contact_attempt_at is null
        ), 0) as new_uncontacted_count,
        case when v_can_manager_sections then coalesce((
          select count(*)
          from public.leads l
          where l.status not in ('closed_won', 'closed_lost')
            and l.assigned_to is null
        ), 0) else 0 end as unassigned_count,
        case when v_can_manager_sections then coalesce((
          select count(*)
          from public.leads l
          join public.crm_sla_clocks c on c.lead_id = l.id
          where l.status not in ('closed_won', 'closed_lost')
            and c.sla_due_at is not null
            and c.first_contact_attempt_at is null
            and c.sla_due_at < v_now
            and (v_scope_owner is null or l.assigned_to = v_scope_owner)
        ), 0) else 0 end as sla_breach_count
    )
    select jsonb_build_object(
      'capturedAt', v_now,
      'localDate', v_local_date,
      'scopeOwnerId', v_scope_owner,
      'isTeamScope', v_scope_owner is null,
      'canViewManagerSections', v_can_manager_sections,
      'summary', jsonb_build_object(
        'overdue', (select overdue_count from counts),
        'dueToday', (select due_today_count from counts),
        'upcoming', (select upcoming_count from counts),
        'noNextAction', (select no_next_action_count from counts),
        'newUncontacted', (select new_uncontacted_count from counts),
        'unassigned', (select unassigned_count from counts),
        'slaBreaches', (select sla_breach_count from counts)
      ),
      'tasks', jsonb_build_object(
        'overdue', (select rows from overdue_tasks),
        'dueToday', (select rows from due_today_tasks),
        'upcoming', (select rows from upcoming_tasks)
      ),
      'attention', jsonb_build_object(
        'noNextAction', (select rows from no_next_action),
        'newUncontacted', (select rows from new_uncontacted),
        'unassigned', case when v_can_manager_sections then (select rows from unassigned_leads) else '[]'::jsonb end,
        'slaBreaches', case when v_can_manager_sections then (select rows from sla_breaches) else '[]'::jsonb end
      )
    )
  );
end;
$$;

comment on function private.get_crm_my_day_impl(uuid, integer, integer) is
  'CRM 2A-6 My Day read model. Single v_now capture; Asia/Kolkata day boundaries; RLS-scoped via invoker.';

revoke all on function private.get_crm_my_day_impl(uuid, integer, integer) from public, anon;
grant execute on function private.get_crm_my_day_impl(uuid, integer, integer) to authenticated;

-- =============================================================================
-- B. public.get_crm_my_day — thin authenticated wrapper
-- =============================================================================

create or replace function public.get_crm_my_day(
  p_owner_id uuid default null,
  p_upcoming_limit integer default 50,
  p_attention_limit integer default 50
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  return private.get_crm_my_day_impl(p_owner_id, p_upcoming_limit, p_attention_limit);
end;
$$;

comment on function public.get_crm_my_day(uuid, integer, integer) is
  'CRM 2A-6 My Day workspace read RPC. Task buckets (overdue/today/upcoming) + lead attention sections.';

revoke all on function public.get_crm_my_day(uuid, integer, integer) from public, anon;
grant execute on function public.get_crm_my_day(uuid, integer, integer) to authenticated;
