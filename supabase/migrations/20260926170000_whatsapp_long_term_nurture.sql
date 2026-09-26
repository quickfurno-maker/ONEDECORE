-- Long-term lead nurture: timeline-aware CRM WhatsApp promotion audiences.
-- App-side preparation only; provider execution gates remain unchanged.
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
  v_rules jsonb := '[]'::jsonb;
begin
  if p_group is null or jsonb_typeof(p_group) <> 'object' or pg_column_size(p_group) > 16384 then
    raise exception 'CAMPAIGN_VALIDATION: invalid audience rule group' using errcode = '22023';
  end if;
  v_logic := p_group->>'logic';
  if v_logic not in ('and','or') or jsonb_typeof(p_group->'rules') <> 'array'
     or jsonb_array_length(p_group->'rules') not between 1 and 20 then
    raise exception 'CAMPAIGN_VALIDATION: invalid audience rule group' using errcode = '22023';
  end if;
  for v_rule in select value from jsonb_array_elements(p_group->'rules')
  loop
    if jsonb_typeof(v_rule) <> 'object' then
      raise exception 'CAMPAIGN_VALIDATION: invalid audience rule' using errcode = '22023';
    end if;
    v_field := v_rule->>'field';
    v_operator := v_rule->>'operator';
    if v_field not in (
      'lead_source','lead_stage','service_interest','locality',
      'sales_temperature','lead_created_month','owner','budget',
      'last_interaction_age','milestone','dormant_duration','project_timeline'
    ) then
      raise exception 'CAMPAIGN_VALIDATION: unsupported audience field' using errcode = '22023';
    end if;
    if v_operator not in ('equals','not_equals','in','not_in')
       or jsonb_typeof(v_rule->'values') <> 'array' then
      raise exception 'CAMPAIGN_VALIDATION: invalid audience operator/values' using errcode = '22023';
    end if;
    select coalesce(array_agg(trim(lower(val))), array[]::text[]) into v_values
    from jsonb_array_elements_text(v_rule->'values') val;
    if cardinality(v_values) not between 1 and 20
       or exists (select 1 from unnest(v_values) v where v='' or length(v)>120) then
      raise exception 'CAMPAIGN_VALIDATION: audience value bounds' using errcode = '22023';
    end if;
    if v_field='sales_temperature'
       and exists (select 1 from unnest(v_values) v where v not in ('hot','warm','cold','lost')) then
      raise exception 'CAMPAIGN_VALIDATION: sales_temperature invalid' using errcode = '22023';
    end if;
    if v_field='lead_created_month'
       and exists (select 1 from unnest(v_values) v where v !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then
      raise exception 'CAMPAIGN_VALIDATION: lead_created_month invalid' using errcode = '22023';
    end if;
    if v_field='project_timeline'
       and exists (
         select 1 from unnest(v_values) v
         where v not in ('immediate','within-1-month','within-2-months','after-2-months')
       ) then
      raise exception 'CAMPAIGN_VALIDATION: project_timeline invalid' using errcode = '22023';
    end if;
    if v_field='owner'
       and exists (
         select 1 from unnest(v_values) v
         where v <> 'unassigned'
           and v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       ) then
      raise exception 'CAMPAIGN_VALIDATION: owner invalid' using errcode = '22023';
    end if;
    if v_field in ('last_interaction_age','dormant_duration')
       and exists (
         select 1 from unnest(v_values) v
         where v not in ('0-7d','8-14d','15-30d','31-60d','60d+','not_dormant')
       ) then
      raise exception 'CAMPAIGN_VALIDATION: activity bucket invalid' using errcode = '22023';
    end if;
    if v_field='milestone'
       and exists (
         select 1 from unnest(v_values) v
         where v not in ('consultation','site_visit','quotation')
       ) then
      raise exception 'CAMPAIGN_VALIDATION: milestone invalid' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct v order by v), array[]::text[])
      into v_distinct
    from unnest(v_values) v;
    if cardinality(v_distinct) <> cardinality(v_values)
       or (v_operator in ('equals','not_equals') and cardinality(v_distinct) <> 1) then
      raise exception 'CAMPAIGN_VALIDATION: duplicate/invalid audience values' using errcode = '22023';
    end if;
    v_rules := v_rules || jsonb_build_array(
      jsonb_build_object(
        'field',v_field,
        'operator',v_operator,
        'values',to_jsonb(v_distinct)
      )
    );
  end loop;

  select jsonb_build_object(
    'logic',v_logic,
    'rules',coalesce(
      jsonb_agg(r.elem order by r.elem->>'field',r.elem->>'operator',r.elem->>'values'),
      '[]'::jsonb
    )
  ) into p_group
  from jsonb_array_elements(v_rules) r(elem);
  return p_group;
