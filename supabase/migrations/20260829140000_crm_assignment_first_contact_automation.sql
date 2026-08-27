-- CRM 2A-7 — Assignment / reassignment + First Contact automation
-- Forward-only after 20260828140000_crm_activity_rpc_workflows.
-- No SLA activation, no My Day, no lead-detail UI, no import opt-in (2A-8), no M38.

-- =============================================================================
-- A. lead_activities: follow_up.auto_created summary type
-- =============================================================================

alter table public.lead_activities
  drop constraint if exists chk_lead_activities_type;

alter table public.lead_activities
  add constraint chk_lead_activities_type check (
    activity_type in (
      'note.created',
      'follow_up.scheduled',
      'follow_up.auto_created',
      'follow_up.completed',
      'follow_up.cancelled',
      'follow_up.sla_breached',
      'status.changed',
      'assignment.changed',
      'lead.manual_created',
      'lead.bulk_imported'
    )
  );

-- =============================================================================
-- B. ensure_sla_first_contact_primary (idempotent; lead should be locked by caller)
-- =============================================================================

create or replace function private.ensure_sla_first_contact_primary(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_clock public.crm_sla_clocks%rowtype;
  v_existing public.lead_follow_ups%rowtype;
  v_row public.lead_follow_ups%rowtype;
  v_prev_owner uuid;
  v_now timestamptz;
begin
  if p_lead_id is null or p_assignee_id is null or p_actor is null then
    return;
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    return;
  end if;

  if v_lead.status in ('closed_won', 'closed_lost') then
    return;
  end if;

  if v_lead.entry_method = 'import' then
    return;
  end if;

  v_clock := private.ensure_first_contact_sla_clock(p_lead_id);

  if v_clock.first_contact_attempt_at is not null then
    return;
  end if;

  if v_clock.sla_due_at is null then
    return;
  end if;

  v_now := clock_timestamp();

  select * into v_existing
  from public.lead_follow_ups f
  where f.lead_id = p_lead_id
    and f.status = 'open'
    and f.source = 'sla_auto'
    and f.title = 'First Contact'
  order by f.id
  limit 1
  for update;

  if found then
    if coalesce(v_existing.is_primary_next_action, false) is not true then
      perform private.clear_open_primary_for_lead(
        p_lead_id, p_actor, 'primary_replaced', v_existing.id
      );
      update public.lead_follow_ups
      set is_primary_next_action = true,
          updated_at = v_now
      where id = v_existing.id;

      insert into public.lead_follow_up_events (
        follow_up_id, lead_id, actor_id, event_type,
        previous_values, new_values, reason_code, reason_note
      )
      values (
        v_existing.id, p_lead_id, p_actor, 'primary_designated',
        jsonb_build_object('isPrimaryNextAction', false),
        jsonb_build_object('isPrimaryNextAction', true),
        'sla_auto_primary', null
      );
    end if;

    if v_existing.owner_id is distinct from p_assignee_id then
      v_prev_owner := v_existing.owner_id;
      update public.lead_follow_ups
      set owner_id = p_assignee_id,
          updated_at = v_now
      where id = v_existing.id;

      insert into public.lead_follow_up_events (
        follow_up_id, lead_id, actor_id, event_type,
        previous_values, new_values, reason_code, reason_note
      )
      values (
        v_existing.id, p_lead_id, p_actor, 'ownership_transferred',
        jsonb_build_object('ownerId', v_prev_owner),
        jsonb_build_object('ownerId', p_assignee_id),
        null, null
      );
    end if;

    return;
  end if;

  perform private.clear_open_primary_for_lead(p_lead_id, p_actor, 'primary_replaced', null);

  insert into public.lead_follow_ups (
    lead_id, owner_id, due_at, status, created_by,
    activity_type, title, priority, is_primary_next_action, source, updated_at
  ) values (
    p_lead_id, p_assignee_id, v_clock.sla_due_at, 'open', p_actor,
    'call', 'First Contact', 'high', true, 'sla_auto', v_now
  )
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, p_lead_id, p_actor, 'created',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'activityType', 'call',
      'title', 'First Contact',
      'dueAt', v_clock.sla_due_at,
      'priority', 'high',
      'ownerId', p_assignee_id,
      'isPrimaryNextAction', true,
      'source', 'sla_auto'
    )),
    null, null
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, p_lead_id, p_actor, 'primary_designated',
    jsonb_build_object('isPrimaryNextAction', false),
    jsonb_build_object('isPrimaryNextAction', true),
    'sla_auto_primary', null
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'follow_up.auto_created',
    v_row.id,
    p_actor,
    'First Contact task auto-created',
    jsonb_strip_nulls(jsonb_build_object(
      'dueAt', v_clock.sla_due_at,
      'ownerId', p_assignee_id,
      'activityType', 'call',
      'title', 'First Contact',
      'priority', 'high',
      'isPrimaryNextAction', true,
      'source', 'sla_auto'
    ))
  );
end;
$$;

comment on function private.ensure_sla_first_contact_primary(uuid, uuid, uuid) is
  'CRM 2A-7: idempotent SLA First Contact primary ensure. Uses existing clock due only; never marks attempt.';

