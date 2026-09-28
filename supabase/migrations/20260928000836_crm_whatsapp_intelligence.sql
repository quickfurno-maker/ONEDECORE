-- ONEDECORE Phase 2 — CRM ↔ WhatsApp intelligence.
-- Content-free engagement signals, governed CRM WhatsApp quick action and
-- lead-scoped marketing-consent visibility. No provider call, template dispatch,
-- Meta activation or inferred consent is introduced here.

begin;

alter table public.whatsapp_crm_link_events
  drop constraint if exists chk_whatsapp_crm_link_events_method;

alter table public.whatsapp_crm_link_events
  add constraint chk_whatsapp_crm_link_events_method check (
    link_method in ('manual_existing', 'created_lead', 'crm_outbound_start')
  );

create index if not exists idx_whatsapp_conversations_lead_last_message
  on public.whatsapp_conversations (lead_id, last_message_at desc, id)
  where lead_id is not null;

-- ============================================================================
-- 1. Content-free WhatsApp engagement signals for CRM scoring.
--    Private SECURITY DEFINER implementation + public SECURITY INVOKER wrapper.
-- ============================================================================

create or replace function private.list_crm_whatsapp_lead_signals_impl(
  p_lead_ids uuid[]
)
returns table (
  lead_id uuid,
  whatsapp_linked boolean,
  has_customer_reply boolean,
  last_inbound_at timestamptz,
  production_conversation_id uuid,
  production_sender_ready boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_count integer;
  v_production_ready boolean;
begin
  if v_actor is null then
    raise exception 'CRM_WHATSAPP_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_lead_ids is null then
    return;
  end if;

  v_count := cardinality(p_lead_ids);
  if v_count > 200 then
    raise exception 'CRM_WHATSAPP_SIGNAL_BATCH_TOO_LARGE' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.whatsapp_phone_numbers p
    join public.whatsapp_business_accounts b on b.id = p.business_account_id
    where p.production_sender_at is not null
      and p.status = 'active'
      and b.status = 'active'
  ) into v_production_ready;

  return query
  with requested as (
    select distinct unnest(p_lead_ids) as id
  ),
  visible as (
    select l.id
    from requested r
    join public.leads l on l.id = r.id
    where l.deleted_at is null
      and (select private.crm_can_view_lead(l.assigned_to))
  ),
  aggregates as (
    select
      v.id as lead_id,
      count(c.id) > 0 as whatsapp_linked,
      max(c.last_inbound_at) as last_inbound_at
    from visible v
    left join public.whatsapp_conversations c on c.lead_id = v.id
    group by v.id
  )
  select
    a.lead_id,
    a.whatsapp_linked,
    a.last_inbound_at is not null as has_customer_reply,
    a.last_inbound_at,
    (
      select c.id
      from public.whatsapp_conversations c
      join public.whatsapp_phone_numbers p on p.id = c.phone_number_id
      join public.whatsapp_business_accounts b on b.id = p.business_account_id
      where c.lead_id = a.lead_id
        and p.production_sender_at is not null
        and p.status = 'active'
        and b.status = 'active'
      order by c.last_message_at desc nulls last, c.created_at desc, c.id
      limit 1
    ) as production_conversation_id,
    v_production_ready
  from aggregates a
  order by a.lead_id;
end;
$fn$;

revoke all on function private.list_crm_whatsapp_lead_signals_impl(uuid[])
  from public, anon;
grant execute on function private.list_crm_whatsapp_lead_signals_impl(uuid[])
  to authenticated;

