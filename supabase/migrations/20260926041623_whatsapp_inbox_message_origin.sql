-- P2 — surface truthful outbound-message origin inside the shared inbox.
-- This is a read-only projection over existing attribution evidence. It grants
-- no campaign, automation or template-management authority.

create or replace function private.whatsapp_inbox_message_origins_impl(
  p_message_ids uuid[]
)
returns table (
  message_id uuid,
  origin_kind text,
  origin_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'WHATSAPP_INBOX_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_message_ids is null or cardinality(p_message_ids) = 0 then
    return;
  end if;

  if cardinality(p_message_ids) > 100 then
    raise exception 'WHATSAPP_INBOX_ORIGIN_BATCH_TOO_LARGE' using errcode = '22023';
  end if;

  return query
  select
    m.id as message_id,
    case
      when aa.whatsapp_message_id is not null then 'automation'
      when ca.whatsapp_message_id is not null then 'campaign'
      when tsi.outbound_message_id is not null then 'utility_template'
      else null
    end as origin_kind,
    case
      when aa.whatsapp_message_id is not null then left(a.name, 160)
      when ca.whatsapp_message_id is not null then left(c.name, 160)
      when tsi.outbound_message_id is not null then left(ts.name, 160)
      else null
    end as origin_label
  from public.whatsapp_messages m
  left join public.whatsapp_message_automation_attributions aa
    on aa.whatsapp_message_id = m.id
  left join public.whatsapp_automations a
    on a.id = aa.automation_id
  left join public.whatsapp_message_campaign_attributions ca
    on ca.whatsapp_message_id = m.id
  left join public.campaign_versions cv
    on cv.id = ca.campaign_version_id
  left join public.campaigns c
    on c.id = cv.campaign_id
  left join public.whatsapp_template_send_intents tsi
    on tsi.outbound_message_id = m.id
  left join public.whatsapp_template_snapshots ts
    on ts.id = tsi.template_snapshot_id
  where m.id = any(p_message_ids)
    and m.direction = 'outbound'
    and (select private.whatsapp_inbox_can_view_conversation(m.conversation_id))
    and (
      aa.whatsapp_message_id is not null
      or ca.whatsapp_message_id is not null
      or tsi.outbound_message_id is not null
    );
end;
$$;

comment on function private.whatsapp_inbox_message_origins_impl(uuid[]) is
  'P2 read-only inbox origin projection. Returns only attribution labels for messages the current actor may already view.';

alter function private.whatsapp_inbox_message_origins_impl(uuid[]) owner to postgres;
revoke all on function private.whatsapp_inbox_message_origins_impl(uuid[])
  from public, anon;
grant execute on function private.whatsapp_inbox_message_origins_impl(uuid[])
  to authenticated;

create or replace function public.get_whatsapp_inbox_message_origins(
  p_message_ids uuid[]
)
returns table (
  message_id uuid,
  origin_kind text,
  origin_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.whatsapp_inbox_message_origins_impl(p_message_ids);
$$;

alter function public.get_whatsapp_inbox_message_origins(uuid[]) owner to postgres;
revoke all on function public.get_whatsapp_inbox_message_origins(uuid[])
  from public, anon;
grant execute on function public.get_whatsapp_inbox_message_origins(uuid[])
  to authenticated;

comment on function public.get_whatsapp_inbox_message_origins(uuid[]) is
  'Returns campaign, automation or utility-template origin for caller-visible inbox messages. Direct messages return no row.';
