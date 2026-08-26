-- =============================================================================
-- CRM 2A-3 — Activity RPC Workflows (create/reschedule/transfer/designate/complete)
-- Forward-only after 20260827140000_crm_business_sla_foundation.
-- No SLA activation, no business hours mutation, no UI, no My Day, no assign wiring,
-- no deferred payment M38. Legacy create/complete/cancel follow-up RPCs untouched.
-- Public wrappers SECURITY INVOKER → private SECURITY DEFINER impls.
-- Lead-scoped FOR UPDATE serialization; clock_timestamp() only AFTER locks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Helper: clear any open primary follow-up for a lead (with audit)
-- -----------------------------------------------------------------------------

create or replace function private.clear_open_primary_for_lead(
  p_lead_id uuid,
  p_actor uuid,
  p_reason text,
  p_except_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.lead_follow_ups%rowtype;
begin
  for v_row in
    select *
    from public.lead_follow_ups
    where lead_id = p_lead_id
      and is_primary_next_action = true
      and status = 'open'
      and (p_except_id is null or id <> p_except_id)
    for update
  loop
    update public.lead_follow_ups
    set is_primary_next_action = false,
        updated_at = clock_timestamp()
    where id = v_row.id;

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, p_lead_id, p_actor, 'primary_cleared',
      jsonb_build_object('isPrimaryNextAction', true),
      jsonb_build_object('isPrimaryNextAction', false),
      p_reason, null
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- B. Helper: validate WhatsApp governed-send evidence chain.
--    Returns provider_timestamp of the bound outbound message on success.
--    p_receipt_at is the lower bound (SLA clock_started_at from the caller).
-- -----------------------------------------------------------------------------

create or replace function private.validate_crm_whatsapp_send_evidence(
  p_send_intent_id uuid,
  p_lead_id uuid,
  p_receipt_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.whatsapp_send_intents%rowtype;
  v_conversation_lead uuid;
  v_message public.whatsapp_messages%rowtype;
  v_provider_ts timestamptz;
begin
  if p_send_intent_id is null then
    raise exception 'WHATSAPP_SEND_EVIDENCE_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into v_intent
  from public.whatsapp_send_intents
  where id = p_send_intent_id;
  if not found
    or v_intent.lifecycle_status <> 'dispatch_bound'
    or v_intent.outbound_message_id is null then
    raise exception 'WHATSAPP_SEND_EVIDENCE_INVALID' using errcode = 'P0001';
  end if;

  select c.lead_id
  into v_conversation_lead
  from public.whatsapp_conversations c
  where c.id = v_intent.conversation_id;
  if not found
    or v_conversation_lead is null
    or v_conversation_lead is distinct from p_lead_id then
    raise exception 'WHATSAPP_SEND_EVIDENCE_INVALID' using errcode = 'P0001';
  end if;

  select *
  into v_message
  from public.whatsapp_messages
  where id = v_intent.outbound_message_id;
  if not found
    or v_message.conversation_id is distinct from v_intent.conversation_id
    or v_message.direction <> 'outbound'
    or v_message.provider_message_id is null
    or v_message.provider_timestamp is null then
    raise exception 'WHATSAPP_SEND_EVIDENCE_INVALID' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.whatsapp_provider_dispatch_attempts a
    where a.send_intent_id = v_intent.id
      and a.status = 'succeeded'
      and a.provider_message_id is not null
      and a.provider_message_id = v_message.provider_message_id
  ) then
    raise exception 'WHATSAPP_SEND_EVIDENCE_INVALID' using errcode = 'P0001';
  end if;

  v_provider_ts := v_message.provider_timestamp;

  if p_receipt_at is not null and v_provider_ts < p_receipt_at then
    raise exception 'WHATSAPP_SEND_EVIDENCE_INVALID' using errcode = 'P0001';
  end if;

  return v_provider_ts;
end;
$$;

-- -----------------------------------------------------------------------------
-- C. Helper: mark first-contact attempt (immutable once set).
--    Called only from DEFINER complete impl under the same postgres owner.
-- -----------------------------------------------------------------------------

create or replace function private.mark_first_contact_attempt_if_qualifying(
  p_lead_id uuid,
  p_attempt_at timestamptz,
  p_source text,
  p_outcome_code text default null,
  p_activity_type text default null,
  p_whatsapp_send_intent_id uuid default null
)
returns public.crm_sla_clocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clock public.crm_sla_clocks%rowtype;
  v_outcome public.lead_activity_outcome_codes%rowtype;
begin
  if p_lead_id is null or p_attempt_at is null then
    return null;
  end if;

  if p_source not in ('call_outcome', 'whatsapp_governed_send') then
    return null;
  end if;

  -- Idempotent clock existence; never activates policy, never rescopes due.
  perform private.ensure_first_contact_sla_clock(p_lead_id);

  select *
  into v_clock
  from public.crm_sla_clocks
  where lead_id = p_lead_id
  for update;

  if not found then
    return null;
  end if;

  -- Immutable: never move an already-set attempt timestamp.
  if v_clock.first_contact_attempt_at is not null then
    return v_clock;
  end if;

  if p_source = 'call_outcome' then
    if p_activity_type is distinct from 'call' then
      return v_clock;
    end if;
    if p_outcome_code is null then
      return v_clock;
    end if;
    select *
    into v_outcome
    from public.lead_activity_outcome_codes
    where code = p_outcome_code;
    if not found
      or v_outcome.is_active is not true
      or v_outcome.closes_contact_attempt is not true then
      return v_clock;
    end if;
  elsif p_source = 'whatsapp_governed_send' then
    if p_activity_type is distinct from 'whatsapp' then
      return v_clock;
    end if;
    if p_outcome_code is distinct from 'whatsapp_sent' then
      return v_clock;
    end if;
    if p_whatsapp_send_intent_id is null then
      return v_clock;
    end if;
    -- Evidence chain already validated by caller; p_attempt_at IS provider_timestamp.
  end if;

  update public.crm_sla_clocks
  set first_contact_attempt_at = p_attempt_at,
      updated_at = clock_timestamp()
  where lead_id = p_lead_id
    and first_contact_attempt_at is null
  returning * into v_clock;

  return v_clock;
end;
$$;

-- -----------------------------------------------------------------------------
-- D. private.create_lead_activity_impl / public.create_lead_activity
-- -----------------------------------------------------------------------------

create or replace function private.create_lead_activity_impl(
  p_lead_id uuid,
  p_activity_type text,
  p_title text,
  p_due_at timestamptz,
  p_priority text default 'normal',
  p_owner_id uuid default null,
  p_is_primary boolean default false,
  p_duration_minutes integer default null,
  p_reminder_at timestamptz default null,
  p_quotation_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_owner uuid;
  v_title text;
  v_row public.lead_follow_ups%rowtype;
  v_broad boolean;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_lead_id is null then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_type is null
     or p_activity_type not in (
       'call', 'whatsapp', 'consultation', 'site_visit',
       'quotation_follow_up', 'internal_task'
     ) then
    raise exception 'ACTIVITY_TYPE_INVALID' using errcode = '22023';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null or length(v_title) < 1 or length(v_title) > 200 then
    raise exception 'ACTIVITY_TITLE_INVALID' using errcode = '22023';
  end if;

  if p_priority is null or p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'ACTIVITY_PRIORITY_INVALID' using errcode = '22023';
  end if;

  if p_due_at is null then
    raise exception 'ACTIVITY_DUE_REQUIRED' using errcode = '22023';
  end if;

  if p_duration_minutes is not null and p_duration_minutes <= 0 then
    raise exception 'ACTIVITY_DURATION_INVALID' using errcode = '22023';
  end if;

  if p_reminder_at is not null and p_reminder_at > p_due_at then
    raise exception 'ACTIVITY_REMINDER_INVALID' using errcode = '22023';
  end if;

  if p_quotation_id is not null then
    if not exists (
      select 1 from public.quotations q
      where q.id = p_quotation_id and q.lead_id = p_lead_id
    ) then
      raise exception 'ACTIVITY_QUOTATION_MISMATCH' using errcode = '22023';
    end if;
  end if;

  -- Terminal leads: never create a new primary.
  if v_lead.status in ('closed_won', 'closed_lost') and coalesce(p_is_primary, false) then
    raise exception 'ACTIVITY_TERMINAL_REJECTED' using errcode = '22023';
  end if;

  -- Manual create on on_hold leads: primary reserved for on_hold_review (complete path only).
  if v_lead.status = 'on_hold' and coalesce(p_is_primary, false) then
    raise exception 'ON_HOLD_PRIMARY_RESERVED' using errcode = '22023';
  end if;

  v_broad := (select private.crm_has_broad_lead_read());

  if v_broad then
    v_owner := coalesce(p_owner_id, v_actor);
    if not (select private.crm_user_can_operate_lead(v_owner, p_lead_id, 'crm.follow_ups.manage')) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if not (select private.crm_is_eligible_follow_up_owner(v_owner)) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
  else
    if p_owner_id is not null and p_owner_id is distinct from v_actor then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    v_owner := v_actor;
  end if;

  -- Primary switch: demote existing open primary first.
  if coalesce(p_is_primary, false) then
    perform private.clear_open_primary_for_lead(p_lead_id, v_actor, 'primary_replaced', null);
  end if;

  insert into public.lead_follow_ups (
    lead_id, owner_id, due_at, status, created_by,
    activity_type, title, priority, is_primary_next_action,
    duration_minutes, reminder_at, quotation_id, source, updated_at
  ) values (
    p_lead_id, v_owner, p_due_at, 'open', v_actor,
    p_activity_type, v_title, p_priority, coalesce(p_is_primary, false),
    p_duration_minutes, p_reminder_at, p_quotation_id, 'manual', v_now
  )
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, p_lead_id, v_actor, 'created',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'activityType', p_activity_type,
      'title', v_title,
      'dueAt', p_due_at,
      'priority', p_priority,
      'ownerId', v_owner,
      'isPrimaryNextAction', coalesce(p_is_primary, false),
      'source', 'manual',
      'durationMinutes', p_duration_minutes,
      'reminderAt', p_reminder_at,
      'quotationId', p_quotation_id
    )),
    null, null
  );

  if coalesce(p_is_primary, false) then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, p_lead_id, v_actor, 'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true),
      'created_primary', null
    );
  end if;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'follow_up.scheduled',
    v_row.id,
    v_actor,
    'Follow-up scheduled',
    jsonb_strip_nulls(jsonb_build_object(
      'dueAt', p_due_at,
      'ownerId', v_owner,
      'activityType', p_activity_type,
      'title', v_title,
      'priority', p_priority,
      'isPrimaryNextAction', coalesce(p_is_primary, false),
      'source', 'manual'
    ))
  );

  return v_row;