create or replace function public.list_crm_whatsapp_lead_signals(
  p_lead_ids uuid[]
)
returns table (
  lead_id uuid,
  whatsapp_linked boolean,
  has_customer_reply boolean,
  last_inbound_at timestamptz,
  production_conversation_id uuid,
  production_sender_ready boolean
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select *
  from private.list_crm_whatsapp_lead_signals_impl(p_lead_ids);
$fn$;

revoke all on function public.list_crm_whatsapp_lead_signals(uuid[])
  from public, anon;
grant execute on function public.list_crm_whatsapp_lead_signals(uuid[])
  to authenticated;

comment on function public.list_crm_whatsapp_lead_signals(uuid[]) is
  'Content-free CRM WhatsApp intelligence for visible live leads: linked state, customer-reply recency, and current production conversation. Bounded to 200 lead ids.';

-- ============================================================================
-- 2. Lead-scoped consent visibility.
--    consents.read can see state; marketing_consents.manage remains the only
--    permission accepted by the existing consent mutation RPC.
-- ============================================================================

create or replace function private.get_crm_whatsapp_marketing_state_impl(
  p_lead_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_lead public.leads%rowtype;
  v_contact public.contacts%rowtype;
  v_latest public.consent_events%rowtype;
  v_current boolean;
  v_email_suppressed boolean;
  v_whatsapp_suppressed boolean;
begin
  if v_actor is null then
    raise exception 'CRM_WHATSAPP_AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_lead
  from public.leads
  where id = p_lead_id
    and deleted_at is null;

  if not found or not (select private.crm_can_view_lead(v_lead.assigned_to)) then
    raise exception 'CRM_WHATSAPP_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (
    (select public.authorize('consents.read'))
    or (select public.authorize('marketing_consents.manage'))
  ) then
    raise exception 'CRM_WHATSAPP_CONSENT_READ_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_contact
  from public.contacts
  where id = v_lead.contact_id;

  if not found then
    raise exception 'CRM_WHATSAPP_CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select *
  into v_latest
  from public.consent_events ce
  where ce.contact_id = v_lead.contact_id
    and ce.purpose_code = 'MARKETING'
  order by ce.occurred_at desc, ce.created_at desc, ce.id desc
  limit 1;

  v_current := private.has_current_marketing_consent(v_lead.contact_id);

  select exists (
    select 1
    from public.contact_channels ch
    where ch.contact_id = v_lead.contact_id
      and ch.channel_type = 'email'
      and ch.status = 'suppressed'
  ) into v_email_suppressed;

  select exists (
    select 1
    from public.contact_channels ch
    where ch.contact_id = v_lead.contact_id
      and ch.channel_type in ('whatsapp', 'phone')
      and ch.status = 'suppressed'
  ) into v_whatsapp_suppressed;

  return jsonb_build_object(
    'contact_id', v_lead.contact_id,
    'current_granted', v_current,
    'latest_event_type', v_latest.event_type,
    'latest_occurred_at', v_latest.occurred_at,
    'dnc', v_contact.status = 'do_not_contact',
    'contact_status', v_contact.status,
    'email_suppressed', v_email_suppressed,
    'whatsapp_suppressed', v_whatsapp_suppressed,
    'outreach_blocked', (
      v_contact.status in ('do_not_contact', 'merged', 'archived')
      or not v_current
      or v_whatsapp_suppressed
    )
  );
end;
$fn$;

revoke all on function private.get_crm_whatsapp_marketing_state_impl(uuid)
  from public, anon;
grant execute on function private.get_crm_whatsapp_marketing_state_impl(uuid)
  to authenticated;

create or replace function public.get_crm_whatsapp_marketing_state(
  p_lead_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $fn$
  select private.get_crm_whatsapp_marketing_state_impl(p_lead_id);
$fn$;

revoke all on function public.get_crm_whatsapp_marketing_state(uuid)
  from public, anon;
grant execute on function public.get_crm_whatsapp_marketing_state(uuid)
  to authenticated;

comment on function public.get_crm_whatsapp_marketing_state(uuid) is
  'Lead-scoped CRM visibility for MARKETING consent, DNC and channel suppression. Requires CRM lead scope plus consents.read or marketing_consents.manage.';

-- ============================================================================
-- 3. CRM quick action: prepare/open the one production-sender conversation.
--    This never dispatches a provider message.
-- ============================================================================

create or replace function private.ensure_whatsapp_conversation_for_crm_lead_impl(
  p_lead_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_lead public.leads%rowtype;
  v_phone public.whatsapp_phone_numbers%rowtype;
  v_customer_e164 text;
  v_conversation public.whatsapp_conversations%rowtype;
  v_previous_lead_id uuid;
  v_previous_contact_id uuid;
  v_created boolean := false;
  v_linked boolean := false;
begin
  if v_actor is null then
    raise exception 'CRM_WHATSAPP_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('whatsapp.inbox.use')) then
    raise exception 'CRM_WHATSAPP_USE_REQUIRED' using errcode = '42501';
  end if;

  if p_lead_id is null then
    raise exception 'CRM_WHATSAPP_LEAD_REQUIRED' using errcode = '22023';
  end if;

  select *
  into v_lead
  from public.leads
  where id = p_lead_id
    and deleted_at is null;

  if not found or not (select private.crm_can_view_lead(v_lead.assigned_to)) then
    raise exception 'CRM_WHATSAPP_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_lead.status in ('closed_lost', 'on_hold') then
    raise exception 'CRM_WHATSAPP_LEAD_NOT_SENDABLE' using errcode = '22023';
  end if;

  select p.*
  into v_phone
  from public.whatsapp_phone_numbers p
  join public.whatsapp_business_accounts b on b.id = p.business_account_id
  where p.production_sender_at is not null
    and p.status = 'active'
    and b.status = 'active'
  order by p.production_sender_at desc, p.id
  limit 1;

  if not found then
    raise exception 'CRM_WHATSAPP_PRODUCTION_SENDER_NOT_READY' using errcode = '55000';
  end if;

  select cc.address_normalized
  into v_customer_e164
  from public.contact_channels cc
  where cc.contact_id = v_lead.contact_id
    and cc.channel_type in ('whatsapp', 'phone')
    and cc.status = 'active'
    and cc.address_normalized ~ '^\+[1-9]\d{1,14}$'
  order by
    case cc.channel_type when 'whatsapp' then 0 else 1 end,
    cc.is_primary desc,
    cc.created_at,
    cc.id
  limit 1;

  if v_customer_e164 is null then
    raise exception 'CRM_WHATSAPP_CONTACT_CHANNEL_MISSING' using errcode = '22023';
  end if;

  select *
  into v_conversation
  from public.whatsapp_conversations c
  where c.phone_number_id = v_phone.id
    and c.customer_e164 = v_customer_e164
  for update;

  if found then
    v_previous_lead_id := v_conversation.lead_id;
    v_previous_contact_id := v_conversation.contact_id;

    if v_conversation.lead_id is not null
       and v_conversation.lead_id <> v_lead.id then
      raise exception 'CRM_WHATSAPP_NUMBER_LINKED_TO_OTHER_LEAD' using errcode = '22023';
    end if;

    if v_conversation.contact_id is not null
       and v_conversation.contact_id <> v_lead.contact_id then
      raise exception 'CRM_WHATSAPP_NUMBER_LINKED_TO_OTHER_CONTACT' using errcode = '22023';
    end if;

    if v_conversation.lead_id is null or v_conversation.contact_id is null then
      update public.whatsapp_conversations
      set lead_id = v_lead.id,
          contact_id = v_lead.contact_id,
          display_name_snapshot = coalesce(display_name_snapshot, v_lead.submitted_name),
          updated_at = now()
      where id = v_conversation.id
      returning * into v_conversation;

      v_linked := true;
    end if;
  else
    insert into public.whatsapp_conversations (
      phone_number_id,
      customer_e164,
      contact_id,
      lead_id,
      display_name_snapshot,
      created_at,
      updated_at
    ) values (
      v_phone.id,
      v_customer_e164,
      v_lead.contact_id,
      v_lead.id,
      v_lead.submitted_name,
      now(),
      now()
    )
    returning * into v_conversation;

    v_created := true;
    v_linked := true;
    v_previous_lead_id := null;
    v_previous_contact_id := null;
  end if;

  if v_linked then
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
      v_conversation.id,
      v_previous_lead_id,
      v_lead.id,
      v_previous_contact_id,
      v_lead.contact_id,
      v_actor,
      'crm_outbound_start',
      true,
      null
    );
  end if;

  return jsonb_build_object(
    'outcome', case
      when v_created then 'created'
      when v_linked then 'linked'
      else 'existing'
    end,
    'conversation_id', v_conversation.id,
    'lead_id', v_lead.id,
    'contact_id', v_lead.contact_id,
    'customer_e164', v_customer_e164,
    'provider_send_started', false
  );
end;
$fn$;

revoke all on function private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)
  from public, anon;
grant execute on function private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)
  to authenticated;

create or replace function public.ensure_whatsapp_conversation_for_crm_lead(
  p_lead_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $fn$
  select private.ensure_whatsapp_conversation_for_crm_lead_impl(p_lead_id);
$fn$;

revoke all on function public.ensure_whatsapp_conversation_for_crm_lead(uuid)
  from public, anon;
grant execute on function public.ensure_whatsapp_conversation_for_crm_lead(uuid)
  to authenticated;

comment on function public.ensure_whatsapp_conversation_for_crm_lead(uuid) is
  'CRM quick-action preparation only. Requires lead scope + whatsapp.inbox.use, current production sender and an active E.164 channel. Creates/links local conversation evidence but never sends or grants marketing consent.';

commit;
