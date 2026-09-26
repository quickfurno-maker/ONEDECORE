-- ONEDECORE P2 — CRM <-> WhatsApp workspace integration.
-- Adds governed human resolution for unlinked conversations and completes the
-- deterministic automatic link by carrying contact_id alongside lead_id.
-- No provider send, template, campaign, consent or Meta execution state changes.

create table public.whatsapp_crm_link_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete restrict,
  previous_lead_id uuid references public.leads(id) on delete set null,
  new_lead_id uuid not null references public.leads(id) on delete restrict,
  previous_contact_id uuid references public.contacts(id) on delete set null,
  new_contact_id uuid not null references public.contacts(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  link_method text not null,
  phone_match boolean not null,
  reason text,
  occurred_at timestamptz not null default now(),

  constraint chk_whatsapp_crm_link_events_method check (
    link_method in ('manual_existing', 'created_lead')
  ),
  constraint chk_whatsapp_crm_link_events_reason check (
    reason is null or length(trim(reason)) between 5 and 500
  )
);

comment on table public.whatsapp_crm_link_events is
  'Append-only audit of explicit staff resolution between a WhatsApp conversation and a CRM lead. Automatic deterministic links remain in the inbound audit path.';

create index idx_whatsapp_crm_link_events_conversation
  on public.whatsapp_crm_link_events(conversation_id, occurred_at desc);

create trigger trg_whatsapp_crm_link_events_no_update
  before update on public.whatsapp_crm_link_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_crm_link_events_no_delete
  before delete on public.whatsapp_crm_link_events
  for each row execute function private.forbid_append_only_mutation();

alter table public.whatsapp_crm_link_events enable row level security;
revoke all on public.whatsapp_crm_link_events from public, anon, authenticated;

-- Complete the existing deterministic writer: when phone identity proves a
-- unique CRM lead, keep the linked contact on the conversation too. Existing
-- non-null lead links are still never silently overwritten.
create or replace function private.crm_apply_whatsapp_conversation_lead_link(
  p_conversation_id uuid
)
returns text
language plpgsql
set search_path = ''
as $fn$
declare
  v_conv public.whatsapp_conversations%rowtype;
  v_resolved_lead uuid;
  v_resolved_contact uuid;
  v_code text;
begin
  if p_conversation_id is null then
    return 'invalid_conversation';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    return 'invalid_conversation';
  end if;

  select r.lead_id, r.contact_id, r.resolution_code
  into v_resolved_lead, v_resolved_contact, v_code
  from private.crm_resolve_whatsapp_lead_link(v_conv.customer_e164) r;

  if v_conv.lead_id is not null then
    if v_code = 'linked' and v_resolved_lead = v_conv.lead_id then
      if v_conv.contact_id is null and v_resolved_contact is not null then
        update public.whatsapp_conversations
        set contact_id = v_resolved_contact,
            updated_at = now()
        where id = p_conversation_id
          and lead_id = v_conv.lead_id
          and contact_id is null;
      end if;
      return 'existing_link_confirmed';
    end if;
    if v_code = 'linked' then
      return 'existing_link_conflict';
    end if;
    return 'existing_link_preserved';
  end if;

  if v_code <> 'linked' then
    return v_code;
  end if;

  update public.whatsapp_conversations
  set lead_id = v_resolved_lead,
      contact_id = v_resolved_contact,
      updated_at = now()
  where id = p_conversation_id
    and lead_id is null;

  if not found then
    return 'existing_link_preserved';
  end if;

  return 'linked';
end;
$fn$;

comment on function private.crm_apply_whatsapp_conversation_lead_link(uuid) is
  'Single deterministic writer for WhatsApp conversation CRM linkage. Unique canonical phone identity sets both lead_id and contact_id; existing lead links are never silently replaced.';

