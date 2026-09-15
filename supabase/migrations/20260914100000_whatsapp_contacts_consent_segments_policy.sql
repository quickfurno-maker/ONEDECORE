-- =============================================================================
-- ONEDECORE WM-3 ? Contacts, MARKETING consent/preferences, opt-out, segments,
-- and versioned WhatsApp marketing send policy.
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active) values
  ('whatsapp.contacts.read','Read WhatsApp Contacts','Read the global WhatsApp contact/compliance workspace',true,true),
  ('whatsapp.opt_out.record','Record WhatsApp Opt-out','Record a restrictive customer marketing opt-out; never grants consent',true,true),
  ('whatsapp.segments.read','Read WhatsApp Segments','Read saved WhatsApp audience segments and preview counts',true,true),
  ('whatsapp.segments.manage','Manage WhatsApp Segments','Create and edit allowlisted WhatsApp audience segments',true,true),
  ('whatsapp.settings.read','Read WhatsApp Settings','Read WhatsApp marketing send policy and compliance settings',true,true),
  ('whatsapp.settings.manage','Manage WhatsApp Settings','Manage versioned WhatsApp frequency, quiet-hours and execution gate policy',true,true)
on conflict (code) do update set name=excluded.name, description=excluded.description, is_system=true, is_active=true;

insert into public.role_permissions (role_id, permission_id)
select r.id,p.id from (values
  ('super_admin','whatsapp.contacts.read'),
  ('super_admin','whatsapp.opt_out.record'),
  ('super_admin','whatsapp.segments.read'),
  ('super_admin','whatsapp.segments.manage'),
  ('super_admin','whatsapp.settings.read'),
  ('super_admin','whatsapp.settings.manage'),
  ('sales_manager','whatsapp.contacts.read'),
  ('sales_manager','whatsapp.opt_out.record'),
  ('sales_manager','whatsapp.segments.read'),
  ('sales_manager','whatsapp.segments.manage'),
  ('sales_manager','whatsapp.settings.read'),
  ('sales_executive','whatsapp.opt_out.record')
) v(role_code,permission_code)
join public.roles r on r.code=v.role_code and r.is_system=true
join public.permissions p on p.code=v.permission_code and p.is_system=true
on conflict (role_id,permission_id) do nothing;

create table public.whatsapp_marketing_preference_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  category text not null,
  event_type text not null,
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_pref_category check (category in ('design_inspiration','offers','project_updates','referral','educational_content')),
  constraint chk_whatsapp_pref_event check (event_type in ('allowed','opted_out')),
  constraint chk_whatsapp_pref_source check (length(source) between 1 and 64),
  constraint chk_whatsapp_pref_evidence check (jsonb_typeof(evidence)='object' and pg_column_size(evidence)<=2048)
);
create index idx_whatsapp_pref_contact_category_time on public.whatsapp_marketing_preference_events(contact_id,category,occurred_at desc,id desc);

create table public.whatsapp_marketing_send_policies (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  execution_enabled boolean not null default false,
  frequency_rules jsonb not null,
  quiet_hours jsonb not null,
  timezone text not null default 'Asia/Kolkata',
  effective_from timestamptz not null default clock_timestamp(),
  set_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_policy_version check (version>=1),
  constraint chk_whatsapp_policy_frequency check (jsonb_typeof(frequency_rules)='array' and jsonb_array_length(frequency_rules) between 1 and 8 and pg_column_size(frequency_rules)<=2048),
  constraint chk_whatsapp_policy_quiet check (jsonb_typeof(quiet_hours)='object' and pg_column_size(quiet_hours)<=1024),
  constraint chk_whatsapp_policy_timezone check (length(timezone) between 1 and 80)
);
create index idx_whatsapp_policy_effective on public.whatsapp_marketing_send_policies(effective_from desc,version desc);

create table public.whatsapp_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rule_group jsonb not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_segments_name check (length(trim(name)) between 2 and 120),
  constraint chk_whatsapp_segments_description check (description is null or length(description)<=500),
  constraint chk_whatsapp_segments_rules check (jsonb_typeof(rule_group)='object' and pg_column_size(rule_group)<=8192)
);
create unique index uq_whatsapp_segments_name_active on public.whatsapp_segments(lower(name)) where is_active=true;

