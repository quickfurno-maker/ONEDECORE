begin;
select plan(12);

select ok(
  to_regprocedure(
    'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'
  ) is not null,
  'campaign scheduler reschedule RPC exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)',
    'execute'
  ),
  true,
  'authenticated operators may call the governed reschedule RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)',
    'execute'
  ),
  false,
  'anonymous callers cannot reschedule campaigns'
);
select ok(
  position(
    'whatsapp_campaign_raise_operator_denial' in pg_get_functiondef(
      'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'reschedule reuses the independent operator denial'
);

select ok(
  position(
    'v_run.status <> ''scheduled''' in pg_get_functiondef(
      'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'only a scheduled run can move'
);

select ok(
  position(
    'run_rescheduled' in pg_get_functiondef(
      'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'reschedule appends durable run_rescheduled evidence'
);
select ok(
  position(
    'previous_scheduled_for' in pg_get_functiondef(
      'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'reschedule evidence preserves the previous delivery instant'
);

select ok(
  position(
    '90 days' in pg_get_functiondef(
      'public.reschedule_whatsapp_campaign_run(uuid,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'reschedule keeps the existing ninety-day scheduling horizon'
);

select ok(
  to_regprocedure(
    'public.list_whatsapp_campaign_scheduler_runs(timestamp with time zone,timestamp with time zone)'
  ) is not null,
  'campaign scheduler bounded calendar read RPC exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.list_whatsapp_campaign_scheduler_runs(timestamp with time zone,timestamp with time zone)',
    'execute'
  ),
  true,
  'authenticated campaign operators may read the governed scheduler calendar'
);

select is(
  has_function_privilege(
    'anon',
    'public.list_whatsapp_campaign_scheduler_runs(timestamp with time zone,timestamp with time zone)',
    'execute'
  ),
  false,
  'anonymous callers cannot read campaign scheduler runs'
);

select ok(
  position(
    '120 days' in pg_get_functiondef(
      'public.list_whatsapp_campaign_scheduler_runs(timestamp with time zone,timestamp with time zone)'::regprocedure
    )
  ) > 0
  and position(
    'LIMIT 1000' in upper(pg_get_functiondef(
      'public.list_whatsapp_campaign_scheduler_runs(timestamp with time zone,timestamp with time zone)'::regprocedure
    ))
  ) > 0,
  'scheduler calendar read is time-bounded and row-bounded'
);

select * from finish();
rollback;