revoke all on function private.ensure_sla_first_contact_primary(uuid, uuid, uuid)
  from public, anon, authenticated;
alter function private.ensure_sla_first_contact_primary(uuid, uuid, uuid) owner to postgres;

-- =============================================================================
-- C. sync_open_activities_on_assignment (reassign ownership transfer / retention)
-- =============================================================================

create or replace function private.sync_open_activities_on_assignment(
  p_lead_id uuid,
  p_new_assignee_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.lead_follow_ups%rowtype;
  v_prev_owner uuid;
  v_now timestamptz;
begin
  if p_lead_id is null or p_new_assignee_id is null or p_actor is null then
    return;
  end if;

  v_now := clock_timestamp();

  for v_row in
    select *
    from public.lead_follow_ups f
    where f.lead_id = p_lead_id
      and f.status = 'open'
    order by f.id
    for update
  loop
    if coalesce(v_row.is_primary_next_action, false) then
      if v_row.owner_id is distinct from p_new_assignee_id then
        v_prev_owner := v_row.owner_id;
        update public.lead_follow_ups
        set owner_id = p_new_assignee_id,
            updated_at = v_now
        where id = v_row.id;

        insert into public.lead_follow_up_events (
          follow_up_id, lead_id, actor_id, event_type,
          previous_values, new_values, reason_code, reason_note
        )
        values (
          v_row.id, p_lead_id, p_actor, 'ownership_transferred',
          jsonb_build_object('ownerId', v_prev_owner),
          jsonb_build_object('ownerId', p_new_assignee_id),
          null, null
        );
      end if;
    elsif not (select private.crm_user_can_operate_lead(
      v_row.owner_id, p_lead_id, 'crm.follow_ups.manage'
    )) then
      if v_row.owner_id is distinct from p_new_assignee_id then
        v_prev_owner := v_row.owner_id;
        update public.lead_follow_ups
        set owner_id = p_new_assignee_id,
            updated_at = v_now
        where id = v_row.id;

        insert into public.lead_follow_up_events (
          follow_up_id, lead_id, actor_id, event_type,
          previous_values, new_values, reason_code, reason_note
        )
        values (
          v_row.id, p_lead_id, p_actor, 'ownership_transferred',
          jsonb_build_object('ownerId', v_prev_owner),
          jsonb_build_object('ownerId', p_new_assignee_id),
          null, null
        );
      end if;
    end if;
  end loop;
end;
$$;

comment on function private.sync_open_activities_on_assignment(uuid, uuid, uuid) is
  'CRM 2A-7: after reassignment, primary follows new assignee; secondary retained when still authorized else transferred.';

revoke all on function private.sync_open_activities_on_assignment(uuid, uuid, uuid)
  from public, anon, authenticated;
alter function private.sync_open_activities_on_assignment(uuid, uuid, uuid) owner to postgres;

-- =============================================================================
-- D. assign_lead_impl — activity ownership + First Contact automation
-- =============================================================================

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

  -- Unassign: fail closed when any open activity remains (stricter MVP preserved).
  if v_mode = 'unassign' then
    if exists (
      select 1
      from public.lead_follow_ups f
      where f.lead_id = p_lead_id
        and f.status = 'open'
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

  -- Activity ownership + First Contact (non-import SLA-applicable paths only).
  if v_mode in ('assign', 'reassign') and v_lead.entry_method is distinct from 'import' then
    perform private.ensure_first_contact_sla_clock(p_lead_id);

    if v_mode = 'reassign' then
      perform private.sync_open_activities_on_assignment(
        p_lead_id, p_assignee_id, v_actor
      );
    end if;

    perform private.ensure_sla_first_contact_primary(
      p_lead_id, p_assignee_id, v_actor
    );
  end if;

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

alter function private.assign_lead_impl(
  uuid, uuid, text, uuid, timestamptz, boolean
) owner to postgres;

-- =============================================================================
-- E. Lead receipt SLA clock trigger (public/manual; import opt-out via entry_method)
-- =============================================================================

create or replace function private.trg_leads_after_insert_sla_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.entry_method is distinct from 'import' then
    perform private.ensure_first_contact_sla_clock(NEW.id);
  end if;

  if NEW.assigned_to is not null
     and NEW.entry_method is distinct from 'import'
     and NEW.status = 'assigned'
     and auth.uid() is not null
  then
    perform private.ensure_sla_first_contact_primary(NEW.id, NEW.assigned_to, auth.uid());
  end if;

  return NEW;
end;
$$;

comment on function private.trg_leads_after_insert_sla_receipt() is
  'CRM 2A-7: ensure first-contact SLA clock at lead receipt for non-import paths; optional First Contact on create-with-assign.';

drop trigger if exists trg_leads_after_insert_sla_receipt on public.leads;

create trigger trg_leads_after_insert_sla_receipt
  after insert on public.leads
  for each row
  execute function private.trg_leads_after_insert_sla_receipt();

revoke all on function private.trg_leads_after_insert_sla_receipt() from public, anon, authenticated;
alter function private.trg_leads_after_insert_sla_receipt() owner to postgres;