create or replace function private.whatsapp_wm_append_only_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'WHATSAPP_APPEND_ONLY';
end;$$;
revoke all on function private.whatsapp_wm_append_only_guard() from public,anon,authenticated;

create trigger trg_whatsapp_pref_no_update before update on public.whatsapp_marketing_preference_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_pref_no_delete before delete on public.whatsapp_marketing_preference_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_policy_no_update before update on public.whatsapp_marketing_send_policies for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_policy_no_delete before delete on public.whatsapp_marketing_send_policies for each row execute function private.whatsapp_wm_append_only_guard();

create or replace function private.whatsapp_segment_rule_group_valid(p_rules jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb; f text; op text; v jsonb; n integer:=0;
begin
  if jsonb_typeof(p_rules)<>'object' or jsonb_typeof(p_rules->'rules')<>'array' then return false; end if;
  n:=jsonb_array_length(p_rules->'rules');
  if n<1 or n>20 then return false; end if;
  for r in select value from jsonb_array_elements(p_rules->'rules') loop
    if jsonb_typeof(r)<>'object' then return false; end if;
    f:=r->>'field'; op:=r->>'op'; v:=r->'value';
    if f not in ('lead_stage','service_interest','property_code','locality','budget_range','assigned_to','sales_temperature','source','received_date') then return false; end if;
    if op not in ('equals','not_equals','in','not_in') then return false; end if;
    if op in ('in','not_in') then
      if jsonb_typeof(v)<>'array' or jsonb_array_length(v)<1 or jsonb_array_length(v)>50 then return false; end if;
    else
      if jsonb_typeof(v) not in ('string','number','boolean') then return false; end if;
    end if;
  end loop;
  return true;
end;$$;
revoke all on function private.whatsapp_segment_rule_group_valid(jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_contact_matches_segment(p_contact_id uuid,p_rules jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r jsonb; f text; op text; vals text[]; actual text; matched boolean; l record;
begin
  if not private.whatsapp_segment_rule_group_valid(p_rules) then return false; end if;
  select * into l from public.leads where contact_id=p_contact_id and deleted_at is null order by created_at desc,id desc limit 1;
  if not found then return false; end if;
  for r in select value from jsonb_array_elements(p_rules->'rules') loop
    f:=r->>'field'; op:=r->>'op';
    actual:=case f
      when 'lead_stage' then l.status
      when 'service_interest' then l.service_code
      when 'property_code' then l.property_code
      when 'locality' then coalesce(l.locality,'')
      when 'budget_range' then coalesce(l.budget_comfort_code,'')
      when 'assigned_to' then coalesce(l.assigned_to::text,'')
      when 'sales_temperature' then coalesce(l.manual_sales_temperature,'')
      when 'source' then coalesce(l.source,'')
      when 'received_date' then to_char(l.created_at at time zone 'Asia/Kolkata','YYYY-MM-DD')
      else '' end;
    if op in ('in','not_in') then
      select array_agg(value#>>'{}') into vals from jsonb_array_elements(r->'value');
      matched:=actual=any(coalesce(vals,array[]::text[]));
      if op='not_in' then matched:=not matched; end if;
    else
      matched:=actual=(r->'value'#>>'{}');
      if op='not_equals' then matched:=not matched; end if;
    end if;
    if not matched then return false; end if;
  end loop;
  return true;
end;$$;
revoke all on function private.whatsapp_contact_matches_segment(uuid,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_latest_marketing_consent(p_contact_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select ce.event_type from public.consent_events ce where ce.contact_id=p_contact_id and ce.purpose_code='MARKETING' order by ce.occurred_at desc,ce.created_at desc,ce.id desc limit 1;
$$;
revoke all on function private.whatsapp_latest_marketing_consent(uuid) from public,anon,authenticated;

create or replace function private.whatsapp_preference_opted_out(p_contact_id uuid,p_category text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select e.event_type='opted_out' from public.whatsapp_marketing_preference_events e where e.contact_id=p_contact_id and e.category=p_category order by e.occurred_at desc,e.id desc limit 1),false);
$$;
revoke all on function private.whatsapp_preference_opted_out(uuid,text) from public,anon,authenticated;

alter table public.whatsapp_marketing_preference_events enable row level security;
alter table public.whatsapp_marketing_preference_events force row level security;
alter table public.whatsapp_marketing_send_policies enable row level security;
alter table public.whatsapp_marketing_send_policies force row level security;
alter table public.whatsapp_segments enable row level security;
alter table public.whatsapp_segments force row level security;

revoke all on table public.whatsapp_marketing_preference_events from public,anon,authenticated;
revoke all on table public.whatsapp_marketing_send_policies from public,anon,authenticated;
revoke all on table public.whatsapp_segments from public,anon,authenticated;
grant select on public.whatsapp_marketing_preference_events to authenticated,service_role;
grant select on public.whatsapp_marketing_send_policies to authenticated,service_role;
grant select on public.whatsapp_segments to authenticated,service_role;

create policy whatsapp_pref_read on public.whatsapp_marketing_preference_events for select to authenticated using (private.has_permission('whatsapp.contacts.read'));
create policy whatsapp_policy_read on public.whatsapp_marketing_send_policies for select to authenticated using (private.has_permission('whatsapp.settings.read'));
create policy whatsapp_segments_read on public.whatsapp_segments for select to authenticated using (private.has_permission('whatsapp.segments.read'));

create or replace function public.list_whatsapp_contacts(p_search text default null,p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_search text:=nullif(trim(coalesce(p_search,'')),''); v_page integer:=greatest(1,least(coalesce(p_page,1),10000)); v_size integer:=greatest(1,least(coalesce(p_page_size,25),50));
begin
  if not private.has_permission('whatsapp.contacts.read') then raise exception 'WHATSAPP_CONTACTS_DENIED' using errcode='42501'; end if;
  return jsonb_build_object('total_count',(select count(*) from public.contacts c where (v_search is null or c.display_name ilike '%'||replace(replace(v_search,'%','\%'),'_','\_')||'%' escape '\' or exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.address_normalized ilike '%'||v_search||'%'))),
  'items',coalesce((select jsonb_agg(x order by (x->>'display_name')) from (
    select jsonb_build_object(
      'contact_id',c.id,'display_name',c.display_name,'contact_status',c.status,
      'whatsapp_e164',(select ch.address_normalized from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' order by (ch.status='active') desc,ch.is_primary desc,ch.created_at desc limit 1),
      'whatsapp_channel_status',(select ch.status from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' order by (ch.status='active') desc,ch.is_primary desc,ch.created_at desc limit 1),
      'marketing_consent',private.whatsapp_latest_marketing_consent(c.id),
      'lead_id',(select l.id from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1),
      'lead_stage',(select l.status from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1),
      'locality',(select l.locality from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1)
    ) x from public.contacts c
    where (v_search is null or c.display_name ilike '%'||v_search||'%' or exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.address_normalized ilike '%'||v_search||'%'))
    order by c.display_name,c.id offset (v_page-1)*v_size limit v_size
  ) q),'[]'::jsonb));
end;$$;

create or replace function public.save_whatsapp_segment(p_segment_id uuid,p_name text,p_description text,p_rule_group jsonb,p_active boolean default true)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not private.has_permission('whatsapp.segments.manage') then raise exception 'WHATSAPP_SEGMENTS_DENIED' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 120 or not private.whatsapp_segment_rule_group_valid(p_rule_group) then raise exception 'WHATSAPP_SEGMENT_VALIDATION' using errcode='22023'; end if;
  if p_segment_id is null then
    insert into public.whatsapp_segments(name,description,rule_group,is_active,created_by,updated_by) values(trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_rule_group,coalesce(p_active,true),v_actor,v_actor) returning id into v_id;
  else
    update public.whatsapp_segments set name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),rule_group=p_rule_group,is_active=coalesce(p_active,true),updated_by=v_actor,updated_at=now() where id=p_segment_id returning id into v_id;
    if v_id is null then raise exception 'WHATSAPP_SEGMENT_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  return jsonb_build_object('segment_id',v_id);
end;$$;

create or replace function public.preview_whatsapp_segment(p_segment_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rules jsonb;
begin
  if not private.has_permission('whatsapp.segments.read') then raise exception 'WHATSAPP_SEGMENTS_DENIED' using errcode='42501'; end if;
  select rule_group into v_rules from public.whatsapp_segments where id=p_segment_id and is_active=true;
  if v_rules is null then raise exception 'WHATSAPP_SEGMENT_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object(
    'total_matched',(select count(*) from public.contacts c where private.whatsapp_contact_matches_segment(c.id,v_rules)),
    'eligible',(select count(*) from public.contacts c where private.whatsapp_contact_matches_segment(c.id,v_rules) and c.status='active' and private.whatsapp_latest_marketing_consent(c.id)='granted' and exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.status='active')),
    'do_not_contact',(select count(*) from public.contacts c where private.whatsapp_contact_matches_segment(c.id,v_rules) and c.status='do_not_contact'),
    'no_marketing_consent',(select count(*) from public.contacts c where private.whatsapp_contact_matches_segment(c.id,v_rules) and coalesce(private.whatsapp_latest_marketing_consent(c.id),'')<>'granted'),
    'missing_whatsapp',(select count(*) from public.contacts c where private.whatsapp_contact_matches_segment(c.id,v_rules) and not exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.status='active'))
  );
end;$$;

create or replace function public.record_whatsapp_marketing_preference(p_contact_id uuid,p_category text,p_event_type text,p_source text default 'staff')
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not private.has_permission('marketing_consents.manage') then raise exception 'WHATSAPP_PREFERENCE_DENIED' using errcode='42501'; end if;
  if p_category not in ('design_inspiration','offers','project_updates','referral','educational_content') or p_event_type not in ('allowed','opted_out') then raise exception 'WHATSAPP_PREFERENCE_VALIDATION' using errcode='22023'; end if;
  insert into public.whatsapp_marketing_preference_events(contact_id,category,event_type,source,actor_id) values(p_contact_id,p_category,p_event_type,left(coalesce(nullif(trim(p_source),''),'staff'),64),v_actor) returning id into v_id;
  return jsonb_build_object('preference_event_id',v_id);
end;$$;

create or replace function public.record_whatsapp_customer_opt_out(p_contact_id uuid,p_conversation_id uuid default null,p_message_id uuid default null,p_source text default 'staff')
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_event uuid; v_allowed boolean:=false;
begin
  if v_actor is null or not private.has_permission('whatsapp.opt_out.record') then raise exception 'WHATSAPP_OPT_OUT_DENIED' using errcode='42501'; end if;
  if private.has_role('super_admin') or private.has_role('sales_manager') then v_allowed:=true;
  elsif p_conversation_id is not null and exists(select 1 from public.whatsapp_conversations c where c.id=p_conversation_id and c.contact_id=p_contact_id and private.whatsapp_inbox_actor_can_use_conversation(v_actor,c.id)) then v_allowed:=true; end if;
  if not v_allowed then raise exception 'WHATSAPP_OPT_OUT_DENIED' using errcode='42501'; end if;
  if private.whatsapp_latest_marketing_consent(p_contact_id)='withdrawn' then return jsonb_build_object('outcome','already_withdrawn'); end if;
  insert into public.consent_events(contact_id,purpose_code,channel,event_type,copy_version,notice_version,source,locale,actor_type,occurred_at,evidence)
  values(p_contact_id,'MARKETING','whatsapp','withdrawn','customer-opt-out-v1','customer-opt-out-v1','whatsapp_customer_opt_out','en-IN','staff',clock_timestamp(),jsonb_strip_nulls(jsonb_build_object('recorder_profile_id',v_actor,'conversation_id',p_conversation_id,'message_id',p_message_id,'source',left(coalesce(p_source,'staff'),64)))) returning id into v_event;
  return jsonb_build_object('outcome','withdrawn','consent_event_id',v_event);
end;$$;

create or replace function public.record_whatsapp_inbound_opt_out(p_message_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m record; v_text text; v_contact uuid; v_event uuid;
begin
  if auth.role()<>'service_role' then raise exception 'WHATSAPP_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select wm.*,wc.contact_id into m from public.whatsapp_messages wm join public.whatsapp_conversations wc on wc.id=wm.conversation_id where wm.id=p_message_id and wm.direction='inbound';
  if not found or m.contact_id is null or m.body_text is null then return jsonb_build_object('outcome','not_applicable'); end if;
  v_text:=lower(regexp_replace(trim(m.body_text),'[[:space:]]+',' ','g'));
  v_text:=regexp_replace(v_text,'^[[:punct:][:space:]]+|[[:punct:][:space:]]+$','','g');
  if length(m.body_text)>40 or v_text not in ('stop','unsubscribe','remove me','no marketing','stop marketing','opt out','optout') then return jsonb_build_object('outcome','not_opt_out'); end if;
  v_contact:=m.contact_id;
  if private.whatsapp_latest_marketing_consent(v_contact)='withdrawn' then return jsonb_build_object('outcome','already_withdrawn'); end if;
  insert into public.consent_events(contact_id,purpose_code,channel,event_type,copy_version,notice_version,source,locale,actor_type,occurred_at,evidence)
  values(v_contact,'MARKETING','whatsapp','withdrawn','customer-opt-out-v1','customer-opt-out-v1','whatsapp_inbound_message','en-IN','system',m.provider_timestamp,jsonb_build_object('message_id',m.id,'provider_message_id',m.provider_message_id)) returning id into v_event;
  return jsonb_build_object('outcome','withdrawn','consent_event_id',v_event);
end;$$;

create or replace function public.set_whatsapp_marketing_send_policy(p_frequency_rules jsonb,p_quiet_hours jsonb,p_timezone text default 'Asia/Kolkata',p_execution_enabled boolean default false)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_version integer; v_id uuid; r jsonb; start_t text; end_t text;
begin
  if v_actor is null or not private.has_permission('whatsapp.settings.manage') or not private.has_role('super_admin') then raise exception 'WHATSAPP_SETTINGS_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_frequency_rules)<>'array' or jsonb_array_length(p_frequency_rules) not between 1 and 8 then raise exception 'WHATSAPP_POLICY_VALIDATION' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(p_frequency_rules) loop
    if jsonb_typeof(r)<>'object' or coalesce((r->>'windowHours')::integer,0) not between 1 and 2160 or coalesce((r->>'maxMessages')::integer,0) not between 1 and 100 then raise exception 'WHATSAPP_POLICY_VALIDATION' using errcode='22023'; end if;
  end loop;
  start_t:=p_quiet_hours->>'startLocal'; end_t:=p_quiet_hours->>'endLocal';
  if start_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or end_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or start_t=end_t then raise exception 'WHATSAPP_POLICY_VALIDATION' using errcode='22023'; end if;
  select coalesce(max(version),0)+1 into v_version from public.whatsapp_marketing_send_policies;
  insert into public.whatsapp_marketing_send_policies(version,execution_enabled,frequency_rules,quiet_hours,timezone,set_by) values(v_version,coalesce(p_execution_enabled,false),p_frequency_rules,p_quiet_hours,coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'),v_actor) returning id into v_id;
  return jsonb_build_object('policy_id',v_id,'version',v_version);
end;$$;

create or replace function public.get_whatsapp_marketing_send_policy()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p record;
begin
  if not private.has_permission('whatsapp.settings.read') then raise exception 'WHATSAPP_SETTINGS_DENIED' using errcode='42501'; end if;
  select * into p from public.whatsapp_marketing_send_policies where effective_from<=now() order by effective_from desc,version desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id',p.id,'version',p.version,'execution_enabled',p.execution_enabled,'frequency_rules',p.frequency_rules,'quiet_hours',p.quiet_hours,'timezone',p.timezone,'effective_from',p.effective_from);
end;$$;

revoke all on function public.list_whatsapp_contacts(text,integer,integer) from public,anon;
revoke all on function public.save_whatsapp_segment(uuid,text,text,jsonb,boolean) from public,anon;
revoke all on function public.preview_whatsapp_segment(uuid) from public,anon;
revoke all on function public.record_whatsapp_marketing_preference(uuid,text,text,text) from public,anon;
revoke all on function public.record_whatsapp_customer_opt_out(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.set_whatsapp_marketing_send_policy(jsonb,jsonb,text,boolean) from public,anon;
revoke all on function public.get_whatsapp_marketing_send_policy() from public,anon;
grant execute on function public.list_whatsapp_contacts(text,integer,integer) to authenticated;
grant execute on function public.save_whatsapp_segment(uuid,text,text,jsonb,boolean) to authenticated;
grant execute on function public.preview_whatsapp_segment(uuid) to authenticated;
grant execute on function public.record_whatsapp_marketing_preference(uuid,text,text,text) to authenticated;
grant execute on function public.record_whatsapp_customer_opt_out(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.set_whatsapp_marketing_send_policy(jsonb,jsonb,text,boolean) to authenticated;
grant execute on function public.get_whatsapp_marketing_send_policy() to authenticated;
revoke all on function public.record_whatsapp_inbound_opt_out(uuid) from public,anon,authenticated;
grant execute on function public.record_whatsapp_inbound_opt_out(uuid) to service_role;
