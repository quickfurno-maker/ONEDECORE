-- CRM-native WhatsApp campaign audiences: manual sales bucket + lead month.
-- Manual Hot/Warm/Cold is authoritative; unset = Cold; closed_lost = Lost.
-- Meta/provider activation remains unchanged and safe-off.

begin;

create or replace function private.canonicalize_campaign_audience_rule_group(p_group jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_logic text;
  v_rule jsonb;
  v_field text;
  v_operator text;
  v_values text[];
  v_distinct text[];
  v_raw_count integer;
  v_rules jsonb := '[]'::jsonb;
begin
  if p_group is null or jsonb_typeof(p_group) <> 'object' then
    raise exception 'CAMPAIGN_VALIDATION: audience rule group required' using errcode = '22023';
  end if;
  if pg_column_size(p_group) > 16384 then
    raise exception 'CAMPAIGN_VALIDATION: audience rule exceeds 16KiB' using errcode = '22023';
  end if;

  v_logic := p_group->>'logic';
  if v_logic not in ('and', 'or') then
    raise exception 'CAMPAIGN_VALIDATION: audience logic must be and|or' using errcode = '22023';
  end if;
  if jsonb_typeof(p_group->'rules') <> 'array' then
    raise exception 'CAMPAIGN_VALIDATION: audience rules required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_group->'rules') < 1 or jsonb_array_length(p_group->'rules') > 20 then
    raise exception 'CAMPAIGN_VALIDATION: audience rules must be 1..20' using errcode = '22023';
  end if;

  for v_rule in select value from jsonb_array_elements(p_group->'rules')
  loop
    if jsonb_typeof(v_rule) <> 'object' then
      raise exception 'CAMPAIGN_VALIDATION: invalid audience rule' using errcode = '22023';
    end if;
    v_field := v_rule->>'field';
    v_operator := v_rule->>'operator';
    if v_field not in (
      'lead_source',
      'lead_stage',
      'service_interest',
      'locality',
      'sales_temperature',
      'lead_created_month'
    ) then
      raise exception 'CAMPAIGN_VALIDATION: unsupported audience field' using errcode = '22023';
    end if;
    if v_operator not in ('equals', 'not_equals', 'in', 'not_in') then
      raise exception 'CAMPAIGN_VALIDATION: unsupported audience operator' using errcode = '22023';
    end if;
    if jsonb_typeof(v_rule->'values') <> 'array' then
      raise exception 'CAMPAIGN_VALIDATION: audience values required' using errcode = '22023';
    end if;

    select coalesce(array_agg(trim(lower(val))), array[]::text[])
      into v_values
    from jsonb_array_elements_text(v_rule->'values') as val;

    v_raw_count := coalesce(cardinality(v_values), 0);
    if v_raw_count < 1 or v_raw_count > 20 then
      raise exception 'CAMPAIGN_VALIDATION: audience values must be 1..20' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_values) v where v is null or v = '' or length(v) > 120) then
      raise exception 'CAMPAIGN_VALIDATION: audience value bounds' using errcode = '22023';
    end if;
    if v_field = 'sales_temperature'
       and exists (select 1 from unnest(v_values) v where v not in ('hot','warm','cold','lost')) then
      raise exception 'CAMPAIGN_VALIDATION: sales_temperature invalid' using errcode = '22023';
    end if;
    if v_field = 'lead_created_month'
       and exists (select 1 from unnest(v_values) v where v !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then
      raise exception 'CAMPAIGN_VALIDATION: lead_created_month invalid' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct v order by v), array[]::text[])
      into v_distinct
    from unnest(v_values) v;

    if cardinality(v_distinct) <> v_raw_count then
      raise exception 'CAMPAIGN_VALIDATION: duplicate audience values' using errcode = '22023';
    end if;
    if v_operator in ('equals', 'not_equals') and cardinality(v_distinct) <> 1 then
      raise exception 'CAMPAIGN_VALIDATION: equals/not_equals requires one value' using errcode = '22023';
    end if;

    v_rules := v_rules || jsonb_build_array(
      jsonb_build_object(
        'field', v_field,
        'operator', v_operator,
        'values', to_jsonb(v_distinct)
      )
    );
  end loop;

  select jsonb_build_object(
    'logic', v_logic,
    'rules', coalesce(
      jsonb_agg(r.elem order by r.elem->>'field', r.elem->>'operator', r.elem->>'values'),
      '[]'::jsonb
    )
  )
  into p_group
  from jsonb_array_elements(v_rules) as r(elem);

  return p_group;
end;
$$;

