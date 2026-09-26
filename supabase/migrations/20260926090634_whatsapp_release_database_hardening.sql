-- P6 release database hardening.
-- Forward-only patch after the P1-P4 migrations. Never rewrites managed history.

-- Supabase default table privileges include non-DML capabilities for authenticated.
-- P3 intentionally grants only SELECT/INSERT/UPDATE on the editable draft table and
-- SELECT on its audit stream, so explicitly strip the non-RLS capabilities.
revoke truncate, references, trigger
  on public.whatsapp_template_drafts
  from authenticated;

revoke truncate, references, trigger
  on public.whatsapp_template_draft_events
  from authenticated;

-- Restore the positional-variable invariant from the original Template Studio
-- validator while preserving the richer P3 component/header/button support.
create or replace function private.whatsapp_template_submission_problem(
  p_category text,
  p_parameter_format text,
  p_components jsonb
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_component jsonb;
  v_button jsonb;
  v_type text;
  v_format text;
  v_seen text[] := array[]::text[];
  v_key record;
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
        if length(coalesce(v_component->>'text','')) not between 1 and 60 then
          return 'header_invalid';
        end if;
      elsif v_format in ('IMAGE','VIDEO','DOCUMENT') then
        if v_component ? 'text' then return 'header_invalid'; end if;
        if jsonb_typeof(v_component->'example') <> 'object'
           or jsonb_typeof(v_component->'example'->'header_handle') <> 'array'
           or jsonb_array_length(v_component->'example'->'header_handle') <> 1
           or length(coalesce(v_component->'example'->'header_handle'->>0,'')) not between 1 and 2048 then
          return 'header_media_example_missing';
        end if;
      elsif v_format = 'LOCATION' then
        if v_component ? 'text' or v_component ? 'example' then
          return 'header_invalid';
        end if;
      else
        return 'header_invalid';
      end if;
    elsif v_type = 'BODY' then
      if length(coalesce(v_component->>'text','')) not between 1 and 1024 then
        return 'body_invalid';
      end if;
    elsif v_type = 'FOOTER' then
      if length(coalesce(v_component->>'text','')) not between 1 and 60
         or (v_component->>'text') ~ '\{\{' then
        return 'footer_invalid';
      end if;
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
            if coalesce(v_button->>'url','') !~ '^https://[^\s{}]{4,1990}$' then
              return 'button_url_invalid';
            end if;
          when 'PHONE_NUMBER' then
            if coalesce(v_button->>'phone_number','') !~ '^\+[1-9]\d{1,14}$' then
              return 'button_phone_invalid';
            end if;
          when 'FLOW' then
            if length(coalesce(v_button->>'flow_id','')) not between 1 and 128 then
              return 'button_flow_invalid';
            end if;
            if coalesce(v_button->>'flow_action','navigate') <> 'navigate' then
              return 'button_flow_invalid';
            end if;
            if length(coalesce(v_button->>'navigate_screen','')) not between 1 and 128 then
              return 'button_flow_invalid';
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

  -- P3 remains POSITIONAL-only. Every discovered variable must be numeric.
  for v_key in
    select * from private.whatsapp_template_variable_keys(p_components)
  loop
    if v_key.key !~ '^[1-9][0-9]{0,2}$' then
      return 'parameter_format_mismatch';
    end if;
  end loop;

  -- Within each template component, positional variables must be exactly 1..n.
  for v_key in
    select k.component, count(*)::integer as n, max(k.key::integer) as top
    from private.whatsapp_template_variable_keys(p_components) k
    group by k.component
  loop
    if v_key.top <> v_key.n then
      return 'parameter_positions_not_sequential';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function private.whatsapp_template_submission_problem(text,text,jsonb)
  from public, anon, authenticated;

comment on function private.whatsapp_template_submission_problem(text,text,jsonb) is
  'P6 hardened provider-submission validator: richer P3 components plus strict sequential POSITIONAL variables.';
