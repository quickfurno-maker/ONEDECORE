-- Phase 5 closeout: revenue attribution and budget-based ROI.
-- Revenue is last-touch within the existing 30-day WhatsApp attribution window.
-- No new callable surface is added: this extends the already-authorized overview RPC.
begin;

create or replace function public.get_whatsapp_analytics_overview(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_runs uuid[];
  v_revenue jsonb;
begin
  perform private.whatsapp_analytics_require_read();
  select range_from,range_to into v_from,v_to
  from private.whatsapp_analytics_range(p_from,p_to);

  select coalesce(array_agg(r.id),'{}'::uuid[]) into v_runs
  from public.whatsapp_campaign_runs r
  where r.created_at>=v_from and r.created_at<v_to;

  with sent as (
    select
      r.id recipient_id,
      r.run_id,
      r.contact_id,
      m.provider_timestamp sent_at,
      c.id campaign_id,
      c.name campaign_name,
      snap.name template_name
    from public.whatsapp_campaign_recipients r
    join public.whatsapp_messages m on m.id=r.canonical_message_id
    join public.whatsapp_campaign_runs run on run.id=r.run_id
    join public.campaign_versions v on v.id=run.campaign_version_id
    join public.campaigns c on c.id=v.campaign_id
    join public.whatsapp_campaign_specs spec on spec.id=run.spec_id
    join public.whatsapp_template_snapshots snap on snap.id=spec.template_snapshot_id
    where r.run_id=any(v_runs)
      and m.provider_timestamp is not null
  ),
  bookings as (
    select
      qa.id acceptance_id,
      qa.accepted_at,
      qv.grand_total_paise,
      touch.run_id,
      touch.campaign_id,
      touch.campaign_name,
      touch.template_name
    from public.quotation_acceptances qa
    join public.quotation_versions qv on qv.id=qa.quotation_version_id
    join public.leads l on l.id=qa.lead_id
    join lateral (
      select s.*
      from sent s
      where s.contact_id=l.contact_id
        and s.sent_at<=qa.accepted_at
        and s.sent_at>qa.accepted_at-private.whatsapp_attribution_window()
      order by s.sent_at desc,s.recipient_id desc
      limit 1
    ) touch on true
  ),
  version_budgets as (
    select distinct
      v.id campaign_version_id,
      c.id campaign_id,
      c.name campaign_name,
      case
        when jsonb_typeof(v.budget_snapshot->'total_budget_paise')='number'
          then greatest(0,(v.budget_snapshot->>'total_budget_paise')::bigint)
        else 0
      end planned_budget_paise
    from public.whatsapp_campaign_runs r
    join public.campaign_versions v on v.id=r.campaign_version_id
    join public.campaigns c on c.id=v.campaign_id
    where r.id=any(v_runs)
  ),
  totals as (
    select
      count(*)::integer booking_count,
      coalesce(sum(grand_total_paise),0)::bigint revenue_paise
    from bookings
  ),
  budget_totals as (
    select coalesce(sum(planned_budget_paise),0)::bigint planned_budget_paise
    from version_budgets
  ),
  campaign_rows as (
    select
      b.campaign_id,
      b.campaign_name,
      count(*)::integer booking_count,
      sum(b.grand_total_paise)::bigint revenue_paise
    from bookings b
    group by b.campaign_id,b.campaign_name
  ),
  campaign_budgets as (
    select
      campaign_id,
      campaign_name,
      sum(planned_budget_paise)::bigint planned_budget_paise
    from version_budgets
    group by campaign_id,campaign_name
  ),
  template_rows as (
    select
      template_name,
      count(*)::integer booking_count,
      sum(grand_total_paise)::bigint revenue_paise
    from bookings
    group by template_name
  ),
  month_rows as (
    select
      to_char(timezone('Asia/Kolkata',accepted_at),'YYYY-MM') month_key,
      count(*)::integer booking_count,
      sum(grand_total_paise)::bigint revenue_paise
    from bookings
    group by to_char(timezone('Asia/Kolkata',accepted_at),'YYYY-MM')
  )
  select jsonb_build_object(
    'booking_count',t.booking_count,
    'attributed_revenue_paise',t.revenue_paise,
    'planned_budget_paise',bt.planned_budget_paise,
    'roi',case
      when bt.planned_budget_paise>0
        then round(((t.revenue_paise-bt.planned_budget_paise)::numeric/bt.planned_budget_paise),4)
      else null
    end,
    'campaigns',coalesce((
      select jsonb_agg(jsonb_build_object(
        'campaign_id',coalesce(cr.campaign_id,cb.campaign_id),
        'campaign_name',coalesce(cr.campaign_name,cb.campaign_name),
        'booking_count',coalesce(cr.booking_count,0),
        'revenue_paise',coalesce(cr.revenue_paise,0),
        'planned_budget_paise',coalesce(cb.planned_budget_paise,0),
        'roi',case
          when coalesce(cb.planned_budget_paise,0)>0
            then round(((coalesce(cr.revenue_paise,0)-cb.planned_budget_paise)::numeric/cb.planned_budget_paise),4)
          else null
        end
      ) order by coalesce(cr.revenue_paise,0) desc,coalesce(cr.campaign_name,cb.campaign_name))
      from campaign_rows cr
      full join campaign_budgets cb using(campaign_id,campaign_name)
    ),'[]'::jsonb),
    'templates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'template_name',template_name,
        'booking_count',booking_count,
        'revenue_paise',revenue_paise
      ) order by revenue_paise desc,template_name)
      from template_rows
    ),'[]'::jsonb),
    'months',coalesce((
      select jsonb_agg(jsonb_build_object(
        'month',month_key,
        'booking_count',booking_count,
        'revenue_paise',revenue_paise
      ) order by month_key)
      from month_rows
    ),'[]'::jsonb)
  )
  into v_revenue
  from totals t cross join budget_totals bt;

  return jsonb_build_object(
    'range',jsonb_build_object('from',v_from,'to',v_to),
    'attribution_window_days',extract(day from private.whatsapp_attribution_window())::integer,
    'channel',(
      select jsonb_build_object(
        'outbound_messages',count(*) filter (where m.direction='outbound'),
        'inbound_messages',count(*) filter (where m.direction='inbound'),
        'active_conversations',count(distinct m.conversation_id),
        'outbound_with_delivered_evidence',count(*) filter (
          where m.direction='outbound' and exists(
            select 1 from public.whatsapp_message_status_events se
            where se.provider_message_id=m.provider_message_id and se.status in ('delivered','read')
          )
        ),
        'outbound_with_read_evidence',count(*) filter (
          where m.direction='outbound' and exists(
            select 1 from public.whatsapp_message_status_events se
            where se.provider_message_id=m.provider_message_id and se.status='read'
          )
        ),
        'outbound_with_failed_evidence',count(*) filter (
          where m.direction='outbound' and exists(
            select 1 from public.whatsapp_message_status_events se
            where se.provider_message_id=m.provider_message_id and se.status='failed'
          )
        )
      )
      from public.whatsapp_messages m
      where m.provider_timestamp>=v_from and m.provider_timestamp<v_to
    ),
    'campaign_funnel',private.whatsapp_campaign_funnel_summary(v_runs),
    'revenue',coalesce(v_revenue,'{}'::jsonb),
    'runs',coalesce((
      select jsonb_agg(x.item order by x.created_at desc)
      from (
        select r.created_at,jsonb_build_object(
          'run_id',r.id,
          'status',r.status,
          'created_at',r.created_at,
          'started_at',r.started_at,
          'completed_at',r.completed_at,
          'campaign_version_id',r.campaign_version_id,
          'campaign_name',c.name,
          'version_number',v.version_number,
          'version_title',v.title,
          'template_name',snap.name,
          'funnel',private.whatsapp_campaign_funnel_summary(array[r.id])
        ) as item
        from public.whatsapp_campaign_runs r
        join public.campaign_versions v on v.id=r.campaign_version_id
        join public.campaigns c on c.id=v.campaign_id
        join public.whatsapp_campaign_specs s on s.id=r.spec_id
        join public.whatsapp_template_snapshots snap on snap.id=s.template_snapshot_id
        where r.id=any(v_runs)
        order by r.created_at desc
        limit 50
      ) x
    ),'[]'::jsonb),
    'generated_at',clock_timestamp()
  );
end;
$$;

commit;
