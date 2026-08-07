-- =============================================================================
-- ONEDECORE Phase 6B-B4 — Provider Dispatch Foundation (M21)
-- Repository only. No managed apply. No live Meta calls in CI. No production deploy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Provider dispatch attempts (durable attempt identity + reconciliation)
-- -----------------------------------------------------------------------------

create table public.whatsapp_provider_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  send_intent_id uuid not null references public.whatsapp_send_intents (id) on delete restrict,
  attempt_number integer not null,
  provider_code text not null,
  provider_attempt_key text not null,
  status text not null default 'requested',
  error_class text,
  provider_message_id text,
  http_status integer,
  request_snapshot jsonb not null default '{}'::jsonb,
  response_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint chk_whatsapp_provider_dispatch_attempts_provider check (
    provider_code in ('fake', 'meta')
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_status check (
    status in ('requested', 'succeeded', 'failed', 'ambiguous')
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_error_class check (
    error_class is null
    or error_class in ('transient', 'terminal', 'ambiguous')
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_attempt_number check (
    attempt_number between 1 and 20
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_provider_attempt_key check (
    length(provider_attempt_key) between 1 and 128
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_provider_message_id check (
    provider_message_id is null or length(provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_request_snapshot check (
    pg_column_size(request_snapshot) <= 4096
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_response_snapshot check (
    pg_column_size(response_snapshot) <= 4096
  ),
  constraint chk_whatsapp_provider_dispatch_attempts_binding check (
    (status = 'succeeded' and provider_message_id is not null)
    or (status <> 'succeeded')
  )
);

create unique index uq_whatsapp_provider_dispatch_attempts_intent_attempt
  on public.whatsapp_provider_dispatch_attempts (send_intent_id, attempt_number);

create unique index uq_whatsapp_provider_dispatch_attempts_provider_key
  on public.whatsapp_provider_dispatch_attempts (provider_code, provider_attempt_key);

create index idx_whatsapp_provider_dispatch_attempts_intent_created
  on public.whatsapp_provider_dispatch_attempts (send_intent_id, created_at desc);

comment on table public.whatsapp_provider_dispatch_attempts is
  'Durable provider dispatch attempts for WHATSAPP_SERVICE send intents. No cross-transaction remote calls.';

-- -----------------------------------------------------------------------------
-- B. Send-intent lifecycle extensions
-- -----------------------------------------------------------------------------

alter table public.whatsapp_send_intents
  drop constraint chk_whatsapp_send_intents_no_placeholder_outbound;

alter table public.whatsapp_send_intents
  drop constraint chk_whatsapp_send_intents_lifecycle_status;

alter table public.whatsapp_send_intents
  add constraint chk_whatsapp_send_intents_lifecycle_status check (
    lifecycle_status in (
      'eligible',
      'ineligible',
      'cancelled',
      'dispatch_pending',
      'dispatch_bound'
    )
  );

alter table public.whatsapp_send_intents
  add constraint chk_whatsapp_send_intents_dispatch_binding check (
    (
      lifecycle_status = 'dispatch_bound'
      and outbound_message_id is not null
    )
    or (
      lifecycle_status <> 'dispatch_bound'
      and outbound_message_id is null
    )
  );

alter table public.whatsapp_send_intent_events
  drop constraint chk_whatsapp_send_intent_events_type;

alter table public.whatsapp_send_intent_events
  add constraint chk_whatsapp_send_intent_events_type check (
    event_type in (
      'created',
      'eligibility_recorded',
      'idempotency_reused',
      'cancelled',
      'dispatch_claimed',
      'dispatch_requested',
      'dispatch_succeeded',
      'dispatch_failed',
      'dispatch_ambiguous',
      'dispatch_bound',
      'dispatch_reconciled'
    )
  );

-- -----------------------------------------------------------------------------
-- C. Dispatch-time guards — assignment, consent/DNC, service window
-- -----------------------------------------------------------------------------

create or replace function private.whatsapp_inbox_actor_can_use_conversation(
  p_actor_id uuid,
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_conversations c
    left join public.leads l on l.id = c.lead_id
    where c.id = p_conversation_id
      and p_actor_id is not null
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_actor_id
          and p.code = 'whatsapp.inbox.use'
          and r.is_system = true
          and p.is_active = true
      )
      and (
        (
          c.lead_id is null
          and exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = p_actor_id
              and p.code = 'whatsapp.inbox.manage'
              and r.code in ('super_admin', 'sales_manager', 'management')
          )
        )
        or (
          c.lead_id is not null
          and l.assigned_to is not null
          and l.assigned_to = p_actor_id
        )
        or (
          c.lead_id is not null
          and exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = p_actor_id
              and p.code = 'whatsapp.inbox.manage'
              and r.code in ('super_admin', 'sales_manager', 'management')
          )
        )
      )
  );
$$;

create or replace function private.whatsapp_evaluate_service_window_at_dispatch(
  p_conversation_id uuid
)
returns table (
  dispatch_mode text,
  window_open boolean,
  reason_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_last_inbound timestamptz;
begin
  select c.last_inbound_at
    into v_last_inbound
  from public.whatsapp_conversations c
  where c.id = p_conversation_id;

  if not found then
    return query
      select null::text, false, 'denied_invalid_conversation'::text;
    return;
  end if;

  if v_last_inbound is null then
    return query
      select 'template_required'::text, false, 'denied_service_window_closed'::text;
    return;
  end if;

  if v_last_inbound < (now() - interval '24 hours') then
    return query
      select 'template_required'::text, false, 'denied_service_window_closed'::text;
    return;
  end if;

  return query
    select 'service_window_text'::text, true, 'eligible_service_window'::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- D. Claim / bind RPCs — service_role only; no remote call inside transaction
-- -----------------------------------------------------------------------------

create or replace function public.claim_whatsapp_send_intent_for_dispatch(
  p_send_intent_id uuid,
  p_provider_code text,
  p_provider_attempt_key text
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  dispatch_attempt_id uuid,
  conversation_id uuid,
  requested_by uuid,
  body_text text,
  phone_number_id text,
  customer_e164 text,
  sender_e164 text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_intent public.whatsapp_send_intents%rowtype;
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_attempt_number integer;
  v_eligibility_code text;
  v_eligibility_snapshot jsonb;
  v_dispatch_mode text;
  v_window_open boolean;
  v_window_reason text;
  v_phone_number_id text;
  v_sender_e164 text;
begin
  if p_provider_code not in ('fake', 'meta') then
    raise exception 'validation: provider_code' using errcode = '22023';
  end if;

  if p_provider_attempt_key is null
    or length(p_provider_attempt_key) < 1
    or length(p_provider_attempt_key) > 128 then
    raise exception 'validation: provider_attempt_key' using errcode = '22023';
  end if;

  select * into v_intent
  from public.whatsapp_send_intents
  where id = p_send_intent_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::text;
    return;
  end if;

  if v_intent.lifecycle_status = 'dispatch_bound' then
    return query select 'already_bound'::text, v_intent.id, null::uuid, v_intent.conversation_id, v_intent.requested_by, v_intent.body_text, null::text, null::text, null::text;
    return;
  end if;

  if v_intent.lifecycle_status not in ('eligible', 'dispatch_pending') then
    raise exception 'dispatch_not_claimable: %', v_intent.lifecycle_status using errcode = '22023';
  end if;

  if not private.whatsapp_inbox_actor_can_use_conversation(
    v_intent.requested_by,
    v_intent.conversation_id
  ) then
    raise exception 'denied_conversation_scope' using errcode = '42501';
  end if;

  select eligibility_code, eligibility_snapshot, dispatch_mode
    into v_eligibility_code, v_eligibility_snapshot, v_dispatch_mode
  from private.whatsapp_evaluate_service_send_eligibility(v_intent.conversation_id);

  if v_eligibility_code <> 'eligible' then
    raise exception '%', v_eligibility_code using errcode = '22023';
  end if;

  select dispatch_mode, window_open, reason_code
    into v_dispatch_mode, v_window_open, v_window_reason
  from private.whatsapp_evaluate_service_window_at_dispatch(v_intent.conversation_id);

  if not v_window_open then
    raise exception '%', v_window_reason using errcode = '22023';
  end if;

  if v_intent.dispatch_mode = 'template_required' then
    raise exception 'denied_template_required' using errcode = '22023';
  end if;

  select coalesce(max(attempt_number), 0) + 1
    into v_attempt_number
  from public.whatsapp_provider_dispatch_attempts
  where send_intent_id = v_intent.id;

  begin
    insert into public.whatsapp_provider_dispatch_attempts (
      send_intent_id,
      attempt_number,
      provider_code,
      provider_attempt_key,
      status,
      request_snapshot
    )
    values (
      v_intent.id,
      v_attempt_number,
      p_provider_code,
      p_provider_attempt_key,
      'requested',
      jsonb_build_object(
        'conversation_id', v_intent.conversation_id,
        'purpose_code', v_intent.purpose_code
      )
    )
    returning * into v_attempt;
  exception
    when unique_violation then
      select * into v_attempt
      from public.whatsapp_provider_dispatch_attempts
      where provider_code = p_provider_code
        and provider_attempt_key = p_provider_attempt_key;

      return query
        select
          'attempt_idempotent_reuse'::text,
          v_intent.id,
          v_attempt.id,
          v_intent.conversation_id,
          v_intent.requested_by,
          v_intent.body_text,
          null::text,
          null::text,
          null::text;
      return;
  end;

  update public.whatsapp_send_intents
  set lifecycle_status = 'dispatch_pending'
  where id = v_intent.id;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'dispatch_claimed',
      v_intent.requested_by,
      jsonb_build_object('dispatch_attempt_id', v_attempt.id)
    ),
    (
      v_intent.id,
      'dispatch_requested',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'provider_code', p_provider_code,
        'provider_attempt_key', p_provider_attempt_key
      )
    );

  select pn.phone_number_id, coalesce(pn.display_phone_number, pn.phone_number_id)
    into v_phone_number_id, v_sender_e164
  from public.whatsapp_conversations c
  join public.whatsapp_phone_numbers pn on pn.id = c.phone_number_id
  where c.id = v_intent.conversation_id;

  return query
    select
      'claimed'::text,
      v_intent.id,
      v_attempt.id,
      v_intent.conversation_id,
      v_intent.requested_by,
      v_intent.body_text,
      v_phone_number_id,
      (select customer_e164 from public.whatsapp_conversations where id = v_intent.conversation_id),
      v_sender_e164;
end;
$$;

create or replace function public.bind_whatsapp_send_intent_dispatch(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text,
  p_provider_timestamp timestamptz default now()
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  outbound_message_id uuid,
  provider_message_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_intent public.whatsapp_send_intents%rowtype;
  v_message_id uuid;
  v_conv public.whatsapp_conversations%rowtype;
  v_sender_e164 text;
begin
  if p_provider_message_id is null
    or length(p_provider_message_id) < 1
    or length(p_provider_message_id) > 128 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.whatsapp_provider_dispatch_attempts
  where id = p_dispatch_attempt_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if v_attempt.status = 'succeeded' then
    select * into v_intent
    from public.whatsapp_send_intents
    where id = v_attempt.send_intent_id;

    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        v_attempt.provider_message_id;
    return;
  end if;

  if v_attempt.status not in ('requested', 'ambiguous') then
    raise exception 'dispatch_attempt_not_bindable: %', v_attempt.status using errcode = '22023';
  end if;

  select * into v_intent
  from public.whatsapp_send_intents
  where id = v_attempt.send_intent_id
  for update;

  if v_intent.lifecycle_status = 'dispatch_bound' then
    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        p_provider_message_id;
    return;
  end if;

  if exists (
    select 1
    from public.whatsapp_messages m
    where m.provider_message_id = p_provider_message_id
  ) then
    raise exception 'provider_message_id_conflict' using errcode = '23505';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = v_intent.conversation_id;

  select coalesce(pn.display_phone_number, pn.phone_number_id)
    into v_sender_e164
  from public.whatsapp_phone_numbers pn
  where pn.id = v_conv.phone_number_id;

  insert into public.whatsapp_messages (
    conversation_id,
    provider_message_id,
    direction,
    provider_message_type,
    normalized_message_type,
    sender_e164,
    recipient_e164,
    body_text,
    content,
    provider_timestamp,
    latest_status
  )
  values (
    v_intent.conversation_id,
    p_provider_message_id,
    'outbound',
    'text',
    'text',
    v_sender_e164,
    v_conv.customer_e164,
    v_intent.body_text,
    '{}'::jsonb,
    coalesce(p_provider_timestamp, now()),
    null
  )
  returning id into v_message_id;

  update public.whatsapp_provider_dispatch_attempts
  set
    status = 'succeeded',
    provider_message_id = p_provider_message_id,
    completed_at = now(),
    response_snapshot = coalesce(response_snapshot, '{}'::jsonb)
      || jsonb_build_object('provider_message_id', p_provider_message_id)
  where id = v_attempt.id;

  update public.whatsapp_send_intents
  set
    lifecycle_status = 'dispatch_bound',
    outbound_message_id = v_message_id
  where id = v_intent.id;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'dispatch_succeeded',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'provider_message_id', p_provider_message_id
      )
    ),
    (
      v_intent.id,
      'dispatch_bound',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'outbound_message_id', v_message_id,
        'provider_message_id', p_provider_message_id
      )
    );

  update public.whatsapp_conversations
  set
    last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), coalesce(p_provider_timestamp, now())),
    updated_at = now()
  where id = v_intent.conversation_id;

  return query
    select
      'bound'::text,
      v_intent.id,
      v_message_id,
      p_provider_message_id;