create or replace function private.campaign_rule_matches_lead_v2(
  p_rule jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text,
  p_sales_temperature text,
  p_created_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_field text;
  v_operator text;
  v_actual text;
  v_values text[];
begin
  v_field := p_rule->>'field';
  v_operator := p_rule->>'operator';
  v_actual := case v_field
    when 'lead_source' then lower(trim(coalesce(p_lead_source, '')))
    when 'lead_stage' then lower(trim(coalesce(p_lead_status, '')))
    when 'service_interest' then lower(trim(coalesce(p_service_code, '')))
    when 'locality' then lower(trim(coalesce(p_locality, '')))
    when 'sales_temperature' then
      case
        when p_lead_status = 'closed_lost' then 'lost'
        else coalesce(nullif(lower(trim(p_sales_temperature)), ''), 'cold')
      end
    when 'lead_created_month' then
      case when p_created_at is null then '' else to_char(p_created_at at time zone 'Asia/Kolkata', 'YYYY-MM') end
    else null
  end;
  if v_actual is null then
    return false;
  end if;

  select coalesce(array_agg(val), array[]::text[])
    into v_values
  from jsonb_array_elements_text(p_rule->'values') val;

  if v_operator = 'equals' then
    return v_actual = v_values[1];
  elsif v_operator = 'not_equals' then
    return v_actual <> v_values[1];
  elsif v_operator = 'in' then
    return v_actual = any (v_values);
  elsif v_operator = 'not_in' then
    return not (v_actual = any (v_values));
  end if;
  return false;
end;
$$;

create or replace function private.campaign_rule_group_matches_lead_v2(
  p_group jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text,
  p_sales_temperature text,
  p_created_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_logic text;
  v_rule jsonb;
  v_match boolean;
  v_any boolean := false;
  v_all boolean := true;
begin
  v_logic := p_group->>'logic';
  for v_rule in select value from jsonb_array_elements(p_group->'rules')
  loop
    v_match := private.campaign_rule_matches_lead_v2(
      v_rule,
      p_lead_source,
      p_lead_status,
      p_service_code,
      p_locality,
      p_sales_temperature,
      p_created_at
    );
    v_any := v_any or v_match;
    v_all := v_all and v_match;
  end loop;
  if v_logic = 'or' then
    return v_any;
  end if;
  return v_all;
end;
$$;

create or replace function private.whatsapp_campaign_audience_contact_ids(
  p_rule jsonb,
  p_segment_rules jsonb
)
returns table(contact_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.contact_id
  from (
    select distinct l.contact_id
    from public.leads l
    left join public.lead_sources ls on ls.id = l.primary_source_id
    where l.deleted_at is null
      and l.contact_id is not null
      and private.campaign_rule_group_matches_lead_v2(
        p_rule,
        ls.code,
        l.status,
        l.service_code,
        l.locality,
        l.manual_sales_temperature,
        l.created_at
      )
  ) m
  where p_segment_rules is null
     or private.whatsapp_contact_matches_segment(m.contact_id, p_segment_rules);
$$;

create or replace function public.preview_campaign_audience(p_campaign_version_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_version public.campaign_versions%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_rule_match integer := 0;
  v_distinct_contacts integer := 0;
  v_consent integer := 0;
  v_dnc integer := 0;
  v_eligible integer := 0;
  v_email boolean;
  v_whatsapp boolean;
begin
  v_actor := private.marketing_require_actor('campaigns.read');
  if p_campaign_version_id is null then
    raise exception 'CAMPAIGN_VALIDATION: campaign_version_id required' using errcode = '22023';
  end if;

  select * into v_version
  from public.campaign_versions
  where id = p_campaign_version_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_rule
  from public.campaign_audience_rule_versions
  where campaign_version_id = v_version.id;

  v_email := 'email' = any (v_version.intended_channels);
  v_whatsapp := 'whatsapp' = any (v_version.intended_channels);

  with matched as (
    select l.id as lead_id, l.contact_id, c.status as contact_status
    from public.leads l
    join public.contacts c on c.id = l.contact_id
    left join public.lead_sources ls on ls.id = l.primary_source_id
    where l.deleted_at is null
      and private.campaign_rule_group_matches_lead_v2(
        v_rule.rule_group,
        ls.code,
        l.status,
        l.service_code,
        l.locality,
        l.manual_sales_temperature,
        l.created_at
      )
  )
  select
    count(*)::integer,
    count(distinct contact_id)::integer,
    count(distinct contact_id) filter (
      where private.has_current_marketing_consent(contact_id)
    )::integer,
    count(distinct contact_id) filter (
      where contact_status = 'do_not_contact'
    )::integer,
    count(distinct contact_id) filter (
      where contact_status not in ('do_not_contact', 'merged', 'archived')
        and private.has_current_marketing_consent(contact_id)
        and (
          not v_email or exists (
            select 1
            from public.contact_channels ch
            where ch.contact_id = matched.contact_id
              and ch.channel_type = 'email'
              and ch.status = 'active'
          )
        )
        and (
          not v_whatsapp or exists (
            select 1
            from public.contact_channels ch
            where ch.contact_id = matched.contact_id
              and ch.channel_type = 'whatsapp'
              and ch.status = 'active'
          )
        )
    )::integer
  into v_rule_match, v_distinct_contacts, v_consent, v_dnc, v_eligible
  from matched;

  return jsonb_build_object(
    'targeting_mode', v_version.targeting_mode,
    'rule_match_lead_count', coalesce(v_rule_match, 0),
    'distinct_contact_count', coalesce(v_distinct_contacts, 0),
    'current_marketing_consent_count', coalesce(v_consent, 0),
    'dnc_blocked_count', coalesce(v_dnc, 0),
    'eligible_direct_or_custom_count', case
      when v_version.targeting_mode = 'direct_or_custom' then coalesce(v_eligible, 0)
      else null
    end,
    'evaluated_at', now(),
    'preview_label', 'Current preview — eligibility will be rechecked before future execution.'
  );
end;
$$;

revoke all on function private.campaign_rule_matches_lead_v2(jsonb,text,text,text,text,text,timestamptz)
  from public, anon, authenticated;
revoke all on function private.campaign_rule_group_matches_lead_v2(jsonb,text,text,text,text,text,timestamptz)
  from public, anon, authenticated;
revoke all on function private.whatsapp_campaign_audience_contact_ids(jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.preview_campaign_audience(uuid)
  from public, anon;
grant execute on function public.preview_campaign_audience(uuid) to authenticated;

comment on function private.campaign_rule_group_matches_lead_v2(jsonb,text,text,text,text,text,timestamptz) is
  'Campaign audience matcher using CRM manual Hot/Warm/Cold, default Cold when unset, Closed Lost as Lost, plus IST lead-created month.';

commit;
