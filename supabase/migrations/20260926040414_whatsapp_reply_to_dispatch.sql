-- P2 — preserve outbound reply context after a governed text dispatch.
-- The send-intent RPC already validates reply_to_message_id belongs to the
-- same conversation. This migration only carries that existing fact into the
-- outbound whatsapp_messages row created when provider evidence is bound.

create or replace function public.bind_whatsapp_send_intent_dispatch(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text,
  p_provider_timestamp timestamptz default now()
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  outbound_message_id uuid,
  provider_message_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_intent public.whatsapp_send_intents%rowtype;
  v_message_id uuid;
  v_conv public.whatsapp_conversations%rowtype;
  v_sender_e164 text;
  v_reply_provider_message_id text;
begin
  if p_provider_message_id is null
    or length(p_provider_message_id) < 1
    or length(p_provider_message_id) > 128 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.whatsapp_provider_dispatch_attempts
  where id = p_dispatch_attempt_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if v_attempt.status = 'succeeded' then
    select * into v_intent
    from public.whatsapp_send_intents
    where id = v_attempt.send_intent_id;

    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        v_attempt.provider_message_id;
    return;
  end if;

  if v_attempt.status not in ('requested', 'ambiguous') then
    raise exception 'dispatch_attempt_not_bindable: %', v_attempt.status using errcode = '22023';
  end if;

  select * into v_intent
  from public.whatsapp_send_intents
  where id = v_attempt.send_intent_id
  for update;

  if v_intent.lifecycle_status = 'dispatch_bound' then
    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        p_provider_message_id;
    return;
  end if;

  if exists (
    select 1
    from public.whatsapp_messages m
    where m.provider_message_id = p_provider_message_id
  ) then
    raise exception 'provider_message_id_conflict' using errcode = '23505';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = v_intent.conversation_id;

  select coalesce(pn.display_phone_number, pn.phone_number_id)
    into v_sender_e164
  from public.whatsapp_phone_numbers pn
  where pn.id = v_conv.phone_number_id;

  if v_intent.reply_to_message_id is not null then
    select m.provider_message_id
      into v_reply_provider_message_id
    from public.whatsapp_messages m
    where m.id = v_intent.reply_to_message_id
      and m.conversation_id = v_intent.conversation_id;

    if v_reply_provider_message_id is null then
      raise exception 'reply_target_missing_at_bind' using errcode = '22023';
    end if;
  end if;

  insert into public.whatsapp_messages (
    conversation_id,
    provider_message_id,
    direction,
    provider_message_type,
    normalized_message_type,
    sender_e164,
    recipient_e164,
    body_text,
    content,
    context_provider_message_id,
    provider_timestamp,
    latest_status
  )
  values (
    v_intent.conversation_id,
    p_provider_message_id,
    'outbound',
    'text',
    'text',
    v_sender_e164,
    v_conv.customer_e164,
    v_intent.body_text,
    '{}'::jsonb,
    v_reply_provider_message_id,
    coalesce(p_provider_timestamp, now()),
    null
  )
  returning id into v_message_id;

  update public.whatsapp_provider_dispatch_attempts
  set
    status = 'succeeded',
    provider_message_id = p_provider_message_id,
    completed_at = now(),
    response_snapshot = coalesce(response_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id
      )
  where id = v_attempt.id;

  update public.whatsapp_send_intents
  set
    lifecycle_status = 'dispatch_bound',
    outbound_message_id = v_message_id
  where id = v_intent.id;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'dispatch_succeeded',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id
      )
    ),
    (
      v_intent.id,
      'dispatch_bound',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'outbound_message_id', v_message_id,
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id
      )
    );

  update public.whatsapp_conversations
  set
    last_message_at = greatest(
      coalesce(last_message_at, '-infinity'::timestamptz),
      coalesce(p_provider_timestamp, now())
    ),
    updated_at = now()
  where id = v_intent.conversation_id;

  return query
    select
      'bound'::text,
      v_intent.id,
      v_message_id,
      p_provider_message_id;
end;
$$;

alter function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  owner to postgres;

revoke all on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  to service_role;

comment on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) is
  'Binds provider evidence and preserves reply context_provider_message_id from the governed send intent.';
