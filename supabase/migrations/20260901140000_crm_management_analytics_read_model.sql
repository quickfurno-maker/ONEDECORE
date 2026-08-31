-- =============================================================================
-- CRM 2E — Management analytics read model (forward-only)
--
-- Adds ONE public SECURITY INVOKER aggregate. No table, column, constraint,
-- enum, trigger, index, permission, role grant or RLS policy is created,
-- altered or dropped. No privilege is widened: every base relation the
-- function reads (leads, crm_sla_clocks, lead_events, sales_targets,
-- quotation_acceptances) is read AS THE CALLER, so the existing five-role CRM
-- RLS is the only scope authority and an aggregate can never span a scope the
-- caller could not already enumerate row by row.
--
-- Does NOT: mutate lead stage, activate or edit SLA policy, touch transition/
-- activity/cadence/quotation/WhatsApp authorities, create a second sales-credit
-- rule, persist any score or metric, seed data, or add a scheduler/worker.
--
-- Why SQL is required here at all:
--   1. supabase/config.toml pins PostgREST max_rows = 1000. First-response SLA,
--      the conversion funnel and stage-to-stage velocity are whole-cohort
--      measures; deriving them from a truncated page would silently understate
--      every denominator. They must run set-based, server side.
--   2. The conversion funnel needs first-entry instants reconstructed from
--      public.lead_events across the whole cohort. That is an aggregate over a
--      table whose row count is a multiple of the lead count; it cannot be
--      shipped to the client.
--   3. Target achievement sums public.quotation_acceptances. The count is
--      small today but unbounded, and an exact paise SUM must not depend on a
--      page boundary.
--
-- FORECAST IS NOT RE-IMPLEMENTED HERE. CRM 2E reuses
-- public.get_crm_pipeline_value_summary (CRM 2D, 20260831140000) verbatim, so
-- the locked stage probabilities exist in exactly one place.
-- =============================================================================

-- =============================================================================
-- public.get_crm_management_analytics
--
-- Mirrors public.get_crm_my_day (20260829120000) and
-- public.get_crm_pipeline_value_summary (20260831140000): explicit permission
-- gate, broad-read scope resolution, refusal to query another owner, a single
-- clock_timestamp() capture, jsonb payload.
--
-- Measurement semantics (all documented in
-- docs/product/crm-2e-management-analytics-design.md):
--
--   COHORT  = leads RECEIVED in [p_start, p_end] (leads.created_at), optionally
--             narrowed by owner and primary source. SLA, conversion and the
--             stage-to-stage velocity medians are cohort measures.
--   CURRENT = the open book right now, date range NOT applied. Active lead age
--             and days-in-current-stage are current measures, exactly like the
--             CRM 2D weighted forecast.
--
-- Percentages are emitted as integer BASIS POINTS (1/100 of a percent) so no
-- float ever reaches a ledger surface, and NULL whenever the denominator is
-- zero — never 0%, which would read as a real measurement.
-- =============================================================================

