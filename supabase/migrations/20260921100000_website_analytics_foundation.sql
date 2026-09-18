-- Native first-party website analytics foundation.
-- Consent-gated, PII-free traffic measurement linked to CRM only by lead UUID.
-- No direct anon/authenticated writes; public ingestion is service-role only.

insert into public.permissions (code, name, description, is_system, is_active)
values (
  'website.analytics.read',
  'Read website analytics',
  'View consented first-party website traffic and CRM conversion analytics',
  true,
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code = 'website.analytics.read'
on conflict (role_id, permission_id) do nothing;

create table public.website_analytics_visitors (
  id uuid primary key,
  consent_version text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint chk_website_analytics_visitor_consent
    check (length(trim(consent_version)) between 2 and 32)
);

create table public.website_analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null references public.website_analytics_visitors(id) on delete cascade,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  landing_path text not null,
  referrer_host text,
  source_key text not null,
  medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  has_meta_click boolean not null default false,
  has_google_click boolean not null default false,
  constraint chk_website_analytics_session_path
    check (landing_path ~ '^/' and length(landing_path) <= 500),
  constraint chk_website_analytics_referrer
    check (referrer_host is null or length(referrer_host) <= 253),
  constraint chk_website_analytics_source
    check (source_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_website_analytics_medium
    check (medium is null or length(medium) <= 80),
  constraint chk_website_analytics_campaign
    check (utm_campaign is null or length(utm_campaign) <= 200),
  constraint chk_website_analytics_content
    check (utm_content is null or length(utm_content) <= 200),
  constraint chk_website_analytics_term
    check (utm_term is null or length(utm_term) <= 200)
);

create table public.website_analytics_events (
  id uuid primary key,
  session_id uuid not null references public.website_analytics_sessions(id) on delete cascade,
  event_type text not null,
  path text not null,
  action_key text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_website_analytics_event_type check (
    event_type in (
      'page_view',
      'cta_click',
      'contact_whatsapp',
      'contact_phone',
      'lead_form_start',
      'lead_form_submit',
      'lead_submit_success'
    )
  ),
  constraint chk_website_analytics_event_path
    check (path ~ '^/' and length(path) <= 500),
  constraint chk_website_analytics_action
    check (action_key is null or length(action_key) <= 120)
);

create table public.website_analytics_lead_links (
  session_id uuid not null references public.website_analytics_sessions(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (session_id, lead_id),
  constraint uq_website_analytics_lead_link unique (lead_id)
);

comment on table public.website_analytics_visitors is
  'Consent-gated anonymous first-party website measurement. UUID only; no customer PII.';
comment on table public.website_analytics_sessions is
  'Consent-gated measured sessions with bounded traffic-source metadata; no raw click IDs or PII.';
comment on table public.website_analytics_events is
  'PII-free website behavior events for public conversion measurement.';
comment on table public.website_analytics_lead_links is
  'Controlled bridge from an anonymous measured session to the authoritative CRM lead.';

create index idx_website_analytics_sessions_started
  on public.website_analytics_sessions (started_at desc);
create index idx_website_analytics_sessions_source_started
  on public.website_analytics_sessions (source_key, started_at desc);
create index idx_website_analytics_sessions_campaign_started
  on public.website_analytics_sessions (utm_campaign, started_at desc)
  where utm_campaign is not null;
create index idx_website_analytics_events_session_time
  on public.website_analytics_events (session_id, occurred_at);
create index idx_website_analytics_events_type_time
  on public.website_analytics_events (event_type, occurred_at desc);
create index idx_website_analytics_links_time
  on public.website_analytics_lead_links (linked_at desc);

alter table public.website_analytics_visitors enable row level security;
alter table public.website_analytics_sessions enable row level security;
alter table public.website_analytics_events enable row level security;
alter table public.website_analytics_lead_links enable row level security;
alter table public.website_analytics_visitors force row level security;
alter table public.website_analytics_sessions force row level security;
alter table public.website_analytics_events force row level security;
alter table public.website_analytics_lead_links force row level security;

revoke all on table public.website_analytics_visitors from public, anon, authenticated;
revoke all on table public.website_analytics_sessions from public, anon, authenticated;
revoke all on table public.website_analytics_events from public, anon, authenticated;
revoke all on table public.website_analytics_lead_links from public, anon, authenticated;
grant select on table public.website_analytics_visitors to authenticated;
grant select on table public.website_analytics_sessions to authenticated;
grant select on table public.website_analytics_events to authenticated;
grant select on table public.website_analytics_lead_links to authenticated;

create policy website_analytics_visitors_read
  on public.website_analytics_visitors for select to authenticated
  using ((select public.authorize('website.analytics.read')));
create policy website_analytics_sessions_read
  on public.website_analytics_sessions for select to authenticated
  using ((select public.authorize('website.analytics.read')));
create policy website_analytics_events_read
  on public.website_analytics_events for select to authenticated
  using ((select public.authorize('website.analytics.read')));
create policy website_analytics_lead_links_read
  on public.website_analytics_lead_links for select to authenticated
  using ((select public.authorize('website.analytics.read')));

create or replace function private.website_analytics_normalize_text(
  p_value text,
  p_max integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    else left(regexp_replace(btrim(p_value), '[[:cntrl:]]', '', 'g'), p_max)
  end;
$$;

create or replace function private.resolve_website_lead_source_code(p_attribution jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_source text := lower(coalesce(
    nullif(p_attribution->>'utmSource', ''),
    nullif(p_attribution->>'utm_source', ''),
    ''
  ));
  v_medium text := lower(coalesce(
    nullif(p_attribution->>'utmMedium', ''),
    nullif(p_attribution->>'utm_medium', ''),
    ''
  ));
  v_referrer text := lower(coalesce(
    nullif(p_attribution->>'referrerHost', ''),
    nullif(p_attribution->>'referrer_host', ''),
    ''
  ));
  v_paid boolean;
begin
  v_paid := v_medium in (
    'cpc', 'ppc', 'paid', 'paid_social', 'social_paid',
    'paid-social', 'display', 'retargeting'
  ) or coalesce(p_attribution->>'fbclid', '') <> ''
    or coalesce(p_attribution->>'gclid', '') <> ''
    or coalesce(p_attribution->>'wbraid', '') <> ''
    or coalesce(p_attribution->>'gbraid', '') <> '';

  if v_source in ('instagram', 'ig') then
    return case when v_paid then 'instagram_ads' else 'instagram_organic' end;
  elsif v_source in ('facebook', 'fb') then
    return case when v_paid then 'facebook_ads' else 'facebook_organic' end;
  elsif v_source in ('google', 'google_ads', 'googleads') then
    return case when v_paid then 'google_ads' else 'google_organic' end;
  elsif coalesce(p_attribution->>'gclid', '') <> ''
     or coalesce(p_attribution->>'wbraid', '') <> ''
     or coalesce(p_attribution->>'gbraid', '') <> '' then
    return 'google_ads';
  elsif v_referrer like '%google.%' then
    return 'google_organic';
  elsif v_referrer like '%instagram.%' then
    return 'instagram_organic';
  elsif v_referrer like '%facebook.%' or v_referrer like '%fb.%' then
    return 'facebook_organic';
  end if;

  -- A generic Meta click does not prove Facebook vs Instagram.
  return 'website_planner';
end;
$$;

create or replace function private.trg_leads_before_insert_source_enrichment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_source_code text;
begin
  if NEW.primary_source_id is null then
    if NEW.source in ('website-planner', 'local-test') then
      v_source_code := private.resolve_website_lead_source_code(
        coalesce(NEW.attribution, '{}'::jsonb)
      );
    else
      v_source_code := 'manual_entry';
    end if;

    select ls.id into v_source_id
    from public.lead_sources ls
    where ls.code = v_source_code
      and ls.is_active = true;

    if v_source_id is null and NEW.source in ('website-planner', 'local-test') then
      select ls.id into v_source_id
      from public.lead_sources ls
      where ls.code = 'website_planner'
        and ls.is_active = true;
    end if;

    if v_source_id is null then
      raise exception 'INACTIVE_OR_UNKNOWN_SOURCE'
        using errcode = '22023', hint = 'Active lead source required for new leads';
    end if;
    NEW.primary_source_id := v_source_id;
  elsif not exists (
    select 1 from public.lead_sources ls
    where ls.id = NEW.primary_source_id and ls.is_active = true
  ) then
    raise exception 'INACTIVE_SOURCE_NOT_SELECTABLE'
      using errcode = '22023',
            hint = 'Inactive sources may not be selected for new leads';
  end if;

  if NEW.entry_method is null then
    NEW.entry_method := case NEW.source
      when 'website-planner' then 'public_intake'
      when 'local-test' then 'local_test'
      else 'manual'
    end;
  end if;
  return NEW;
end;
$$;

create or replace function public.record_website_analytics_event(
  p_visitor_id uuid,
  p_session_id uuid,
  p_event_id uuid,
  p_consent_version text,
  p_event_type text,
  p_path text,
  p_action_key text default null,
  p_occurred_at timestamptz default now(),
  p_landing_path text default '/',
  p_referrer_host text default null,
  p_source_key text default 'direct',
  p_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_has_meta_click boolean default false,
  p_has_google_click boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_occurred timestamptz;
begin
  if p_visitor_id is null or p_session_id is null or p_event_id is null then
    raise exception 'WEBSITE_ANALYTICS_INVALID_ID' using errcode = '22023';
  end if;
  if p_consent_version is null or length(trim(p_consent_version)) not between 2 and 32 then
    raise exception 'WEBSITE_ANALYTICS_INVALID_CONSENT' using errcode = '22023';
  end if;
  if p_event_type not in (
    'page_view', 'cta_click', 'contact_whatsapp', 'contact_phone',
    'lead_form_start', 'lead_form_submit', 'lead_submit_success'
  ) then
    raise exception 'WEBSITE_ANALYTICS_INVALID_EVENT' using errcode = '22023';
  end if;
  if p_path is null or p_path !~ '^/' or length(p_path) > 500
     or p_landing_path is null or p_landing_path !~ '^/' or length(p_landing_path) > 500 then
    raise exception 'WEBSITE_ANALYTICS_INVALID_PATH' using errcode = '22023';
  end if;
  if p_source_key is null or p_source_key !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'WEBSITE_ANALYTICS_INVALID_SOURCE' using errcode = '22023';
  end if;

  v_occurred := greatest(
    least(coalesce(p_occurred_at, v_now), v_now + interval '5 minutes'),
    v_now - interval '24 hours'
  );

  insert into public.website_analytics_visitors (
    id, consent_version, first_seen_at, last_seen_at
  ) values (
    p_visitor_id, trim(p_consent_version), v_occurred, v_occurred
  )
  on conflict (id) do update set
    consent_version = excluded.consent_version,
    last_seen_at = greatest(public.website_analytics_visitors.last_seen_at, excluded.last_seen_at);

  insert into public.website_analytics_sessions (
    id, visitor_id, started_at, last_seen_at, landing_path,
    referrer_host, source_key, medium, utm_campaign, utm_content, utm_term,
    has_meta_click, has_google_click
  ) values (
    p_session_id, p_visitor_id, v_occurred, v_occurred, p_landing_path,
    private.website_analytics_normalize_text(lower(p_referrer_host), 253),
    p_source_key,
    private.website_analytics_normalize_text(lower(p_medium), 80),
    private.website_analytics_normalize_text(p_utm_campaign, 200),
    private.website_analytics_normalize_text(p_utm_content, 200),
    private.website_analytics_normalize_text(p_utm_term, 200),
    coalesce(p_has_meta_click, false),
    coalesce(p_has_google_click, false)
  )
  on conflict (id) do update set
    last_seen_at = greatest(public.website_analytics_sessions.last_seen_at, excluded.last_seen_at);

  insert into public.website_analytics_events (
    id, session_id, event_type, path, action_key, occurred_at
  ) values (
    p_event_id, p_session_id, p_event_type, p_path,
    private.website_analytics_normalize_text(p_action_key, 120),
    v_occurred
  )
  on conflict (id) do nothing;

  return jsonb_build_object('outcome_code', 'ok');
end;
$$;

revoke all on function public.record_website_analytics_event(
  uuid, uuid, uuid, text, text, text, text, timestamptz, text,
  text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.record_website_analytics_event(
  uuid, uuid, uuid, text, text, text, text, timestamptz, text,
  text, text, text, text, text, text, boolean, boolean
) to service_role;

create or replace function private.trg_website_analytics_link_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_text text;
  v_session_id uuid;
begin
  v_session_text := nullif(coalesce(NEW.attribution, '{}'::jsonb)->>'analyticsSessionId', '');
  if v_session_text is null
     or v_session_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    return NEW;
  end if;
  v_session_id := v_session_text::uuid;

  insert into public.website_analytics_lead_links (session_id, lead_id, linked_at)
  select v_session_id, NEW.id, NEW.created_at
  where exists (
    select 1 from public.website_analytics_sessions s where s.id = v_session_id
  )
  on conflict (lead_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_website_analytics_link_lead on public.leads;
create trigger trg_website_analytics_link_lead
  after insert on public.leads
  for each row execute function private.trg_website_analytics_link_lead();

create or replace function public.get_website_analytics_dashboard(
  p_from date default (current_date - 29),
  p_to date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_until timestamptz;
  v_result jsonb;
begin
  if not public.authorize('website.analytics.read') then
    raise exception 'WEBSITE_ANALYTICS_FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to
     or p_to - p_from > 366 then
    raise exception 'WEBSITE_ANALYTICS_INVALID_RANGE' using errcode = '22023';
  end if;

  v_from := p_from::timestamp at time zone 'Asia/Kolkata';
  v_until := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';

  with session_base as (
    select s.*
    from public.website_analytics_sessions s
    where s.started_at >= v_from and s.started_at < v_until
  ),
  event_base as (
    select e.*
    from public.website_analytics_events e
    join session_base s on s.id = e.session_id
  ),
  lead_base as (
    select distinct s.source_key, s.utm_campaign, l.lead_id
    from session_base s
    join public.website_analytics_lead_links l on l.session_id = s.id
  ),
  conversion_base as (
    select lb.source_key, lb.utm_campaign, c.lead_id, c.conversion_type, c.value_minor
    from lead_base lb
    join public.campaign_conversion_feedback_events c on c.lead_id = lb.lead_id
  ),
  source_sessions as (
    select source_key,
      count(distinct visitor_id)::bigint as visitors,
      count(*)::bigint as sessions
    from session_base group by source_key
  ),
  source_events as (
    select s.source_key,
      count(*) filter (where e.event_type = 'page_view')::bigint as page_views,
      count(*) filter (where e.event_type in ('cta_click','contact_whatsapp','contact_phone'))::bigint as cta_actions
    from event_base e
    join session_base s on s.id = e.session_id
    group by s.source_key
  ),
  source_leads as (
    select source_key, count(distinct lead_id)::bigint as leads
    from lead_base group by source_key
  ),
  source_conversions as (
    select source_key,
      count(distinct lead_id) filter (where conversion_type='QualifiedLead')::bigint as qualified,
      count(distinct lead_id) filter (where conversion_type='ConsultationScheduled')::bigint as consultations,
      count(distinct lead_id) filter (where conversion_type='ProposalSent')::bigint as proposals,
      count(distinct lead_id) filter (where conversion_type='CommercialConversion')::bigint as commercial_conversions,
      coalesce(sum(value_minor) filter (where conversion_type='CommercialConversion'),0)::bigint as commercial_value_minor
    from conversion_base group by source_key
  ),
  source_rows as (
    select ss.source_key,
      ss.visitors, ss.sessions,
      coalesce(se.page_views,0) as page_views,
      coalesce(se.cta_actions,0) as cta_actions,
      coalesce(sl.leads,0) as leads,
      coalesce(sc.qualified,0) as qualified,
      coalesce(sc.consultations,0) as consultations,
      coalesce(sc.proposals,0) as proposals,
      coalesce(sc.commercial_conversions,0) as commercial_conversions,
      coalesce(sc.commercial_value_minor,0) as commercial_value_minor
    from source_sessions ss
    left join source_events se using (source_key)
    left join source_leads sl using (source_key)
    left join source_conversions sc using (source_key)
  ),
  campaign_sessions as (
    select utm_campaign,
      count(distinct visitor_id)::bigint as visitors,
      count(*)::bigint as sessions
    from session_base
    where utm_campaign is not null
    group by utm_campaign
  ),
  campaign_leads as (
    select utm_campaign, count(distinct lead_id)::bigint as leads
    from lead_base
    where utm_campaign is not null
    group by utm_campaign
  ),
  campaign_conversions as (
    select utm_campaign,
      count(distinct lead_id) filter (where conversion_type='QualifiedLead')::bigint as qualified,
      count(distinct lead_id) filter (where conversion_type='CommercialConversion')::bigint as commercial_conversions
    from conversion_base
    where utm_campaign is not null
    group by utm_campaign
  ),
  campaign_rows as (
    select cs.utm_campaign,
      cs.visitors, cs.sessions,
      coalesce(cl.leads,0) as leads,
      coalesce(cc.qualified,0) as qualified,
      coalesce(cc.commercial_conversions,0) as commercial_conversions
    from campaign_sessions cs
    left join campaign_leads cl using (utm_campaign)
    left join campaign_conversions cc using (utm_campaign)
    order by cs.sessions desc, cs.utm_campaign
    limit 100
  ),
  page_rows as (
    select path,
      count(*)::bigint as page_views,
      count(distinct session_id)::bigint as sessions
    from event_base
    where event_type = 'page_view'
    group by path
    order by page_views desc, path
    limit 50
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'timezone', 'Asia/Kolkata',
    'measurement_scope', 'consented_first_party',
    'totals', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from session_base),
      'sessions', (select count(*) from session_base),
      'page_views', (select count(*) from event_base where event_type='page_view'),
      'cta_actions', (select count(*) from event_base where event_type in ('cta_click','contact_whatsapp','contact_phone')),
      'form_starts', (select count(*) from event_base where event_type='lead_form_start'),
      'form_submits', (select count(*) from event_base where event_type='lead_form_submit'),
      'leads', (select count(distinct lead_id) from lead_base),
      'qualified', (select count(distinct lead_id) from conversion_base where conversion_type='QualifiedLead'),
      'consultations', (select count(distinct lead_id) from conversion_base where conversion_type='ConsultationScheduled'),
      'proposals', (select count(distinct lead_id) from conversion_base where conversion_type='ProposalSent'),
      'commercial_conversions', (select count(distinct lead_id) from conversion_base where conversion_type='CommercialConversion'),
      'commercial_value_minor', (select coalesce(sum(value_minor),0) from conversion_base where conversion_type='CommercialConversion')
    ),
    'sources', coalesce(
      (select jsonb_agg(to_jsonb(source_rows) order by sessions desc, source_key) from source_rows),
      '[]'::jsonb
    ),
    'campaigns', coalesce(
      (select jsonb_agg(to_jsonb(campaign_rows)) from campaign_rows),
      '[]'::jsonb
    ),
    'pages', coalesce(
      (select jsonb_agg(to_jsonb(page_rows)) from page_rows),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.get_website_analytics_dashboard(date, date)
  from public, anon;
grant execute on function public.get_website_analytics_dashboard(date, date)
  to authenticated;

revoke execute on function private.website_analytics_normalize_text(text, integer)
  from public, anon, authenticated;
revoke execute on function private.resolve_website_lead_source_code(jsonb)
  from public, anon, authenticated;
revoke execute on function private.trg_website_analytics_link_lead()
  from public, anon, authenticated;