end;
$$;

create or replace function public.create_lead_activity(
  p_lead_id uuid,
  p_activity_type text,
  p_title text,
  p_due_at timestamptz,
  p_priority text default 'normal',
  p_owner_id uuid default null,
  p_is_primary boolean default false,
  p_duration_minutes integer default null,
  p_reminder_at timestamptz default null,
  p_quotation_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_lead_activity_impl(
    p_lead_id, p_activity_type, p_title, p_due_at, p_priority,
    p_owner_id, p_is_primary, p_duration_minutes, p_reminder_at, p_quotation_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- E. private.reschedule_lead_activity_impl / public.reschedule_lead_activity
-- -----------------------------------------------------------------------------

create or replace function private.reschedule_lead_activity_impl(
  p_activity_id uuid,
  p_due_at timestamptz,
  p_reminder_at timestamptz default null,
  p_clear_reminder boolean default false
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_lead_id uuid;
  v_prev_due timestamptz;
  v_prev_reminder timestamptz;
  v_new_reminder timestamptz;
  v_due_changed boolean;
  v_reminder_changed boolean;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select f.lead_id
  into v_lead_id
  from public.lead_follow_ups f
  where f.id = p_activity_id;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.leads where id = v_lead_id for update;

  select * into v_row from public.lead_follow_ups where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'ACTIVITY_NOT_OPEN' using errcode = '22023';
  end if;

  if p_due_at is null or p_due_at <= v_now then
    raise exception 'ACTIVITY_DUE_MUST_BE_FUTURE' using errcode = '22023';
  end if;

  -- Capture OLD values BEFORE any UPDATE so event previous_values are correct.
  v_prev_due := v_row.due_at;
  v_prev_reminder := v_row.reminder_at;

  if coalesce(p_clear_reminder, false) then
    v_new_reminder := null;
  elsif p_reminder_at is not null then
    if p_reminder_at > p_due_at then
      raise exception 'ACTIVITY_REMINDER_INVALID' using errcode = '22023';
    end if;
    v_new_reminder := p_reminder_at;
  else
    v_new_reminder := v_prev_reminder;
    if v_new_reminder is not null and v_new_reminder > p_due_at then
      v_new_reminder := null;
    end if;
  end if;

  v_due_changed := v_prev_due is distinct from p_due_at;
  v_reminder_changed := v_prev_reminder is distinct from v_new_reminder;

  if not v_due_changed and not v_reminder_changed then
    return v_row;
  end if;

  update public.lead_follow_ups
  set due_at = p_due_at,
      reminder_at = v_new_reminder,
      updated_at = v_now
  where id = p_activity_id
  returning * into v_row;

  if v_due_changed then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, v_row.lead_id, v_actor, 'rescheduled',
      jsonb_build_object('dueAt', v_prev_due),
      jsonb_build_object('dueAt', p_due_at),
      null, null
    );
  end if;

  if v_reminder_changed then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, v_row.lead_id, v_actor, 'reminder_changed',
      jsonb_strip_nulls(jsonb_build_object('reminderAt', v_prev_reminder)),
      jsonb_strip_nulls(jsonb_build_object('reminderAt', v_new_reminder)),
      case when coalesce(p_clear_reminder, false) then 'cleared' else null end, null
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.reschedule_lead_activity(
  p_activity_id uuid,
  p_due_at timestamptz,
  p_reminder_at timestamptz default null,
  p_clear_reminder boolean default false
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.reschedule_lead_activity_impl(
    p_activity_id, p_due_at, p_reminder_at, p_clear_reminder
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- F. private.transfer_activity_ownership_impl / public wrapper
-- -----------------------------------------------------------------------------

create or replace function private.transfer_activity_ownership_impl(
  p_activity_id uuid,
  p_new_owner_id uuid
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_lead_id uuid;
  v_prev_owner uuid;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_new_owner_id is null then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '22023';
  end if;

  select lead_id into v_lead_id
  from public.lead_follow_ups
  where id = p_activity_id;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.leads where id = v_lead_id for update;

  select * into v_row from public.lead_follow_ups where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'ACTIVITY_NOT_OPEN' using errcode = '22023';
  end if;

  if v_row.is_primary_next_action then
    raise exception 'PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT' using errcode = '22023';
  end if;

  -- Same-owner: stable no-op.
  if v_row.owner_id is not distinct from p_new_owner_id then
    return v_row;
  end if;

  -- Cross-owner transfer requires broad lead read (delegation authority).
  if not (select private.crm_has_broad_lead_read()) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if not (select private.crm_user_can_operate_lead(p_new_owner_id, v_row.lead_id, 'crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if not (select private.crm_is_eligible_follow_up_owner(p_new_owner_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  v_prev_owner := v_row.owner_id;

  update public.lead_follow_ups
  set owner_id = p_new_owner_id,
      updated_at = v_now
  where id = p_activity_id
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'ownership_transferred',
    jsonb_build_object('ownerId', v_prev_owner),
    jsonb_build_object('ownerId', p_new_owner_id),
    null, null
  );

  return v_row;
end;
$$;

create or replace function public.transfer_activity_ownership(
  p_activity_id uuid,
  p_new_owner_id uuid
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.transfer_activity_ownership_impl(p_activity_id, p_new_owner_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- G. private.designate_primary_next_action_impl / public wrapper
-- -----------------------------------------------------------------------------

create or replace function private.designate_primary_next_action_impl(
  p_activity_id uuid
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_lead public.leads%rowtype;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select l.*
  into v_lead
  from public.lead_follow_ups f
  join public.leads l on l.id = f.lead_id
  where f.id = p_activity_id
  for update of l;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_row from public.lead_follow_ups where id = p_activity_id for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'ACTIVITY_NOT_OPEN' using errcode = '22023';
  end if;

  if v_lead.status in ('closed_won', 'closed_lost') then
    raise exception 'ACTIVITY_TERMINAL_REJECTED' using errcode = '22023';
  end if;

  if v_lead.status = 'on_hold' and coalesce(v_row.source, 'manual') <> 'on_hold_review' then
    raise exception 'ON_HOLD_PRIMARY_RESERVED' using errcode = '22023';
  end if;

  if v_row.is_primary_next_action then
    return v_row;
  end if;

  perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'primary_replaced', v_row.id);

  update public.lead_follow_ups
  set is_primary_next_action = true,
      updated_at = v_now
  where id = p_activity_id
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'primary_designated',
    jsonb_build_object('isPrimaryNextAction', false),
    jsonb_build_object('isPrimaryNextAction', true),
    null, null
  );

  return v_row;
end;
$$;

create or replace function public.designate_primary_next_action(
  p_activity_id uuid
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.designate_primary_next_action_impl(p_activity_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- H. private.complete_lead_activity_impl / public wrapper
--    Atomic complete with optional NEXT_PRIMARY / ON_HOLD / CLOSED_LOST / NONE.
-- -----------------------------------------------------------------------------

create or replace function private.complete_lead_activity_impl(
  p_activity_id uuid,
  p_outcome_code text,
  p_completion_note text default null,
  p_resolution text default null,
  p_next_activity_type text default null,
  p_next_title text default null,
  p_next_due_at timestamptz default null,
  p_next_priority text default null,
  p_next_duration_minutes integer default null,
  p_next_reminder_at timestamptz default null,
  p_next_quotation_id uuid default null,
  p_on_hold_reason text default null,
  p_on_hold_review_at timestamptz default null,
  p_closed_lost_reason text default null,
  p_closure_reason_code text default null,
  p_whatsapp_send_intent_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_lead public.leads%rowtype;
  v_now timestamptz;
  v_outcome public.lead_activity_outcome_codes%rowtype;
  v_display_outcome text;
  v_note text;
  v_resolution_raw text;
  v_resolution text;
  v_was_primary boolean;
  v_terminal_before boolean;
  v_other_open_primary_exists boolean;
  v_attempt_at timestamptz;
  v_clock_started_at timestamptz;
  v_next_priority text;
  v_next_owner uuid;
  v_next_title text;
  v_next_row public.lead_follow_ups%rowtype;
  v_next_type text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_note := nullif(trim(coalesce(p_completion_note, '')), '');
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'ACTIVITY_OUTCOME_INVALID' using errcode = '22023';
  end if;

  if p_outcome_code is null or length(trim(p_outcome_code)) = 0 then
    raise exception 'ACTIVITY_OUTCOME_REQUIRED' using errcode = '22023';
  end if;

  -- Hard reject any explicit closed_won intent BEFORE any other resolution mapping.
  v_resolution_raw := nullif(trim(upper(coalesce(p_resolution, ''))), '');
  if v_resolution_raw = 'CLOSED_WON' then
    raise exception 'CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE' using errcode = 'P0001';
  end if;

  -- Lock lead first via join, then re-lock activity row explicitly.
  select l.*
  into v_lead
  from public.lead_follow_ups f
  join public.leads l on l.id = f.lead_id
  where f.id = p_activity_id
  for update of l;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_row
  from public.lead_follow_ups
  where id = p_activity_id
  for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'ACTIVITY_NOT_OPEN' using errcode = '22023';
  end if;

  -- Outcome catalogue validation.
  select * into v_outcome
  from public.lead_activity_outcome_codes
  where code = p_outcome_code;
  if not found or v_outcome.is_active is not true then
    raise exception 'ACTIVITY_OUTCOME_INVALID' using errcode = '22023';
  end if;

  if v_outcome.activity_types is not null
     and cardinality(v_outcome.activity_types) > 0
     and not (v_row.activity_type = any(v_outcome.activity_types)) then
    raise exception 'ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE' using errcode = '22023';
  end if;

  v_display_outcome := coalesce(v_outcome.display_name, p_outcome_code);
  v_was_primary := coalesce(v_row.is_primary_next_action, false);
  v_terminal_before := v_lead.status in ('closed_won', 'closed_lost');

  v_resolution := coalesce(v_resolution_raw, 'NONE');

  if v_resolution not in ('NEXT_PRIMARY', 'ON_HOLD', 'CLOSED_LOST', 'NONE') then
    -- CLOSED_WON was already trapped above; anything else is a bad resolution.
    raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
  end if;

  -- Terminal leads: only NONE allowed. No status transition, no next primary.
  if v_terminal_before then
    if v_resolution <> 'NONE' then
      if v_resolution = 'CLOSED_LOST' and v_lead.status = 'closed_lost' then
        v_resolution := 'NONE';
      else
        raise exception 'ACTIVITY_TERMINAL_REJECTED' using errcode = '22023';
      end if;
    end if;
  end if;

  -- Resolution requirement rules for non-terminal leads.
  if not v_terminal_before then
    if v_was_primary then
      if v_resolution = 'NONE' then
        raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
      end if;
    else
      -- Secondary complete: NONE only if another open primary still exists
      -- OR lead is already terminal (handled above).
      if v_resolution = 'NONE' then
        select exists (
          select 1
          from public.lead_follow_ups
          where lead_id = v_row.lead_id
            and is_primary_next_action = true
            and status = 'open'
            and id <> v_row.id
        ) into v_other_open_primary_exists;

        if not v_other_open_primary_exists then
          raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
        end if;
      end if;
    end if;
  end if;

  -- WhatsApp evidence: ensure clock, read clock_started_at, pass as receipt bound.
  if p_outcome_code = 'whatsapp_sent' then
    if v_row.activity_type <> 'whatsapp' then
      raise exception 'ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE' using errcode = '22023';
    end if;
    if p_whatsapp_send_intent_id is null then
      raise exception 'WHATSAPP_SEND_EVIDENCE_REQUIRED' using errcode = 'P0001';
    end if;

    perform private.ensure_first_contact_sla_clock(v_row.lead_id);

    select clock_started_at
    into v_clock_started_at
    from public.crm_sla_clocks
    where lead_id = v_row.lead_id;

    v_attempt_at := private.validate_crm_whatsapp_send_evidence(
      p_whatsapp_send_intent_id, v_row.lead_id, v_clock_started_at
    );
  end if;

  -- Complete the activity row (clear primary flag if it was primary).
  update public.lead_follow_ups
  set status = 'completed',
      outcome = v_display_outcome,
      outcome_code = p_outcome_code,
      completion_note = v_note,
      completed_by = v_actor,
      completed_at = v_now,
      is_primary_next_action = false,
      updated_at = v_now
  where id = p_activity_id
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'completed',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'completed', 'completedAt', v_now),
    null, null
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'outcome_recorded',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'outcomeCode', p_outcome_code,
      'outcomeDisplay', v_display_outcome,
      'note', v_note
    )),
    null, null
  );

  if v_was_primary then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, v_row.lead_id, v_actor, 'primary_cleared',
      jsonb_build_object('isPrimaryNextAction', true),
      jsonb_build_object('isPrimaryNextAction', false),
      'completed', null
    );
  end if;

  -- First-contact attempt marking (Call outcome uses v_now; WhatsApp uses provider_timestamp).
  if v_row.activity_type = 'call'
     and v_outcome.closes_contact_attempt is true then
    perform private.mark_first_contact_attempt_if_qualifying(
      v_row.lead_id, v_now, 'call_outcome', p_outcome_code, 'call', null
    );
  elsif v_row.activity_type = 'whatsapp'
        and p_outcome_code = 'whatsapp_sent'
        and v_attempt_at is not null then
    perform private.mark_first_contact_attempt_if_qualifying(
      v_row.lead_id, v_attempt_at, 'whatsapp_governed_send', p_outcome_code, 'whatsapp',
      p_whatsapp_send_intent_id
    );
  end if;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.completed',
    v_row.id,
    v_actor,
    'Follow-up completed',
    jsonb_strip_nulls(jsonb_build_object(
      'outcomeCode', p_outcome_code,
      'outcomeDisplay', v_display_outcome,
      'note', v_note,
      'wasPrimary', v_was_primary,
      'resolution', v_resolution
    ))
  );

  if v_terminal_before or v_resolution = 'NONE' then
    return v_row;
  end if;

  -- NEXT_PRIMARY: create next primary owned by lead.assigned_to via completion_chain.
  if v_resolution = 'NEXT_PRIMARY' then
    if v_lead.assigned_to is null then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    v_next_type := coalesce(p_next_activity_type, 'call');
    if v_next_type not in (
      'call', 'whatsapp', 'consultation', 'site_visit',
      'quotation_follow_up', 'internal_task'
    ) then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    v_next_title := nullif(trim(coalesce(p_next_title, '')), '');
    if v_next_title is null or length(v_next_title) < 1 or length(v_next_title) > 200 then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_due_at is null or p_next_due_at <= v_now then
      raise exception 'ACTIVITY_DUE_MUST_BE_FUTURE' using errcode = '22023';
    end if;

    v_next_priority := coalesce(p_next_priority, 'normal');
    if v_next_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_reminder_at is not null and p_next_reminder_at > p_next_due_at then
      raise exception 'ACTIVITY_REMINDER_INVALID' using errcode = '22023';
    end if;

    if p_next_duration_minutes is not null and p_next_duration_minutes <= 0 then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_quotation_id is not null and not exists (
      select 1 from public.quotations q
      where q.id = p_next_quotation_id and q.lead_id = v_row.lead_id
    ) then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    v_next_owner := v_lead.assigned_to;
    if not (select private.crm_is_eligible_follow_up_owner(v_next_owner)) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'completion_chain', v_row.id);

    insert into public.lead_follow_ups (
      lead_id, owner_id, due_at, status, created_by,
      activity_type, title, priority, is_primary_next_action,
      duration_minutes, reminder_at, quotation_id, source, updated_at
    ) values (
      v_row.lead_id, v_next_owner, p_next_due_at, 'open', v_actor,
      v_next_type, v_next_title, v_next_priority, true,
      p_next_duration_minutes, p_next_reminder_at, p_next_quotation_id, 'completion_chain', v_now
    )
    returning * into v_next_row;

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'created',
      '{}'::jsonb,
      jsonb_strip_nulls(jsonb_build_object(
        'activityType', v_next_type,
        'title', v_next_title,
        'dueAt', p_next_due_at,
        'priority', v_next_priority,
        'ownerId', v_next_owner,
        'isPrimaryNextAction', true,
        'source', 'completion_chain',
        'chainedFromId', v_row.id
      )),
      'completion_chain', null
    );

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true),
      'completion_chain', null
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_row.lead_id,
      'follow_up.scheduled',
      v_next_row.id,
      v_actor,
      'Follow-up scheduled',
      jsonb_strip_nulls(jsonb_build_object(
        'dueAt', p_next_due_at,
        'ownerId', v_next_owner,
        'activityType', v_next_type,
        'title', v_next_title,
        'priority', v_next_priority,
        'isPrimaryNextAction', true,
        'source', 'completion_chain',
        'chainedFromId', v_row.id
      ))
    );

    return v_row;
  end if;

  -- ON_HOLD: create on_hold_review primary + transition lead via existing impl.
  if v_resolution = 'ON_HOLD' then
    if p_on_hold_reason is null or length(trim(p_on_hold_reason)) = 0 then
      raise exception 'ON_HOLD_REVIEW_REQUIRED' using errcode = '22023';
    end if;

    if p_on_hold_review_at is null or p_on_hold_review_at <= v_now then
      raise exception 'ON_HOLD_REVIEW_REQUIRED' using errcode = '22023';
    end if;

    if v_lead.assigned_to is null then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    v_next_owner := v_lead.assigned_to;

    perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'on_hold_review', v_row.id);

    insert into public.lead_follow_ups (
      lead_id, owner_id, due_at, status, created_by,
      activity_type, title, priority, is_primary_next_action,
      duration_minutes, reminder_at, quotation_id, source, updated_at
    ) values (
      v_row.lead_id, v_next_owner, p_on_hold_review_at, 'open', v_actor,
      'internal_task', 'On-hold review', 'normal', true,
      null, null, null, 'on_hold_review', v_now
    )
    returning * into v_next_row;

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'created',
      '{}'::jsonb,
      jsonb_build_object(
        'activityType', 'internal_task',
        'title', 'On-hold review',
        'dueAt', p_on_hold_review_at,
        'priority', 'normal',
        'ownerId', v_next_owner,
        'isPrimaryNextAction', true,
        'source', 'on_hold_review',
        'chainedFromId', v_row.id
      ),
      'on_hold_review', null
    );

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true),
      'on_hold_review', null
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_row.lead_id,
      'follow_up.scheduled',
      v_next_row.id,
      v_actor,
      'Follow-up scheduled',
      jsonb_build_object(
        'dueAt', p_on_hold_review_at,
        'ownerId', v_next_owner,
        'activityType', 'internal_task',
        'title', 'On-hold review',
        'priority', 'normal',
        'isPrimaryNextAction', true,
        'source', 'on_hold_review',
        'chainedFromId', v_row.id
      )
    );

    perform private.transition_lead_status_impl(
      v_row.lead_id, 'on_hold', p_on_hold_reason, null
    );

    return v_row;
  end if;

  -- CLOSED_LOST: clear all open primaries + transition lead via existing impl.
  if v_resolution = 'CLOSED_LOST' then
    if p_closed_lost_reason is null or length(trim(p_closed_lost_reason)) = 0 then
      raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
    end if;

    perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'closed_lost', null);

    perform private.transition_lead_status_impl(
      v_row.lead_id, 'closed_lost', p_closed_lost_reason, p_closure_reason_code
    );

    return v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.complete_lead_activity(
  p_activity_id uuid,
  p_outcome_code text,
  p_completion_note text default null,
  p_resolution text default null,
  p_next_activity_type text default null,
  p_next_title text default null,
  p_next_due_at timestamptz default null,
  p_next_priority text default null,
  p_next_duration_minutes integer default null,
  p_next_reminder_at timestamptz default null,
  p_next_quotation_id uuid default null,
  p_on_hold_reason text default null,
  p_on_hold_review_at timestamptz default null,
  p_closed_lost_reason text default null,
  p_closure_reason_code text default null,
  p_whatsapp_send_intent_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.complete_lead_activity_impl(
    p_activity_id, p_outcome_code, p_completion_note, p_resolution,
    p_next_activity_type, p_next_title, p_next_due_at, p_next_priority,
    p_next_duration_minutes, p_next_reminder_at, p_next_quotation_id,
    p_on_hold_reason, p_on_hold_review_at, p_closed_lost_reason,
    p_closure_reason_code, p_whatsapp_send_intent_id
  );
end;
$$;

-- =============================================================================
-- I. Ownership, revokes, grants
-- =============================================================================

alter function private.clear_open_primary_for_lead(uuid, uuid, text, uuid) owner to postgres;
alter function private.validate_crm_whatsapp_send_evidence(uuid, uuid, timestamptz) owner to postgres;
alter function private.mark_first_contact_attempt_if_qualifying(uuid, timestamptz, text, text, text, uuid) owner to postgres;
alter function private.create_lead_activity_impl(uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid) owner to postgres;
alter function private.reschedule_lead_activity_impl(uuid, timestamptz, timestamptz, boolean) owner to postgres;
alter function private.transfer_activity_ownership_impl(uuid, uuid) owner to postgres;
alter function private.designate_primary_next_action_impl(uuid) owner to postgres;
alter function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) owner to postgres;