end;
$$;

create or replace function private.campaign_rule_matches_lead_v4(
  p_rule jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text,
  p_sales_temperature text,
  p_created_at timestamptz,
  p_assigned_to uuid,
  p_budget_code text,
  p_last_activity_at timestamptz,
  p_on_hold_since timestamptz,
  p_has_consultation boolean,
  p_has_site_visit boolean,
  p_has_quotation boolean,
  p_timeline_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_operator text := p_rule->>'operator';
  v_actual text;
  v_values text[];
begin
  if p_rule->>'field' <> 'project_timeline' then
    return private.campaign_rule_matches_lead_v3(
      p_rule,p_lead_source,p_lead_status,p_service_code,p_locality,
      p_sales_temperature,p_created_at,p_assigned_to,p_budget_code,
      p_last_activity_at,p_on_hold_since,p_has_consultation,
      p_has_site_visit,p_has_quotation
    );
  end if;

  select coalesce(array_agg(val),array[]::text[]) into v_values
  from jsonb_array_elements_text(p_rule->'values') val;
  v_actual := lower(trim(coalesce(p_timeline_code,'')));

  if v_operator='equals' then return v_actual=v_values[1]; end if;
  if v_operator='not_equals' then return v_actual<>v_values[1]; end if;
  if v_operator='in' then return v_actual=any(v_values); end if;
  if v_operator='not_in' then return not (v_actual=any(v_values)); end if;
  return false;
end;
$$;

create or replace function private.campaign_rule_group_matches_lead_v4(
  p_group jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text,
  p_sales_temperature text,
  p_created_at timestamptz,
  p_assigned_to uuid,
  p_budget_code text,
  p_last_activity_at timestamptz,
  p_on_hold_since timestamptz,
  p_has_consultation boolean,
  p_has_site_visit boolean,
  p_has_quotation boolean,
  p_timeline_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule jsonb;
  v_match boolean;
  v_any boolean := false;
  v_all boolean := true;
begin
  for v_rule in select value from jsonb_array_elements(p_group->'rules')
  loop
    v_match := private.campaign_rule_matches_lead_v4(
      v_rule,p_lead_source,p_lead_status,p_service_code,p_locality,
      p_sales_temperature,p_created_at,p_assigned_to,p_budget_code,
      p_last_activity_at,p_on_hold_since,p_has_consultation,
      p_has_site_visit,p_has_quotation,p_timeline_code
    );
    v_any := v_any or v_match;
    v_all := v_all and v_match;
  end loop;
  if p_group->>'logic'='or' then return v_any; end if;
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
    left join public.lead_sources ls on ls.id=l.primary_source_id
    left join lateral (
      select
        max(a.occurred_at) as last_activity_at,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='consultation_scheduled') as had_consultation,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='site_visit_scheduled') as had_site_visit,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='proposal_sent') as had_quotation
      from public.lead_activities a
      where a.lead_id=l.id
    ) act on true
    where l.deleted_at is null and l.contact_id is not null
      and private.campaign_rule_group_matches_lead_v4(
        p_rule,ls.code,l.status,l.service_code,l.locality,
        l.manual_sales_temperature,l.created_at,l.assigned_to,
        coalesce(l.budget_range_code,l.budget_comfort_code),
        act.last_activity_at,l.on_hold_since,
        coalesce(act.had_consultation,false)
          or l.status in ('consultation_scheduled','site_visit_scheduled','proposal_sent','negotiation','closed_won'),
        coalesce(act.had_site_visit,false)
          or l.status in ('site_visit_scheduled','proposal_sent','negotiation','closed_won'),
        coalesce(act.had_quotation,false)
          or l.status in ('proposal_sent','negotiation','closed_won'),
        l.timeline_code
      )
  ) m
  where p_segment_rules is null
     or private.whatsapp_contact_matches_segment(m.contact_id,p_segment_rules);
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
    raise exception 'CAMPAIGN_VALIDATION: campaign_version_id required' using errcode='22023';
  end if;
  select * into v_version
  from public.campaign_versions
  where id=p_campaign_version_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  select * into v_rule
  from public.campaign_audience_rule_versions
  where campaign_version_id=v_version.id;
  v_email := 'email'=any(v_version.intended_channels);
  v_whatsapp := 'whatsapp'=any(v_version.intended_channels);

  with matched as (
    select l.id lead_id,l.contact_id,c.status contact_status
    from public.leads l
    join public.contacts c on c.id=l.contact_id
    left join public.lead_sources ls on ls.id=l.primary_source_id
    left join lateral (
      select
        max(a.occurred_at) last_activity_at,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='consultation_scheduled') had_consultation,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='site_visit_scheduled') had_site_visit,
        bool_or(a.activity_type='status.changed' and a.metadata->>'to'='proposal_sent') had_quotation
      from public.lead_activities a
      where a.lead_id=l.id
    ) act on true
    where l.deleted_at is null
      and private.campaign_rule_group_matches_lead_v4(
        v_rule.rule_group,ls.code,l.status,l.service_code,l.locality,
        l.manual_sales_temperature,l.created_at,l.assigned_to,
        coalesce(l.budget_range_code,l.budget_comfort_code),
        act.last_activity_at,l.on_hold_since,
        coalesce(act.had_consultation,false)
          or l.status in ('consultation_scheduled','site_visit_scheduled','proposal_sent','negotiation','closed_won'),
        coalesce(act.had_site_visit,false)
          or l.status in ('site_visit_scheduled','proposal_sent','negotiation','closed_won'),
        coalesce(act.had_quotation,false)
          or l.status in ('proposal_sent','negotiation','closed_won'),
        l.timeline_code
      )
  )
  select
    count(*)::integer,
    count(distinct contact_id)::integer,
    count(distinct contact_id) filter (
      where private.has_current_marketing_consent(contact_id)
    )::integer,
    count(distinct contact_id) filter (
      where contact_status='do_not_contact'
    )::integer,
    count(distinct contact_id) filter (
      where contact_status not in ('do_not_contact','merged','archived')
        and private.has_current_marketing_consent(contact_id)
        and (
          not v_email or exists(
            select 1 from public.contact_channels ch
            where ch.contact_id=matched.contact_id
              and ch.channel_type='email'
              and ch.status='active'
          )
        )
        and (
          not v_whatsapp or exists(
            select 1 from public.contact_channels ch
            where ch.contact_id=matched.contact_id
              and ch.channel_type='whatsapp'
              and ch.status='active'
          )
        )
    )::integer
  into v_rule_match,v_distinct_contacts,v_consent,v_dnc,v_eligible
  from matched;

  return jsonb_build_object(
    'targeting_mode',v_version.targeting_mode,
    'rule_match_lead_count',coalesce(v_rule_match,0),
    'distinct_contact_count',coalesce(v_distinct_contacts,0),
    'current_marketing_consent_count',coalesce(v_consent,0),
    'dnc_blocked_count',coalesce(v_dnc,0),
    'eligible_direct_or_custom_count',
      case when v_version.targeting_mode='direct_or_custom' then coalesce(v_eligible,0) else null end,
    'evaluated_at',now(),
    'preview_label','Current preview — eligibility will be rechecked before future execution.'
  );
end;
$$;

revoke all on function private.campaign_rule_matches_lead_v4(
  jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,
  boolean,boolean,boolean,text
) from public,anon,authenticated;
revoke all on function private.campaign_rule_group_matches_lead_v4(
  jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,
  boolean,boolean,boolean,text
) from public,anon,authenticated;
revoke all on function private.whatsapp_campaign_audience_contact_ids(jsonb,jsonb)
  from public,anon,authenticated;
revoke all on function public.preview_campaign_audience(uuid)
  from public,anon;
grant execute on function public.preview_campaign_audience(uuid)
  to authenticated;

comment on function private.campaign_rule_group_matches_lead_v4(
  jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,
  boolean,boolean,boolean,text
) is
  'Long-term nurture matcher: P4 CRM audience semantics plus canonical project timeline.';

commit;
