-- P3 — Meta-independent ONEDECORE template drafts and richer Template Studio reads.
-- Local drafts are a separate human-owned authority. They never create or
-- mutate provider registry rows and never imply Meta approval.

create table public.whatsapp_template_drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  language text not null,
  category text not null,
  parameter_format text not null default 'POSITIONAL',
  components jsonb not null default '[]'::jsonb,
  workflow_status text not null default 'local_draft',
  source_preset_id text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_template_drafts_name check (name ~ '^[a-z0-9_]{1,128}$'),
  constraint chk_whatsapp_template_drafts_language check (language ~ '^[a-z]{2,3}(_[A-Z]{2})?$'),
  constraint chk_whatsapp_template_drafts_category check (category in ('UTILITY','MARKETING')),
  constraint chk_whatsapp_template_drafts_parameter_format check (parameter_format = 'POSITIONAL'),
  constraint chk_whatsapp_template_drafts_components check (
    jsonb_typeof(components) = 'array'
    and jsonb_array_length(components) between 1 and 4
    and pg_column_size(components) <= 16384
  ),
  constraint chk_whatsapp_template_drafts_workflow check (
    workflow_status in ('local_draft','locally_reviewed','archived')
  ),
  constraint chk_whatsapp_template_drafts_preset check (
    source_preset_id is null or length(source_preset_id) between 1 and 96
  ),
  constraint chk_whatsapp_template_drafts_lock check (lock_version >= 1)
);

create unique index uq_whatsapp_template_drafts_live_name_language
  on public.whatsapp_template_drafts(name, language)
  where workflow_status <> 'archived';
create index idx_whatsapp_template_drafts_status_updated
  on public.whatsapp_template_drafts(workflow_status, updated_at desc);
create index idx_whatsapp_template_drafts_category_language
  on public.whatsapp_template_drafts(category, language, updated_at desc);

comment on table public.whatsapp_template_drafts is
  'P3 ONEDECORE-owned local template workspace. Editable draft/review state only; never provider approval truth.';

