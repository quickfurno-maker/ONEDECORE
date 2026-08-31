-- =============================================================================
-- CRM 2D — Lead commercial read models (forward-only)
-- Owner locks Q4/Q5/Q7 (2026-08-31). Canonical deal value + weighted pipeline.
--
-- Adds READ FUNCTIONS ONLY. No table, column, constraint, enum, trigger, index,
-- permission, role grant or RLS policy is created, altered or dropped.
--
-- Does NOT: mutate lead stage, touch transition/activity/cadence/quotation/
-- WhatsApp authorities, activate SLA, configure business hours, seed data,
-- persist any score, or add a scheduler/worker/queue.
--
-- Why SQL is required here at all (the rest of CRM 2D is pure TypeScript):
--   1. public.quotation_access_grants has RLS enabled with ZERO select policies
--      for `authenticated` (20260813140000), because the row holds
--      capability_token_hash / derivation_nonce. Distinguishing an ISSUED
--      quotation from a merely FINALIZED one therefore cannot be done as the
--      invoker, at any layer above the database.
--   2. The pipeline board fetches at most 30 leads per column while reporting
--      exact counts, so a weighted total derived from loaded cards would be
--      wrong past 30 leads. A correct aggregate must run set-based, server side.
-- =============================================================================

-- =============================================================================
-- A. private.crm_lead_deal_values — the single DEFINER helper
--
-- SECURITY DEFINER is required ONLY to read quotation_access_grants. It is
-- deliberately kept to a minimal non-secret projection:
--   (lead_id, status, state, taxable_base_paise, version_number,
--    quotation_id, quotation_number, at)
-- It NEVER returns capability_token_hash, derivation_nonce, grant id, or any
-- other capability material.
--
-- Cross-lead isolation is enforced INSIDE the function by the same predicate
-- the leads RLS policy uses — private.crm_can_view_lead(l.assigned_to) — so the
-- function can never return a row the caller could not already see through
-- leads_select_crm_scoped. It cannot be used as an existence oracle either:
-- an unviewable lead simply produces no row.
-- =============================================================================

