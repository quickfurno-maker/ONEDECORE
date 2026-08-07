-- =============================================================================
-- ONEDECORE Phase 6B-B1 — Shared Inbox Authorization & Send-Intent Foundation (M19)
-- Repository only. No managed apply. No Meta outbound. No shared inbox UI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. RBAC — whatsapp.inbox.read / .use / .manage
-- -----------------------------------------------------------------------------

insert into public.permissions (code, name, description, is_system, is_active) values
  (
    'whatsapp.inbox.read',
    'Read WhatsApp Inbox',
    'View WhatsApp conversations and messages within authorized scope',
    true,
    true
  ),
  (
    'whatsapp.inbox.use',
    'Use WhatsApp Inbox Actions',
    'Create controlled WHATSAPP_SERVICE send intents within authorized scope',
    true,
    true
  ),
  (
    'whatsapp.inbox.manage',
    'Manage WhatsApp Inbox Triage',
    'Manager/admin triage for unlinked or unknown conversations',
    true,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code in ('whatsapp.inbox.read', 'whatsapp.inbox.use', 'whatsapp.inbox.manage')
  and (
    (r.code = 'super_admin')
    or (r.code in ('sales_manager', 'management'))
    or (
      r.code in ('sales_executive', 'sales')
      and p.code in ('whatsapp.inbox.read', 'whatsapp.inbox.use')
    )
  )
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- B. Send-intent durable model (text-only, pre-dispatch)
-- -----------------------------------------------------------------------------

create table public.whatsapp_send_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  purpose_code text not null,
  idempotency_key text not null,
  request_hash text not null,
  body_text text not null,
  reply_to_message_id uuid references public.whatsapp_messages (id) on delete set null,
  dispatch_mode text not null default 'service_window_text',
  eligibility_code text not null,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'eligible',
  outbound_message_id uuid references public.whatsapp_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_send_intents_purpose check (purpose_code = 'WHATSAPP_SERVICE'),
  constraint chk_whatsapp_send_intents_idempotency_key check (
    length(idempotency_key) between 1 and 128
  ),
  constraint chk_whatsapp_send_intents_request_hash check (
    request_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_whatsapp_send_intents_body_text check (
    length(body_text) between 1 and 4096
  ),
  constraint chk_whatsapp_send_intents_dispatch_mode check (
    dispatch_mode in ('service_window_text', 'template_required')
  ),
  constraint chk_whatsapp_send_intents_lifecycle_status check (
    lifecycle_status in ('eligible', 'ineligible', 'cancelled', 'dispatch_bound')
  ),
  constraint chk_whatsapp_send_intents_eligibility_code check (
    length(eligibility_code) between 1 and 64
  ),
  constraint chk_whatsapp_send_intents_eligibility_snapshot check (
    pg_column_size(eligibility_snapshot) <= 4096
  ),
  constraint chk_whatsapp_send_intents_no_placeholder_outbound check (
    outbound_message_id is null
  )
);

create unique index uq_whatsapp_send_intents_actor_idempotency
  on public.whatsapp_send_intents (requested_by, idempotency_key);

create index idx_whatsapp_send_intents_conversation_created
  on public.whatsapp_send_intents (conversation_id, created_at desc);

comment on table public.whatsapp_send_intents is
  'Durable pre-dispatch WHATSAPP_SERVICE send intents. Phase 6B-B1 does not create provider messages.';

create table public.whatsapp_send_intent_events (
  id uuid primary key default gen_random_uuid(),
  send_intent_id uuid not null references public.whatsapp_send_intents (id) on delete restrict,
  event_type text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_send_intent_events_type check (
    event_type in ('created', 'eligibility_recorded', 'idempotency_reused', 'cancelled')
  ),
  constraint chk_whatsapp_send_intent_events_details check (
    pg_column_size(details) <= 2048
  )
);

create index idx_whatsapp_send_intent_events_intent_created
  on public.whatsapp_send_intent_events (send_intent_id, created_at asc);

comment on table public.whatsapp_send_intent_events is
  'Append-only send-intent lifecycle events. Pre-dispatch only in Phase 6B-B1.';

create trigger trg_whatsapp_send_intent_events_no_update
  before update on public.whatsapp_send_intent_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_send_intent_events_no_delete
  before delete on public.whatsapp_send_intent_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_send_intents_updated_at
  before update on public.whatsapp_send_intents
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- C. Access resolver — current lead assignment, unlinked triage fail-closed for SE
-- -----------------------------------------------------------------------------

create or replace function private.whatsapp_inbox_has_manage_scope()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.authorize('whatsapp.inbox.manage'))
    and (
      (select private.has_role('super_admin'))
      or (select private.has_role('sales_manager'))
      or (select private.has_role('management'))
    );
$$;

