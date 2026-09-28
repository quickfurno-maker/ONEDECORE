-- ONEDECORE Phase 2 — CRM ↔ WhatsApp intelligence pgTAP contracts

begin;
select plan(28);

select ok(
  to_regclass('public.idx_whatsapp_conversations_lead_last_message') is not null,
  'linked-conversation CRM scoring has a lead/timestamp index'
);

select ok(
  to_regprocedure('public.list_crm_whatsapp_lead_signals(uuid[])') is not null,
  'CRM WhatsApp signal read RPC exists'
);

select ok(
  to_regprocedure('private.list_crm_whatsapp_lead_signals_impl(uuid[])') is not null,
  'private CRM WhatsApp signal implementation exists'
);

select ok(
  to_regprocedure('public.get_crm_whatsapp_marketing_state(uuid)') is not null,
  'lead-scoped WhatsApp marketing state RPC exists'
);

select ok(
  to_regprocedure('private.get_crm_whatsapp_marketing_state_impl(uuid)') is not null,
  'private lead-scoped consent implementation exists'
);

select ok(
  to_regprocedure('public.ensure_whatsapp_conversation_for_crm_lead(uuid)') is not null,
  'CRM WhatsApp quick-action RPC exists'
);

select ok(
  to_regprocedure('private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)') is not null,
  'private CRM WhatsApp quick-action implementation exists'
);

select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='list_crm_whatsapp_lead_signals'
  ),
  false,
  'signal public wrapper is SECURITY INVOKER'
);

select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='get_crm_whatsapp_marketing_state'
  ),
  false,
  'consent public wrapper is SECURITY INVOKER'
);

select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='ensure_whatsapp_conversation_for_crm_lead'
  ),
  false,
  'quick-action public wrapper is SECURITY INVOKER'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'list_crm_whatsapp_lead_signals_impl',
        'get_crm_whatsapp_marketing_state_impl',
        'ensure_whatsapp_conversation_for_crm_lead_impl'
      )
      and p.prosecdef
  ),
  3,
  'all three private implementations are SECURITY DEFINER'
);

select is(
  (
    select provolatile::text
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='get_crm_whatsapp_marketing_state_impl'
  ),
  'v',
  'consent-state implementation is VOLATILE because current consent evaluation is volatile'
);

select is(
  (
    select provolatile::text
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='get_crm_whatsapp_marketing_state'
  ),
  'v',
  'consent-state public wrapper preserves the VOLATILE contract'
);

select is(
  has_function_privilege(
    'anon',
    'public.list_crm_whatsapp_lead_signals(uuid[])',
    'execute'
  ),
  false,
  'anon cannot read CRM WhatsApp signals'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.list_crm_whatsapp_lead_signals(uuid[])',
    'execute'
  ),
  true,
  'authenticated CRM staff may invoke the signal wrapper'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_crm_whatsapp_marketing_state(uuid)',
    'execute'
  ),
  false,
  'anon cannot read lead marketing state'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.get_crm_whatsapp_marketing_state(uuid)',
    'execute'
  ),
  true,
  'authenticated CRM staff may invoke the consent wrapper'
);

select is(
  has_function_privilege(
    'anon',
    'public.ensure_whatsapp_conversation_for_crm_lead(uuid)',
    'execute'
  ),
  false,
  'anon cannot prepare a CRM WhatsApp conversation'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ensure_whatsapp_conversation_for_crm_lead(uuid)',
    'execute'
  ),
  true,
  'authenticated CRM staff may invoke the governed quick-action wrapper'
);

select ok(
  position(
    'crm_can_view_lead' in pg_get_functiondef(
      'private.list_crm_whatsapp_lead_signals_impl(uuid[])'::regprocedure
    )
  ) > 0,
  'signal implementation re-applies CRM lead visibility'
);

select ok(
  position(
    'cardinality' in pg_get_functiondef(
      'private.list_crm_whatsapp_lead_signals_impl(uuid[])'::regprocedure
    )
  ) > 0
  and position(
    '> 200' in pg_get_functiondef(
      'private.list_crm_whatsapp_lead_signals_impl(uuid[])'::regprocedure
    )
  ) > 0,
  'signal read is bounded to 200 lead ids'
);

select ok(
  position(
    'body_text' in lower(pg_get_functiondef(
      'private.list_crm_whatsapp_lead_signals_impl(uuid[])'::regprocedure
    ))
  ) = 0
  and position(
    'whatsapp_messages' in lower(pg_get_functiondef(
      'private.list_crm_whatsapp_lead_signals_impl(uuid[])'::regprocedure
    ))
  ) = 0,
  'CRM scoring signal implementation never reads message content'
);

select ok(
  position(
    'crm_can_view_lead' in pg_get_functiondef(
      'private.get_crm_whatsapp_marketing_state_impl(uuid)'::regprocedure
    )
  ) > 0
  and position(
    'consents.read' in pg_get_functiondef(
      'private.get_crm_whatsapp_marketing_state_impl(uuid)'::regprocedure
    )
  ) > 0
  and position(
    'marketing_consents.manage' in pg_get_functiondef(
      'private.get_crm_whatsapp_marketing_state_impl(uuid)'::regprocedure
    )
  ) > 0,
  'consent visibility requires lead scope plus an approved consent permission'
);

select ok(
  position(
    'whatsapp.inbox.use' in pg_get_functiondef(
      'private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)'::regprocedure
    )
  ) > 0
  and position(
    'crm_can_view_lead' in pg_get_functiondef(
      'private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)'::regprocedure
    )
  ) > 0,
  'CRM WhatsApp starter requires inbox-use plus CRM lead scope'
);

select ok(
  position(
    'production_sender_at is not null' in lower(pg_get_functiondef(
      'private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)'::regprocedure
    ))
  ) > 0,
  'CRM WhatsApp starter selects only the explicit production sender'
);

select ok(
  position(
    '''provider_send_started'', false' in lower(pg_get_functiondef(
      'private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)'::regprocedure
    ))
  ) > 0
  and position(
    'graph.facebook' in lower(pg_get_functiondef(
      'private.ensure_whatsapp_conversation_for_crm_lead_impl(uuid)'::regprocedure
    ))
  ) = 0,
  'CRM quick action prepares local evidence and never calls Meta/provider transport'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid='public.whatsapp_crm_link_events'::regclass
      and c.conname='chk_whatsapp_crm_link_events_method'
      and pg_get_constraintdef(c.oid) like '%crm_outbound_start%'
  ),
  'CRM-started conversation links have an explicit audit method'
);

select results_eq(
  $$select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and p.prokind='f'
      and p.prosrc ~ 'update\s+public\.whatsapp_conversations[^;]*\ylead_id\y'$$,
  array[3],
  'lead_id has exactly three reviewed writers after Phase 2'
);

select * from finish();
rollback;