create or replace function private.crm_lead_deal_values(
  p_owner_id uuid default null,
  p_lead_id uuid default null
)
returns table (
  lead_id uuid,
  lead_status text,
  commercial_state text,
  taxable_base_paise bigint,
  version_number integer,
  quotation_id uuid,
  quotation_number text,
  state_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible_leads as (
    select l.id, l.status, l.assigned_to
    from public.leads l
    where (select private.crm_can_view_lead(l.assigned_to))
      and (p_lead_id is null or l.id = p_lead_id)
      and (p_owner_id is null or l.assigned_to = p_owner_id)
  ),
  roots as (
    -- quotations.lead_id is UNIQUE (20260812140000), so this stays 1:1.
    select vl.id as lead_id, q.id as quotation_id, q.quotation_number
    from visible_leads vl
    join public.quotations q on q.lead_id = vl.id
  ),
  accepted as (
    select
      r.lead_id,
      qa.taxable_base_paise,
      qv.version_number,
      qa.accepted_at as state_at
    from roots r
    join public.quotation_acceptances qa on qa.quotation_id = r.quotation_id
    join public.quotation_versions qv on qv.id = qa.quotation_version_id
  ),
  issued as (
    -- Same evidence the CRM 2C proposal_sent gate treats as delivery: a
    -- finalized version with a live, non-revoked capability grant.
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      coalesce(qv.finalized_at, qv.updated_at) as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    join public.quotation_access_grants g
      on g.quotation_version_id = qv.id
     and g.revoked_at is null
    where qv.status = 'finalized'
    order by r.lead_id, qv.version_number desc
  ),
  finalized as (
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      coalesce(qv.finalized_at, qv.updated_at) as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    where qv.status = 'finalized'
    order by r.lead_id, qv.version_number desc
  ),
  drafted as (
    -- Owner lock Q4 rank 4: a current draft counts only when it carries a real
    -- number. A zero-value draft resolves to UNKNOWN, never to zero.
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      qv.updated_at as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    where qv.status = 'draft'
      and qv.is_current_draft = true
      and qv.taxable_base_paise > 0
    order by r.lead_id, qv.version_number desc
  )
  select
    vl.id,
    vl.status,
    case
      when a.lead_id is not null then 'accepted'
      when i.lead_id is not null then 'issued'
      when f.lead_id is not null then 'finalized'
      when d.lead_id is not null then 'draft'
      else 'unknown'
    end,
    coalesce(
      a.taxable_base_paise,
      i.taxable_base_paise,
      f.taxable_base_paise,
      d.taxable_base_paise
    ),
    coalesce(a.version_number, i.version_number, f.version_number, d.version_number),
    r.quotation_id,
    r.quotation_number,
    coalesce(a.state_at, i.state_at, f.state_at, d.state_at)
  from visible_leads vl
  left join roots r on r.lead_id = vl.id
  left join accepted a on a.lead_id = vl.id
  left join issued i on i.lead_id = vl.id
  left join finalized f on f.lead_id = vl.id
  left join drafted d on d.lead_id = vl.id;
$$;

comment on function private.crm_lead_deal_values(uuid, uuid) is
  'CRM 2D canonical deal-value resolver. DEFINER solely to read quotation_access_grants for the ISSUED tier; returns a non-secret projection only and re-applies private.crm_can_view_lead so it can never expose a lead outside the caller CRM scope. Value is taxable_base_paise (ex-tax, INR); NULL means unknown and must never be rendered as zero.';

alter function private.crm_lead_deal_values(uuid, uuid) owner to postgres;
revoke all on function private.crm_lead_deal_values(uuid, uuid) from public, anon;
grant execute on function private.crm_lead_deal_values(uuid, uuid) to authenticated;

-- =============================================================================
-- B. private.crm_stage_probability_bp — locked stage probabilities (Q5, Q7)
--
-- Basis points (1/100 of a percent) so weighted arithmetic stays integer-exact.
-- Encoded ONCE here and echoed to the client, so no surface hardcodes policy.
-- =============================================================================

create or replace function private.crm_stage_probability_bp(p_status text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new' then 500
    when 'assigned' then 1000
    when 'contacted' then 2000
    when 'qualified' then 3500
    when 'consultation_scheduled' then 5000
    when 'proposal_sent' then 6500
    when 'negotiation' then 8000
    when 'closed_won' then 10000
    when 'closed_lost' then 0
    when 'on_hold' then 0
    else 0
  end;
$$;

comment on function private.crm_stage_probability_bp(text) is
  'CRM 2D owner-locked stage probability in basis points. On Hold is 0 (PARKED) and is excluded from active weighted totals. Probability is a function of stage alone and is never derived from the lead score.';

alter function private.crm_stage_probability_bp(text) owner to postgres;
revoke all on function private.crm_stage_probability_bp(text) from public, anon;
grant execute on function private.crm_stage_probability_bp(text) to authenticated;

-- =============================================================================
-- C. public.get_crm_lead_commercial_state — SECURITY INVOKER wrapper
-- =============================================================================

create or replace function public.get_crm_lead_commercial_state(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_row record;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_lead_id is null then
    raise exception 'validation: lead_id required' using errcode = '22023';
  end if;

  if not (select public.authorize('quotations.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Fail closed on any lead outside CRM scope: no existence oracle.
  if not (select private.crm_can_view_lead_by_id(p_lead_id)) then
    raise exception 'forbidden: lead not visible' using errcode = '42501';
  end if;

  select * into v_row
  from private.crm_lead_deal_values(null, p_lead_id)
  limit 1;

  if not found then
    raise exception 'forbidden: lead not visible' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'leadId', v_row.lead_id,
    'state', v_row.commercial_state,
    'quotationId', v_row.quotation_id,
    'quotationNumber', v_row.quotation_number,
    'versionNumber', v_row.version_number,
    'taxableBasePaise', v_row.taxable_base_paise,
    'at', v_row.state_at,
    'probabilityBasisPoints',
      (select private.crm_stage_probability_bp(v_row.lead_status))
  );
end;
$$;

comment on function public.get_crm_lead_commercial_state(uuid) is
  'CRM 2D lead commercial state + canonical deal value (taxable_base_paise, ex-tax INR) + locked stage probability. taxableBasePaise NULL means unknown.';

alter function public.get_crm_lead_commercial_state(uuid) owner to postgres;
revoke all on function public.get_crm_lead_commercial_state(uuid) from public, anon;
grant execute on function public.get_crm_lead_commercial_state(uuid) to authenticated;

-- =============================================================================
-- D0. public.get_crm_lead_deal_values — bounded batch read for pipeline cards
--
-- SECURITY INVOKER. Per-card values must come from the SAME resolver as the
-- aggregate, otherwise a card and its column total could disagree. The helper
-- already applies private.crm_can_view_lead per row, so an id the caller cannot
-- see simply yields no row — passing foreign ids reveals nothing.
-- =============================================================================

create or replace function public.get_crm_lead_deal_values(p_lead_ids uuid[])
returns table (
  lead_id uuid,
  commercial_state text,
  taxable_base_paise bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('leads.read_all'))
    or (select public.authorize('leads.read_assigned'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not (select public.authorize('quotations.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_lead_ids is null or cardinality(p_lead_ids) = 0 then
    return;
  end if;

  -- Bounded: the pipeline board fetches 8 columns x 30 cards.
  if cardinality(p_lead_ids) > 300 then
    raise exception 'validation: too many lead ids' using errcode = '22023';
  end if;

  return query
    select d.lead_id, d.commercial_state, d.taxable_base_paise
    from private.crm_lead_deal_values(null, null) d
    where d.lead_id = any (p_lead_ids);
end;
$$;

comment on function public.get_crm_lead_deal_values(uuid[]) is
  'CRM 2D bounded batch deal-value read for pipeline cards. Shares the canonical resolver with get_crm_pipeline_value_summary so card values and column totals always agree. taxable_base_paise NULL means unknown.';

alter function public.get_crm_lead_deal_values(uuid[]) owner to postgres;
revoke all on function public.get_crm_lead_deal_values(uuid[]) from public, anon;
grant execute on function public.get_crm_lead_deal_values(uuid[]) to authenticated;

-- =============================================================================
-- D. public.get_crm_pipeline_value_summary — SECURITY INVOKER aggregate
--
-- Mirrors public.get_crm_my_day (20260829120000): explicit permission gate,
-- broad-read scope resolution, refusal to query another owner, single
-- clock_timestamp() capture, jsonb payload.
-- =============================================================================

create or replace function public.get_crm_pipeline_value_summary(
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
-- VOLATILE, matching public.get_crm_my_day: a single clock_timestamp() capture
-- is volatile, and mislabelling it STABLE risks the planner caching it.
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_actor uuid;
  v_broad boolean;
  v_scope_owner uuid;
begin
  v_actor := (select auth.uid());
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('leads.read_all'))
    or (select public.authorize('leads.read_assigned'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not (select public.authorize('quotations.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_broad := (select private.crm_has_broad_lead_read());

  if not v_broad then
    if p_owner_id is not null and p_owner_id is distinct from v_actor then
      raise exception 'forbidden: cannot query other owner' using errcode = '42501';
    end if;
    v_scope_owner := v_actor;
  else
    v_scope_owner := p_owner_id;
  end if;

  v_now := clock_timestamp();

  return (
    with rows_scoped as (
      select
        d.lead_status,
        d.taxable_base_paise,
        (select private.crm_stage_probability_bp(d.lead_status)) as bp
      from private.crm_lead_deal_values(v_scope_owner, null) d
      where d.lead_status not in ('closed_won', 'closed_lost')
    ),
    per_lead as (
      select
        lead_status,
        taxable_base_paise,
        bp,
        case
          when taxable_base_paise is null then null
          -- Round per lead, then sum: a card total always adds up to its column.
          else round((taxable_base_paise::numeric * bp) / 10000)::bigint
        end as weighted_paise
      from rows_scoped
    ),
    active_stages as (
      select
        lead_status as stage,
        count(*)::integer as lead_count,
        count(taxable_base_paise)::integer as valued_lead_count,
        coalesce(sum(taxable_base_paise), 0)::bigint as deal_value_paise,
        coalesce(sum(weighted_paise), 0)::bigint as weighted_value_paise,
        max(bp)::integer as probability_bp
      from per_lead
      where lead_status <> 'on_hold'
      group by lead_status
    ),
    parked as (
      select
        count(*)::integer as lead_count,
        count(taxable_base_paise)::integer as valued_lead_count,
        coalesce(sum(taxable_base_paise), 0)::bigint as deal_value_paise
      from per_lead
      where lead_status = 'on_hold'
    )
    select jsonb_build_object(
      'capturedAt', v_now,
      'scopeOwnerId', v_scope_owner,
      'isTeamScope', v_scope_owner is null,
      'stages', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'stage', stage,
            'leadCount', lead_count,
            'valuedLeadCount', valued_lead_count,
            'dealValuePaise', deal_value_paise,
            'weightedValuePaise', weighted_value_paise,
            'probabilityBasisPoints', probability_bp
          )
          order by stage
        )
        from active_stages
      ), '[]'::jsonb),
      'activeLeadCount', coalesce((select sum(lead_count) from active_stages), 0),
      'activeValuedLeadCount',
        coalesce((select sum(valued_lead_count) from active_stages), 0),
      'activeDealValuePaise',
        coalesce((select sum(deal_value_paise) from active_stages), 0),
      'activeWeightedValuePaise',
        coalesce((select sum(weighted_value_paise) from active_stages), 0),
      'parkedLeadCount', (select lead_count from parked),
      'parkedValuedLeadCount', (select valued_lead_count from parked),
      'parkedDealValuePaise', (select deal_value_paise from parked)
    )
  );
end;
$$;

comment on function public.get_crm_pipeline_value_summary(uuid) is
  'CRM 2D weighted pipeline aggregate over the full RLS-scoped lead set. Values are taxable_base_paise (ex-tax, INR); leads with unknown value are excluded from totals and reported via valuedLeadCount. On Hold is reported separately as parked and excluded from active totals.';

alter function public.get_crm_pipeline_value_summary(uuid) owner to postgres;
revoke all on function public.get_crm_pipeline_value_summary(uuid) from public, anon;
grant execute on function public.get_crm_pipeline_value_summary(uuid) to authenticated;