create or replace function private.link_whatsapp_conversation_to_crm_lead_impl(
  p_conversation_id uuid,
  p_lead_id uuid,
  p_reason text default null,
  p_method text default 'manual_existing'
)
returns table (
  outcome_code text,
  lead_id uuid,
  contact_id uuid,
  phone_match boolean
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid;
  v_conv public.whatsapp_conversations%rowtype;
  v_lead public.leads%rowtype;
  v_reason text;
  v_phone_match boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_WHATSAPP_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.whatsapp_inbox_has_manage_scope()) then
    raise exception 'CRM_WHATSAPP_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.crm_has_broad_lead_read()) then
    raise exception 'CRM_WHATSAPP_CRM_READ_REQUIRED' using errcode = '42501';
  end if;

  if p_conversation_id is null or p_lead_id is null then
    raise exception 'CRM_WHATSAPP_LINK_INPUT_REQUIRED' using errcode = '22023';
  end if;

  if p_method not in ('manual_existing', 'created_lead') then
    raise exception 'CRM_WHATSAPP_LINK_METHOD_INVALID' using errcode = '22023';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'CRM_WHATSAPP_CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
    and deleted_at is null;

  if not found or not (select private.crm_can_view_lead(v_lead.assigned_to)) then
    raise exception 'CRM_WHATSAPP_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_conv.lead_id is not null then
    if v_conv.lead_id = v_lead.id then
      return query
      select 'already_linked'::text, v_conv.lead_id, coalesce(v_conv.contact_id, v_lead.contact_id), true;
      return;
    end if;
    raise exception 'CRM_WHATSAPP_ALREADY_LINKED' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.contact_channels cc
    where cc.contact_id = v_lead.contact_id
      and cc.channel_type in ('phone', 'whatsapp')
      and cc.status = 'active'
      and cc.address_normalized = v_conv.customer_e164
  )
  into v_phone_match;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if not v_phone_match and (v_reason is null or length(v_reason) < 5) then
    raise exception 'CRM_WHATSAPP_LINK_REASON_REQUIRED'
      using errcode = '22023',
            hint = 'A reason is required when the WhatsApp number does not match the CRM contact.';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'CRM_WHATSAPP_LINK_REASON_INVALID' using errcode = '22023';
  end if;

  update public.whatsapp_conversations
  set lead_id = v_lead.id,
      contact_id = v_lead.contact_id,
      updated_at = now()
  where id = v_conv.id
    and lead_id is null;

  if not found then
    raise exception 'CRM_WHATSAPP_ALREADY_LINKED' using errcode = '40001';
  end if;

  insert into public.whatsapp_crm_link_events (
    conversation_id,
    previous_lead_id,
    new_lead_id,
    previous_contact_id,
    new_contact_id,
    actor_id,
    link_method,
    phone_match,
    reason
  ) values (
    v_conv.id,
    v_conv.lead_id,
    v_lead.id,
    v_conv.contact_id,
    v_lead.contact_id,
    v_actor,
    p_method,
    v_phone_match,
    v_reason
  );

  return query
  select 'linked'::text, v_lead.id, v_lead.contact_id, v_phone_match;
end;
$fn$;

create or replace function public.link_whatsapp_conversation_to_crm_lead(
  p_conversation_id uuid,
  p_lead_id uuid,
  p_reason text default null,
  p_method text default 'manual_existing'
)
returns table (
  outcome_code text,
  lead_id uuid,
  contact_id uuid,
  phone_match boolean
)
language sql
security invoker
set search_path = ''
as $fn$
  select *
  from private.link_whatsapp_conversation_to_crm_lead_impl(
    p_conversation_id,
    p_lead_id,
    p_reason,
    p_method
  );
$fn$;

alter function private.crm_apply_whatsapp_conversation_lead_link(uuid) owner to postgres;
alter function private.link_whatsapp_conversation_to_crm_lead_impl(uuid, uuid, text, text) owner to postgres;
alter function public.link_whatsapp_conversation_to_crm_lead(uuid, uuid, text, text) owner to postgres;

revoke all on function private.crm_apply_whatsapp_conversation_lead_link(uuid)
  from public, anon, authenticated;
revoke all on function private.link_whatsapp_conversation_to_crm_lead_impl(uuid, uuid, text, text)
  from public, anon;