create table public.whatsapp_template_draft_events (
  id bigserial primary key,
  draft_id uuid not null references public.whatsapp_template_drafts(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  lock_version integer not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint chk_whatsapp_template_draft_events_type check (
    event_type in ('created','updated','reviewed','reopened','archived')
  ),
  constraint chk_whatsapp_template_draft_events_status check (
    (from_status is null or from_status in ('local_draft','locally_reviewed','archived'))
    and (to_status is null or to_status in ('local_draft','locally_reviewed','archived'))
  ),
  constraint chk_whatsapp_template_draft_events_details check (
    jsonb_typeof(details)='object' and pg_column_size(details) <= 2048
  )
);
create index idx_whatsapp_template_draft_events_draft_time
  on public.whatsapp_template_draft_events(draft_id, occurred_at desc);

alter table public.whatsapp_template_drafts enable row level security;
alter table public.whatsapp_template_draft_events enable row level security;

revoke all on public.whatsapp_template_drafts from public, anon;
revoke all on public.whatsapp_template_draft_events from public, anon;
grant select, insert, update on public.whatsapp_template_drafts to authenticated;
grant select on public.whatsapp_template_draft_events to authenticated;

create policy whatsapp_template_drafts_read
on public.whatsapp_template_drafts
for select to authenticated
using ((select public.authorize('whatsapp.templates.read')));

create policy whatsapp_template_drafts_insert
on public.whatsapp_template_drafts
for insert to authenticated
with check (
  (select public.authorize('whatsapp.templates.manage'))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy whatsapp_template_drafts_update
on public.whatsapp_template_drafts
for update to authenticated
using ((select public.authorize('whatsapp.templates.manage')))
with check (
  (select public.authorize('whatsapp.templates.manage'))
  and updated_by = (select auth.uid())
);

create policy whatsapp_template_draft_events_read
on public.whatsapp_template_draft_events
for select to authenticated
using ((select public.authorize('whatsapp.templates.read')));

create or replace function private.whatsapp_template_draft_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not (select public.authorize('whatsapp.templates.manage')) then
    raise exception 'denied_templates_manage' using errcode='42501';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.lock_version := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.lock_version := old.lock_version + 1;
  end if;
  return new;
end;
$$;
revoke all on function private.whatsapp_template_draft_before_write() from public, anon, authenticated;

create or replace function private.whatsapp_template_draft_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if tg_op = 'INSERT' then
    v_event := 'created';
  elsif new.workflow_status = 'archived' and old.workflow_status <> 'archived' then
    v_event := 'archived';
  elsif new.workflow_status = 'locally_reviewed' and old.workflow_status <> 'locally_reviewed' then
    v_event := 'reviewed';
  elsif new.workflow_status = 'local_draft' and old.workflow_status = 'locally_reviewed' then
    v_event := 'reopened';
  else
    v_event := 'updated';
  end if;

  insert into public.whatsapp_template_draft_events(
    draft_id, actor_id, event_type, from_status, to_status, lock_version, details
  ) values (
    new.id,
    new.updated_by,
    v_event,
    case when tg_op='INSERT' then null else old.workflow_status end,
    new.workflow_status,
    new.lock_version,
    jsonb_build_object('name', new.name, 'language', new.language, 'category', new.category)
  );
  return new;
end;
$$;
revoke all on function private.whatsapp_template_draft_audit() from public, anon, authenticated;

create trigger trg_whatsapp_template_drafts_before_write
before insert or update on public.whatsapp_template_drafts
for each row execute function private.whatsapp_template_draft_before_write();

create trigger trg_whatsapp_template_drafts_audit
after insert or update on public.whatsapp_template_drafts
for each row execute function private.whatsapp_template_draft_audit();

create trigger trg_whatsapp_template_draft_events_no_update
before update on public.whatsapp_template_draft_events
for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_draft_events_no_delete
before delete on public.whatsapp_template_draft_events
for each row execute function private.forbid_append_only_mutation();

-- Provider submission validation is broader than the one-to-one inbox lane.
-- The inbox lane continues using whatsapp_template_staff_send_problem and
-- therefore remains fail-closed for media headers and Flow buttons.
create or replace function private.whatsapp_template_submission_problem(
  p_category text,
  p_parameter_format text,
  p_components jsonb
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_component jsonb;
  v_button jsonb;
  v_type text;
  v_format text;
  v_seen text[] := array[]::text[];
begin
  if p_category is null or p_category not in ('UTILITY','MARKETING') then
    return 'category_not_submittable';
  end if;
  if p_parameter_format is distinct from 'POSITIONAL' then
    return 'parameter_format_invalid';
  end if;
  if p_components is null
     or jsonb_typeof(p_components) <> 'array'
     or jsonb_array_length(p_components) not between 1 and 4
     or pg_column_size(p_components) > 16384 then
    return 'components_invalid';
  end if;

  for v_component in select value from jsonb_array_elements(p_components) loop
    if jsonb_typeof(v_component) <> 'object' then return 'components_invalid'; end if;
    v_type := upper(coalesce(v_component->>'type',''));
    if v_type = any(v_seen) then return 'component_repeated'; end if;
    v_seen := v_seen || v_type;

    if v_type = 'HEADER' then
      v_format := upper(coalesce(v_component->>'format',''));
      if v_format = 'TEXT' then
        if length(coalesce(v_component->>'text','')) not between 1 and 60 then return 'header_invalid'; end if;
      elsif v_format in ('IMAGE','VIDEO','DOCUMENT') then
        if v_component ? 'text' then return 'header_invalid'; end if;
        if jsonb_typeof(v_component->'example') <> 'object'
           or jsonb_typeof(v_component->'example'->'header_handle') <> 'array'
           or jsonb_array_length(v_component->'example'->'header_handle') <> 1
           or length(coalesce(v_component->'example'->'header_handle'->>0,'')) not between 1 and 2048 then
          return 'header_media_example_missing';
        end if;
      elsif v_format = 'LOCATION' then
        if v_component ? 'text' or v_component ? 'example' then return 'header_invalid'; end if;
      else
        return 'header_invalid';
      end if;
    elsif v_type = 'BODY' then
      if length(coalesce(v_component->>'text','')) not between 1 and 1024 then return 'body_invalid'; end if;
    elsif v_type = 'FOOTER' then
      if length(coalesce(v_component->>'text','')) not between 1 and 60
         or (v_component->>'text') ~ '\{\{' then return 'footer_invalid'; end if;
    elsif v_type = 'BUTTONS' then
      if jsonb_typeof(v_component->'buttons') <> 'array'
         or jsonb_array_length(v_component->'buttons') not between 1 and 10 then
        return 'buttons_invalid';
      end if;
      for v_button in select value from jsonb_array_elements(v_component->'buttons') loop
        if jsonb_typeof(v_button) <> 'object'
           or length(coalesce(v_button->>'text','')) not between 1 and 25 then
          return 'buttons_invalid';
        end if;
        case upper(coalesce(v_button->>'type',''))
          when 'QUICK_REPLY' then null;
          when 'URL' then
            if coalesce(v_button->>'url','') !~ '^https://[^\s{}]{4,1990}$' then return 'button_url_invalid'; end if;
          when 'PHONE_NUMBER' then
            if coalesce(v_button->>'phone_number','') !~ '^\+[1-9]\d{1,14}$' then return 'button_phone_invalid'; end if;
          when 'FLOW' then
            if length(coalesce(v_button->>'flow_id','')) not between 1 and 128 then return 'button_flow_invalid'; end if;
            if coalesce(v_button->>'flow_action','navigate') <> 'navigate' then return 'button_flow_invalid'; end if;
            if length(coalesce(v_button->>'navigate_screen','')) not between 1 and 128 then return 'button_flow_invalid'; end if;
          else return 'button_type_unsupported';
        end case;
      end loop;
    else
      return 'component_unsupported';
    end if;
  end loop;

  if not ('BODY' = any(v_seen)) then return 'body_invalid'; end if;
  return null;
end;
$$;
revoke all on function private.whatsapp_template_submission_problem(text,text,jsonb) from public, anon, authenticated;

-- Save/update through a session RPC. The table trigger owns actor/timestamps.
create or replace function public.save_whatsapp_template_draft(
  p_name text,
  p_language text,
  p_category text,
  p_components jsonb,
  p_workflow_status text,
  p_draft_id uuid default null,
  p_expected_lock_version integer default null,
  p_source_preset_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.whatsapp_template_drafts%rowtype;
  v_problem text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not (select public.authorize('whatsapp.templates.manage')) then
    raise exception 'denied_templates_manage' using errcode='42501';
  end if;
  if p_name is null or p_name !~ '^[a-z0-9_]{1,128}$' then raise exception 'validation: name' using errcode='22023'; end if;
  if p_language is null or p_language !~ '^[a-z]{2,3}(_[A-Z]{2})?$' then raise exception 'validation: language' using errcode='22023'; end if;
  if p_category not in ('UTILITY','MARKETING') then raise exception 'validation: category' using errcode='22023'; end if;
  if p_workflow_status not in ('local_draft','locally_reviewed') then raise exception 'validation: workflow_status' using errcode='22023'; end if;
  if p_source_preset_id is not null and length(p_source_preset_id) not between 1 and 96 then raise exception 'validation: preset' using errcode='22023'; end if;

  v_problem := private.whatsapp_template_submission_problem(p_category, 'POSITIONAL', p_components);
  if v_problem is not null and v_problem <> 'header_media_example_missing' then
    raise exception 'validation: components (%)', v_problem using errcode='22023';
  end if;
  -- Media headers may be reviewed locally before Meta provides an upload handle.
  -- request_whatsapp_template_submission still calls the strict validator above.

  if p_draft_id is null then
    insert into public.whatsapp_template_drafts(
      name, language, category, parameter_format, components, workflow_status,
      source_preset_id, created_by, updated_by
    ) values (
      p_name, p_language, p_category, 'POSITIONAL', p_components,
      p_workflow_status, nullif(trim(coalesce(p_source_preset_id,'')),''),
      auth.uid(), auth.uid()
    ) returning * into v_row;
  else
    if p_expected_lock_version is null then raise exception 'validation: lock_version' using errcode='22023'; end if;
    update public.whatsapp_template_drafts
    set name=p_name,
        language=p_language,
        category=p_category,
        components=p_components,
        workflow_status=p_workflow_status,
        source_preset_id=nullif(trim(coalesce(p_source_preset_id,'')),''),
        updated_by=auth.uid()
    where id=p_draft_id
      and lock_version=p_expected_lock_version
      and workflow_status <> 'archived'
    returning * into v_row;
    if not found then raise exception 'draft_conflict_or_missing' using errcode='40001'; end if;
  end if;

  return jsonb_build_object(
    'id',v_row.id,'name',v_row.name,'language',v_row.language,'category',v_row.category,
    'workflow_status',v_row.workflow_status,'source_preset_id',v_row.source_preset_id,
    'lock_version',v_row.lock_version,'created_at',v_row.created_at,'updated_at',v_row.updated_at
  );
end;
$$;
revoke all on function public.save_whatsapp_template_draft(text,text,text,jsonb,text,uuid,integer,text) from public, anon;
grant execute on function public.save_whatsapp_template_draft(text,text,text,jsonb,text,uuid,integer,text) to authenticated;

create or replace function public.archive_whatsapp_template_draft(
  p_draft_id uuid,
  p_expected_lock_version integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not (select public.authorize('whatsapp.templates.manage')) then
    raise exception 'denied_templates_manage' using errcode='42501';
  end if;
  update public.whatsapp_template_drafts
  set workflow_status='archived', updated_by=auth.uid()
  where id=p_draft_id
    and lock_version=p_expected_lock_version
    and workflow_status <> 'archived';
  if not found then raise exception 'draft_conflict_or_missing' using errcode='40001'; end if;
  return true;
end;
$$;
revoke all on function public.archive_whatsapp_template_draft(uuid,integer) from public, anon;
grant execute on function public.archive_whatsapp_template_draft(uuid,integer) to authenticated;

create or replace function public.get_whatsapp_template_draft(p_draft_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when d.id is null then null else jsonb_build_object(
    'id',d.id,'name',d.name,'language',d.language,'category',d.category,
    'parameter_format',d.parameter_format,'components',d.components,
    'workflow_status',d.workflow_status,'source_preset_id',d.source_preset_id,
    'lock_version',d.lock_version,'created_at',d.created_at,'updated_at',d.updated_at
  ) end
  from public.whatsapp_template_drafts d
  where d.id=p_draft_id;
$$;
revoke all on function public.get_whatsapp_template_draft(uuid) from public, anon;
grant execute on function public.get_whatsapp_template_draft(uuid) to authenticated;

create or replace function public.list_whatsapp_template_drafts(
  p_status text default null,
  p_category text default null,
  p_language text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_search text;
  v_pattern text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not (select public.authorize('whatsapp.templates.read')) then raise exception 'denied_templates_read' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('local_draft','locally_reviewed','archived') then raise exception 'validation: status' using errcode='22023'; end if;
  if p_category is not null and p_category not in ('UTILITY','MARKETING') then raise exception 'validation: category' using errcode='22023'; end if;
  if p_language is not null and p_language !~ '^[a-z]{2,3}(_[A-Z]{2})?$' then raise exception 'validation: language' using errcode='22023'; end if;
  if p_page is null or p_page < 1 or p_page > 10000 then raise exception 'validation: page' using errcode='22023'; end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then raise exception 'validation: page_size' using errcode='22023'; end if;
  v_search := nullif(trim(coalesce(p_search,'')),'');
  if v_search is not null and length(v_search)>128 then raise exception 'validation: search' using errcode='22023'; end if;
  if v_search is not null then v_pattern := '%'||replace(replace(replace(v_search,'\','\\'),'%','\%'),'_','\_')||'%'; end if;

  with filtered as (
    select d.* from public.whatsapp_template_drafts d
    where (p_status is null or d.workflow_status=p_status)
      and (p_category is null or d.category=p_category)
      and (p_language is null or d.language=p_language)
      and (v_pattern is null or d.name ilike v_pattern escape '\')
  ), page_rows as (
    select * from filtered
    order by updated_at desc, name, language, id
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'total_count',(select count(*) from filtered),
    'page',p_page,'page_size',p_page_size,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,'name',d.name,'language',d.language,'category',d.category,
        'parameter_format',d.parameter_format,'components',d.components,
        'workflow_status',d.workflow_status,'source_preset_id',d.source_preset_id,
        'lock_version',d.lock_version,'created_at',d.created_at,'updated_at',d.updated_at
      ) order by d.updated_at desc,d.id)
      from page_rows d
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.list_whatsapp_template_drafts(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.list_whatsapp_template_drafts(text,text,text,text,integer,integer) to authenticated;

-- Add a real language filter without replacing the frozen WM-2 reader.
create or replace function private.list_whatsapp_template_registry_p3_impl(
  p_status text default null,
  p_category text default null,
  p_search text default null,
  p_language text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_pattern text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not (select public.authorize('whatsapp.templates.read')) then raise exception 'denied_templates_read' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED','IN_APPEAL','PENDING_DELETION','DELETED','LIMIT_EXCEEDED','ARCHIVED','unknown') then raise exception 'validation: status' using errcode='22023'; end if;
  if p_category is not null and p_category not in ('MARKETING','UTILITY','AUTHENTICATION','unknown') then raise exception 'validation: category' using errcode='22023'; end if;
  if p_language is not null and length(p_language) > 32 then raise exception 'validation: language' using errcode='22023'; end if;
  if p_page is null or p_page < 1 or p_page > 10000 then raise exception 'validation: page' using errcode='22023'; end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then raise exception 'validation: page_size' using errcode='22023'; end if;
  v_search := nullif(trim(coalesce(p_search,'')),'');
  if v_search is not null and length(v_search)>128 then raise exception 'validation: search' using errcode='22023'; end if;
  if v_search is not null then v_pattern := '%'||replace(replace(replace(v_search,'\','\\'),'%','\%'),'_','\_')||'%'; end if;

  with filtered as (
    select t.* from public.whatsapp_templates t
    where (p_status is null or t.status=p_status)
      and (p_category is null or t.category=p_category)
      and (p_language is null or t.language=p_language)
      and (v_pattern is null or t.name ilike v_pattern escape '\')
  ), page_rows as (
    select * from filtered
    order by name,language,id
    limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'total_count',(select count(*) from filtered),
    'page',p_page,'page_size',p_page_size,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'business_account_id',p.business_account_id,'provider_template_id',p.provider_template_id,
        'name',p.name,'language',p.language,'category',p.category,'raw_category',p.raw_category,
        'status',p.status,'raw_status',p.raw_status,'quality_rating',p.quality_rating,
        'raw_quality_rating',p.raw_quality_rating,'parameter_format',p.parameter_format,'origin',p.origin,
        'rejected_reason',p.rejected_reason,'synced_at',p.synced_at,'updated_at',p.updated_at,
        'body_preview',(select left(c->>'text',280) from jsonb_array_elements(p.components)c where upper(c->>'type')='BODY' limit 1),
        'variable_count',(select count(*) from private.whatsapp_template_variable_keys(p.components)),
        'send_problem',private.whatsapp_template_staff_send_problem(p.components,p.parameter_format),
        'approved_snapshot_id',(select s.id from public.whatsapp_template_snapshots s where s.template_id=p.id and s.content_hash=p.content_hash limit 1),
        'one_to_one_sendable',(
          p.status='APPROVED' and p.category='UTILITY'
          and private.whatsapp_template_staff_send_problem(p.components,p.parameter_format) is null
          and exists(select 1 from public.whatsapp_template_snapshots s where s.template_id=p.id and s.content_hash=p.content_hash)
        )
      ) order by p.name,p.language,p.id)
      from page_rows p
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function private.list_whatsapp_template_registry_p3_impl(text,text,text,text,integer,integer)
  from public, anon;
grant execute on function private.list_whatsapp_template_registry_p3_impl(text,text,text,text,integer,integer)
  to authenticated;

create or replace function public.list_whatsapp_template_registry_p3(
  p_status text default null,
  p_category text default null,
  p_search text default null,
  p_language text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_whatsapp_template_registry_p3_impl(
    p_status, p_category, p_search, p_language, p_page, p_page_size
  );
$$;
revoke all on function public.list_whatsapp_template_registry_p3(text,text,text,text,integer,integer)
  from public, anon;
grant execute on function public.list_whatsapp_template_registry_p3(text,text,text,text,integer,integer)
  to authenticated;

comment on function public.list_whatsapp_template_registry_p3(text,text,text,text,integer,integer) is
  'P3 SECURITY INVOKER wrapper for the scoped registry read model with language filtering.';


create or replace function private.list_whatsapp_template_status_timeline_impl(
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not (select public.authorize('whatsapp.templates.read')) then raise exception 'denied_templates_read' using errcode='42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'validation: limit' using errcode='22023'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'template_id',x.template_id,
    'template_name',x.template_name,
    'source',x.source,
    'event_kind',x.event_kind,
    'status',x.status,
    'category',x.category,
    'quality_rating',x.quality_rating,
    'error_code',x.error_code,
    'occurred_at',x.occurred_at
  ) order by x.occurred_at desc, x.id desc),'[]'::jsonb)
  into v_result
  from (
    select
      e.id,
      e.template_id,
      coalesce(t.name,s.name,'Unknown template') as template_name,
      e.source,
      e.event_kind,
      e.status,
      e.category,
      e.quality_rating,
      e.error_code,
      e.occurred_at
    from public.whatsapp_template_status_events e
    left join public.whatsapp_templates t on t.id=e.template_id
    left join public.whatsapp_template_submissions s on s.id=e.submission_id
    order by e.occurred_at desc,e.id desc
    limit p_limit
  ) x;
  return v_result;
end;
$$;
revoke all on function private.list_whatsapp_template_status_timeline_impl(integer)
  from public, anon;
grant execute on function private.list_whatsapp_template_status_timeline_impl(integer)
  to authenticated;

create or replace function public.list_whatsapp_template_status_timeline(
  p_limit integer default 25
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_whatsapp_template_status_timeline_impl(p_limit);
$$;
revoke all on function public.list_whatsapp_template_status_timeline(integer)
  from public, anon;
grant execute on function public.list_whatsapp_template_status_timeline(integer)
  to authenticated;

comment on function public.list_whatsapp_template_status_timeline(integer) is
  'P3 SECURITY INVOKER wrapper for the bounded provider status/submission timeline.';
