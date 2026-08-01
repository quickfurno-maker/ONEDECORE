-- Phase 5C2A — CRM assignment mutation hardening (assign, reassign, safe unassign)

drop function if exists public.assign_lead(uuid, uuid, text);
drop function if exists private.assign_lead_impl(uuid, uuid, text);

create or replace function private.assign_lead_impl(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_reason text default null,
  p_expected_assignee uuid default null,
  p_expected_updated_at timestamptz default null,
  p_enforce_expected_state boolean default false
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_prev uuid;
  v_method text;
  v_history_id uuid;
  v_reason text;
  v_mode text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_ASSIGNMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.assign')) then
    raise exception 'CRM_ASSIGNMENT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'CRM_ASSIGNMENT_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_can_view_lead_by_id(p_lead_id)) then
    raise exception 'CRM_ASSIGNMENT_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_prev := v_lead.assigned_to;

  if v_prev is not distinct from p_assignee_id then
    return v_lead;
  end if;

  if p_enforce_expected_state then
    if v_lead.assigned_to is distinct from p_expected_assignee then
      raise exception 'CRM_ASSIGNMENT_STALE' using errcode = 'P0001';
    end if;
    if p_expected_updated_at is null
      or v_lead.updated_at is distinct from p_expected_updated_at then
      raise exception 'CRM_ASSIGNMENT_STALE' using errcode = 'P0001';
    end if;
  end if;

  if v_lead.status in ('closed_won', 'closed_lost') then
    raise exception 'CRM_ASSIGNMENT_TERMINAL' using errcode = '22023';
  end if;

  if p_assignee_id is null then
    v_mode := 'unassign';
  elsif v_prev is null then
    v_mode := 'assign';
  else
    v_mode := 'reassign';
  end if;

  if v_mode = 'assign' then
    if v_lead.status <> 'new' or v_prev is not null then
      raise exception 'CRM_ASSIGNMENT_TARGET_INVALID' using errcode = '22023';
    end if;
  elsif v_mode = 'reassign' then
    if v_prev is null then
      raise exception 'CRM_ASSIGNMENT_TARGET_INVALID' using errcode = '22023';
    end if;
    if p_assignee_id is null then
      raise exception 'CRM_ASSIGNMENT_TARGET_INVALID' using errcode = '22023';
    end if;
  elsif v_mode = 'unassign' then
    if v_prev is null then
      raise exception 'CRM_ASSIGNMENT_TARGET_INVALID' using errcode = '22023';
    end if;
    if v_lead.status <> 'assigned' then
      raise exception 'CRM_ASSIGNMENT_UNSAFE_UNASSIGN' using errcode = '22023';
    end if;
  end if;

  if p_assignee_id is not null
    and not (select private.crm_is_assignable_sales_user(p_assignee_id)) then
    raise exception 'CRM_ASSIGNMENT_TARGET_INVALID' using errcode = '22023';
  end if;

  if v_mode = 'unassign' then
    if exists (
      select 1
      from public.lead_follow_ups f
      where f.lead_id = p_lead_id
        and f.status = 'open'
    ) then
      raise exception 'CRM_ASSIGNMENT_OPEN_FOLLOW_UPS' using errcode = '22023';
    end if;
  elsif v_mode = 'reassign' then
    if exists (
      select 1
      from public.lead_follow_ups f
      where f.lead_id = p_lead_id
        and f.status = 'open'
        and f.owner_id is distinct from p_assignee_id
    ) then
      raise exception 'CRM_ASSIGNMENT_OPEN_FOLLOW_UPS' using errcode = '22023';
    end if;
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_mode = 'assign' then
    if v_reason is not null and char_length(v_reason) > 500 then
      raise exception 'CRM_ASSIGNMENT_REASON_INVALID' using errcode = '22023';
    end if;
  else
    if v_reason is null then
      raise exception 'CRM_ASSIGNMENT_REASON_REQUIRED' using errcode = '22023';
    end if;
    if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
      raise exception 'CRM_ASSIGNMENT_REASON_INVALID' using errcode = '22023';
    end if;
  end if;

  v_method := private.crm_derive_human_assignment_method();

  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
  set assigned_to = p_assignee_id,
      status = case
        when v_mode = 'assign' then 'assigned'
        when v_mode = 'unassign' then 'new'
        else status
      end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_assignment_history (
    lead_id, previous_assignee, new_assignee, assignment_method, actor_id, reason
  ) values (
    p_lead_id, v_prev, p_assignee_id, v_method, v_actor, v_reason
  )
  returning id into v_history_id;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    p_lead_id,
    'lead.assigned',
    v_actor,
    'staff',
    jsonb_build_object(
      'previousAssignee', v_prev,
      'newAssignee', p_assignee_id,
      'method', v_method,
      'mode', v_mode
    )
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'assignment.changed',
    v_history_id,
    v_actor,
    case
      when v_mode = 'unassign' then 'Lead unassigned'
      when v_mode = 'reassign' then 'Lead reassigned'
      else 'Lead assigned'
    end,
    jsonb_build_object(
      'previousAssignee', v_prev,
      'newAssignee', p_assignee_id,
      'method', v_method,
      'mode', v_mode
    )
  );

  perform set_config('onedecore.crm_transition', '0', true);
  return v_lead;
end;
$$;

create or replace function public.assign_lead(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_reason text default null,
  p_expected_assignee uuid default null,
  p_expected_updated_at timestamptz default null,
  p_enforce_expected_state boolean default false
)
returns public.leads
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.assign_lead_impl(
    p_lead_id,
    p_assignee_id,
    p_reason,
    p_expected_assignee,
    p_expected_updated_at,
    p_enforce_expected_state
  );
end;
$$;

alter function private.assign_lead_impl(
  uuid, uuid, text, uuid, timestamptz, boolean
) owner to postgres;

alter function public.assign_lead(
  uuid, uuid, text, uuid, timestamptz, boolean
) owner to postgres;

revoke all on function private.assign_lead_impl(
  uuid, uuid, text, uuid, timestamptz, boolean
) from public, anon;

revoke all on function public.assign_lead(
  uuid, uuid, text, uuid, timestamptz, boolean
) from public, anon;

grant execute on function private.assign_lead_impl(
  uuid, uuid, text, uuid, timestamptz, boolean
) to authenticated;

grant execute on function public.assign_lead(
  uuid, uuid, text, uuid, timestamptz, boolean
) to authenticated;