alter function public.create_lead_activity(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) owner to postgres;
alter function public.reschedule_lead_activity(uuid, timestamptz, timestamptz, boolean) owner to postgres;
alter function public.transfer_activity_ownership(uuid, uuid) owner to postgres;
alter function public.designate_primary_next_action(uuid) owner to postgres;
alter function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) owner to postgres;

-- Private impls: revoke public/anon; grant authenticated (INVOKER wrappers call these).
revoke all on function private.create_lead_activity_impl(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) from public, anon;
revoke all on function private.reschedule_lead_activity_impl(uuid, timestamptz, timestamptz, boolean) from public, anon;
revoke all on function private.transfer_activity_ownership_impl(uuid, uuid) from public, anon;
revoke all on function private.designate_primary_next_action_impl(uuid) from public, anon;
revoke all on function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) from public, anon;

grant execute on function private.create_lead_activity_impl(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) to authenticated;
grant execute on function private.reschedule_lead_activity_impl(uuid, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function private.transfer_activity_ownership_impl(uuid, uuid) to authenticated;
grant execute on function private.designate_primary_next_action_impl(uuid) to authenticated;
grant execute on function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) to authenticated;

-- Internal helpers (validate/mark/clear): callable only from DEFINER impls under
-- the same postgres owner. No authenticated execute — DEFINER owner privilege suffices.
revoke all on function private.clear_open_primary_for_lead(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.validate_crm_whatsapp_send_evidence(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.mark_first_contact_attempt_if_qualifying(uuid, timestamptz, text, text, text, uuid) from public, anon, authenticated;

-- Public wrappers: authenticated only.
revoke all on function public.create_lead_activity(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) from public, anon;
revoke all on function public.reschedule_lead_activity(uuid, timestamptz, timestamptz, boolean) from public, anon;
revoke all on function public.transfer_activity_ownership(uuid, uuid) from public, anon;
revoke all on function public.designate_primary_next_action(uuid) from public, anon;
revoke all on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) from public, anon;

grant execute on function public.create_lead_activity(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) to authenticated;
grant execute on function public.reschedule_lead_activity(uuid, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.transfer_activity_ownership(uuid, uuid) to authenticated;
grant execute on function public.designate_primary_next_action(uuid) to authenticated;
grant execute on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) to authenticated;

-- =============================================================================
-- J. Comments
-- =============================================================================

comment on function public.create_lead_activity(
  uuid, text, text, timestamptz, text, uuid, boolean, integer, timestamptz, uuid
) is
  'CRM 2A-3: create structured activity (source=manual). Demotes existing open primary when p_is_primary. Terminal / on_hold leads reject primary create.';

comment on function public.reschedule_lead_activity(uuid, timestamptz, timestamptz, boolean) is
  'CRM 2A-3: reschedule open activity due_at (+ optional reminder). Rejects past/equal due after lock; captures OLD values for event previous_values. No-op when unchanged.';

comment on function public.transfer_activity_ownership(uuid, uuid) is
  'CRM 2A-3: transfer secondary open activity to a new eligible owner. Primary transfer requires lead reassignment.';

comment on function public.designate_primary_next_action(uuid) is
  'CRM 2A-3: designate an open activity as the lead primary. Rejects terminal leads; on_hold requires on_hold_review source.';

comment on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) is
  'CRM 2A-3: complete activity with structured outcome and optional resolution (NEXT_PRIMARY | ON_HOLD | CLOSED_LOST | NONE). CLOSED_WON is hard-rejected; Closed Won remains quotation-acceptance exclusive.';

