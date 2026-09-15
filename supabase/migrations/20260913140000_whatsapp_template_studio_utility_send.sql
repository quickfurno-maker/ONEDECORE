-- =============================================================================
-- ONEDECORE WM-2 (ADR-0034) — Template Studio, governed one-to-one UTILITY
-- template sends, and the inbound media view seam.
--
-- Repository only. No managed apply. No live Meta call from the database.
--
-- WHAT THIS MIGRATION ADDS
--
--   1. whatsapp.templates.read / .use / .manage, exactly per the WM-0 matrix:
--      Super Admin + Sales Manager read/manage; Super Admin + Sales Manager +
--      Sales Executive use. Legacy `management` and `sales` receive nothing.
--
--   2. `public.whatsapp_templates` (M18) extended forward-only with provider
--      sync metadata. Normalised status/category/quality live beside the raw
--      provider strings, so an unknown Meta value is preserved and never
--      sendable. The table stays service-only (no grant, no policy): staff read
--      it through `list_whatsapp_template_registry` and
--      `list_whatsapp_sendable_utility_templates`.
--
--   3. Evidence, append-only with mutation guards:
--        whatsapp_template_snapshots      immutable content-addressed APPROVED copies
--        whatsapp_template_status_events  observed/changed/submission outcome evidence
--        whatsapp_template_sync_runs      who asked for a provider sync, and when
--        whatsapp_template_submissions    Studio create/submit requests
--        whatsapp_media_access_events     who opened which inbound media
--
--   4. A separate one-to-one template send lane:
--        whatsapp_template_send_intents
--        whatsapp_template_dispatch_attempts
--      guarded lifecycles, one provider attempt per intent, ambiguous outcomes
--      parked for reconciliation and never retried.
--
-- WHAT IT DOES NOT TOUCH
--
--   The WHATSAPP_SERVICE text lane (whatsapp_send_intents, its claim/bind RPCs,
--   chk_whatsapp_send_intents_purpose) is unchanged. MARKETING templates can be
--   synced and submitted but never enter the one-to-one lane; that is the WM-4
--   campaign engine's job. No campaign table is touched.
--
-- PROVIDER TRUTH VS HUMAN AUTHORITY
--
--   Anything Meta says (status, category, quality, template id, message id) is
--   written ONLY by service_role RPCs, so no staff session can fabricate an
--   APPROVED template or a provider message. Anything a human decides (request a
--   sync, submit a template, send a template) is recorded by authenticated RPCs
--   that take the actor from auth.uid() and never from a parameter.
-- =============================================================================

/* ========================================================================== */
/* 1. Permissions                                                             */
/* ========================================================================== */

insert into public.permissions (code, name, description, is_system, is_active) values
  (
    'whatsapp.templates.read',
    'Read WhatsApp Templates',
    'Template Studio: every registry row including pending, rejected and unknown provider states',
    true,
    true
  ),
  (
    'whatsapp.templates.use',
    'Use Approved WhatsApp Templates',
    'Send an APPROVED UTILITY template one-to-one inside a conversation the actor can already use. Never bulk.',
    true,
    true
  ),
  (
    'whatsapp.templates.manage',
    'Manage WhatsApp Templates',
    'Sync, create and submit WhatsApp templates through the official Meta API',
    true,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

-- Explicit pairs, not a role predicate: the legacy roles `management` and
-- `sales` cannot pick a code up by accident.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('super_admin', 'whatsapp.templates.read'),
  ('super_admin', 'whatsapp.templates.use'),
  ('super_admin', 'whatsapp.templates.manage'),
  ('sales_manager', 'whatsapp.templates.read'),
  ('sales_manager', 'whatsapp.templates.use'),
  ('sales_manager', 'whatsapp.templates.manage'),
  ('sales_executive', 'whatsapp.templates.use')
) as v(role_code, permission_code)
join public.roles r on r.code = v.role_code and r.is_system = true
join public.permissions p on p.code = v.permission_code and p.is_system = true
on conflict (role_id, permission_id) do nothing;

/* ========================================================================== */
/* 2. Pure helpers: normalisation, hashing, template component parsing        */
/* ========================================================================== */

create or replace function private.whatsapp_normalize_template_status(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_raw, ''))) in (
      'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL',
      'PENDING_DELETION', 'DELETED', 'LIMIT_EXCEEDED', 'ARCHIVED'
    ) then upper(trim(p_raw))
    else 'unknown'
  end;
$$;

create or replace function private.whatsapp_normalize_template_category(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_raw, ''))) in ('MARKETING', 'UTILITY', 'AUTHENTICATION')
      then upper(trim(p_raw))
    else 'unknown'
  end;
$$;