create or replace function private.whatsapp_inbox_can_view_conversation(p_conversation_id uuid)
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
      and (select public.authorize('whatsapp.inbox.read'))
      and (
        (
          c.lead_id is null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
        or (
          c.lead_id is not null
          and (
            (select private.whatsapp_inbox_has_manage_scope())
            or (
              l.assigned_to is not null
              and l.assigned_to = (select auth.uid())
            )
          )
        )
      )
  );
$$;

create or replace function private.whatsapp_inbox_can_use_conversation(p_conversation_id uuid)
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
      and (select public.authorize('whatsapp.inbox.use'))
      and (
        (
          c.lead_id is null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
        or (
          c.lead_id is not null
          and l.assigned_to is not null
          and l.assigned_to = (select auth.uid())
        )
        or (
          c.lead_id is not null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
      )
  );
$$;

create or replace function private.whatsapp_normalize_send_body(p_body_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_normalized text;
begin
  if p_body_text is null then
    raise exception 'validation: body_text required' using errcode = '22023';
  end if;

  v_normalized := trim(regexp_replace(p_body_text, '[[:space:]]+', ' ', 'g'));

  if length(v_normalized) < 1 or length(v_normalized) > 4096 then
    raise exception 'validation: body_text length' using errcode = '22023';
  end if;

  return v_normalized;
end;
$$;

create or replace function private.whatsapp_compute_send_request_hash(
  p_conversation_id uuid,
  p_purpose_code text,
  p_body_text text,
  p_reply_to_message_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'conversation_id', p_conversation_id::text,
          'purpose_code', p_purpose_code,
          'body_text', p_body_text,
          'reply_to_message_id', coalesce(p_reply_to_message_id::text, '')
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.whatsapp_latest_consent_event_type(
  p_contact_id uuid,
  p_purpose_code text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ce.event_type
  from public.consent_events ce
  where ce.contact_id = p_contact_id
    and ce.purpose_code = p_purpose_code
  order by ce.occurred_at desc, ce.id desc
  limit 1;
$$;

create or replace function private.whatsapp_evaluate_service_send_eligibility(
  p_conversation_id uuid
)
returns table (
  eligibility_code text,
  eligibility_snapshot jsonb,
  dispatch_mode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conv public.whatsapp_conversations%rowtype;
  v_contact_id uuid;
  v_contact_status text;
  v_channel_status text;
  v_consent_event text;
begin
  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id;

  if not found then
    return query
      select
        'denied_invalid_conversation'::text,
        jsonb_build_object('conversation_id', p_conversation_id),
        null::text;
    return;
  end if;

  v_contact_id := v_conv.contact_id;

  if v_contact_id is null and v_conv.lead_id is not null then
    select l.contact_id into v_contact_id
    from public.leads l
    where l.id = v_conv.lead_id;
  end if;

  if v_contact_id is null then
    return query
      select
        'denied_missing_contact'::text,
        jsonb_build_object('conversation_id', p_conversation_id),
        null::text;
    return;
  end if;

  select c.status into v_contact_status
  from public.contacts c
  where c.id = v_contact_id;

  if v_contact_status = 'do_not_contact' then
    return query
      select
        'denied_dnc'::text,
        jsonb_build_object('contact_id', v_contact_id, 'contact_status', v_contact_status),
        null::text;
    return;
  end if;

  if v_contact_status in ('merged', 'archived') then
    return query
      select
        'denied_contact_inactive'::text,
        jsonb_build_object('contact_id', v_contact_id, 'contact_status', v_contact_status),
        null::text;
    return;
  end if;

  select ch.status into v_channel_status
  from public.contact_channels ch
  where ch.contact_id = v_contact_id
    and ch.channel_type = 'whatsapp'
    and ch.address_normalized = v_conv.customer_e164
  order by case ch.status when 'active' then 0 else 1 end
  limit 1;

  if v_channel_status is null then
    return query
      select
        'denied_missing_whatsapp_channel'::text,
        jsonb_build_object('contact_id', v_contact_id, 'customer_e164', v_conv.customer_e164),
        null::text;
    return;
  end if;

  if v_channel_status = 'suppressed' then
    return query
      select
        'denied_channel_suppressed'::text,
        jsonb_build_object('contact_id', v_contact_id, 'channel_status', v_channel_status),
        null::text;
    return;
  end if;

  if v_channel_status <> 'active' then
    return query
      select
        'denied_channel_inactive'::text,
        jsonb_build_object('contact_id', v_contact_id, 'channel_status', v_channel_status),
        null::text;
    return;
  end if;

  v_consent_event := private.whatsapp_latest_consent_event_type(v_contact_id, 'WHATSAPP_SERVICE');

  if v_consent_event is distinct from 'granted' then
    return query
      select
        'denied_missing_consent'::text,
        jsonb_build_object(
          'contact_id', v_contact_id,
          'latest_consent_event', coalesce(v_consent_event, 'none')
        ),
        null::text;
    return;
  end if;

  return query
    select
      'eligible'::text,
      jsonb_build_object(
        'contact_id', v_contact_id,
        'channel_status', v_channel_status,
        'latest_consent_event', v_consent_event
      ),
      'service_window_text'::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- D. Mutations — INVOKER wrapper -> private DEFINER implementation
-- -----------------------------------------------------------------------------

create or replace function private.create_whatsapp_service_send_intent_impl(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_purpose_code text,
  p_body_text text,
  p_reply_to_message_id uuid default null
)
returns public.whatsapp_send_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_normalized_body text;
  v_request_hash text;
  v_existing public.whatsapp_send_intents%rowtype;
  v_eligibility_code text;
  v_eligibility_snapshot jsonb;
  v_dispatch_mode text;
  v_intent public.whatsapp_send_intents%rowtype;
  v_conv public.whatsapp_conversations%rowtype;
  v_pre_consent_count integer;
  v_pre_message_count integer;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_purpose_code is distinct from 'WHATSAPP_SERVICE' then
    raise exception 'denied_purpose: only WHATSAPP_SERVICE is allowed' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128 then
    raise exception 'validation: idempotency_key' using errcode = '22023';
  end if;

  if p_reply_to_message_id is not null then
    if not exists (
      select 1
      from public.whatsapp_messages m
      where m.id = p_reply_to_message_id
        and m.conversation_id = p_conversation_id
    ) then
      raise exception 'validation: reply_to_message_id' using errcode = '22023';
    end if;
  end if;

  v_normalized_body := private.whatsapp_normalize_send_body(p_body_text);
  v_request_hash := private.whatsapp_compute_send_request_hash(
    p_conversation_id,
    p_purpose_code,
    v_normalized_body,
    p_reply_to_message_id
  );

  perform pg_advisory_xact_lock(
    hashtextextended('whatsapp:send-intent:' || v_actor::text || ':' || p_idempotency_key, 0)
  );

  select * into v_existing
  from public.whatsapp_send_intents
  where requested_by = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash is distinct from v_request_hash then
      raise exception 'idempotency_conflict: same idempotency key with different request'
        using errcode = '23505';
    end if;

    insert into public.whatsapp_send_intent_events (
      send_intent_id, event_type, actor_id, details
    )
    values (
      v_existing.id,
      'idempotency_reused',
      v_actor,
      jsonb_build_object('idempotency_key', p_idempotency_key)
    );

    return v_existing;
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'denied_invalid_conversation' using errcode = '22023';
  end if;

  if v_conv.lead_id is not null then
    perform 1
    from public.leads
    where id = v_conv.lead_id
    for update;

    if not found then
      raise exception 'denied_invalid_conversation' using errcode = '22023';
    end if;
  end if;

  if not (select private.whatsapp_inbox_can_use_conversation(p_conversation_id)) then
    raise exception 'denied_conversation_scope' using errcode = '42501';
  end if;

  select eligibility_code, eligibility_snapshot, dispatch_mode
    into v_eligibility_code, v_eligibility_snapshot, v_dispatch_mode
  from private.whatsapp_evaluate_service_send_eligibility(p_conversation_id);

  if v_eligibility_code <> 'eligible' then
    raise exception '%', v_eligibility_code using errcode = '22023';
  end if;

  select count(*)::integer into v_pre_consent_count from public.consent_events;
  select count(*)::integer into v_pre_message_count
  from public.whatsapp_messages
  where direction = 'outbound';

  insert into public.whatsapp_send_intents (
    conversation_id,
    requested_by,
    purpose_code,
    idempotency_key,
    request_hash,
    body_text,
    reply_to_message_id,
    dispatch_mode,
    eligibility_code,
    eligibility_snapshot,
    lifecycle_status
  )
  values (
    p_conversation_id,
    v_actor,
    p_purpose_code,
    p_idempotency_key,
    v_request_hash,
    v_normalized_body,
    p_reply_to_message_id,
    v_dispatch_mode,
    v_eligibility_code,
    v_eligibility_snapshot,
    'eligible'
  )
  returning * into v_intent;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'created',
      v_actor,
      jsonb_build_object(
        'conversation_id', p_conversation_id,
        'purpose_code', p_purpose_code,
        'idempotency_key', p_idempotency_key
      )
    ),
    (
      v_intent.id,
      'eligibility_recorded',
      v_actor,
      jsonb_build_object(
        'eligibility_code', v_eligibility_code,
        'dispatch_mode', v_dispatch_mode
      )
    );

  if (select count(*)::integer from public.consent_events) <> v_pre_consent_count then
    raise exception 'consent_mutation_forbidden' using errcode = '55000';
  end if;

  if (
    select count(*)::integer
    from public.whatsapp_messages
    where direction = 'outbound'
  ) <> v_pre_message_count then
    raise exception 'provider_message_fabrication_forbidden' using errcode = '55000';
  end if;

  return v_intent;
end;
$$;

create or replace function public.create_whatsapp_service_send_intent(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_purpose_code text,
  p_body_text text,
  p_reply_to_message_id uuid default null
)
returns public.whatsapp_send_intents
language sql
security invoker
set search_path = ''
as $$
  select private.create_whatsapp_service_send_intent_impl(
    p_conversation_id,
    p_idempotency_key,
    p_purpose_code,
    p_body_text,
    p_reply_to_message_id
  );
$$;

create or replace function public.whatsapp_inbox_check_conversation_access(
  p_conversation_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_capability
    when 'read' then (select private.whatsapp_inbox_can_view_conversation(p_conversation_id))
    when 'use' then (select private.whatsapp_inbox_can_use_conversation(p_conversation_id))
    when 'manage' then (select private.whatsapp_inbox_has_manage_scope())
      and exists (
        select 1
        from public.whatsapp_conversations c
        where c.id = p_conversation_id
      )
    else false
  end;
$$;

comment on function public.whatsapp_inbox_check_conversation_access(uuid, text) is
  'Returns whether the current actor may perform the requested inbox capability on a conversation.';

comment on function public.create_whatsapp_service_send_intent(uuid, text, text, text, uuid) is
  'Creates or reuses a durable WHATSAPP_SERVICE send intent. Pre-dispatch only; no provider dispatch in Phase 6B-B1.';

-- -----------------------------------------------------------------------------
-- E. Ownership, grants, RLS
-- -----------------------------------------------------------------------------

alter function private.whatsapp_inbox_has_manage_scope() owner to postgres;
alter function private.whatsapp_inbox_can_view_conversation(uuid) owner to postgres;
alter function private.whatsapp_inbox_can_use_conversation(uuid) owner to postgres;
alter function private.whatsapp_normalize_send_body(text) owner to postgres;
alter function private.whatsapp_compute_send_request_hash(uuid, text, text, uuid) owner to postgres;
alter function private.whatsapp_latest_consent_event_type(uuid, text) owner to postgres;
alter function private.whatsapp_evaluate_service_send_eligibility(uuid) owner to postgres;
alter function private.create_whatsapp_service_send_intent_impl(uuid, text, text, text, uuid) owner to postgres;

revoke all on function private.whatsapp_inbox_has_manage_scope() from public, anon;
revoke all on function private.whatsapp_inbox_can_view_conversation(uuid) from public, anon;
revoke all on function private.whatsapp_inbox_can_use_conversation(uuid) from public, anon;
revoke all on function private.whatsapp_normalize_send_body(text) from public, anon, authenticated;
revoke all on function private.whatsapp_compute_send_request_hash(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function private.whatsapp_latest_consent_event_type(uuid, text) from public, anon, authenticated;
revoke all on function private.whatsapp_evaluate_service_send_eligibility(uuid) from public, anon, authenticated;
revoke all on function private.create_whatsapp_service_send_intent_impl(uuid, text, text, text, uuid) from public, anon;

grant execute on function private.whatsapp_inbox_has_manage_scope() to authenticated;
grant execute on function private.whatsapp_inbox_can_view_conversation(uuid) to authenticated;
grant execute on function private.whatsapp_inbox_can_use_conversation(uuid) to authenticated;
grant execute on function private.create_whatsapp_service_send_intent_impl(uuid, text, text, text, uuid) to authenticated;

revoke execute on function public.create_whatsapp_service_send_intent(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.create_whatsapp_service_send_intent(uuid, text, text, text, uuid) to authenticated;

alter function public.whatsapp_inbox_check_conversation_access(uuid, text) owner to postgres;

revoke execute on function public.whatsapp_inbox_check_conversation_access(uuid, text) from public, anon;
grant execute on function public.whatsapp_inbox_check_conversation_access(uuid, text) to authenticated;

alter table public.whatsapp_send_intents enable row level security;
alter table public.whatsapp_send_intent_events enable row level security;

revoke all on table public.whatsapp_send_intents from public, anon, authenticated;
revoke all on table public.whatsapp_send_intent_events from public, anon, authenticated;

grant select on table public.whatsapp_send_intents to authenticated;
grant select on table public.whatsapp_send_intent_events to authenticated;

create policy whatsapp_send_intents_select_scoped
  on public.whatsapp_send_intents
  for select
  to authenticated
  using ((select private.whatsapp_inbox_can_view_conversation(conversation_id)));

create policy whatsapp_send_intent_events_select_scoped
  on public.whatsapp_send_intent_events
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