create or replace function public.get_crm_management_analytics(
  p_start timestamptz,
  p_end timestamptz,
  p_target_month date default null,
  p_owner_id uuid default null,
  p_source_id uuid default null
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
  v_can_read_commercial boolean;
  v_target_month date;
  v_target_period text;
begin
  v_actor := (select auth.uid());
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.reporting.read')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('leads.read_all'))
    or (select public.authorize('leads.read_assigned'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_start is null or p_end is null then
    raise exception 'validation: range required' using errcode = '22023';
  end if;

  if p_start > p_end then
    raise exception 'validation: range start after end' using errcode = '22023';
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

  -- Accepted-quotation truth is the ONLY achievement source. Without
  -- quotations.read the caller sees no acceptance rows at all, and a SUM over
  -- an empty set would render as a truthful-looking zero. Report UNKNOWN.
  v_can_read_commercial := (select public.authorize('quotations.read'));

  v_target_month := date_trunc(
    'month',
    coalesce(p_target_month, (p_start at time zone 'Asia/Kolkata')::date)
  )::date;
  v_target_period := to_char(v_target_month, 'YYYY-MM');

  v_now := clock_timestamp();

  return (
    with cohort as (
      select l.id, l.status, l.created_at, l.assigned_to
      from public.leads l
      where l.created_at >= p_start
        and l.created_at <= p_end
        and (v_scope_owner is null or l.assigned_to = v_scope_owner)
        and (p_source_id is null or l.primary_source_id = p_source_id)
    ),

    -- ---------------------------------------------------------------------
    -- A. First-response SLA
    --
    -- ELIGIBLE is exactly `sla_due_at is not null`. That column is written
    -- once, at receipt, by private.ensure_first_contact_sla_clock and only
    -- when the policy was already active AND created_at >= effective_from.
    -- Using it as the denominator therefore makes non-retroactivity a
    -- property of the data, not of a predicate re-derived here: a lead
    -- received before activation can never enter the denominator, and a
    -- later activation can never retroactively pull it in.
    --
    -- MET uses first_contact_attempt_at, the canonical CRM 2A-3 first
    -- qualifying contact ATTEMPT (a call outcome that closes a contact
    -- attempt, or a governed WhatsApp send). It is not a connection.
    -- ---------------------------------------------------------------------
    sla_rows as (
      select
        c.id,
        k.sla_due_at,
        k.first_contact_attempt_at,
        k.clock_started_at
      from cohort c
      left join public.crm_sla_clocks k on k.lead_id = c.id
    ),
    sla_agg as (
      select
        count(*)::integer as cohort_lead_count,
        count(*) filter (where sla_due_at is not null)::integer as eligible_count,
        count(*) filter (
          where sla_due_at is not null
            and first_contact_attempt_at is not null
            and first_contact_attempt_at <= sla_due_at
        )::integer as met_count,
        count(*) filter (
          where sla_due_at is not null
            and (
              (first_contact_attempt_at is not null and first_contact_attempt_at > sla_due_at)
              or (first_contact_attempt_at is null and v_now > sla_due_at)
            )
        )::integer as breached_count,
        count(*) filter (
          where sla_due_at is not null
            and first_contact_attempt_at is null
            and v_now <= sla_due_at
        )::integer as pending_count,
        count(*) filter (where sla_due_at is null)::integer as out_of_policy_count
      from sla_rows
    ),

    -- ---------------------------------------------------------------------
    -- B1. Velocity — cohort median time to first contact ATTEMPT.
    -- Wall-clock seconds from receipt (clock_started_at = leads.created_at)
    -- to the qualifying attempt. Business-window arithmetic exists only for
    -- computing sla_due_at and is deliberately not reused here.
    -- ---------------------------------------------------------------------
    first_contact_samples as (
      select extract(epoch from (first_contact_attempt_at - clock_started_at))::numeric as secs
      from sla_rows
      where first_contact_attempt_at is not null
        and clock_started_at is not null
    ),
    first_contact_agg as (
      select
        count(*)::integer as sample_size,
        case
          when count(*) = 0 then null
          else round(percentile_cont(0.5) within group (order by secs))::bigint
        end as median_seconds
      from first_contact_samples
    ),

    -- ---------------------------------------------------------------------
    -- B2. Velocity — CURRENT snapshot. Open means not terminal and not
    -- parked. The date range is intentionally NOT applied: "how old is the
    -- open book right now" is a snapshot question, like the weighted
    -- forecast.
    --
    -- Stage entry reuses the CRM 2B rule verbatim: the most recent
    -- stage-entry lead_event, falling back to receipt when a lead has never
    -- moved.
    -- ---------------------------------------------------------------------
    open_leads as (
      select l.id, l.created_at
      from public.leads l
      where l.status not in ('closed_won', 'closed_lost', 'on_hold')
        and (v_scope_owner is null or l.assigned_to = v_scope_owner)
        and (p_source_id is null or l.primary_source_id = p_source_id)
    ),
    open_ages as (
      select
        extract(epoch from (v_now - o.created_at))::numeric as age_secs,
        extract(epoch from (v_now - coalesce((
          select max(e.occurred_at)
          from public.lead_events e
          where e.lead_id = o.id
            and e.event_type in (
              'lead.created', 'lead.assigned', 'lead.status_changed',
              'lead.on_hold', 'lead.resumed'
            )
        ), o.created_at)))::numeric as stage_secs
      from open_leads o
    ),
    open_agg as (
      select
        count(*)::integer as active_lead_count,
        case
          when count(*) = 0 then null
          else round(percentile_cont(0.5) within group (order by age_secs))::bigint
        end as median_age_seconds,
        case
          when count(*) = 0 then null
          else round(percentile_cont(0.5) within group (order by stage_secs))::bigint
        end as median_stage_seconds
      from open_ages
    ),

    -- ---------------------------------------------------------------------
    -- C. Stage reach — the ONE reconstruction used by both conversion and
    -- stage-to-stage velocity.
    --
    -- Every entry into contacted..closed_lost is evented by
    -- private.transition_lead_status_impl (event_data 'to') or by
    -- private.accepted_quotation_close_won_impl (event_data 'to_status').
    -- BOTH key spellings are read; ignoring either would silently drop
    -- accepted-quotation Closed-Won out of the funnel.
    --
    -- MIN(occurred_at) is FIRST entry, so an on-hold pause and resume cannot
    -- inflate or reset a stage. Current status is a fallback only: a lead
    -- standing in a stage has demonstrably reached it.
    -- ---------------------------------------------------------------------
    cohort_events as (
      select
        e.lead_id,
        coalesce(e.event_data ->> 'to', e.event_data ->> 'to_status') as to_status,
        e.occurred_at
      from public.lead_events e
      join cohort c on c.id = e.lead_id
      where e.event_type in ('lead.status_changed', 'lead.resumed', 'lead.on_hold')
    ),
    stage_entries as (
      select
        c.id as lead_id,
        c.status as current_status,
        c.created_at,
        min(ev.occurred_at) filter (where ev.to_status = 'contacted') as t_contacted,
        min(ev.occurred_at) filter (where ev.to_status = 'qualified') as t_qualified,
        min(ev.occurred_at) filter (where ev.to_status = 'consultation_scheduled') as t_consultation,
        min(ev.occurred_at) filter (where ev.to_status = 'proposal_sent') as t_proposal,
        min(ev.occurred_at) filter (where ev.to_status = 'negotiation') as t_negotiation,
        min(ev.occurred_at) filter (where ev.to_status = 'closed_won') as t_won,
        min(ev.occurred_at) filter (where ev.to_status = 'closed_lost') as t_lost
      from cohort c
      left join cohort_events ev on ev.lead_id = c.id
      group by c.id, c.status, c.created_at
    ),
    reach as (
      select
        count(*)::integer as received_count,
        count(*) filter (where t_contacted is not null or current_status = 'contacted')::integer as contacted_count,
        count(*) filter (where t_qualified is not null or current_status = 'qualified')::integer as qualified_count,
        count(*) filter (where t_consultation is not null or current_status = 'consultation_scheduled')::integer as consultation_count,
        count(*) filter (where t_proposal is not null or current_status = 'proposal_sent')::integer as proposal_count,
        count(*) filter (where t_negotiation is not null or current_status = 'negotiation')::integer as negotiation_count,
        count(*) filter (where t_won is not null or current_status = 'closed_won')::integer as won_count,
        count(*) filter (where t_lost is not null or current_status = 'closed_lost')::integer as lost_count,
        count(*) filter (where current_status = 'on_hold')::integer as on_hold_current_count
      from stage_entries
    ),

    -- ---------------------------------------------------------------------
    -- B3. Velocity — stage-to-stage medians. Only pairs whose BOTH instants
    -- are reconstructed from real events are sampled; a lead missing either
    -- side contributes nothing rather than a fabricated zero. Non-monotonic
    -- pairs (t2 < t1) are excluded rather than clamped.
    -- ---------------------------------------------------------------------
    transition_samples as (
      select 'received'::text as from_stage, 'contacted'::text as to_stage,
             extract(epoch from (t_contacted - created_at))::numeric as secs
      from stage_entries
      where t_contacted is not null and t_contacted >= created_at
      union all
      select 'contacted', 'qualified', extract(epoch from (t_qualified - t_contacted))::numeric
      from stage_entries
      where t_contacted is not null and t_qualified is not null and t_qualified >= t_contacted
      union all
      select 'qualified', 'consultation_scheduled', extract(epoch from (t_consultation - t_qualified))::numeric
      from stage_entries
      where t_qualified is not null and t_consultation is not null and t_consultation >= t_qualified
      union all
      select 'consultation_scheduled', 'proposal_sent', extract(epoch from (t_proposal - t_consultation))::numeric
      from stage_entries
      where t_consultation is not null and t_proposal is not null and t_proposal >= t_consultation
      union all
      select 'proposal_sent', 'negotiation', extract(epoch from (t_negotiation - t_proposal))::numeric
      from stage_entries
      where t_proposal is not null and t_negotiation is not null and t_negotiation >= t_proposal
      union all
      select 'negotiation', 'closed_won', extract(epoch from (t_won - t_negotiation))::numeric
      from stage_entries
      where t_negotiation is not null and t_won is not null and t_won >= t_negotiation
    ),
    transition_agg as (
      select
        from_stage,
        to_stage,
        count(*)::integer as sample_size,
        round(percentile_cont(0.5) within group (order by secs))::bigint as median_seconds
      from transition_samples
      group by from_stage, to_stage
    ),

    -- ---------------------------------------------------------------------
    -- E. Target achievement.
    --
    -- Achievement is the EXISTING commercial credit rule, not a second one:
    -- public.quotation_acceptances carries credited_sales_executive_id (a
    -- snapshot of leads.assigned_to taken at acceptance, and frozen because
    -- reassignment of a closed_won lead is refused), taxable_base_paise
    -- (ex-tax, the measure sales_targets.revenue_target_paise is denominated
    -- in) and sales_achievement_month (already derived Asia/Kolkata at
    -- acceptance). CRM 2E only reads and sums them.
    --
    -- The row set is RLS-scoped, so an executive sums only their own credited
    -- acceptances and cannot see a team total.
    -- ---------------------------------------------------------------------
    acceptances as (
      select qa.credited_sales_executive_id as exec_id, qa.taxable_base_paise
      from public.quotation_acceptances qa
      where v_can_read_commercial
        and qa.sales_achievement_month = v_target_period
    ),
    target_defs as (
      select
        t.id,
        t.target_scope,
        t.target_user_id,
        t.revenue_target_paise,
        t.closed_won_count_target,
        t.status,
        coalesce(nullif(trim(pr.display_name), ''), 'Sales executive') as target_display_name
      from public.sales_targets t
      left join public.profiles pr on pr.id = t.target_user_id
      where t.target_month = v_target_month
        and (
          v_scope_owner is null
          or (t.target_scope = 'executive_personal' and t.target_user_id = v_scope_owner)
        )
    ),
    target_rows as (
      select
        d.id,
        d.target_scope,
        d.target_user_id,
        d.revenue_target_paise,
        d.closed_won_count_target,
        d.status,
        d.target_display_name,
        (select coalesce(sum(a.taxable_base_paise), 0)::bigint
         from acceptances a
         where d.target_scope = 'sales_team' or a.exec_id = d.target_user_id) as achieved_paise,
        (select count(*)::integer
         from acceptances a
         where d.target_scope = 'sales_team' or a.exec_id = d.target_user_id) as accepted_count
      from target_defs d
    )

    select jsonb_build_object(
      'capturedAt', v_now,
      'rangeStartIso', p_start,
      'rangeEndIso', p_end,
      'scopeOwnerId', v_scope_owner,
      'isTeamScope', v_scope_owner is null,
      'sourceId', p_source_id,
      'canReadCommercialTruth', v_can_read_commercial,

      'sla', (
        select jsonb_build_object(
          'cohortLeadCount', s.cohort_lead_count,
          'eligibleCount', s.eligible_count,
          'metCount', s.met_count,
          'breachedCount', s.breached_count,
          'pendingCount', s.pending_count,
          'outOfPolicyCount', s.out_of_policy_count,
          'decidedCount', s.met_count + s.breached_count,
          -- Compliance is met / DECIDED. A lead still inside its window is
          -- neither a success nor a failure; counting it either way would move
          -- the number without any operator having done anything.
          'complianceBasisPoints', case
            when (s.met_count + s.breached_count) = 0 then null
            else round((s.met_count::numeric * 10000) / (s.met_count + s.breached_count))::integer
          end
        )
        from sla_agg s
      ),

      'velocity', (
        select jsonb_build_object(
          'firstContactSampleSize', f.sample_size,
          'medianFirstContactSeconds', f.median_seconds,
          'activeLeadCount', o.active_lead_count,
          'medianActiveLeadAgeSeconds', o.median_age_seconds,
          'medianCurrentStageAgeSeconds', o.median_stage_seconds,
          'stageTransitions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'fromStage', from_stage,
                'toStage', to_stage,
                'sampleSize', sample_size,
                'medianSeconds', median_seconds
              )
              order by to_stage
            )
            from transition_agg
          ), '[]'::jsonb)
        )
        from first_contact_agg f cross join open_agg o
      ),

      'conversion', (
        select jsonb_build_object(
          'receivedCount', r.received_count,
          'closedLostCount', r.lost_count,
          'onHoldCurrentCount', r.on_hold_current_count,
          'wonRateBasisPoints', case
            when r.received_count = 0 then null
            else round((r.won_count::numeric * 10000) / r.received_count)::integer
          end,
          'stages', jsonb_build_array(
            jsonb_build_object(
              'stage', 'received',
              'reachedCount', r.received_count,
              'previousStage', null,
              'previousCount', null,
              'stepConversionBasisPoints', null,
              'overallConversionBasisPoints',
                case when r.received_count = 0 then null else 10000 end
            ),
            jsonb_build_object(
              'stage', 'contacted',
              'reachedCount', r.contacted_count,
              'previousStage', 'received',
              'previousCount', r.received_count,
              'stepConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.contacted_count::numeric * 10000) / r.received_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.contacted_count::numeric * 10000) / r.received_count)::integer end
            ),
            jsonb_build_object(
              'stage', 'qualified',
              'reachedCount', r.qualified_count,
              'previousStage', 'contacted',
              'previousCount', r.contacted_count,
              'stepConversionBasisPoints', case when r.contacted_count = 0 then null
                else round((r.qualified_count::numeric * 10000) / r.contacted_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.qualified_count::numeric * 10000) / r.received_count)::integer end
            ),
            jsonb_build_object(
              'stage', 'consultation_scheduled',
              'reachedCount', r.consultation_count,
              'previousStage', 'qualified',
              'previousCount', r.qualified_count,
              'stepConversionBasisPoints', case when r.qualified_count = 0 then null
                else round((r.consultation_count::numeric * 10000) / r.qualified_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.consultation_count::numeric * 10000) / r.received_count)::integer end
            ),
            jsonb_build_object(
              'stage', 'proposal_sent',
              'reachedCount', r.proposal_count,
              'previousStage', 'consultation_scheduled',
              'previousCount', r.consultation_count,
              'stepConversionBasisPoints', case when r.consultation_count = 0 then null
                else round((r.proposal_count::numeric * 10000) / r.consultation_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.proposal_count::numeric * 10000) / r.received_count)::integer end
            ),
            jsonb_build_object(
              'stage', 'negotiation',
              'reachedCount', r.negotiation_count,
              'previousStage', 'proposal_sent',
              'previousCount', r.proposal_count,
              'stepConversionBasisPoints', case when r.proposal_count = 0 then null
                else round((r.negotiation_count::numeric * 10000) / r.proposal_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.negotiation_count::numeric * 10000) / r.received_count)::integer end
            ),
            jsonb_build_object(
              'stage', 'closed_won',
              'reachedCount', r.won_count,
              'previousStage', 'negotiation',
              'previousCount', r.negotiation_count,
              'stepConversionBasisPoints', case when r.negotiation_count = 0 then null
                else round((r.won_count::numeric * 10000) / r.negotiation_count)::integer end,
              'overallConversionBasisPoints', case when r.received_count = 0 then null
                else round((r.won_count::numeric * 10000) / r.received_count)::integer end
            )
          )
        )
        from reach r
      ),

      'targets', jsonb_build_object(
        'period', v_target_period,
        'targetMonth', v_target_month,
        'canReadCommercialTruth', v_can_read_commercial,
        -- NULL, not 0, when accepted-quotation truth is unreadable.
        'periodAchievedPaise', case
          when not v_can_read_commercial then null
          else (select coalesce(sum(a.taxable_base_paise), 0)::bigint from acceptances a)
        end,
        'periodAcceptedCount', case
          when not v_can_read_commercial then null
          else (select count(*)::integer from acceptances a)
        end,
        'rows', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'targetId', id,
              'targetScope', target_scope,
              'targetUserId', target_user_id,
              'targetDisplayName',
                case when target_scope = 'sales_team' then 'Sales team' else target_display_name end,
              'status', status,
              'revenueTargetPaise', revenue_target_paise,
              'closedWonCountTarget', closed_won_count_target,
              'achievedPaise', case when v_can_read_commercial then achieved_paise else null end,
              'acceptedCount', case when v_can_read_commercial then accepted_count else null end,
              'remainingPaise', case
                when not v_can_read_commercial then null
                else greatest(revenue_target_paise - achieved_paise, 0)
              end,
              -- revenue_target_paise carries a > 0 CHECK, so this can never
              -- divide by zero; the guard is kept so a future bound change
              -- degrades to UNKNOWN rather than to an error.
              'attainmentBasisPoints', case
                when not v_can_read_commercial then null
                when revenue_target_paise is null or revenue_target_paise <= 0 then null
                else round((achieved_paise::numeric * 10000) / revenue_target_paise)::integer
              end
            )
            order by target_scope, target_display_name
          )
          from target_rows
        ), '[]'::jsonb)
      )
    )
  );
end;
$$;

comment on function public.get_crm_management_analytics(timestamptz, timestamptz, date, uuid, uuid) is
  'CRM 2E management analytics aggregate: first-response SLA compliance, velocity medians, conversion funnel and target achievement. SECURITY INVOKER so existing CRM RLS stays the only scope authority. SLA eligibility is crm_sla_clocks.sla_due_at IS NOT NULL (non-retroactive by construction); first response is the canonical first-contact ATTEMPT, not a connection. Achievement reuses quotation_acceptances credit verbatim and is NULL, never zero, without quotations.read. Forecast is deliberately NOT here: it stays in get_crm_pipeline_value_summary.';

alter function public.get_crm_management_analytics(timestamptz, timestamptz, date, uuid, uuid)
  owner to postgres;
revoke all on function public.get_crm_management_analytics(timestamptz, timestamptz, date, uuid, uuid)
  from public, anon;
grant execute on function public.get_crm_management_analytics(timestamptz, timestamptz, date, uuid, uuid)
  to authenticated;