create or replace function private.whatsapp_normalize_template_quality(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_raw is null or trim(p_raw) = '' then null
    when upper(trim(p_raw)) in ('GREEN', 'YELLOW', 'RED') then upper(trim(p_raw))
    else 'unknown'
  end;
$$;

/* Raw provider strings are kept, but bounded (WHATSAPP_TEMPLATE_RAW_VALUE_MAX_LENGTH). */
create or replace function private.whatsapp_bound_raw_provider_value(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(trim(coalesce(p_raw, '')), 64), '');
$$;

/*
 * Content identity of a template: what would be rendered to the customer, and
 * under which name/language/category. Status and quality are NOT part of it:
 * a PAUSED -> APPROVED round trip is the same content and the same snapshot.
 * jsonb text output is canonical (keys ordered), so the hash is deterministic.
 */
create or replace function private.whatsapp_template_content_hash(
  p_name text,
  p_language text,
  p_category text,
  p_parameter_format text,
  p_components jsonb
)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'name', p_name,
          'language', p_language,
          'category', p_category,
          'parameter_format', p_parameter_format,
          'components', coalesce(p_components, '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

/*
 * Variables a staff member must fill: {{1}}/{{name}} placeholders in a TEXT
 * header and in the body. Repeated placeholders count once. Mirrored by
 * `extractWhatsappTemplateVariables` in template-components.ts.
 */
create or replace function private.whatsapp_template_variable_keys(p_components jsonb)
returns table (component text, key text, ordinal integer)
language sql
stable
set search_path = ''
as $$
  with parts as (
    select
      case upper(c ->> 'type') when 'HEADER' then 'header' else 'body' end as component,
      c ->> 'text' as part_text
    from jsonb_array_elements(
      case when jsonb_typeof(p_components) = 'array' then p_components else '[]'::jsonb end
    ) as c
    where jsonb_typeof(c) = 'object'
      and jsonb_typeof(c -> 'text') = 'string'
      and (
        upper(c ->> 'type') = 'BODY'
        or (upper(c ->> 'type') = 'HEADER' and upper(coalesce(c ->> 'format', 'TEXT')) = 'TEXT')
      )
  ),
  found as (
    select p.component, rm.m[1] as key, rm.n as position
    from parts p
    cross join lateral regexp_matches(
      p.part_text, '\{\{\s*([A-Za-z0-9_]{1,64})\s*\}\}', 'g'
    ) with ordinality as rm(m, n)
  )
  select f.component, f.key, min(f.position)::integer as ordinal
  from found f
  group by f.component, f.key
  order by f.component, min(f.position);
$$;

/*
 * Why a template cannot be sent by staff one-to-one, or null when it can.
 * WM-2 sends templates whose only parameters are text variables in a TEXT
 * header and the body. Media headers, dynamic URL buttons, copy-code, flow and
 * other parameterised components fail closed until a later phase implements
 * their parameters.
 */
create or replace function private.whatsapp_template_staff_send_problem(
  p_components jsonb,
  p_parameter_format text
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
  v_body_count integer := 0;
  v_key record;
  v_expected integer;
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    return 'components_invalid';
  end if;

  for v_component in select value from jsonb_array_elements(p_components) loop
    if jsonb_typeof(v_component) <> 'object' then
      return 'components_invalid';
    end if;
    v_type := upper(coalesce(v_component ->> 'type', ''));
    if v_type = 'BODY' then
      if coalesce(v_component ->> 'text', '') = '' then
        return 'body_missing';
      end if;
      v_body_count := v_body_count + 1;
    elsif v_type = 'HEADER' then
      if upper(coalesce(v_component ->> 'format', 'TEXT')) <> 'TEXT' then
        return 'header_media_unsupported';
      end if;
    elsif v_type = 'FOOTER' then
      if coalesce(v_component ->> 'text', '') ~ '\{\{' then
        return 'footer_variables_unsupported';
      end if;
    elsif v_type = 'BUTTONS' then
      if jsonb_typeof(v_component -> 'buttons') <> 'array' then
        return 'components_invalid';
      end if;
      for v_button in select value from jsonb_array_elements(v_component -> 'buttons') loop
        if upper(coalesce(v_button ->> 'type', '')) not in ('QUICK_REPLY', 'URL', 'PHONE_NUMBER') then
          return 'button_parameters_unsupported';
        end if;
        if upper(v_button ->> 'type') = 'URL' and coalesce(v_button ->> 'url', '') ~ '\{\{' then
          return 'button_parameters_unsupported';
        end if;
      end loop;
    else
      return 'component_unsupported';
    end if;
  end loop;

  if v_body_count <> 1 then
    return 'body_missing';
  end if;

  if coalesce(upper(p_parameter_format), 'POSITIONAL') = 'NAMED' then
    for v_key in select * from private.whatsapp_template_variable_keys(p_components) loop
      if v_key.key !~ '^[a-z_][a-z0-9_]*$' then
        return 'parameter_format_mismatch';
      end if;
    end loop;
  else
    for v_key in select * from private.whatsapp_template_variable_keys(p_components) loop
      if v_key.key !~ '^[1-9][0-9]{0,2}$' then
        return 'parameter_format_mismatch';
      end if;
    end loop;
    -- Positional keys must be exactly 1..n within each component.
    for v_key in
      select k.component, count(*)::integer as n, max(k.key::integer) as top
      from private.whatsapp_template_variable_keys(p_components) k
      group by k.component
    loop
      if v_key.top <> v_key.n then
        return 'parameter_positions_not_sequential';
      end if;
    end loop;
  end if;

  select count(*)::integer into v_expected
  from private.whatsapp_template_variable_keys(p_components) k
  where k.component = 'header';
  if v_expected > 1 then
    return 'header_variables_unsupported';
  end if;

  return null;
end;
$$;

/* Why a parameter object does not fit a template, or null when it does. */
create or replace function private.whatsapp_template_parameters_problem(
  p_components jsonb,
  p_parameters jsonb
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_component text;
  v_key record;
  v_value jsonb;
  v_text text;
  v_max integer;
begin
  if p_parameters is null or jsonb_typeof(p_parameters) <> 'object' then
    return 'parameters_not_object';
  end if;
  if pg_column_size(p_parameters) > 4096 then
    return 'parameters_too_large';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_parameters) as k(name) where k.name not in ('header', 'body')
  ) then
    return 'parameters_unexpected_component';
  end if;

  foreach v_component in array array['header', 'body'] loop
    if p_parameters ? v_component and jsonb_typeof(p_parameters -> v_component) <> 'object' then
      return 'parameters_component_not_object';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(coalesce(p_parameters -> v_component, '{}'::jsonb)) as k(name)
      where not exists (
        select 1
        from private.whatsapp_template_variable_keys(p_components) vk
        where vk.component = v_component and vk.key = k.name
      )
    ) then
      return 'parameters_unexpected_key';
    end if;
  end loop;

  for v_key in select * from private.whatsapp_template_variable_keys(p_components) loop
    v_value := p_parameters -> v_key.component -> v_key.key;
    if v_value is null or jsonb_typeof(v_value) <> 'string' then
      return 'parameters_missing';
    end if;
    v_text := v_value #>> '{}';
    if length(trim(v_text)) = 0 then
      return 'parameters_missing';
    end if;
    v_max := case v_key.component when 'header' then 60 else 1024 end;
    if length(v_text) > v_max or v_text ~ '[\n\t]' or v_text ~ ' {5,}' then
      return 'parameters_invalid';
    end if;
  end loop;

  return null;
end;
$$;

/*
 * Single-pass placeholder substitution for the HISTORY preview only. The
 * provider payload is type=template with parameters and is never built from
 * this text. Single pass: a value that itself contains "{{2}}" is not
 * substituted again.
 */
create or replace function private.whatsapp_render_template_text(p_text text, p_values jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rest text := coalesce(p_text, '');
  v_out text := '';
  v_match text[];
  v_token text;
  v_pos integer;
begin
  loop
    v_match := regexp_match(v_rest, '(\{\{\s*([A-Za-z0-9_]{1,64})\s*\}\})');
    exit when v_match is null;
    v_token := v_match[1];
    v_pos := strpos(v_rest, v_token);
    v_out := v_out || left(v_rest, v_pos - 1)
      || coalesce(case when jsonb_typeof(p_values -> v_match[2]) = 'string' then p_values ->> v_match[2] end, v_token);
    v_rest := substr(v_rest, v_pos + length(v_token));
  end loop;
  return v_out || v_rest;
end;
$$;

create or replace function private.whatsapp_render_template_preview(
  p_components jsonb,
  p_parameters jsonb
)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(concat_ws(
    E'\n\n',
    (select private.whatsapp_render_template_text(c ->> 'text', coalesce(p_parameters -> 'header', '{}'::jsonb))
       from jsonb_array_elements(p_components) c
      where upper(c ->> 'type') = 'HEADER' and upper(coalesce(c ->> 'format', 'TEXT')) = 'TEXT'
      limit 1),
    (select private.whatsapp_render_template_text(c ->> 'text', coalesce(p_parameters -> 'body', '{}'::jsonb))
       from jsonb_array_elements(p_components) c
      where upper(c ->> 'type') = 'BODY'
      limit 1),
    (select c ->> 'text'
       from jsonb_array_elements(p_components) c
      where upper(c ->> 'type') = 'FOOTER'
      limit 1)
  ), '');
$$;

/*
 * The provider `components` array for a type=template message, built from the
 * validated parameters in the database's own key order. POSITIONAL parameters
 * are ordered by number; NAMED parameters carry parameter_name.
 */
create or replace function private.whatsapp_build_template_send_components(
  p_components jsonb,
  p_parameter_format text,
  p_parameters jsonb
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with keys as (
    select
      k.component,
      k.key,
      case when coalesce(upper(p_parameter_format), 'POSITIONAL') = 'NAMED'
        then k.ordinal else k.key::integer end as sort_key
    from private.whatsapp_template_variable_keys(p_components) k
  ),
  grouped as (
    select
      k.component,
      jsonb_agg(
        case when coalesce(upper(p_parameter_format), 'POSITIONAL') = 'NAMED'
          then jsonb_build_object('type', 'text', 'parameter_name', k.key, 'text', p_parameters -> k.component ->> k.key)
          else jsonb_build_object('type', 'text', 'text', p_parameters -> k.component ->> k.key)
        end
        order by k.sort_key
      ) as parameters
    from keys k
    group by k.component
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', g.component, 'parameters', g.parameters)
      order by case g.component when 'header' then 0 else 1 end
    ),
    '[]'::jsonb
  )
  from grouped g;
$$;

/* The business number as E.164, or null when it cannot be proven. */
create or replace function private.whatsapp_business_sender_e164(p_display_phone_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_display_phone_number is null then null
    when trim(p_display_phone_number) ~ '^\+[1-9]\d{1,14}$' then trim(p_display_phone_number)
    when ('+' || regexp_replace(p_display_phone_number, '\D', '', 'g')) ~ '^\+[1-9]\d{1,14}$'
      then '+' || regexp_replace(p_display_phone_number, '\D', '', 'g')
    else null
  end;
$$;

/* Structural validation of a Studio submission. Meta remains the final judge. */
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
  v_seen text[] := array[]::text[];
  v_problem text;
begin
  if p_category is null or p_category not in ('UTILITY', 'MARKETING') then
    return 'category_not_submittable';
  end if;
  if p_parameter_format is null or p_parameter_format not in ('POSITIONAL', 'NAMED') then
    return 'parameter_format_invalid';
  end if;
  if p_components is null
     or jsonb_typeof(p_components) <> 'array'
     or jsonb_array_length(p_components) not between 1 and 4
     or pg_column_size(p_components) > 16384 then
    return 'components_invalid';
  end if;

  for v_component in select value from jsonb_array_elements(p_components) loop
    if jsonb_typeof(v_component) <> 'object' then
      return 'components_invalid';
    end if;
    v_type := upper(coalesce(v_component ->> 'type', ''));
    if v_type = any(v_seen) then
      return 'component_repeated';
    end if;
    v_seen := v_seen || v_type;

    if v_type = 'HEADER' then
      if upper(coalesce(v_component ->> 'format', '')) <> 'TEXT'
         or length(coalesce(v_component ->> 'text', '')) not between 1 and 60 then
        return 'header_invalid';
      end if;
    elsif v_type = 'BODY' then
      if length(coalesce(v_component ->> 'text', '')) not between 1 and 1024 then
        return 'body_invalid';
      end if;
    elsif v_type = 'FOOTER' then
      if length(coalesce(v_component ->> 'text', '')) not between 1 and 60
         or (v_component ->> 'text') ~ '\{\{' then
        return 'footer_invalid';
      end if;
    elsif v_type = 'BUTTONS' then
      if jsonb_typeof(v_component -> 'buttons') <> 'array'
         or jsonb_array_length(v_component -> 'buttons') not between 1 and 10 then
        return 'buttons_invalid';
      end if;
      for v_button in select value from jsonb_array_elements(v_component -> 'buttons') loop
        if jsonb_typeof(v_button) <> 'object'
           or length(coalesce(v_button ->> 'text', '')) not between 1 and 25 then
          return 'buttons_invalid';
        end if;
        case upper(coalesce(v_button ->> 'type', ''))
          when 'QUICK_REPLY' then null;
          when 'URL' then
            if coalesce(v_button ->> 'url', '') !~ '^https://[^\s{}]{4,1990}$' then
              return 'button_url_invalid';
            end if;
          when 'PHONE_NUMBER' then
            if coalesce(v_button ->> 'phone_number', '') !~ '^\+[1-9]\d{1,14}$' then
              return 'button_phone_invalid';
            end if;
          else
            return 'button_type_unsupported';
        end case;
      end loop;
    else
      return 'component_unsupported';
    end if;
  end loop;

  if not ('BODY' = any(v_seen)) then
    return 'body_invalid';
  end if;

  v_problem := private.whatsapp_template_staff_send_problem(p_components, p_parameter_format);
  if v_problem is not null then
    return v_problem;
  end if;

  return null;
end;
$$;

revoke all on function private.whatsapp_normalize_template_status(text) from public, anon, authenticated;
revoke all on function private.whatsapp_normalize_template_category(text) from public, anon, authenticated;
revoke all on function private.whatsapp_normalize_template_quality(text) from public, anon, authenticated;
revoke all on function private.whatsapp_bound_raw_provider_value(text) from public, anon, authenticated;
revoke all on function private.whatsapp_template_content_hash(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_template_variable_keys(jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_template_staff_send_problem(jsonb, text) from public, anon, authenticated;
revoke all on function private.whatsapp_template_parameters_problem(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_render_template_text(text, jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_render_template_preview(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_build_template_send_components(jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function private.whatsapp_business_sender_e164(text) from public, anon, authenticated;
revoke all on function private.whatsapp_template_submission_problem(text, text, jsonb) from public, anon, authenticated;

/* ========================================================================== */
/* 3. whatsapp_templates — forward-only extension                             */
/* ========================================================================== */

alter table public.whatsapp_templates
  add column raw_status text,
  add column raw_category text,
  add column quality_rating text,
  add column raw_quality_rating text,
  add column parameter_format text,
  add column content_hash text,
  add column origin text not null default 'provider_sync',
  add column rejected_reason text,
  add column synced_at timestamptz;

-- M18 never synced, so any pre-existing row carries a hand-entered status.
-- Keep what was there as the raw value and normalise before the CHECKs land.
update public.whatsapp_templates
set
  raw_status = private.whatsapp_bound_raw_provider_value(status),
  raw_category = private.whatsapp_bound_raw_provider_value(category),
  status = private.whatsapp_normalize_template_status(status),
  category = private.whatsapp_normalize_template_category(category),
  components = case when jsonb_typeof(components) = 'array' then components else '[]'::jsonb end;

alter table public.whatsapp_templates
  add constraint chk_whatsapp_templates_status_normalized check (
    status in (
      'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL',
      'PENDING_DELETION', 'DELETED', 'LIMIT_EXCEEDED', 'ARCHIVED', 'unknown'
    )
  ),
  add constraint chk_whatsapp_templates_category_normalized check (
    category in ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'unknown')
  ),
  add constraint chk_whatsapp_templates_quality_rating check (
    quality_rating is null or quality_rating in ('GREEN', 'YELLOW', 'RED', 'unknown')
  ),
  add constraint chk_whatsapp_templates_raw_values check (
    (raw_status is null or length(raw_status) <= 64)
    and (raw_category is null or length(raw_category) <= 64)
    and (raw_quality_rating is null or length(raw_quality_rating) <= 64)
  ),
  add constraint chk_whatsapp_templates_parameter_format check (
    parameter_format is null or parameter_format in ('POSITIONAL', 'NAMED')
  ),
  add constraint chk_whatsapp_templates_content_hash check (
    content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint chk_whatsapp_templates_origin check (
    origin in ('provider_sync', 'studio_submission')
  ),
  add constraint chk_whatsapp_templates_rejected_reason check (
    rejected_reason is null or length(rejected_reason) <= 256
  ),
  add constraint chk_whatsapp_templates_components_array check (
    jsonb_typeof(components) = 'array'
  );

create or replace function private.whatsapp_templates_derive_content_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.content_hash := private.whatsapp_template_content_hash(
    new.name, new.language, new.category, new.parameter_format, new.components
  );
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function private.whatsapp_templates_derive_content_hash() from public, anon, authenticated;

create trigger trg_whatsapp_templates_derive_content_hash
  before insert or update on public.whatsapp_templates
  for each row execute function private.whatsapp_templates_derive_content_hash();

update public.whatsapp_templates set components = components;

create index idx_whatsapp_templates_account_status_category
  on public.whatsapp_templates (business_account_id, status, category);

comment on table public.whatsapp_templates is
  'WM-2: WhatsApp template registry. Written only by service_role sync/submission RPCs; status/category/quality normalised beside bounded raw provider values; unknown provider values are preserved and never sendable. Staff read it through list_whatsapp_template_registry / list_whatsapp_sendable_utility_templates.';

/* ========================================================================== */
/* 4. Evidence tables                                                         */
/* ========================================================================== */

create table public.whatsapp_template_snapshots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.whatsapp_templates (id) on delete restrict,
  business_account_id uuid not null references public.whatsapp_business_accounts (id) on delete restrict,
  provider_template_id text not null,
  name text not null,
  language text not null,
  category text not null,
  parameter_format text,
  components jsonb not null,
  content_hash text not null,
  observed_status text not null,
  quality_rating text,
  captured_at timestamptz not null default now(),

  constraint chk_whatsapp_template_snapshots_observed_status check (observed_status = 'APPROVED'),
  constraint chk_whatsapp_template_snapshots_category check (
    category in ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'unknown')
  ),
  constraint chk_whatsapp_template_snapshots_provider_template_id check (
    length(provider_template_id) between 1 and 128
  ),
  constraint chk_whatsapp_template_snapshots_hash check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_template_snapshots_components check (
    jsonb_typeof(components) = 'array' and pg_column_size(components) <= 16384
  ),
  constraint chk_whatsapp_template_snapshots_parameter_format check (
    parameter_format is null or parameter_format in ('POSITIONAL', 'NAMED')
  )
);

create unique index uq_whatsapp_template_snapshots_template_hash
  on public.whatsapp_template_snapshots (template_id, content_hash);

comment on table public.whatsapp_template_snapshots is
  'WM-2: immutable content-addressed copies of a template observed APPROVED by the provider. A one-to-one send binds to a snapshot; the registry row is re-read at send time to prove it is still APPROVED, still UTILITY and still has this content hash.';

create table public.whatsapp_template_sync_runs (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.whatsapp_business_accounts (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  scope text not null,
  template_id uuid references public.whatsapp_templates (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_template_sync_runs_scope check (scope in ('all', 'template')),
  constraint chk_whatsapp_template_sync_runs_scope_template check (
    (scope = 'template') = (template_id is not null)
  )
);

create index idx_whatsapp_template_sync_runs_account_created
  on public.whatsapp_template_sync_runs (business_account_id, created_at desc);

comment on table public.whatsapp_template_sync_runs is
  'WM-2: append-only record of who asked for a provider template sync or single-template status refresh. The provider observations it produced are whatsapp_template_status_events rows referencing it.';

create table public.whatsapp_template_submissions (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.whatsapp_business_accounts (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null,
  name text not null,
  language text not null,
  category text not null,
  parameter_format text not null,
  components jsonb not null,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_template_submissions_name check (name ~ '^[a-z0-9_]{1,128}$'),
  constraint chk_whatsapp_template_submissions_language check (
    language ~ '^[a-z]{2,3}(_[A-Z]{2})?$'
  ),
  constraint chk_whatsapp_template_submissions_category check (category in ('UTILITY', 'MARKETING')),
  constraint chk_whatsapp_template_submissions_parameter_format check (
    parameter_format in ('POSITIONAL', 'NAMED')
  ),
  constraint chk_whatsapp_template_submissions_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_template_submissions_components check (
    jsonb_typeof(components) = 'array' and pg_column_size(components) <= 16384
  ),
  constraint uq_whatsapp_template_submissions_actor_key unique (requested_by, idempotency_key)
);

create index idx_whatsapp_template_submissions_account_created
  on public.whatsapp_template_submissions (business_account_id, created_at desc);

comment on table public.whatsapp_template_submissions is
  'WM-2: append-only Template Studio create/submit requests. Written BEFORE the provider call, so a crash after Meta accepted still leaves evidence. The outcome is exactly one whatsapp_template_status_events row; a request without one is unresolved and is never blindly resubmitted.';

create table public.whatsapp_template_status_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.whatsapp_templates (id) on delete restrict,
  sync_run_id uuid references public.whatsapp_template_sync_runs (id) on delete restrict,
  submission_id uuid references public.whatsapp_template_submissions (id) on delete restrict,
  source text not null,
  event_kind text not null,
  previous_status text,
  status text,
  raw_status text,
  previous_category text,
  category text,
  raw_category text,
  quality_rating text,
  raw_quality_rating text,
  content_hash text,
  http_status integer,
  error_code text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint chk_whatsapp_template_status_events_source check (
    source in ('sync', 'status_refresh', 'submission')
  ),
  constraint chk_whatsapp_template_status_events_kind check (
    event_kind in ('observed', 'changed', 'submission_accepted', 'submission_failed', 'submission_ambiguous')
  ),
  constraint chk_whatsapp_template_status_events_source_ref check (
    (source in ('sync', 'status_refresh') and sync_run_id is not null and submission_id is null
       and template_id is not null and event_kind in ('observed', 'changed'))
    or (source = 'submission' and submission_id is not null and sync_run_id is null
       and event_kind in ('submission_accepted', 'submission_failed', 'submission_ambiguous'))
  ),
  constraint chk_whatsapp_template_status_events_accepted_template check (
    event_kind <> 'submission_accepted' or template_id is not null
  ),
  constraint chk_whatsapp_template_status_events_raw check (
    (raw_status is null or length(raw_status) <= 64)
    and (raw_category is null or length(raw_category) <= 64)
    and (raw_quality_rating is null or length(raw_quality_rating) <= 64)
    and (error_code is null or length(error_code) <= 64)
  ),
  constraint chk_whatsapp_template_status_events_details check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096
  )
);

create unique index uq_whatsapp_template_status_events_submission_outcome
  on public.whatsapp_template_status_events (submission_id)
  where submission_id is not null;

create index idx_whatsapp_template_status_events_template_time
  on public.whatsapp_template_status_events (template_id, occurred_at desc);

create index idx_whatsapp_template_status_events_sync_run
  on public.whatsapp_template_status_events (sync_run_id)
  where sync_run_id is not null;

comment on table public.whatsapp_template_status_events is
  'WM-2: append-only provider evidence for templates: first observation, status/category/quality/content changes, and the single outcome of each Studio submission. Raw provider values are bounded; no provider response body or credential is stored.';

create table public.whatsapp_media_access_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.whatsapp_messages (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  media_kind text not null,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_media_access_events_kind check (
    media_kind in ('image', 'audio', 'video', 'document', 'sticker')
  )
);

create index idx_whatsapp_media_access_events_message
  on public.whatsapp_media_access_events (message_id, created_at desc);

comment on table public.whatsapp_media_access_events is
  'WM-2: append-only evidence that a staff member was authorised to open an inbound media file. Written by authorize_whatsapp_inbound_media_view before any byte is fetched from Meta.';

create trigger trg_whatsapp_template_snapshots_no_update
  before update on public.whatsapp_template_snapshots
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_snapshots_no_delete
  before delete on public.whatsapp_template_snapshots
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_sync_runs_no_update
  before update on public.whatsapp_template_sync_runs
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_sync_runs_no_delete
  before delete on public.whatsapp_template_sync_runs
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_submissions_no_update
  before update on public.whatsapp_template_submissions
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_submissions_no_delete
  before delete on public.whatsapp_template_submissions
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_status_events_no_update
  before update on public.whatsapp_template_status_events
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_template_status_events_no_delete
  before delete on public.whatsapp_template_status_events
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_media_access_events_no_update
  before update on public.whatsapp_media_access_events
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_whatsapp_media_access_events_no_delete
  before delete on public.whatsapp_media_access_events
  for each row execute function private.forbid_append_only_mutation();

/* A snapshot's hash is derived from its own content, never supplied. */
create or replace function private.whatsapp_template_snapshot_derive_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.content_hash := private.whatsapp_template_content_hash(
    new.name, new.language, new.category, new.parameter_format, new.components
  );
  new.captured_at := now();
  return new;
end;
$$;

revoke all on function private.whatsapp_template_snapshot_derive_hash() from public, anon, authenticated;

create trigger trg_whatsapp_template_snapshots_derive_hash
  before insert on public.whatsapp_template_snapshots
  for each row execute function private.whatsapp_template_snapshot_derive_hash();

/* ========================================================================== */
/* 5. One-to-one template send lane                                           */
/* ========================================================================== */

create table public.whatsapp_template_send_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  template_snapshot_id uuid not null references public.whatsapp_template_snapshots (id) on delete restrict,
  purpose_code text not null default 'WHATSAPP_SERVICE',
  template_category text not null default 'UTILITY',
  template_parameters jsonb not null default '{}'::jsonb,
  preview_text text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  lifecycle_status text not null default 'eligible',
  outcome_code text,
  outbound_message_id uuid references public.whatsapp_messages (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_template_send_intents_purpose check (purpose_code = 'WHATSAPP_SERVICE'),
  constraint chk_whatsapp_template_send_intents_category check (template_category = 'UTILITY'),
  constraint chk_whatsapp_template_send_intents_parameters check (
    jsonb_typeof(template_parameters) = 'object' and pg_column_size(template_parameters) <= 4096
  ),
  constraint chk_whatsapp_template_send_intents_preview check (length(preview_text) between 1 and 4096),
  constraint chk_whatsapp_template_send_intents_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_template_send_intents_status check (
    lifecycle_status in ('eligible', 'ineligible', 'dispatch_pending', 'dispatch_bound', 'failed', 'needs_reconcile')
  ),
  constraint chk_whatsapp_template_send_intents_outcome_code check (
    outcome_code is null or length(outcome_code) between 1 and 64
  ),
  constraint chk_whatsapp_template_send_intents_binding check (
    (lifecycle_status = 'dispatch_bound') = (outbound_message_id is not null)
  ),
  constraint uq_whatsapp_template_send_intents_actor_key unique (requested_by, idempotency_key)
);

create index idx_whatsapp_template_send_intents_conversation
  on public.whatsapp_template_send_intents (conversation_id, created_at desc);
create index idx_whatsapp_template_send_intents_reconcile
  on public.whatsapp_template_send_intents (lifecycle_status, updated_at)
  where lifecycle_status in ('dispatch_pending', 'needs_reconcile');

comment on table public.whatsapp_template_send_intents is
  'WM-2: governed one-to-one APPROVED UTILITY template send intents (purpose WHATSAPP_SERVICE). MARKETING and AUTHENTICATION are refused by CHECK and by the RPCs. Bound to an immutable snapshot; eligibility is re-proved at claim time.';

create table public.whatsapp_template_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  template_send_intent_id uuid not null references public.whatsapp_template_send_intents (id) on delete restrict,
  provider_code text not null,
  provider_attempt_key text not null,
  status text not null default 'requested',
  error_class text,
  error_code text,
  http_status integer,
  provider_message_id text,
  response_snapshot jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint chk_whatsapp_template_dispatch_attempts_provider check (provider_code in ('fake', 'meta')),
  constraint chk_whatsapp_template_dispatch_attempts_key check (
    length(provider_attempt_key) between 1 and 128
  ),
  constraint chk_whatsapp_template_dispatch_attempts_status check (
    status in ('requested', 'succeeded', 'failed', 'ambiguous')
  ),
  constraint chk_whatsapp_template_dispatch_attempts_error_class check (
    error_class is null or error_class in ('transient', 'terminal', 'ambiguous')
  ),
  constraint chk_whatsapp_template_dispatch_attempts_error_code check (
    error_code is null or length(error_code) between 1 and 64
  ),
  constraint chk_whatsapp_template_dispatch_attempts_provider_message_id check (
    provider_message_id is null or length(provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_template_dispatch_attempts_binding check (
    status <> 'succeeded' or provider_message_id is not null
  ),
  constraint chk_whatsapp_template_dispatch_attempts_response check (
    jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 4096
  ),
  -- One provider attempt per intent, ever. A second send is a new intent with a
  -- new idempotency key, chosen by a human after seeing the first outcome.
  constraint uq_whatsapp_template_dispatch_attempts_intent unique (template_send_intent_id),
  constraint uq_whatsapp_template_dispatch_attempts_provider_key unique (provider_code, provider_attempt_key)
);

comment on table public.whatsapp_template_dispatch_attempts is
  'WM-2: the single provider attempt of a template send intent. requested -> succeeded | failed | ambiguous; ambiguous -> succeeded only through reconciliation evidence. Never retried automatically.';

/* Lifecycle guard: identity immutable, only reviewed transitions, no delete. */
create or replace function private.whatsapp_template_send_intent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'whatsapp_template_send_intents is append-only' using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.requested_by is distinct from old.requested_by
     or new.template_snapshot_id is distinct from old.template_snapshot_id
     or new.purpose_code is distinct from old.purpose_code
     or new.template_category is distinct from old.template_category
     or new.template_parameters is distinct from old.template_parameters
     or new.preview_text is distinct from old.preview_text
     or new.idempotency_key is distinct from old.idempotency_key
     or new.request_hash is distinct from old.request_hash
     or new.created_at is distinct from old.created_at then
    raise exception 'whatsapp_template_send_intent_identity_immutable' using errcode = '42501';
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status and not (
    (old.lifecycle_status = 'eligible' and new.lifecycle_status in ('dispatch_pending', 'ineligible'))
    or (old.lifecycle_status = 'dispatch_pending' and new.lifecycle_status in ('dispatch_bound', 'failed', 'needs_reconcile'))
    or (old.lifecycle_status = 'needs_reconcile' and new.lifecycle_status = 'dispatch_bound')
  ) then
    raise exception 'whatsapp_template_send_intent_invalid_transition: % -> %',
      old.lifecycle_status, new.lifecycle_status using errcode = '23514';
  end if;

  if old.outbound_message_id is not null
     and new.outbound_message_id is distinct from old.outbound_message_id then
    raise exception 'whatsapp_template_send_intent_binding_immutable' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.whatsapp_template_dispatch_attempt_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'whatsapp_template_dispatch_attempts is append-only' using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.template_send_intent_id is distinct from old.template_send_intent_id
     or new.provider_code is distinct from old.provider_code
     or new.provider_attempt_key is distinct from old.provider_attempt_key
     or new.requested_at is distinct from old.requested_at then
    raise exception 'whatsapp_template_dispatch_attempt_identity_immutable' using errcode = '42501';
  end if;

  if old.status in ('succeeded', 'failed') then
    raise exception 'whatsapp_template_dispatch_attempt_finalized' using errcode = '23514';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status in ('succeeded', 'failed', 'ambiguous'))
    or (old.status = 'ambiguous' and new.status = 'succeeded')
  ) then
    raise exception 'whatsapp_template_dispatch_attempt_invalid_transition: % -> %',
      old.status, new.status using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.whatsapp_template_send_intent_guard() from public, anon, authenticated;
revoke all on function private.whatsapp_template_dispatch_attempt_guard() from public, anon, authenticated;

create trigger trg_whatsapp_template_send_intents_guard
  before update or delete on public.whatsapp_template_send_intents
  for each row execute function private.whatsapp_template_send_intent_guard();

create trigger trg_whatsapp_template_dispatch_attempts_guard
  before update or delete on public.whatsapp_template_dispatch_attempts
  for each row execute function private.whatsapp_template_dispatch_attempt_guard();

/* ========================================================================== */
/* 6. RLS, grants                                                             */
/* ========================================================================== */

alter table public.whatsapp_template_snapshots enable row level security;
alter table public.whatsapp_template_snapshots force row level security;
alter table public.whatsapp_template_sync_runs enable row level security;
alter table public.whatsapp_template_sync_runs force row level security;
alter table public.whatsapp_template_submissions enable row level security;
alter table public.whatsapp_template_submissions force row level security;
alter table public.whatsapp_template_status_events enable row level security;
alter table public.whatsapp_template_status_events force row level security;
alter table public.whatsapp_media_access_events enable row level security;
alter table public.whatsapp_media_access_events force row level security;
alter table public.whatsapp_template_send_intents enable row level security;
alter table public.whatsapp_template_send_intents force row level security;
alter table public.whatsapp_template_dispatch_attempts enable row level security;
alter table public.whatsapp_template_dispatch_attempts force row level security;

revoke all on table public.whatsapp_templates from public, anon, authenticated;
revoke all on table public.whatsapp_template_snapshots from public, anon, authenticated;
revoke all on table public.whatsapp_template_sync_runs from public, anon, authenticated;
revoke all on table public.whatsapp_template_submissions from public, anon, authenticated;
revoke all on table public.whatsapp_template_status_events from public, anon, authenticated;
revoke all on table public.whatsapp_media_access_events from public, anon, authenticated;
revoke all on table public.whatsapp_template_send_intents from public, anon, authenticated;
revoke all on table public.whatsapp_template_dispatch_attempts from public, anon, authenticated;

grant select on table public.whatsapp_template_snapshots to authenticated, service_role;
grant select on table public.whatsapp_template_sync_runs to authenticated, service_role;
grant select on table public.whatsapp_template_submissions to authenticated, service_role;
grant select on table public.whatsapp_template_status_events to authenticated, service_role;
grant select on table public.whatsapp_media_access_events to authenticated, service_role;
grant select on table public.whatsapp_template_send_intents to authenticated, service_role;
grant select on table public.whatsapp_template_dispatch_attempts to authenticated, service_role;
grant select on table public.whatsapp_templates to service_role;

create policy whatsapp_template_snapshots_select_read
  on public.whatsapp_template_snapshots for select to authenticated
  using ((select public.authorize('whatsapp.templates.read')));

create policy whatsapp_template_sync_runs_select_read
  on public.whatsapp_template_sync_runs for select to authenticated
  using ((select public.authorize('whatsapp.templates.read')));

create policy whatsapp_template_submissions_select_read
  on public.whatsapp_template_submissions for select to authenticated
  using ((select public.authorize('whatsapp.templates.read')));

create policy whatsapp_template_status_events_select_read
  on public.whatsapp_template_status_events for select to authenticated
  using ((select public.authorize('whatsapp.templates.read')));

create policy whatsapp_media_access_events_select_own
  on public.whatsapp_media_access_events for select to authenticated
  using (actor_id = (select auth.uid()));

create policy whatsapp_template_send_intents_select_scoped
  on public.whatsapp_template_send_intents for select to authenticated
  using ((select private.whatsapp_inbox_can_view_conversation(conversation_id)));

create policy whatsapp_template_dispatch_attempts_select_scoped
  on public.whatsapp_template_dispatch_attempts for select to authenticated
  using (
    exists (
      select 1
      from public.whatsapp_template_send_intents i
      where i.id = template_send_intent_id
        and (select private.whatsapp_inbox_can_view_conversation(i.conversation_id))
    )
  );

/* ========================================================================== */
/* 7. Send-time gate                                                          */
/* ========================================================================== */

/*
 * The same permission question `private.has_permission` answers for auth.uid(),
 * asked about a named actor by the service-role dispatch path: active profile,
 * cleared staff access, active role, active permission. Nothing cached.
 */
create or replace function private.whatsapp_actor_holds_permission(p_actor_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id is not null
    and not private.staff_access_denied(p_actor_id)
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      join public.profiles prof on prof.id = ur.user_id
      where ur.user_id = p_actor_id
        and p.code = p_code
        and r.is_active = true
        and p.is_active = true
        and prof.status = 'active'
    );
$$;

/*
 * One evaluation, used at intent creation (actor = auth.uid()) and again at
 * claim (actor = the intent's requester), so the rules cannot drift between
 * the two moments. Order is deliberate: scope first, so a caller outside scope
 * learns nothing about the template or the customer.
 *
 *   denied_scope                  missing whatsapp.inbox.use / whatsapp.templates.use,
 *                                 or the live CRM predicate refuses (not assigned,
 *                                 reassigned away, tombstoned lead, unlinked w/o manage)
 *   template_snapshot_missing
 *   template_category_not_utility snapshot or CURRENT registry category is not UTILITY
 *   template_not_approved         CURRENT registry status is not APPROVED
 *   template_content_changed      CURRENT registry content differs from the snapshot
 *   template_parameters_unsupported
 *   template_account_mismatch     conversation's business number is on another WABA
 *   denied_sender_unresolvable    business number has no provable E.164
 *   denied_*                      whatsapp_evaluate_service_send_eligibility
 *                                 (lead deleted, contact, DNC, channel, consent)
 */
create or replace function private.whatsapp_template_send_gate(
  p_actor_id uuid,
  p_conversation_id uuid,
  p_template_snapshot_id uuid
)
returns table (
  gate_code text,
  phone_number_id text,
  customer_e164 text,
  sender_e164 text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_template public.whatsapp_templates%rowtype;
  v_conv public.whatsapp_conversations%rowtype;
  v_phone public.whatsapp_phone_numbers%rowtype;
  v_account_status text;
  v_eligibility text;
  v_sender text;
begin
  if not private.whatsapp_actor_holds_permission(p_actor_id, 'whatsapp.inbox.use')
     or not private.whatsapp_actor_holds_permission(p_actor_id, 'whatsapp.templates.use')
     or not private.whatsapp_inbox_actor_can_use_conversation(p_actor_id, p_conversation_id) then
    return query select 'denied_scope'::text, null::text, null::text, null::text;
    return;
  end if;

  select * into v_snapshot from public.whatsapp_template_snapshots where id = p_template_snapshot_id;
  if not found then
    return query select 'template_snapshot_missing'::text, null::text, null::text, null::text;
    return;
  end if;

  select * into v_template from public.whatsapp_templates where id = v_snapshot.template_id;

  if v_snapshot.category <> 'UTILITY' or v_template.category is distinct from 'UTILITY' then
    return query select 'template_category_not_utility'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_template.status is distinct from 'APPROVED' then
    return query select 'template_not_approved'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_template.content_hash is distinct from v_snapshot.content_hash
     or v_template.provider_template_id is distinct from v_snapshot.provider_template_id then
    return query select 'template_content_changed'::text, null::text, null::text, null::text;
    return;
  end if;

  if private.whatsapp_template_staff_send_problem(v_snapshot.components, v_snapshot.parameter_format) is not null then
    return query select 'template_parameters_unsupported'::text, null::text, null::text, null::text;
    return;
  end if;

  select * into v_conv from public.whatsapp_conversations where id = p_conversation_id;
  select * into v_phone from public.whatsapp_phone_numbers where id = v_conv.phone_number_id;
  select status into v_account_status
  from public.whatsapp_business_accounts where id = v_snapshot.business_account_id;

  if v_phone.business_account_id is distinct from v_snapshot.business_account_id
     or v_phone.status is distinct from 'active'
     or v_account_status is distinct from 'active' then
    return query select 'template_account_mismatch'::text, null::text, null::text, null::text;
    return;
  end if;

  select e.eligibility_code into v_eligibility
  from private.whatsapp_evaluate_service_send_eligibility(p_conversation_id) e;
  if v_eligibility is distinct from 'eligible' then
    return query select coalesce(v_eligibility, 'denied_invalid_conversation'), null::text, null::text, null::text;
    return;
  end if;

  v_sender := private.whatsapp_business_sender_e164(v_phone.display_phone_number);
  if v_sender is null then
    return query select 'denied_sender_unresolvable'::text, null::text, null::text, null::text;
    return;
  end if;

  return query select 'eligible'::text, v_phone.phone_number_id, v_conv.customer_e164, v_sender;
end;
$$;

revoke all on function private.whatsapp_actor_holds_permission(uuid, text) from public, anon, authenticated;
revoke all on function private.whatsapp_template_send_gate(uuid, uuid, uuid) from public, anon, authenticated;

/* ========================================================================== */
/* 8. Staff read models                                                       */
/* ========================================================================== */

create or replace function public.list_whatsapp_template_registry(
  p_status text default null,
  p_category text default null,
  p_search text default null,
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
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select public.authorize('whatsapp.templates.read')) then
    raise exception 'denied_templates_read' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL',
    'PENDING_DELETION', 'DELETED', 'LIMIT_EXCEEDED', 'ARCHIVED', 'unknown'
  ) then
    raise exception 'validation: status' using errcode = '22023';
  end if;
  if p_category is not null and p_category not in ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'unknown') then
    raise exception 'validation: category' using errcode = '22023';
  end if;
  if p_page is null or p_page < 1 or p_page > 10000 then
    raise exception 'validation: page' using errcode = '22023';
  end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'validation: page_size' using errcode = '22023';
  end if;
  v_search := nullif(trim(coalesce(p_search, '')), '');
  if v_search is not null and length(v_search) > 128 then
    raise exception 'validation: search' using errcode = '22023';
  end if;
  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with filtered as (
    select t.*
    from public.whatsapp_templates t
    where (p_status is null or t.status = p_status)
      and (p_category is null or t.category = p_category)
      and (v_pattern is null or t.name ilike v_pattern escape '\')
  ),
  page_rows as (
    select f.*
    from filtered f
    order by f.name, f.language, f.id
    limit p_page_size
    offset (p_page - 1) * p_page_size
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'business_account_id', p.business_account_id,
          'provider_template_id', p.provider_template_id,
          'name', p.name,
          'language', p.language,
          'category', p.category,
          'raw_category', p.raw_category,
          'status', p.status,
          'raw_status', p.raw_status,
          'quality_rating', p.quality_rating,
          'raw_quality_rating', p.raw_quality_rating,
          'parameter_format', p.parameter_format,
          'origin', p.origin,
          'rejected_reason', p.rejected_reason,
          'synced_at', p.synced_at,
          'updated_at', p.updated_at,
          'body_preview', (
            select left(c ->> 'text', 280)
            from jsonb_array_elements(p.components) c
            where upper(c ->> 'type') = 'BODY'
            limit 1
          ),
          'variable_count', (select count(*) from private.whatsapp_template_variable_keys(p.components)),
          'send_problem', private.whatsapp_template_staff_send_problem(p.components, p.parameter_format),
          'approved_snapshot_id', (
            select s.id from public.whatsapp_template_snapshots s
            where s.template_id = p.id and s.content_hash = p.content_hash
            limit 1
          ),
          'one_to_one_sendable', (
            p.status = 'APPROVED'
            and p.category = 'UTILITY'
            and private.whatsapp_template_staff_send_problem(p.components, p.parameter_format) is null
            and exists (
              select 1 from public.whatsapp_template_snapshots s
              where s.template_id = p.id and s.content_hash = p.content_hash
            )
          )
        )
        order by p.name, p.language, p.id
      )
      from page_rows p
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.list_whatsapp_template_registry(text, text, text, integer, integer) is
  'WM-2: Template Studio registry read model. Requires whatsapp.templates.read. Returns normalised and raw provider status/category/quality, sync time, whether the current content has an APPROVED snapshot and whether the row is one-to-one sendable (APPROVED + UTILITY + supported parameters).';

create or replace function public.list_whatsapp_sendable_utility_templates(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_account uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_conversation_id is null
     or not (select public.authorize('whatsapp.inbox.use'))
     or not (select public.authorize('whatsapp.templates.use'))
     or not (select private.whatsapp_inbox_can_use_conversation(p_conversation_id)) then
    raise exception 'whatsapp_conversation_not_found' using errcode = 'P0002';
  end if;

  select pn.business_account_id into v_account
  from public.whatsapp_conversations c
  join public.whatsapp_phone_numbers pn on pn.id = c.phone_number_id
  where c.id = p_conversation_id;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'snapshot_id', s.id,
          'template_id', t.id,
          'name', s.name,
          'language', s.language,
          'parameter_format', s.parameter_format,
          'components', s.components,
          'variables', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'component', k.component,
                'key', k.key,
                'max_length', case k.component when 'header' then 60 else 1024 end
              )
              order by case k.component when 'header' then 0 else 1 end, k.ordinal
            )
            from private.whatsapp_template_variable_keys(s.components) k
          ), '[]'::jsonb)
        )
        order by s.name, s.language
      )
      from public.whatsapp_templates t
      join public.whatsapp_template_snapshots s
        on s.template_id = t.id and s.content_hash = t.content_hash
      where t.business_account_id = v_account
        and t.status = 'APPROVED'
        and t.category = 'UTILITY'
        and s.category = 'UTILITY'
        and private.whatsapp_template_staff_send_problem(s.components, s.parameter_format) is null
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.list_whatsapp_sendable_utility_templates(uuid) is
  'WM-2: the approved UTILITY templates a staff member may send in ONE conversation they can currently use. Requires whatsapp.inbox.use + whatsapp.templates.use + the live CRM use predicate; refused and missing conversations raise the same not-found error. MARKETING and AUTHENTICATION never appear.';

/* ========================================================================== */
/* 9. Human-authority RPCs (authenticated, actor = auth.uid())                */
/* ========================================================================== */

create or replace function public.create_whatsapp_utility_template_send_intent(
  p_conversation_id uuid,
  p_template_snapshot_id uuid,
  p_template_parameters jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_gate record;
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_problem text;
  v_preview text;
  v_hash text;
  v_existing public.whatsapp_template_send_intents%rowtype;
  v_intent public.whatsapp_template_send_intents%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_conversation_id is null
     or not (select public.authorize('whatsapp.inbox.use'))
     or not (select public.authorize('whatsapp.templates.use'))
     or not (select private.whatsapp_inbox_can_use_conversation(p_conversation_id)) then
    raise exception 'whatsapp_conversation_not_found' using errcode = 'P0002';
  end if;
  if p_idempotency_key is null then
    raise exception 'validation: idempotency_key' using errcode = '22023';
  end if;
  if p_template_snapshot_id is null then
    raise exception 'template_not_sendable: template_snapshot_missing' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'conversation_id', p_conversation_id,
    'template_snapshot_id', p_template_snapshot_id,
    'template_parameters', coalesce(p_template_parameters, 'null'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_existing
  from public.whatsapp_template_send_intents
  where requested_by = v_actor and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'intent_id', v_existing.id,
      'reused', true,
      'lifecycle_status', v_existing.lifecycle_status,
      'outcome_code', v_existing.outcome_code
    );
  end if;

  select * into v_gate
  from private.whatsapp_template_send_gate(v_actor, p_conversation_id, p_template_snapshot_id);

  if v_gate.gate_code = 'denied_scope' then
    raise exception 'whatsapp_conversation_not_found' using errcode = 'P0002';
  end if;
  if v_gate.gate_code like 'template_%' then
    raise exception 'template_not_sendable: %', v_gate.gate_code using errcode = '22023';
  end if;
  if v_gate.gate_code <> 'eligible' then
    raise exception '%', v_gate.gate_code using errcode = '22023';
  end if;

  select * into v_snapshot from public.whatsapp_template_snapshots where id = p_template_snapshot_id;

  v_problem := private.whatsapp_template_parameters_problem(v_snapshot.components, p_template_parameters);
  if v_problem is not null then
    raise exception 'validation: template_parameters (%)', v_problem using errcode = '22023';
  end if;

  v_preview := private.whatsapp_render_template_preview(v_snapshot.components, p_template_parameters);
  if v_preview is null or length(v_preview) > 4096 then
    raise exception 'validation: template_parameters (preview_too_long)' using errcode = '22023';
  end if;

  insert into public.whatsapp_template_send_intents (
    conversation_id, requested_by, template_snapshot_id, template_parameters,
    preview_text, idempotency_key, request_hash
  )
  values (
    p_conversation_id, v_actor, p_template_snapshot_id, p_template_parameters,
    v_preview, p_idempotency_key, v_hash
  )
  returning * into v_intent;

  return jsonb_build_object(
    'intent_id', v_intent.id,
    'reused', false,
    'lifecycle_status', v_intent.lifecycle_status,
    'outcome_code', null
  );
end;
$$;

comment on function public.create_whatsapp_utility_template_send_intent(uuid, uuid, jsonb, uuid) is
  'WM-2: records a human decision to send an APPROVED UTILITY template snapshot to ONE conversation. Actor is auth.uid(). Requires whatsapp.inbox.use + whatsapp.templates.use + the live CRM use predicate (assignment, tombstone), current APPROVED/UTILITY registry state matching the snapshot, service eligibility (consent, DNC, suppression) and valid parameters. The history preview is rendered here from the snapshot, never supplied by the caller. Idempotent per (actor, key).';

create or replace function public.request_whatsapp_template_sync(
  p_waba_id text,
  p_template_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_account public.whatsapp_business_accounts%rowtype;
  v_template public.whatsapp_templates%rowtype;
  v_run public.whatsapp_template_sync_runs%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select public.authorize('whatsapp.templates.manage')) then
    raise exception 'denied_templates_manage' using errcode = '42501';
  end if;
  if p_waba_id is null or p_waba_id !~ '^[0-9]{1,64}$' then
    raise exception 'validation: waba_id' using errcode = '22023';
  end if;

  select * into v_account from public.whatsapp_business_accounts where waba_id = p_waba_id;
  if not found or v_account.status <> 'active' then
    raise exception 'whatsapp_business_account_not_registered' using errcode = 'P0002';
  end if;

  if p_template_id is not null then
    select * into v_template
    from public.whatsapp_templates
    where id = p_template_id and business_account_id = v_account.id;
    if not found or v_template.provider_template_id is null then
      raise exception 'whatsapp_template_not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.whatsapp_template_sync_runs (business_account_id, requested_by, scope, template_id)
  values (
    v_account.id,
    v_actor,
    case when p_template_id is null then 'all' else 'template' end,
    p_template_id
  )
  returning * into v_run;

  return jsonb_build_object(
    'sync_run_id', v_run.id,
    'scope', v_run.scope,
    'waba_id', v_account.waba_id,
    'provider_template_id', v_template.provider_template_id
  );
end;
$$;

comment on function public.request_whatsapp_template_sync(text, uuid) is
  'WM-2: records that a whatsapp.templates.manage holder asked for a provider sync of a registered WABA (or one template status refresh). Writes no provider state itself; the service applies observations through apply_whatsapp_template_sync_item.';

create or replace function public.request_whatsapp_template_submission(
  p_waba_id text,
  p_idempotency_key uuid,
  p_name text,
  p_language text,
  p_category text,
  p_parameter_format text,
  p_components jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_account public.whatsapp_business_accounts%rowtype;
  v_existing public.whatsapp_template_submissions%rowtype;
  v_submission public.whatsapp_template_submissions%rowtype;
  v_outcome text;
  v_problem text;
  v_hash text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select public.authorize('whatsapp.templates.manage')) then
    raise exception 'denied_templates_manage' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'validation: idempotency_key' using errcode = '22023';
  end if;
  if p_waba_id is null or p_waba_id !~ '^[0-9]{1,64}$' then
    raise exception 'validation: waba_id' using errcode = '22023';
  end if;
  if p_name is null or p_name !~ '^[a-z0-9_]{1,128}$' then
    raise exception 'validation: name' using errcode = '22023';
  end if;
  if p_language is null or p_language !~ '^[a-z]{2,3}(_[A-Z]{2})?$' then
    raise exception 'validation: language' using errcode = '22023';
  end if;

  select * into v_account from public.whatsapp_business_accounts where waba_id = p_waba_id;
  if not found or v_account.status <> 'active' then
    raise exception 'whatsapp_business_account_not_registered' using errcode = 'P0002';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'waba_id', p_waba_id,
    'name', p_name,
    'language', p_language,
    'category', p_category,
    'parameter_format', p_parameter_format,
    'components', coalesce(p_components, 'null'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_existing
  from public.whatsapp_template_submissions
  where requested_by = v_actor and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    select e.event_kind into v_outcome
    from public.whatsapp_template_status_events e
    where e.submission_id = v_existing.id;
    return jsonb_build_object(
      'submission_id', v_existing.id,
      'reused', true,
      'outcome', v_outcome,
      'waba_id', v_account.waba_id
    );
  end if;

  v_problem := private.whatsapp_template_submission_problem(p_category, p_parameter_format, p_components);
  if v_problem is not null then
    raise exception 'validation: components (%)', v_problem using errcode = '22023';
  end if;

  if exists (
    select 1 from public.whatsapp_templates t
    where t.business_account_id = v_account.id
      and t.name = p_name
      and t.language = p_language
      and t.status in ('APPROVED', 'PENDING', 'IN_APPEAL', 'PAUSED', 'LIMIT_EXCEEDED')
  ) then
    raise exception 'template_name_language_exists' using errcode = '23505';
  end if;

  -- A request for the same name/language with no recorded outcome, or an
  -- ambiguous one, may already have reached Meta. It stays unresolved until a
  -- later provider sync has been requested for the account (which registers
  -- the template if Meta has it, tripping the check above). Never blindly
  -- resubmit.
  if exists (
    select 1 from public.whatsapp_template_submissions s
    where s.business_account_id = v_account.id
      and s.name = p_name
      and s.language = p_language
      and not exists (
        select 1 from public.whatsapp_template_status_events e
        where e.submission_id = s.id
          and e.event_kind in ('submission_failed', 'submission_accepted')
      )
      and not exists (
        select 1 from public.whatsapp_template_sync_runs r
        where r.business_account_id = s.business_account_id
          and r.scope = 'all'
          and r.created_at > s.created_at
      )
  ) then
    raise exception 'template_submission_unresolved' using errcode = '23505';
  end if;

  insert into public.whatsapp_template_submissions (
    business_account_id, requested_by, idempotency_key, request_hash,
    name, language, category, parameter_format, components
  )
  values (
    v_account.id, v_actor, p_idempotency_key, v_hash,
    p_name, p_language, p_category, p_parameter_format, p_components
  )
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'reused', false,
    'outcome', null,
    'waba_id', v_account.waba_id
  );
end;
$$;

comment on function public.request_whatsapp_template_submission(text, uuid, text, text, text, text, jsonb) is
  'WM-2: records a Template Studio create/submit request BEFORE the provider call. Requires whatsapp.templates.manage; UTILITY or MARKETING only; structural validation of components; refuses a name/language that is live or has an unresolved earlier submission. A replayed key returns the recorded request and outcome instead of calling Meta twice.';

create or replace function public.authorize_whatsapp_inbound_media_view(p_message_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_message public.whatsapp_messages%rowtype;
  v_media_id text;
  v_mime text;
  v_sha text;
  v_event_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_message_id is null then
    raise exception 'whatsapp_media_not_found' using errcode = 'P0002';
  end if;

  select * into v_message from public.whatsapp_messages where id = p_message_id;
  if not found
     or not (select private.whatsapp_inbox_can_view_conversation(v_message.conversation_id))
     or v_message.direction <> 'inbound'
     or v_message.normalized_message_type not in ('image', 'audio', 'video', 'document', 'sticker') then
    raise exception 'whatsapp_media_not_found' using errcode = 'P0002';
  end if;

  v_media_id := v_message.content ->> 'id';
  if v_media_id is null or v_media_id !~ '^[0-9]{1,64}$' then
    raise exception 'whatsapp_media_not_found' using errcode = 'P0002';
  end if;

  v_mime := lower(left(coalesce(v_message.content ->> 'mime_type', ''), 128));
  v_sha := left(coalesce(v_message.content ->> 'sha256', ''), 128);

  insert into public.whatsapp_media_access_events (message_id, actor_id, media_kind)
  values (v_message.id, v_actor, v_message.normalized_message_type)
  returning id into v_event_id;

  return jsonb_build_object(
    'access_event_id', v_event_id,
    'media_id', v_media_id,
    'media_kind', v_message.normalized_message_type,
    'declared_mime_type', nullif(split_part(v_mime, ';', 1), ''),
    'declared_sha256', nullif(v_sha, ''),
    'filename', nullif(left(coalesce(v_message.content ->> 'filename', ''), 200), '')
  );
end;
$$;

comment on function public.authorize_whatsapp_inbound_media_view(uuid) is
  'WM-2: authorises the CURRENT staff member to open one inbound media message they can view (tombstoned history included for manage scope) and records the access. Returns only the provider media id and declared metadata; never a URL or credential. Refused and missing raise the same not-found error.';

/* ========================================================================== */
/* 10. Provider-truth RPCs (service_role only)                                */
/* ========================================================================== */

create or replace function public.ensure_whatsapp_business_account(p_waba_id text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_waba_id is null or p_waba_id !~ '^[0-9]{1,64}$' then
    raise exception 'validation: waba_id' using errcode = '22023';
  end if;

  insert into public.whatsapp_business_accounts (provider, waba_id, status)
  values ('meta', p_waba_id, 'active')
  on conflict (waba_id) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.ensure_whatsapp_business_account(text) is
  'WM-2: registers the configured WABA so a template sync can run before the first webhook arrives. Service role only; never reactivates an archived or inactive account.';

/* Shared by sync and submission: upsert the registry row and emit evidence. */
create or replace function private.whatsapp_apply_template_observation(
  p_business_account_id uuid,
  p_source text,
  p_sync_run_id uuid,
  p_provider_template_id text,
  p_name text,
  p_language text,
  p_raw_status text,
  p_raw_category text,
  p_raw_quality_rating text,
  p_parameter_format text,
  p_components jsonb,
  p_rejected_reason text,
  p_origin text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existing public.whatsapp_templates%rowtype;
  v_row public.whatsapp_templates%rowtype;
  v_status text := private.whatsapp_normalize_template_status(p_raw_status);
  v_category text := private.whatsapp_normalize_template_category(p_raw_category);
  v_quality text := private.whatsapp_normalize_template_quality(p_raw_quality_rating);
  v_format text := case when upper(coalesce(p_parameter_format, '')) in ('POSITIONAL', 'NAMED')
    then upper(p_parameter_format) else null end;
  v_changed boolean := false;
  v_snapshot_id uuid;
begin
  if p_provider_template_id is null or p_provider_template_id !~ '^[0-9]{1,64}$' then
    raise exception 'validation: provider_template_id' using errcode = '22023';
  end if;
  if p_name is null or length(p_name) not between 1 and 128 then
    raise exception 'validation: name' using errcode = '22023';
  end if;
  if p_language is null or p_language !~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})?$' then
    raise exception 'validation: language' using errcode = '22023';
  end if;
  if p_components is null or jsonb_typeof(p_components) <> 'array' or pg_column_size(p_components) > 16384 then
    raise exception 'validation: components' using errcode = '22023';
  end if;

  select * into v_existing
  from public.whatsapp_templates
  where business_account_id = p_business_account_id and name = p_name and language = p_language
  for update;

  if not found then
    insert into public.whatsapp_templates (
      business_account_id, provider_template_id, name, language, category, raw_category,
      status, raw_status, quality_rating, raw_quality_rating, parameter_format, components,
      origin, rejected_reason, synced_at, provider_updated_at
    )
    values (
      p_business_account_id, p_provider_template_id, p_name, p_language, v_category,
      private.whatsapp_bound_raw_provider_value(p_raw_category),
      v_status, private.whatsapp_bound_raw_provider_value(p_raw_status),
      v_quality, private.whatsapp_bound_raw_provider_value(p_raw_quality_rating),
      v_format, p_components, p_origin, nullif(left(coalesce(p_rejected_reason, ''), 256), ''),
      case when p_source = 'submission' then null else now() end,
      now()
    )
    returning * into v_row;
    v_changed := true;
  else
    update public.whatsapp_templates set
      provider_template_id = p_provider_template_id,
      category = v_category,
      raw_category = private.whatsapp_bound_raw_provider_value(p_raw_category),
      status = v_status,
      raw_status = private.whatsapp_bound_raw_provider_value(p_raw_status),
      quality_rating = v_quality,
      raw_quality_rating = private.whatsapp_bound_raw_provider_value(p_raw_quality_rating),
      parameter_format = v_format,
      components = p_components,
      rejected_reason = nullif(left(coalesce(p_rejected_reason, ''), 256), ''),
      synced_at = case when p_source = 'submission' then v_existing.synced_at else now() end,
      provider_updated_at = case
        when v_existing.status is distinct from v_status
          or v_existing.category is distinct from v_category
          or v_existing.provider_template_id is distinct from p_provider_template_id
          then now()
        else v_existing.provider_updated_at
      end
    where id = v_existing.id
    returning * into v_row;

    v_changed := v_existing.status is distinct from v_row.status
      or v_existing.category is distinct from v_row.category
      or v_existing.quality_rating is distinct from v_row.quality_rating
      or v_existing.content_hash is distinct from v_row.content_hash
      or v_existing.provider_template_id is distinct from v_row.provider_template_id;
  end if;

  if v_row.status = 'APPROVED' then
    insert into public.whatsapp_template_snapshots (
      template_id, business_account_id, provider_template_id, name, language, category,
      parameter_format, components, content_hash, observed_status, quality_rating
    )
    values (
      v_row.id, v_row.business_account_id, v_row.provider_template_id, v_row.name, v_row.language,
      v_row.category, v_row.parameter_format, v_row.components, v_row.content_hash, 'APPROVED',
      v_row.quality_rating
    )
    on conflict (template_id, content_hash) do nothing
    returning id into v_snapshot_id;

    if v_snapshot_id is null then
      select s.id into v_snapshot_id
      from public.whatsapp_template_snapshots s
      where s.template_id = v_row.id and s.content_hash = v_row.content_hash;
    end if;
  end if;

  if p_source in ('sync', 'status_refresh') and v_changed then
    insert into public.whatsapp_template_status_events (
      template_id, sync_run_id, source, event_kind,
      previous_status, status, raw_status,
      previous_category, category, raw_category,
      quality_rating, raw_quality_rating, content_hash, details
    )
    values (
      v_row.id, p_sync_run_id, p_source,
      case when v_existing.id is null then 'observed' else 'changed' end,
      v_existing.status, v_row.status, v_row.raw_status,
      v_existing.category, v_row.category, v_row.raw_category,
      v_row.quality_rating, v_row.raw_quality_rating, v_row.content_hash,
      jsonb_build_object(
        'content_changed', v_existing.id is not null and v_existing.content_hash is distinct from v_row.content_hash,
        'provider_template_id_changed', v_existing.id is not null and v_existing.provider_template_id is distinct from v_row.provider_template_id,
        'snapshot_id', v_snapshot_id
      )
    );
  end if;

  return jsonb_build_object(
    'template_id', v_row.id,
    'status', v_row.status,
    'category', v_row.category,
    'changed', v_changed,
    'approved_snapshot_id', v_snapshot_id
  );
end;
$$;

revoke all on function private.whatsapp_apply_template_observation(uuid, text, uuid, text, text, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;

create or replace function public.apply_whatsapp_template_sync_item(
  p_sync_run_id uuid,
  p_provider_template_id text,
  p_name text,
  p_language text,
  p_raw_status text,
  p_raw_category text,
  p_raw_quality_rating text,
  p_parameter_format text,
  p_components jsonb,
  p_rejected_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.whatsapp_template_sync_runs%rowtype;
  v_scoped public.whatsapp_templates%rowtype;
begin
  select * into v_run from public.whatsapp_template_sync_runs where id = p_sync_run_id;
  if not found then
    raise exception 'whatsapp_template_sync_run_not_found' using errcode = 'P0002';
  end if;
  if v_run.created_at < now() - interval '1 hour' then
    raise exception 'whatsapp_template_sync_run_expired' using errcode = '22023';
  end if;

  if v_run.scope = 'template' then
    select * into v_scoped from public.whatsapp_templates where id = v_run.template_id;
    if v_scoped.provider_template_id is distinct from p_provider_template_id
       or v_scoped.name is distinct from p_name
       or v_scoped.language is distinct from p_language then
      raise exception 'whatsapp_template_sync_item_outside_run_scope' using errcode = '22023';
    end if;
  end if;

  return private.whatsapp_apply_template_observation(
    v_run.business_account_id,
    case when v_run.scope = 'template' then 'status_refresh' else 'sync' end,
    v_run.id,
    p_provider_template_id, p_name, p_language, p_raw_status, p_raw_category,
    p_raw_quality_rating, p_parameter_format, p_components, p_rejected_reason,
    'provider_sync'
  );
end;
$$;

comment on function public.apply_whatsapp_template_sync_item(uuid, text, text, text, text, text, text, text, jsonb, text) is
  'WM-2: applies ONE provider-observed template to the registry under a human-requested sync run. Service role only. Preserves raw status/category/quality, normalises unknown values to unknown, captures an immutable snapshot only when the provider says APPROVED, and records change evidence.';

create or replace function public.record_whatsapp_template_submission_outcome(
  p_submission_id uuid,
  p_outcome text,
  p_provider_template_id text default null,
  p_raw_status text default null,
  p_raw_category text default null,
  p_http_status integer default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_submission public.whatsapp_template_submissions%rowtype;
  v_applied jsonb;
  v_template_id uuid;
begin
  if p_outcome is null or p_outcome not in ('accepted', 'failed', 'ambiguous') then
    raise exception 'validation: outcome' using errcode = '22023';
  end if;

  select * into v_submission
  from public.whatsapp_template_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'whatsapp_template_submission_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.whatsapp_template_status_events e where e.submission_id = v_submission.id) then
    return jsonb_build_object(
      'outcome', 'already_recorded',
      'submission_id', v_submission.id,
      'recorded', (select e.event_kind from public.whatsapp_template_status_events e where e.submission_id = v_submission.id)
    );
  end if;

  if p_outcome = 'accepted' then
    -- The provider decides status and category. A missing value stays unknown:
    -- nothing here promotes a submission to APPROVED on ONEDECORE's say-so.
    v_applied := private.whatsapp_apply_template_observation(
      v_submission.business_account_id, 'submission', null,
      p_provider_template_id, v_submission.name, v_submission.language,
      p_raw_status, p_raw_category, null, v_submission.parameter_format,
      v_submission.components, null, 'studio_submission'
    );
    v_template_id := (v_applied ->> 'template_id')::uuid;
  end if;

  insert into public.whatsapp_template_status_events (
    template_id, submission_id, source, event_kind, status, raw_status, category, raw_category,
    http_status, error_code, details
  )
  values (
    v_template_id,
    v_submission.id,
    'submission',
    'submission_' || p_outcome,
    case when p_outcome = 'accepted' then v_applied ->> 'status' end,
    private.whatsapp_bound_raw_provider_value(p_raw_status),
    case when p_outcome = 'accepted' then v_applied ->> 'category' end,
    private.whatsapp_bound_raw_provider_value(p_raw_category),
    p_http_status,
    nullif(left(coalesce(p_error_code, ''), 64), ''),
    jsonb_build_object('provider_template_id', left(p_provider_template_id, 64))
  );

  return jsonb_build_object(
    'outcome', p_outcome,
    'submission_id', v_submission.id,
    'template_id', v_template_id,
    'status', v_applied ->> 'status'
  );
end;
$$;

comment on function public.record_whatsapp_template_submission_outcome(uuid, text, text, text, text, integer, text) is
  'WM-2: records the single outcome of a Studio submission. Service role only. accepted upserts the registry with the provider-returned status/category (missing -> unknown, never APPROVED by default); failed and ambiguous record evidence only. A second call returns already_recorded.';

create or replace function public.claim_whatsapp_template_send_intent(
  p_intent_id uuid,
  p_provider_code text,
  p_provider_attempt_key text
)
returns table (
  outcome_code text,
  intent_id uuid,
  dispatch_attempt_id uuid,
  phone_number_id text,
  customer_e164 text,
  template_name text,
  template_language text,
  send_components jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_intent public.whatsapp_template_send_intents%rowtype;
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_gate record;
  v_attempt_id uuid;
  v_problem text;
begin
  if p_provider_code is null or p_provider_code not in ('fake', 'meta') then
    raise exception 'validation: provider_code' using errcode = '22023';
  end if;
  if p_provider_attempt_key is null or length(p_provider_attempt_key) not between 1 and 128 then
    raise exception 'validation: provider_attempt_key' using errcode = '22023';
  end if;

  select * into v_intent
  from public.whatsapp_template_send_intents
  where id = p_intent_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;

  if v_intent.lifecycle_status = 'dispatch_bound' then
    return query select 'already_bound'::text, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;
  -- Another request holds the attempt, or a crash left it unresolved. Either
  -- way the provider may already have the message: no second call.
  if v_intent.lifecycle_status = 'dispatch_pending' then
    return query select 'in_flight'::text, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;
  if v_intent.lifecycle_status = 'needs_reconcile' then
    return query select 'needs_reconcile'::text, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;
  if v_intent.lifecycle_status <> 'eligible' then
    return query select 'not_claimable'::text, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;

  -- Re-prove everything at the moment of sending: permissions, CRM assignment,
  -- tombstone, template approval/category/content, consent, DNC, suppression.
  select * into v_gate
  from private.whatsapp_template_send_gate(v_intent.requested_by, v_intent.conversation_id, v_intent.template_snapshot_id);

  if v_gate.gate_code <> 'eligible' then
    update public.whatsapp_template_send_intents
    set lifecycle_status = 'ineligible', outcome_code = v_gate.gate_code
    where id = v_intent.id;
    return query select v_gate.gate_code, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;

  select * into v_snapshot from public.whatsapp_template_snapshots where id = v_intent.template_snapshot_id;

  v_problem := private.whatsapp_template_parameters_problem(v_snapshot.components, v_intent.template_parameters);
  if v_problem is not null then
    update public.whatsapp_template_send_intents
    set lifecycle_status = 'ineligible', outcome_code = 'template_parameters_invalid'
    where id = v_intent.id;
    return query select 'template_parameters_invalid'::text, v_intent.id, null::uuid, null::text, null::text, null::text, null::text, null::jsonb;
    return;
  end if;

  insert into public.whatsapp_template_dispatch_attempts (
    template_send_intent_id, provider_code, provider_attempt_key
  )
  values (v_intent.id, p_provider_code, p_provider_attempt_key)
  returning id into v_attempt_id;

  update public.whatsapp_template_send_intents
  set lifecycle_status = 'dispatch_pending', outcome_code = null
  where id = v_intent.id;

  return query select
    'claimed'::text,
    v_intent.id,
    v_attempt_id,
    v_gate.phone_number_id,
    v_gate.customer_e164,
    v_snapshot.name,
    v_snapshot.language,
    private.whatsapp_build_template_send_components(
      v_snapshot.components, v_snapshot.parameter_format, v_intent.template_parameters
    );
end;
$$;

comment on function public.claim_whatsapp_template_send_intent(uuid, text, text) is
  'WM-2: service-role claim of an eligible template send intent. Re-runs the full send gate for the requester (tombstone, reassignment, permission loss, template approval/category/content drift, consent/DNC/suppression) and records ineligible with the reason instead of sending. Creates the single provider attempt and returns the type=template components built from validated parameters. in_flight / needs_reconcile never yield a second provider call.';

/* Binding after provider acceptance: the only writer of template outbound messages. */
create or replace function private.whatsapp_bind_template_dispatch_attempt(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text,
  p_provider_timestamp timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attempt public.whatsapp_template_dispatch_attempts%rowtype;
  v_intent public.whatsapp_template_send_intents%rowtype;
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_conv public.whatsapp_conversations%rowtype;
  v_sender text;
  v_message_id uuid;
  v_at timestamptz := coalesce(p_provider_timestamp, now());
begin
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 128 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;

  select * into v_attempt from public.whatsapp_template_dispatch_attempts where id = p_dispatch_attempt_id for update;
  select * into v_intent from public.whatsapp_template_send_intents where id = v_attempt.template_send_intent_id for update;

  if exists (select 1 from public.whatsapp_messages m where m.provider_message_id = p_provider_message_id) then
    raise exception 'provider_message_id_conflict' using errcode = '23505';
  end if;

  select * into v_snapshot from public.whatsapp_template_snapshots where id = v_intent.template_snapshot_id;
  select * into v_conv from public.whatsapp_conversations where id = v_intent.conversation_id;
  select private.whatsapp_business_sender_e164(pn.display_phone_number) into v_sender
  from public.whatsapp_phone_numbers pn where pn.id = v_conv.phone_number_id;

  if v_sender is null then
    raise exception 'denied_sender_unresolvable' using errcode = '22023';
  end if;

  insert into public.whatsapp_messages (
    conversation_id, provider_message_id, direction, provider_message_type,
    normalized_message_type, sender_e164, recipient_e164, body_text, content,
    provider_timestamp, latest_status
  )
  values (
    v_intent.conversation_id,
    p_provider_message_id,
    'outbound',
    'template',
    'text',
    v_sender,
    v_conv.customer_e164,
    v_intent.preview_text,
    jsonb_build_object(
      'template', jsonb_build_object(
        'template_id', v_snapshot.template_id,
        'snapshot_id', v_snapshot.id,
        'provider_template_id', v_snapshot.provider_template_id,
        'name', v_snapshot.name,
        'language', v_snapshot.language,
        'category', v_snapshot.category,
        'parameter_format', v_snapshot.parameter_format
      ),
      'parameters', v_intent.template_parameters,
      'template_send_intent_id', v_intent.id
    ),
    v_at,
    null
  )
  returning id into v_message_id;

  update public.whatsapp_template_dispatch_attempts
  set status = 'succeeded',
      provider_message_id = p_provider_message_id,
      completed_at = now()
  where id = v_attempt.id;

  update public.whatsapp_template_send_intents
  set lifecycle_status = 'dispatch_bound',
      outbound_message_id = v_message_id,
      outcome_code = null
  where id = v_intent.id;

  update public.whatsapp_conversations
  set last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), v_at),
      updated_at = now()
  where id = v_intent.conversation_id;

  return jsonb_build_object(
    'outcome', 'bound',
    'intent_id', v_intent.id,
    'outbound_message_id', v_message_id,
    'provider_message_id', p_provider_message_id
  );
end;
$$;

revoke all on function private.whatsapp_bind_template_dispatch_attempt(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.complete_whatsapp_template_send_intent(
  p_dispatch_attempt_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_provider_timestamp timestamptz default null,
  p_error_class text default null,
  p_error_code text default null,
  p_http_status integer default null,
  p_response_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attempt public.whatsapp_template_dispatch_attempts%rowtype;
  v_intent public.whatsapp_template_send_intents%rowtype;
begin
  if p_outcome is null or p_outcome not in ('success', 'failed', 'ambiguous') then
    raise exception 'validation: outcome' using errcode = '22023';
  end if;
  if p_error_class is not null and p_error_class not in ('transient', 'terminal', 'ambiguous') then
    raise exception 'validation: error_class' using errcode = '22023';
  end if;
  if p_response_snapshot is null
     or jsonb_typeof(p_response_snapshot) <> 'object'
     or pg_column_size(p_response_snapshot) > 4096 then
    raise exception 'validation: response_snapshot' using errcode = '22023';
  end if;

  select * into v_attempt from public.whatsapp_template_dispatch_attempts where id = p_dispatch_attempt_id for update;
  if not found then
    raise exception 'whatsapp_template_dispatch_attempt_not_found' using errcode = 'P0002';
  end if;
  select * into v_intent from public.whatsapp_template_send_intents where id = v_attempt.template_send_intent_id for update;

  if v_attempt.status = 'succeeded' then
    return jsonb_build_object('outcome', 'already_bound', 'intent_id', v_intent.id, 'outbound_message_id', v_intent.outbound_message_id);
  end if;
  if v_attempt.status <> 'requested' then
    return jsonb_build_object('outcome', 'already_finalized', 'intent_id', v_intent.id, 'attempt_status', v_attempt.status);
  end if;

  update public.whatsapp_template_dispatch_attempts
  set http_status = p_http_status,
      response_snapshot = p_response_snapshot,
      error_code = nullif(left(coalesce(p_error_code, ''), 64), '')
  where id = v_attempt.id;

  if p_outcome = 'success' then
    return private.whatsapp_bind_template_dispatch_attempt(v_attempt.id, p_provider_message_id, p_provider_timestamp);
  end if;

  update public.whatsapp_template_dispatch_attempts
  set status = case when p_outcome = 'ambiguous' then 'ambiguous' else 'failed' end,
      error_class = case when p_outcome = 'ambiguous' then 'ambiguous' else coalesce(p_error_class, 'terminal') end,
      completed_at = now()
  where id = v_attempt.id;

  update public.whatsapp_template_send_intents
  set lifecycle_status = case when p_outcome = 'ambiguous' then 'needs_reconcile' else 'failed' end,
      outcome_code = case when p_outcome = 'ambiguous' then 'provider_ambiguous' else 'provider_failed' end
  where id = v_intent.id;

  return jsonb_build_object('outcome', p_outcome, 'intent_id', v_intent.id);
end;
$$;

comment on function public.complete_whatsapp_template_send_intent(uuid, text, text, timestamptz, text, text, integer, jsonb) is
  'WM-2: records the provider result of a template dispatch attempt. Service role only. success binds a canonical outbound whatsapp_messages row (provider_message_type template, normalized text, bounded template identity + parameters, no credential); failed ends the intent; ambiguous parks it as needs_reconcile. Idempotent on an already-finalised attempt.';

create or replace function public.reconcile_whatsapp_template_dispatch_attempt(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attempt public.whatsapp_template_dispatch_attempts%rowtype;
begin
  select * into v_attempt from public.whatsapp_template_dispatch_attempts where id = p_dispatch_attempt_id for update;
  if not found then
    raise exception 'whatsapp_template_dispatch_attempt_not_found' using errcode = 'P0002';
  end if;
  if v_attempt.status = 'succeeded' then
    return jsonb_build_object('outcome', 'already_bound', 'provider_message_id', v_attempt.provider_message_id);
  end if;
  if v_attempt.status <> 'ambiguous' then
    return jsonb_build_object('outcome', 'not_reconcilable', 'attempt_status', v_attempt.status);
  end if;

  return private.whatsapp_bind_template_dispatch_attempt(v_attempt.id, p_provider_message_id, now())
    || jsonb_build_object('reconciled', true);
end;
$$;

comment on function public.reconcile_whatsapp_template_dispatch_attempt(uuid, text) is
  'WM-2: binds an AMBIGUOUS template attempt to provider evidence (a wamid proven to belong to it) without calling the provider again. Service role only.';

/* ========================================================================== */
/* 11. Ownership and execute grants                                           */
/* ========================================================================== */

alter function private.whatsapp_actor_holds_permission(uuid, text) owner to postgres;
alter function private.whatsapp_template_send_gate(uuid, uuid, uuid) owner to postgres;
alter function private.whatsapp_apply_template_observation(uuid, text, uuid, text, text, text, text, text, text, text, jsonb, text, text) owner to postgres;
alter function private.whatsapp_bind_template_dispatch_attempt(uuid, text, timestamptz) owner to postgres;
alter function public.list_whatsapp_template_registry(text, text, text, integer, integer) owner to postgres;
alter function public.list_whatsapp_sendable_utility_templates(uuid) owner to postgres;
alter function public.create_whatsapp_utility_template_send_intent(uuid, uuid, jsonb, uuid) owner to postgres;
alter function public.request_whatsapp_template_sync(text, uuid) owner to postgres;
alter function public.request_whatsapp_template_submission(text, uuid, text, text, text, text, jsonb) owner to postgres;
alter function public.authorize_whatsapp_inbound_media_view(uuid) owner to postgres;
alter function public.ensure_whatsapp_business_account(text) owner to postgres;
alter function public.apply_whatsapp_template_sync_item(uuid, text, text, text, text, text, text, text, jsonb, text) owner to postgres;
alter function public.record_whatsapp_template_submission_outcome(uuid, text, text, text, text, integer, text) owner to postgres;
alter function public.claim_whatsapp_template_send_intent(uuid, text, text) owner to postgres;
alter function public.complete_whatsapp_template_send_intent(uuid, text, text, timestamptz, text, text, integer, jsonb) owner to postgres;
alter function public.reconcile_whatsapp_template_dispatch_attempt(uuid, text) owner to postgres;

revoke all on function public.list_whatsapp_template_registry(text, text, text, integer, integer) from public, anon;
revoke all on function public.list_whatsapp_sendable_utility_templates(uuid) from public, anon;
revoke all on function public.create_whatsapp_utility_template_send_intent(uuid, uuid, jsonb, uuid) from public, anon;
revoke all on function public.request_whatsapp_template_sync(text, uuid) from public, anon;
revoke all on function public.request_whatsapp_template_submission(text, uuid, text, text, text, text, jsonb) from public, anon;
revoke all on function public.authorize_whatsapp_inbound_media_view(uuid) from public, anon;

grant execute on function public.list_whatsapp_template_registry(text, text, text, integer, integer) to authenticated;
grant execute on function public.list_whatsapp_sendable_utility_templates(uuid) to authenticated;
grant execute on function public.create_whatsapp_utility_template_send_intent(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.request_whatsapp_template_sync(text, uuid) to authenticated;
grant execute on function public.request_whatsapp_template_submission(text, uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.authorize_whatsapp_inbound_media_view(uuid) to authenticated;

revoke all on function public.ensure_whatsapp_business_account(text) from public, anon, authenticated;
revoke all on function public.apply_whatsapp_template_sync_item(uuid, text, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.record_whatsapp_template_submission_outcome(uuid, text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_template_send_intent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_whatsapp_template_send_intent(uuid, text, text, timestamptz, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_whatsapp_template_dispatch_attempt(uuid, text) from public, anon, authenticated;

grant execute on function public.ensure_whatsapp_business_account(text) to service_role;
grant execute on function public.apply_whatsapp_template_sync_item(uuid, text, text, text, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.record_whatsapp_template_submission_outcome(uuid, text, text, text, text, integer, text) to service_role;
grant execute on function public.claim_whatsapp_template_send_intent(uuid, text, text) to service_role;
grant execute on function public.complete_whatsapp_template_send_intent(uuid, text, text, timestamptz, text, text, integer, jsonb) to service_role;
grant execute on function public.reconcile_whatsapp_template_dispatch_attempt(uuid, text) to service_role;