comment on function private.mark_first_contact_attempt_if_qualifying(
  uuid, timestamptz, text, text, text, uuid
) is
  'CRM 2A-3: mark first_contact_attempt_at once per lead when Call or governed WhatsApp qualifies. Never touches sla_due_at or breached_at; never activates policy.';

comment on function private.validate_crm_whatsapp_send_evidence(uuid, uuid, timestamptz) is
  'CRM 2A-3: validate governed WhatsApp send-evidence chain (intent dispatch_bound + conversation lead match + outbound message + succeeded provider dispatch). Returns provider_timestamp on success; rejects when provider_timestamp < p_receipt_at (SLA clock_started_at).';

-- =============================================================================
-- K. Postconditions — inactive first_contact policy and untouched business hours
-- =============================================================================

do $$
declare
  v_active boolean;
  v_hours_enabled boolean;
  v_config jsonb;
  v_activated_at timestamptz;
  v_effective_from timestamptz;
begin
  select is_active, business_hours_enabled, business_hours_config,
         activated_at, effective_from
  into v_active, v_hours_enabled, v_config, v_activated_at, v_effective_from
  from public.crm_sla_policies
  where policy_code = 'first_contact';

  if not found then
    raise exception 'CRM 2A-3 postcondition: first_contact policy missing' using errcode = 'P0001';
  end if;

  if v_active is true then
    raise exception 'CRM 2A-3 postcondition: first_contact policy must remain inactive' using errcode = 'P0001';
  end if;

  if v_hours_enabled is true then
    raise exception 'CRM 2A-3 postcondition: business_hours_enabled must remain false' using errcode = 'P0001';
  end if;

  if v_config is not null then
    raise exception 'CRM 2A-3 postcondition: business_hours_config must remain NULL' using errcode = 'P0001';
  end if;

  if v_activated_at is not null then
    raise exception 'CRM 2A-3 postcondition: activated_at must remain NULL' using errcode = 'P0001';
  end if;

  if v_effective_from is not null then
    raise exception 'CRM 2A-3 postcondition: effective_from must remain NULL' using errcode = 'P0001';
  end if;
end;
$$;