grant execute on function private.link_whatsapp_conversation_to_crm_lead_impl(uuid, uuid, text, text)
  to authenticated;

revoke all on function public.link_whatsapp_conversation_to_crm_lead(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.link_whatsapp_conversation_to_crm_lead(uuid, uuid, text, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Create + link in one transaction.
-- Reuses the canonical manual-lead authority, including duplicate checks,
-- assignee policy, audit, contact creation and consent non-assumption.
-- -----------------------------------------------------------------------------

create or replace function private.create_crm_lead_from_whatsapp_conversation_impl(
  p_conversation_id uuid,
  p_submitted_name text,
  p_service_code text default 'not-specified',
  p_assignee_id uuid default null
)
returns table (
  outcome_code text,
  lead_id uuid,
  contact_id uuid
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid;
  v_conv public.whatsapp_conversations%rowtype;
  v_source_id uuid;
  v_lead public.leads%rowtype;
  v_link record;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_WHATSAPP_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.whatsapp_inbox_has_manage_scope()) then
    raise exception 'CRM_WHATSAPP_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.crm_has_broad_lead_read()) then
    raise exception 'CRM_WHATSAPP_CRM_READ_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.create')) then
    raise exception 'CRM_WHATSAPP_LEAD_CREATE_REQUIRED' using errcode = '42501';
  end if;

  if p_conversation_id is null then
    raise exception 'CRM_WHATSAPP_LINK_INPUT_REQUIRED' using errcode = '22023';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'CRM_WHATSAPP_CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_conv.lead_id is not null then
    raise exception 'CRM_WHATSAPP_ALREADY_LINKED' using errcode = '22023';
  end if;

  select ls.id into v_source_id
  from public.lead_sources ls
  where ls.code = 'whatsapp'
    and ls.is_active = true
  order by ls.created_at
  limit 1;

  if v_source_id is null then
    raise exception 'CRM_WHATSAPP_SOURCE_MISSING' using errcode = '22023';
  end if;

  v_lead := private.create_manual_lead_impl(
    p_submitted_name,
    v_conv.customer_e164,
    null,
    coalesce(nullif(trim(p_service_code), ''), 'not-specified'),
    'not-specified',
    'not-specified',
    v_source_id,
    null,
    null,
    '{}'::text[],
    null,
    'Created from WhatsApp inbox',
    p_assignee_id,
    false,
    null
  );

  select * into v_link
  from private.link_whatsapp_conversation_to_crm_lead_impl(
    p_conversation_id,
    v_lead.id,
    null,
    'created_lead'
  );

  if v_link.outcome_code not in ('linked', 'already_linked') then
    raise exception 'CRM_WHATSAPP_CREATE_LINK_FAILED' using errcode = '55000';
  end if;

  return query
  select 'created_and_linked'::text, v_lead.id, v_lead.contact_id;
end;
$fn$;

create or replace function public.create_crm_lead_from_whatsapp_conversation(
  p_conversation_id uuid,
  p_submitted_name text,
  p_service_code text default 'not-specified',
  p_assignee_id uuid default null
)
returns table (
  outcome_code text,
  lead_id uuid,
  contact_id uuid
)
language sql
security invoker
set search_path = ''
as $fn$
  select *
  from private.create_crm_lead_from_whatsapp_conversation_impl(
    p_conversation_id,
    p_submitted_name,
    p_service_code,
    p_assignee_id
  );
$fn$;

alter function private.create_crm_lead_from_whatsapp_conversation_impl(uuid, text, text, uuid)
  owner to postgres;
alter function public.create_crm_lead_from_whatsapp_conversation(uuid, text, text, uuid)
  owner to postgres;

revoke all on function private.create_crm_lead_from_whatsapp_conversation_impl(uuid, text, text, uuid)
  from public, anon;
grant execute on function private.create_crm_lead_from_whatsapp_conversation_impl(uuid, text, text, uuid)
  to authenticated;

revoke all on function public.create_crm_lead_from_whatsapp_conversation(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.create_crm_lead_from_whatsapp_conversation(uuid, text, text, uuid)
  to authenticated;
