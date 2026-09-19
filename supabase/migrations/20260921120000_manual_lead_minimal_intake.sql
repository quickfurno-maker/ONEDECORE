-- Minimal manual-enquiry capture: only name + mobile are required at creation.
-- Unknown service is stored explicitly as not-specified; Manual Entry source is resolved server-side.

alter table public.leads drop constraint if exists chk_leads_service_code;
alter table public.leads add constraint chk_leads_service_code check (
  service_code in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes', 'not-specified')
);

alter table public.leads drop constraint if exists chk_leads_property_code;
alter table public.leads add constraint chk_leads_property_code check (
  property_code is null or property_code in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room', 'not-specified'
  )
);

alter table public.leads drop constraint if exists chk_leads_timeline_code;
alter table public.leads add constraint chk_leads_timeline_code check (
  timeline_code is null or timeline_code in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months', 'not-specified'
  )
);

create or replace function private.crm_manual_leads_are_similar(
  p_existing_locality text,
  p_incoming_locality text,
  p_existing_service text,
  p_incoming_service text,
  p_existing_property text,
  p_incoming_property text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    (
      p_incoming_service = 'not-specified'
      or p_existing_service = 'not-specified'
      or p_existing_service = p_incoming_service
    )
    and (
      p_incoming_property = 'not-specified'
      or p_existing_property = 'not-specified'
      or p_existing_property = p_incoming_property
    )
    and (
      private.crm_normalize_locality(p_existing_locality) is null
      or private.crm_normalize_locality(p_incoming_locality) is null
      or lower(private.crm_normalize_locality(p_existing_locality))
        = lower(private.crm_normalize_locality(p_incoming_locality))
    );
$$;

create or replace function private.check_manual_lead_duplicate_impl(
  p_phone text,
  p_email text,
  p_service_code text,
  p_property_code text,
  p_locality text
)
returns table (
  outcome_code text,
  can_create boolean,
  can_override boolean,
  existing_lead_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_email text;
  v_phone_contact uuid;
  v_email_contact uuid;
begin
  if auth.uid() is null then
    raise exception 'CRM_MANUAL_LEAD_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.create')) then
    raise exception 'CRM_MANUAL_LEAD_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_phone := private.crm_normalize_phone_e164(p_phone);
  v_email := private.crm_normalize_email(p_email);

  if v_phone is null then
    raise exception 'CRM_MANUAL_LEAD_CONTACT_REQUIRED' using errcode = '22023';
  end if;

  if p_service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes', 'not-specified') then
    raise exception 'CRM_MANUAL_LEAD_INVALID_SERVICE' using errcode = '22023';
  end if;

  if p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room', 'not-specified'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_PROPERTY' using errcode = '22023';
  end if;

  if p_locality is not null and length(trim(p_locality)) > 120 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_LOCALITY' using errcode = '22023';
  end if;

  perform private.crm_manual_lead_lock_identity(v_phone, v_email);

  if v_phone is not null then
    select ch.contact_id into v_phone_contact
    from public.contact_channels ch
    where ch.channel_type = 'phone'
      and ch.status = 'active'
      and ch.address_normalized = v_phone
    limit 1;
  end if;

  if v_email is not null then
    select ch.contact_id into v_email_contact
    from public.contact_channels ch
    where ch.channel_type = 'email'
      and ch.status = 'active'
      and ch.address_normalized = v_email
    limit 1;
  end if;

  if v_phone_contact is not null
    and v_email_contact is not null
    and v_phone_contact is distinct from v_email_contact then
    return query select 'CONTACT_IDENTITY_CONFLICT'::text, false, false, null::uuid;
    return;
  end if;

  if v_phone_contact is null and v_email_contact is null then
    return query select 'CLEAR'::text, true, false, null::uuid;
    return;
  end if;

  return query
  select *
  from private.crm_evaluate_manual_lead_duplicate(
    coalesce(v_phone_contact, v_email_contact),
    p_service_code,
    p_property_code,
    p_locality
  );
end;
$$;