end;
$$;

create or replace function public.record_whatsapp_dispatch_attempt_outcome(
  p_dispatch_attempt_id uuid,
  p_status text,
  p_error_class text default null,
  p_http_status integer default null,
  p_response_snapshot jsonb default '{}'::jsonb
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_intent public.whatsapp_send_intents%rowtype;
  v_event_type text;
begin
  if p_status not in ('failed', 'ambiguous') then
    raise exception 'validation: status' using errcode = '22023';
  end if;

  if p_error_class is not null
    and p_error_class not in ('transient', 'terminal', 'ambiguous') then
    raise exception 'validation: error_class' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.whatsapp_provider_dispatch_attempts
  where id = p_dispatch_attempt_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text;
    return;
  end if;

  if v_attempt.status <> 'requested' then
    return query
      select 'already_finalized'::text, v_attempt.send_intent_id, null::text;
    return;
  end if;

  select * into v_intent
  from public.whatsapp_send_intents
  where id = v_attempt.send_intent_id
  for update;

  v_event_type := case
    when p_status = 'ambiguous' then 'dispatch_ambiguous'
    else 'dispatch_failed'
  end;

  update public.whatsapp_provider_dispatch_attempts
  set
    status = p_status,
    error_class = p_error_class,
    http_status = p_http_status,
    completed_at = now(),
    response_snapshot = coalesce(p_response_snapshot, '{}'::jsonb)
  where id = v_attempt.id;

  update public.whatsapp_send_intents
  set lifecycle_status = case
    when p_status = 'ambiguous' then 'dispatch_pending'
    else 'eligible'
  end
  where id = v_intent.id;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values (
    v_intent.id,
    v_event_type,
    v_intent.requested_by,
    jsonb_build_object(
      'dispatch_attempt_id', v_attempt.id,
      'error_class', p_error_class,
      'http_status', p_http_status
    )
  );

  return query
    select 'recorded'::text, v_intent.id, v_intent.lifecycle_status;
end;
$$;

create or replace function public.reconcile_whatsapp_dispatch_attempt(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  outbound_message_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_outcome_code text;
  v_send_intent_id uuid;
  v_outbound_message_id uuid;
begin
  select * into v_attempt
  from public.whatsapp_provider_dispatch_attempts
  where id = p_dispatch_attempt_id;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_attempt.status <> 'ambiguous' then
    return query select 'not_reconcilable'::text, v_attempt.send_intent_id, null::uuid;
    return;
  end if;

  select b.outcome_code, b.send_intent_id, b.outbound_message_id
    into v_outcome_code, v_send_intent_id, v_outbound_message_id
  from public.bind_whatsapp_send_intent_dispatch(
    p_dispatch_attempt_id,
    p_provider_message_id,
    now()
  ) as b(outcome_code, send_intent_id, outbound_message_id, provider_message_id);

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  select
    v_send_intent_id,
    'dispatch_reconciled',
    si.requested_by,
    jsonb_build_object(
      'dispatch_attempt_id', p_dispatch_attempt_id,
      'provider_message_id', p_provider_message_id
    )
  from public.whatsapp_send_intents si
  where si.id = v_send_intent_id;

  return query select v_outcome_code, v_send_intent_id, v_outbound_message_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- E. Ownership, grants, RLS
-- -----------------------------------------------------------------------------

alter function private.whatsapp_inbox_actor_can_use_conversation(uuid, uuid) owner to postgres;
alter function private.whatsapp_evaluate_service_window_at_dispatch(uuid) owner to postgres;
alter function public.claim_whatsapp_send_intent_for_dispatch(uuid, text, text) owner to postgres;
alter function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) owner to postgres;
alter function public.record_whatsapp_dispatch_attempt_outcome(uuid, text, text, integer, jsonb) owner to postgres;
alter function public.reconcile_whatsapp_dispatch_attempt(uuid, text) owner to postgres;

revoke all on function private.whatsapp_inbox_actor_can_use_conversation(uuid, uuid) from public, anon, authenticated;
revoke all on function private.whatsapp_evaluate_service_window_at_dispatch(uuid) from public, anon, authenticated;

revoke all on function public.claim_whatsapp_send_intent_for_dispatch(uuid, text, text) from public, anon, authenticated;
revoke all on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_whatsapp_dispatch_attempt_outcome(uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_whatsapp_dispatch_attempt(uuid, text) from public, anon, authenticated;

grant execute on function public.claim_whatsapp_send_intent_for_dispatch(uuid, text, text) to service_role;
grant execute on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) to service_role;
grant execute on function public.record_whatsapp_dispatch_attempt_outcome(uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.reconcile_whatsapp_dispatch_attempt(uuid, text) to service_role;

alter table public.whatsapp_provider_dispatch_attempts enable row level security;

revoke all on table public.whatsapp_provider_dispatch_attempts from public, anon, authenticated;

grant select on table public.whatsapp_provider_dispatch_attempts to authenticated;
grant select on table public.whatsapp_provider_dispatch_attempts to service_role;

create policy whatsapp_provider_dispatch_attempts_select_scoped
  on public.whatsapp_provider_dispatch_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.whatsapp_send_intents si
      where si.id = send_intent_id
        and (select private.whatsapp_inbox_can_view_conversation(si.conversation_id))
    )
  );

comment on function public.claim_whatsapp_send_intent_for_dispatch(uuid, text, text) is
  'Claims a send intent for provider dispatch after assignment/consent/DNC/service-window recheck. Service role only.';

comment on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) is
  'Binds provider message evidence to a send intent. Creates outbound whatsapp_messages row. Service role only.';
