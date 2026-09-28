-- Phase 4/5 closeout: Nurture V2 evidence fields.
-- Scheduler recurrence itself remains an application governance planner: every
-- delivery still requires its own approved campaign version.
begin;

alter table public.leads
  add column nurture_count integer not null default 0,
  add column last_nurture_template_name text,
  add column last_nurture_at timestamptz,
  add column next_nurture_at timestamptz,
  add column nurture_reengaged_at timestamptz,
  add column nurture_suppressed_until timestamptz;

alter table public.leads
  add constraint chk_leads_nurture_count check (nurture_count between 0 and 10000),
  add constraint chk_leads_nurture_template check (
    last_nurture_template_name is null
    or last_nurture_template_name ~ '^[a-z0-9_]{2,120}$'
  ),
  add constraint chk_leads_nurture_reengaged_order check (
    nurture_reengaged_at is null
    or last_nurture_at is null
    or nurture_reengaged_at >= last_nurture_at
  );

create index idx_leads_long_term_nurture_next
  on public.leads(next_nurture_at,id)
  where timeline_code='after-2-months'
    and deleted_at is null
    and status not in ('closed_won','closed_lost');
create index idx_leads_long_term_nurture_suppressed
  on public.leads(nurture_suppressed_until,id)
  where timeline_code='after-2-months'
    and nurture_suppressed_until is not null
    and deleted_at is null;

create or replace function private.capture_long_term_nurture_send()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_contact_id uuid;
  v_sent_at timestamptz;
  v_template_name text;
begin
  select
    r.contact_id,
    coalesce(m.provider_timestamp,new.created_at),
    snap.name
  into v_contact_id,v_sent_at,v_template_name
  from public.whatsapp_campaign_recipients r
  join public.whatsapp_messages m on m.id=new.whatsapp_message_id
  join public.whatsapp_campaign_runs run on run.id=new.run_id
  join public.whatsapp_campaign_specs spec on spec.id=run.spec_id
  join public.whatsapp_template_snapshots snap on snap.id=spec.template_snapshot_id
  where r.id=new.recipient_id;

  if v_contact_id is null or v_sent_at is null then
    return new;
  end if;
  update public.leads
  set
    nurture_count = least(nurture_count + 1,10000),
    last_nurture_template_name = v_template_name,
    last_nurture_at = v_sent_at,
    -- Monthly is the default planning horizon for long-term nurture. The
    -- Scheduler remains authoritative and can move the next occurrence.
    next_nurture_at = v_sent_at + interval '30 days',
    nurture_reengaged_at = case
      when nurture_reengaged_at is not null
       and nurture_reengaged_at < v_sent_at then null
      else nurture_reengaged_at
    end
  where contact_id=v_contact_id
    and timeline_code='after-2-months'
    and deleted_at is null
    and status not in ('closed_won','closed_lost');

  return new;
end;
$$;

drop trigger if exists trg_capture_long_term_nurture_send
  on public.whatsapp_message_campaign_attributions;
create trigger trg_capture_long_term_nurture_send
after insert on public.whatsapp_message_campaign_attributions
for each row execute function private.capture_long_term_nurture_send();

create or replace function private.capture_long_term_nurture_reply()
returns trigger
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_contact_id uuid;
  v_reply_at timestamptz;
begin
  if new.source_kind <> 'campaign' or new.recipient_id is null then
    return new;
  end if;

  select r.contact_id,m.provider_timestamp
  into v_contact_id,v_reply_at
  from public.whatsapp_campaign_recipients r
  join public.whatsapp_messages m on m.id=new.inbound_message_id
  where r.id=new.recipient_id;

  if v_contact_id is null or v_reply_at is null then
    return new;
  end if;

  update public.leads
  set
    nurture_reengaged_at = case
      when last_nurture_at is not null and v_reply_at >= last_nurture_at
        then v_reply_at
      else nurture_reengaged_at
    end,
    next_nurture_at = case
      when last_nurture_at is not null and v_reply_at >= last_nurture_at
        then null
      else next_nurture_at
    end
  where contact_id=v_contact_id
    and timeline_code='after-2-months'
    and deleted_at is null
    and status not in ('closed_won','closed_lost');

  return new;
end;
$$;

drop trigger if exists trg_capture_long_term_nurture_reply
  on public.whatsapp_reply_attributions;
create trigger trg_capture_long_term_nurture_reply
after insert on public.whatsapp_reply_attributions
for each row execute function private.capture_long_term_nurture_reply();

commit;