create or replace function private.create_manual_lead_impl(
  p_submitted_name text,
  p_phone text,
  p_email text,
  p_service_code text,
  p_property_code text,
  p_timeline_code text,
  p_primary_source_id uuid,
  p_locality text,
  p_budget_comfort_code text,
  p_room_codes text[],
  p_message text,
  p_source_detail text,
  p_assignee_id uuid,
  p_duplicate_override boolean,
  p_duplicate_override_reason text
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_phone text;
  v_email text;
  v_phone_contact uuid;
  v_email_contact uuid;
  v_contact_id uuid;
  v_dup record;
  v_override_reason text;
  v_final_assignee uuid;
  v_final_status text;
  v_method text;
  v_lead public.leads%rowtype;
  v_rooms text[];
  v_is_exec boolean;
  v_is_manager boolean;
  v_source_detail text;
  v_history_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_MANUAL_LEAD_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.create')) then
    raise exception 'CRM_MANUAL_LEAD_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_submitted_name is null or length(trim(p_submitted_name)) < 2 or length(trim(p_submitted_name)) > 120 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_NAME' using errcode = '22023';
  end if;

  v_phone := private.crm_normalize_phone_e164(p_phone);
  v_email := private.crm_normalize_email(p_email);
  if v_phone is null then
    raise exception 'CRM_MANUAL_LEAD_CONTACT_REQUIRED' using errcode = '22023';
  end if;

  if p_service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes', 'not-specified') then
    raise exception 'CRM_MANUAL_LEAD_INVALID_SERVICE' using errcode = '22023';
  end if;

  if p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room', 'not-specified'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_PROPERTY' using errcode = '22023';
  end if;

  if p_timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months', 'not-specified'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_TIMELINE' using errcode = '22023';
  end if;

  if p_primary_source_id is null or not exists (
    select 1 from public.lead_sources ls
    where ls.id = p_primary_source_id and ls.is_active = true
  ) then
    raise exception 'CRM_MANUAL_LEAD_INACTIVE_SOURCE' using errcode = '22023';
  end if;

  v_rooms := coalesce(p_room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6
    or not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_ROOMS' using errcode = '22023';
  end if;

  if p_budget_comfort_code is not null and p_budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_BUDGET' using errcode = '22023';
  end if;

  if p_message is not null and length(p_message) > 2000 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_MESSAGE' using errcode = '22023';
  end if;

  v_source_detail := nullif(trim(coalesce(p_source_detail, '')), '');
  if v_source_detail is not null and length(v_source_detail) > 500 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_SOURCE_DETAIL' using errcode = '22023';
  end if;

  if p_locality is not null and length(trim(p_locality)) > 120 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_LOCALITY' using errcode = '22023';
  end if;

  v_is_exec := (select private.has_role('sales_executive'))
    or (select private.has_role('sales'));
  v_is_manager := (select private.has_role('sales_manager'))
    or (select private.has_role('management'));

  if v_is_exec then
    v_final_assignee := v_actor;
  else
    v_final_assignee := p_assignee_id;
  end if;

  if v_final_assignee is not null then
    if v_final_assignee = v_actor then
      if not (
        v_is_exec
        or v_is_manager
        or (select private.has_role('super_admin'))
      ) then
        raise exception 'CRM_MANUAL_LEAD_INVALID_ASSIGNEE' using errcode = '22023';
      end if;
    elsif not (select private.crm_is_assignable_sales_user(v_final_assignee)) then
      raise exception 'CRM_MANUAL_LEAD_INVALID_ASSIGNEE' using errcode = '22023';
    end if;
  end if;

  if v_is_exec and p_assignee_id is not null and p_assignee_id is distinct from v_actor then
    raise exception 'CRM_MANUAL_LEAD_ASSIGNEE_FORBIDDEN' using errcode = '42501';
  end if;

  if v_is_exec and p_assignee_id is null and v_final_assignee is null then
    raise exception 'CRM_MANUAL_LEAD_ASSIGNEE_REQUIRED' using errcode = '22023';
  end if;

  perform private.crm_manual_lead_lock_identity(v_phone, v_email);

  if v_phone is not null then
    select ch.contact_id into v_phone_contact
    from public.contact_channels ch
    where ch.channel_type = 'phone' and ch.status = 'active' and ch.address_normalized = v_phone
    limit 1
    for update;
  end if;

  if v_email is not null then
    select ch.contact_id into v_email_contact
    from public.contact_channels ch
    where ch.channel_type = 'email' and ch.status = 'active' and ch.address_normalized = v_email
    limit 1
    for update;
  end if;

  if v_phone_contact is not null and v_email_contact is not null
    and v_phone_contact is distinct from v_email_contact then
    raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
  end if;

  select * into v_dup
  from private.crm_evaluate_manual_lead_duplicate(
    coalesce(v_phone_contact, v_email_contact),
    p_service_code,
    p_property_code,
    p_locality
  )
  limit 1;

  if coalesce(v_dup.outcome_code, 'CLEAR') = 'ACTIVE_DUPLICATE' then
    raise exception 'CRM_MANUAL_LEAD_ACTIVE_DUPLICATE' using errcode = 'P0001';
  end if;

  if coalesce(v_dup.outcome_code, 'CLEAR') = 'RECENT_SIMILAR' then
    v_override_reason := nullif(trim(coalesce(p_duplicate_override_reason, '')), '');
    if coalesce(p_duplicate_override, false) is not true then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REQUIRED' using errcode = 'P0001';
    end if;
    if not (select public.authorize('leads.duplicate_override')) then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_DENIED' using errcode = '42501';
    end if;
    if v_override_reason is null or length(v_override_reason) < 10 or length(v_override_reason) > 500 then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REASON_INVALID' using errcode = '22023';
    end if;
  end if;

  if v_phone_contact is null and v_email_contact is null then
    insert into public.contacts (display_name, status)
    values (trim(p_submitted_name), 'active')
    returning id into v_contact_id;

    if v_phone is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  else
    v_contact_id := coalesce(v_phone_contact, v_email_contact);

    if v_phone is not null and v_phone_contact is null then
      if exists (
        select 1 from public.contact_channels ch
        where ch.channel_type = 'phone' and ch.status = 'active' and ch.address_normalized = v_phone
      ) then
        raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
      end if;
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null and v_email_contact is null then
      if exists (
        select 1 from public.contact_channels ch
        where ch.channel_type = 'email' and ch.status = 'active' and ch.address_normalized = v_email
      ) then
        raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
      end if;
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  end if;

  v_final_status := case when v_final_assignee is null then 'new' else 'assigned' end;

  insert into public.leads (
    contact_id,
    submitted_name,
    submitted_email,
    status,
    source,
    service_code,
    property_code,
    timeline_code,
    room_codes,
    budget_comfort_code,
    locality,
    message,
    primary_source_id,
    entry_method,
    assigned_to,
    planner_version,
    landing_path,
    attribution
  ) values (
    v_contact_id,
    trim(p_submitted_name),
    v_email,
    v_final_status,
    'manual-crm',
    p_service_code,
    p_property_code,
    p_timeline_code,
    v_rooms,
    p_budget_comfort_code,
    private.crm_normalize_locality(p_locality),
    nullif(trim(coalesce(p_message, '')), ''),
    p_primary_source_id,
    'manual',
    v_final_assignee,
    null,
    null,
    '{}'::jsonb
  )
  returning * into v_lead;

  if v_source_detail is not null then
    update public.lead_source_touchpoints t
    set source_detail = v_source_detail
    where t.lead_id = v_lead.id
      and t.touchpoint_kind = 'first';
  end if;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    v_lead.id,
    'lead.created',
    v_actor,
    'staff',
    jsonb_strip_nulls(jsonb_build_object(
      'entryMethod', 'manual',
      'reusedContact', (v_phone_contact is not null or v_email_contact is not null),
      'duplicateOverride', coalesce(p_duplicate_override, false),
      'matchedLeadId', v_dup.existing_lead_id,
      'assignmentState', v_final_status
    ))
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_lead.id,
    'lead.manual_created',
    v_lead.id,
    v_actor,
    'Manual CRM lead created',
    jsonb_strip_nulls(jsonb_build_object(
      'entryMethod', 'manual',
      'reusedContact', (v_phone_contact is not null or v_email_contact is not null),
      'duplicateOverride', coalesce(p_duplicate_override, false)
    ))
  );

  if v_final_assignee is not null then
    v_method := private.crm_derive_human_assignment_method();
    insert into public.lead_assignment_history (
      lead_id, previous_assignee, new_assignee, assignment_method, actor_id, reason
    ) values (
      v_lead.id, null, v_final_assignee, v_method, v_actor,
      case when coalesce(p_duplicate_override, false) then v_override_reason else null end
    )
    returning id into v_history_id;

    insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
    values (
      v_lead.id,
      'lead.assigned',
      v_actor,
      'staff',
      jsonb_build_object('assigneeId', v_final_assignee, 'method', v_method, 'onCreate', true)
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_lead.id,
      'assignment.changed',
      v_history_id,
      v_actor,
      'Lead assigned',
      jsonb_build_object('newAssignee', v_final_assignee, 'method', v_method, 'onCreate', true)
    );
  end if;

  if coalesce(p_duplicate_override, false) then
    insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
    values (
      v_lead.id,
      'lead.duplicate_detected',
      v_actor,
      'staff',
      jsonb_strip_nulls(jsonb_build_object(
        'override', true,
        'reason', v_override_reason,
        'matchedLeadId', v_dup.existing_lead_id
      ))
    );
  end if;

  return v_lead;
end;
$$;
