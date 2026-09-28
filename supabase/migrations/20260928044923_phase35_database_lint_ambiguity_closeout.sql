begin;

-- Close two pre-existing PL/pgSQL output-column ambiguities reported by db lint.
create or replace function public.set_crm_auto_assignment_enabled(
  p_enabled boolean,
  p_reason text default null
)
returns table (
  enabled boolean,
  can_manage boolean,
  enabled_by uuid,
  enabled_at timestamptz,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_setting public.crm_assignment_settings%rowtype;
  v_reason text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_AUTO_ASSIGNMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'CRM_AUTO_ASSIGNMENT_SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'CRM_AUTO_ASSIGNMENT_VALUE_REQUIRED' using errcode = '22023';
  end if;

  if p_enabled and not exists (
    select 1
    from public.lead_assignment_rules r
    where r.is_active = true
      and private.crm_is_assignable_sales_user(r.target_user_id)
  ) then
    raise exception 'CRM_AUTO_ASSIGNMENT_NO_ELIGIBLE_RULE'
      using errcode = '22023',
            hint = 'Create and enable at least one rule targeting an active Sales Executive.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'CRM_AUTO_ASSIGNMENT_REASON_INVALID' using errcode = '22023';
  end if;

  select * into v_setting
  from public.crm_assignment_settings
  where singleton = true
  for update;

  if not found then
    raise exception 'CRM_AUTO_ASSIGNMENT_SETTING_MISSING' using errcode = 'P0002';
  end if;

  if v_setting.auto_assignment_enabled is distinct from p_enabled then
    insert into public.crm_assignment_setting_events (
      actor_id, previous_enabled, new_enabled, reason
    ) values (
      v_actor,
      v_setting.auto_assignment_enabled,
      p_enabled,
      v_reason
    );

    update public.crm_assignment_settings s
    set auto_assignment_enabled = p_enabled,
        enabled_by = case when p_enabled then v_actor else s.enabled_by end,
        enabled_at = case when p_enabled then now() else s.enabled_at end,
        updated_by = v_actor,
        updated_at = now()
    where s.singleton = true
    returning * into v_setting;
  end if;

  return query
  select
    v_setting.auto_assignment_enabled,
    true,
    v_setting.enabled_by,
    v_setting.enabled_at,
    v_setting.updated_by,
    v_setting.updated_at;
end;
$$;

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

  update public.whatsapp_conversations wc
  set lead_id = v_lead.id,
      contact_id = v_lead.contact_id,
      updated_at = now()
  where wc.id = v_conv.id
    and wc.lead_id is null;

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

commit;
