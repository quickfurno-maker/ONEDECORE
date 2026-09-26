begin;
select plan(8);

select ok(
  to_regprocedure(
    'private.campaign_rule_matches_lead_v4(jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,boolean,boolean,boolean,text)'
  ) is not null,
  'timeline-aware campaign rule matcher exists'
);

select ok(
  to_regprocedure(
    'private.campaign_rule_group_matches_lead_v4(jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,boolean,boolean,boolean,text)'
  ) is not null,
  'timeline-aware campaign rule group matcher exists'
);

select is(
  private.canonicalize_campaign_audience_rule_group(
    '{"logic":"and","rules":[{"field":"project_timeline","operator":"equals","values":["after-2-months"]}]}'::jsonb
  ) #>> '{rules,0,field}',
  'project_timeline',
  'project timeline is a canonical campaign audience field'
);

select is(
  private.campaign_rule_matches_lead_v4(
    '{"field":"project_timeline","operator":"equals","values":["after-2-months"]}'::jsonb,
    null,null,null,null,null,null,null,null,null,null,false,false,false,'after-2-months'
  ),
  true,
  'after-2-months lead matches the nurture timeline rule'
);

select is(
  private.campaign_rule_matches_lead_v4(
    '{"field":"project_timeline","operator":"equals","values":["after-2-months"]}'::jsonb,
    null,null,null,null,null,null,null,null,null,null,false,false,false,'within-2-months'
  ),
  false,
  'shorter-timeline lead does not match the nurture rule'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.campaign_rule_matches_lead_v4(jsonb,text,text,text,text,text,timestamptz,uuid,text,timestamptz,timestamptz,boolean,boolean,boolean,text)',
    'execute'
  ),
  false,
  'authenticated callers cannot invoke the private matcher'
);

select ok(
  position(
    'l.timeline_code' in pg_get_functiondef(
      'private.whatsapp_campaign_audience_contact_ids(jsonb,jsonb)'::regprocedure
    )
  ) > 0,
  'WhatsApp execution audience passes canonical lead timeline'
);

select ok(
  position(
    'campaign_rule_group_matches_lead_v4' in pg_get_functiondef(
      'public.preview_campaign_audience(uuid)'::regprocedure
    )
  ) > 0,
  'campaign preview uses the timeline-aware matcher'
);

select * from finish();
rollback;
