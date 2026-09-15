-- ONEDECORE commerce automation admin control plane.
-- Adds safe runtime controls, editable workflows, immutable job snapshots and WhatsApp provision.

create table public.commerce_automation_settings (
  scope text primary key default 'commerce',
  runtime_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_automation_settings_scope check (scope='commerce')
);

insert into public.commerce_automation_settings(scope,runtime_enabled)
values('commerce',true) on conflict(scope) do nothing;

create trigger trg_commerce_automation_settings_updated_at
before update on public.commerce_automation_settings
for each row execute function private.set_updated_at();

create table public.commerce_automation_channels (
  channel_code text primary key,
  display_name text not null,
  transport_kind text not null,
  enabled boolean not null default false,
  adapter_status text not null default 'not_connected',
  test_mode boolean not null default true,
  default_locale text not null default 'en',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_automation_channel_code check (channel_code ~ '^[a-z0-9_.-]{3,60}$'),
  constraint chk_commerce_automation_channel_transport check (transport_kind in ('whatsapp')),
  constraint chk_commerce_automation_channel_status check (
    adapter_status in ('not_connected','configured','certified')
  ),
  constraint chk_commerce_automation_channel_locale check (default_locale ~ '^[a-z]{2}(?:_[A-Z]{2})?$'),
  constraint chk_commerce_automation_channel_config check (
    jsonb_typeof(config)='object' and octet_length(config::text)<=4096
  )
);

insert into public.commerce_automation_channels(
  channel_code,display_name,transport_kind,enabled,adapter_status,test_mode,default_locale,config
) values (
  'whatsapp','WhatsApp','whatsapp',false,'not_connected',true,'en',
  '{"note":"Provisioned only. Adapter integration and credentials are intentionally absent."}'::jsonb
) on conflict(channel_code) do nothing;

create trigger trg_commerce_automation_channels_updated_at
before update on public.commerce_automation_channels
for each row execute function private.set_updated_at();

alter table public.commerce_automation_rules
  add column name text,
  add column description text,
  add column channel_code text references public.commerce_automation_channels(channel_code) on delete restrict,
  add column archived_at timestamptz;

update public.commerce_automation_rules
set name=initcap(replace(code,'-',' ')),
    description=coalesce(config->>'reason','Commerce lifecycle automation rule'),
    channel_code=case when action_kind='notification' then 'whatsapp' else null end;
alter table public.commerce_automation_rules
  alter column name set not null,
  alter column description set not null,
  add constraint chk_commerce_automation_rules_name check (length(trim(name)) between 2 and 120),
  add constraint chk_commerce_automation_rules_description check (length(trim(description)) between 2 and 500),
  add constraint chk_commerce_automation_rules_channel check (
    (action_kind='notification' and channel_code is not null)
    or (action_kind='task' and channel_code is null)
  );

alter table public.commerce_automation_jobs
  drop constraint chk_commerce_automation_jobs_status,
  add column action_kind_snapshot text,
  add column audience_snapshot text,
  add column template_code_snapshot text,
  add column task_code_snapshot text,
  add column channel_code_snapshot text,
  add column config_snapshot jsonb not null default '{}'::jsonb,
  add column retry_base_seconds_snapshot integer;

alter table public.commerce_automation_jobs
  add constraint chk_commerce_automation_jobs_status check (
    status in ('pending','claimed','succeeded','dead','cancelled')
  );

update public.commerce_automation_jobs j
set action_kind_snapshot=r.action_kind,
    audience_snapshot=r.audience,
    template_code_snapshot=r.template_code,
    task_code_snapshot=r.task_code,
    channel_code_snapshot=r.channel_code,
    config_snapshot=r.config,
    retry_base_seconds_snapshot=r.retry_base_seconds
from public.commerce_automation_rules r
where r.id=j.rule_id;
alter table public.commerce_automation_jobs
  alter column action_kind_snapshot set not null,
  alter column retry_base_seconds_snapshot set not null,
  add constraint chk_commerce_automation_jobs_action_snapshot check (
    action_kind_snapshot in ('notification','task')
  ),
  add constraint chk_commerce_automation_jobs_retry_snapshot check (
    retry_base_seconds_snapshot between 5 and 86400
  );

alter table public.commerce_automation_notification_outbox
  add column channel_code text references public.commerce_automation_channels(channel_code) on delete restrict;

update public.commerce_automation_notification_outbox
set channel_code='whatsapp'
where channel_code is null;

alter table public.commerce_automation_notification_outbox
  alter column channel_code set not null;

alter table public.commerce_automation_audit
  drop constraint chk_commerce_automation_audit_entity,
  add constraint chk_commerce_automation_audit_entity check (
    entity_kind in ('rule','job','task','notification','event','settings','channel')
  );

create or replace function private.commerce_automation_fanout_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.commerce_automation_jobs(
    event_id,rule_id,scheduled_for,max_attempts,
    action_kind_snapshot,audience_snapshot,template_code_snapshot,task_code_snapshot,
    channel_code_snapshot,config_snapshot,retry_base_seconds_snapshot
  )
  select new.id,r.id,new.occurred_at+make_interval(secs=>r.delay_seconds),r.max_attempts,
         r.action_kind,r.audience,r.template_code,r.task_code,
         r.channel_code,r.config,r.retry_base_seconds
  from public.commerce_automation_rules r
  where r.enabled and r.archived_at is null and r.event_code=new.event_code
  on conflict(event_id,rule_id) do nothing;
  return new;
end;
$$;

create or replace function public.claim_commerce_automation_job(
  p_worker_id text,p_lease_seconds integer default 120
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  j public.commerce_automation_jobs%rowtype;
  e public.commerce_automation_events%rowtype;
  tok uuid:=gen_random_uuid();
  runtime_on boolean;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'COMMERCE_UNAUTHORIZED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_worker_id,''))) not between 1 and 80
     or p_lease_seconds not between 30 and 600 then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  select runtime_enabled into runtime_on
  from public.commerce_automation_settings where scope='commerce';
  if coalesce(runtime_on,false) is false then
    return jsonb_build_object('outcome_code','paused');
  end if;
  select * into j from public.commerce_automation_jobs
  where (status='pending' and scheduled_for<=now())
     or (status='claimed' and lease_expires_at<now())
  order by scheduled_for,created_at
  for update skip locked limit 1;
  if not found then return jsonb_build_object('outcome_code','none'); end if;
  if j.attempt_count>=j.max_attempts then
    update public.commerce_automation_jobs
    set status='dead',claim_token=null,claimed_by=null,claimed_at=null,lease_expires_at=null
    where id=j.id;
    return jsonb_build_object('outcome_code','dead','job_id',j.id);
  end if;
  update public.commerce_automation_jobs
  set status='claimed',attempt_count=attempt_count+1,claim_token=tok,claimed_by=trim(p_worker_id),
      claimed_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),last_error_code=null
  where id=j.id returning * into j;
  select * into e from public.commerce_automation_events where id=j.event_id;
  return jsonb_build_object(
    'outcome_code','claimed','job_id',j.id,'claim_token',tok,'attempt_count',j.attempt_count,
    'action_kind',j.action_kind_snapshot,'audience',j.audience_snapshot,
    'template_code',j.template_code_snapshot,'task_code',j.task_code_snapshot,
    'channel_code',j.channel_code_snapshot,'source_kind',e.source_kind,'source_id',e.source_id,
    'event_code',e.event_code,'payload',e.payload,'config',j.config_snapshot
  );
end;
$$;

create or replace function public.complete_commerce_automation_job(
  p_job_id uuid,p_claim_token uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  j public.commerce_automation_jobs%rowtype;
  e public.commerce_automation_events%rowtype;
  ttl text; det text;
begin
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found or j.status<>'claimed' or j.claim_token is distinct from p_claim_token
     or j.lease_expires_at<now() then
    raise exception 'COMMERCE_AUTOMATION_CLAIM_INVALID' using errcode='22023';
  end if;
  select * into e from public.commerce_automation_events where id=j.event_id;
  if j.action_kind_snapshot='notification' then
    insert into public.commerce_automation_notification_outbox(
      job_id,event_id,audience,template_code,channel_code,source_kind,source_id,payload
    ) values (
      j.id,e.id,j.audience_snapshot,j.template_code_snapshot,j.channel_code_snapshot,
      e.source_kind,e.source_id,e.payload
    ) on conflict(job_id) do nothing;
  elsif j.action_kind_snapshot='task' then
    ttl:=case j.task_code_snapshot
      when 'vendor_product_review' then 'Review vendor product'
      when 'vendor_catalogue_completion' then 'Complete approved product catalogue setup'
      when 'order_start_fulfilment' then 'Start order fulfilment'
      else 'Commerce automation task'
    end;
    det:=case e.source_kind
      when 'order' then coalesce(e.payload->>'orderReference','Commerce order')
      when 'vendor_product' then coalesce(e.payload->>'productName',e.payload->>'productReference','Vendor product')
      else 'Commerce item'
    end;
    insert into public.commerce_automation_tasks(
      job_id,event_id,task_code,source_kind,source_id,title,detail,due_at
    ) values (
      j.id,e.id,j.task_code_snapshot,e.source_kind,e.source_id,ttl,det,now()
    ) on conflict(job_id) do nothing;
  else
    raise exception 'COMMERCE_AUTOMATION_RULE_INVALID' using errcode='22023';
  end if;
  update public.commerce_automation_jobs
  set status='succeeded',completed_at=now(),claim_token=null,claimed_by=null,
      claimed_at=null,lease_expires_at=null
  where id=j.id;
  return jsonb_build_object('job_id',j.id,'status','succeeded');
end;
$$;

create or replace function public.fail_commerce_automation_job(
  p_job_id uuid,p_claim_token uuid,p_error_code text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  j public.commerce_automation_jobs%rowtype;
  next_status text;
  wait_seconds integer;
begin
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found or j.status<>'claimed' or j.claim_token is distinct from p_claim_token then
    raise exception 'COMMERCE_AUTOMATION_CLAIM_INVALID' using errcode='22023';
  end if;
  next_status:=case when j.attempt_count>=j.max_attempts then 'dead' else 'pending' end;
  wait_seconds:=least(86400,j.retry_base_seconds_snapshot*(2 ^ greatest(j.attempt_count-1,0))::integer);
  update public.commerce_automation_jobs
  set status=next_status,
      scheduled_for=case when next_status='pending' then now()+make_interval(secs=>wait_seconds) else scheduled_for end,
      claim_token=null,claimed_by=null,claimed_at=null,lease_expires_at=null,
      last_error_code=left(coalesce(nullif(trim(p_error_code),''),'COMMERCE_AUTOMATION_FAILED'),120),
      completed_at=case when next_status='dead' then now() else null end
  where id=j.id;
  return jsonb_build_object('job_id',j.id,'status',next_status,
    'retry_after_seconds',case when next_status='pending' then wait_seconds else null end);
end;
$$;
create or replace function public.set_commerce_automation_rule_enabled(
  p_rule_id uuid,p_enabled boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid; r public.commerce_automation_rules%rowtype; cancelled_count integer:=0;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_rules
  set enabled=coalesce(p_enabled,false),updated_by=a
  where id=p_rule_id and archived_at is null returning * into r;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if r.enabled is false then
    update public.commerce_automation_jobs
    set status='cancelled',completed_at=now(),last_error_code='RULE_DISABLED'
    where rule_id=r.id and status='pending';
    get diagnostics cancelled_count=row_count;
  end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,case when r.enabled then 'rule.enabled' else 'rule.disabled' end,'rule',r.id,
    jsonb_build_object('code',r.code,'cancelledPendingJobs',cancelled_count));
  return jsonb_build_object('id',r.id,'code',r.code,'enabled',r.enabled,'cancelled_pending_jobs',cancelled_count);
end;
$$;

create or replace function public.set_commerce_automation_runtime_enabled(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; s public.commerce_automation_settings%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_settings
  set runtime_enabled=coalesce(p_enabled,false),updated_by=a
  where scope='commerce' returning * into s;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,case when s.runtime_enabled then 'runtime.enabled' else 'runtime.paused' end,
    'settings',gen_random_uuid(),jsonb_build_object('scope','commerce'));
  return jsonb_build_object('runtime_enabled',s.runtime_enabled);
end;
$$;
create or replace function public.update_commerce_automation_channel(
  p_channel_code text,p_test_mode boolean,p_default_locale text,p_config jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid; c public.commerce_automation_channels%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  if jsonb_typeof(coalesce(p_config,'{}'::jsonb))<>'object' or octet_length(coalesce(p_config,'{}'::jsonb)::text)>4096 then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  update public.commerce_automation_channels
  set test_mode=coalesce(p_test_mode,true),default_locale=trim(coalesce(p_default_locale,'en')),
      config=coalesce(p_config,'{}'::jsonb),updated_by=a
  where channel_code=p_channel_code returning * into c;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'channel.config_updated','channel',gen_random_uuid(),
    jsonb_build_object('channelCode',c.channel_code,'testMode',c.test_mode,'locale',c.default_locale));
  return jsonb_build_object('channel_code',c.channel_code,'enabled',c.enabled,
    'adapter_status',c.adapter_status,'test_mode',c.test_mode,'default_locale',c.default_locale);
end;
$$;

create or replace function public.set_commerce_automation_channel_enabled(
  p_channel_code text,p_enabled boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid; c public.commerce_automation_channels%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  select * into c from public.commerce_automation_channels where channel_code=p_channel_code for update;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if coalesce(p_enabled,false) and c.adapter_status<>'certified' then
    raise exception 'COMMERCE_AUTOMATION_CHANNEL_NOT_CERTIFIED' using errcode='22023';
  end if;
  update public.commerce_automation_channels set enabled=coalesce(p_enabled,false),updated_by=a
  where channel_code=p_channel_code returning * into c;
  return jsonb_build_object('channel_code',c.channel_code,'enabled',c.enabled,'adapter_status',c.adapter_status);
end;
$$;
create or replace function public.upsert_commerce_automation_rule(
  p_rule_id uuid,p_code text,p_name text,p_description text,p_event_code text,
  p_action_kind text,p_audience text,p_template_code text,p_task_code text,p_channel_code text,
  p_delay_seconds integer,p_max_attempts integer,p_retry_base_seconds integer,p_config jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid; r public.commerce_automation_rules%rowtype; is_new boolean:=p_rule_id is null;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  if trim(coalesce(p_code,'')) !~ '^[a-z0-9_.-]{3,120}$'
     or trim(coalesce(p_event_code,'')) !~ '^[a-z0-9_.-]{3,120}$'
     or length(trim(coalesce(p_name,''))) not between 2 and 120
     or length(trim(coalesce(p_description,''))) not between 2 and 500
     or p_action_kind not in ('notification','task')
     or p_delay_seconds not between 0 and 2592000
     or p_max_attempts not between 1 and 10
     or p_retry_base_seconds not between 5 and 86400
     or jsonb_typeof(coalesce(p_config,'{}'::jsonb))<>'object'
     or octet_length(coalesce(p_config,'{}'::jsonb)::text)>4096 then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  if p_action_kind='notification' and (
       p_audience not in ('customer','vendor','admin')
       or nullif(trim(coalesce(p_template_code,'')),'') is null
       or nullif(trim(coalesce(p_channel_code,'')),'') is null
       or nullif(trim(coalesce(p_task_code,'')),'') is not null
     ) then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
  if p_action_kind='task' and (
       p_audience<>'admin' or nullif(trim(coalesce(p_task_code,'')),'') is null
       or nullif(trim(coalesce(p_template_code,'')),'') is not null
       or nullif(trim(coalesce(p_channel_code,'')),'') is not null
     ) then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
  if is_new then
    insert into public.commerce_automation_rules(
      code,name,description,event_code,action_kind,audience,template_code,task_code,channel_code,
      delay_seconds,enabled,max_attempts,retry_base_seconds,config,updated_by
    ) values (
      trim(p_code),trim(p_name),trim(p_description),trim(p_event_code),p_action_kind,p_audience,
      nullif(trim(coalesce(p_template_code,'')),''),nullif(trim(coalesce(p_task_code,'')),''),
      nullif(trim(coalesce(p_channel_code,'')),''),p_delay_seconds,false,p_max_attempts,
      p_retry_base_seconds,coalesce(p_config,'{}'::jsonb),a
    ) returning * into r;
  else
    update public.commerce_automation_rules
    set code=trim(p_code),name=trim(p_name),description=trim(p_description),event_code=trim(p_event_code),
        action_kind=p_action_kind,audience=p_audience,
        template_code=nullif(trim(coalesce(p_template_code,'')),''),
        task_code=nullif(trim(coalesce(p_task_code,'')),''),
        channel_code=nullif(trim(coalesce(p_channel_code,'')),''),
        delay_seconds=p_delay_seconds,max_attempts=p_max_attempts,
        retry_base_seconds=p_retry_base_seconds,config=coalesce(p_config,'{}'::jsonb),updated_by=a
    where id=p_rule_id and archived_at is null returning * into r;
    if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,case when is_new then 'rule.created' else 'rule.updated' end,'rule',r.id,
    jsonb_build_object('code',r.code,'eventCode',r.event_code,'actionKind',r.action_kind));
  return jsonb_build_object('id',r.id,'code',r.code,'enabled',r.enabled,'created',is_new);
exception when unique_violation then
  raise exception 'COMMERCE_AUTOMATION_RULE_CODE_EXISTS' using errcode='23505';
end;
$$;

create or replace function public.archive_commerce_automation_rule(p_rule_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; r public.commerce_automation_rules%rowtype; n integer:=0;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_rules
  set enabled=false,archived_at=now(),updated_by=a
  where id=p_rule_id and archived_at is null returning * into r;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  update public.commerce_automation_jobs
  set status='cancelled',completed_at=now(),last_error_code='RULE_ARCHIVED'
  where rule_id=r.id and status='pending';
  get diagnostics n=row_count;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'rule.archived','rule',r.id,jsonb_build_object('code',r.code,'cancelledPendingJobs',n));
  return jsonb_build_object('id',r.id,'archived',true,'cancelled_pending_jobs',n);
end;
$$;

create or replace function public.cancel_commerce_automation_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; j public.commerce_automation_jobs%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if j.status not in ('pending','dead') and not (j.status='claimed' and j.lease_expires_at<now()) then
    raise exception 'COMMERCE_AUTOMATION_CANCEL_INVALID' using errcode='22023';
  end if;
  update public.commerce_automation_jobs
  set status='cancelled',completed_at=now(),claim_token=null,claimed_by=null,claimed_at=null,
      lease_expires_at=null,last_error_code='MANUALLY_CANCELLED'
  where id=j.id returning * into j;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'job.cancelled','job',j.id,'{}'::jsonb);
  return jsonb_build_object('id',j.id,'status',j.status);
end;
$$;
create or replace function public.cancel_commerce_automation_notification(p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; n public.commerce_automation_notification_outbox%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_notification_outbox
  set status='cancelled'
  where id=p_notification_id and status='pending_adapter' returning * into n;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'notification.cancelled','notification',n.id,
    jsonb_build_object('templateCode',n.template_code,'channelCode',n.channel_code));
  return jsonb_build_object('id',n.id,'status',n.status);
end;
$$;

create or replace function public.cancel_commerce_automation_task(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; t public.commerce_automation_tasks%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_tasks
  set status='cancelled'
  where id=p_task_id and status='open' returning * into t;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'task.cancelled','task',t.id,jsonb_build_object('taskCode',t.task_code));
  return jsonb_build_object('id',t.id,'status',t.status);
end;
$$;

create or replace function public.replay_commerce_automation_event(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; e public.commerce_automation_events%rowtype; n integer:=0;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  select * into e from public.commerce_automation_events where id=p_event_id;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_jobs(
    event_id,rule_id,scheduled_for,max_attempts,
    action_kind_snapshot,audience_snapshot,template_code_snapshot,task_code_snapshot,
    channel_code_snapshot,config_snapshot,retry_base_seconds_snapshot
  )
  select e.id,r.id,now()+make_interval(secs=>r.delay_seconds),r.max_attempts,
         r.action_kind,r.audience,r.template_code,r.task_code,r.channel_code,r.config,r.retry_base_seconds
  from public.commerce_automation_rules r
  where r.enabled and r.archived_at is null and r.event_code=e.event_code
  on conflict(event_id,rule_id) do nothing;
  get diagnostics n=row_count;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'event.replayed','event',e.id,jsonb_build_object('newJobs',n,'eventCode',e.event_code));
  return jsonb_build_object('id',e.id,'new_jobs',n);
end;
$$;

-- Extend RLS to the new control tables.
do $$
declare t text;
begin
  foreach t in array array['commerce_automation_settings','commerce_automation_channels'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.authorize(''commerce.automation.manage'')))',
      t||'_automation_manage_read',t
    );
  end loop;
end $$;

revoke all on function public.set_commerce_automation_runtime_enabled(boolean) from public,anon,authenticated;
revoke all on function public.update_commerce_automation_channel(text,boolean,text,jsonb) from public,anon,authenticated;
revoke all on function public.set_commerce_automation_channel_enabled(text,boolean) from public,anon,authenticated;
revoke all on function public.upsert_commerce_automation_rule(uuid,text,text,text,text,text,text,text,text,text,integer,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.archive_commerce_automation_rule(uuid) from public,anon,authenticated;
revoke all on function public.cancel_commerce_automation_job(uuid) from public,anon,authenticated;
revoke all on function public.cancel_commerce_automation_notification(uuid) from public,anon,authenticated;
revoke all on function public.cancel_commerce_automation_task(uuid) from public,anon,authenticated;
revoke all on function public.replay_commerce_automation_event(uuid) from public,anon,authenticated;

grant execute on function public.set_commerce_automation_runtime_enabled(boolean) to authenticated;
grant execute on function public.update_commerce_automation_channel(text,boolean,text,jsonb) to authenticated;
grant execute on function public.set_commerce_automation_channel_enabled(text,boolean) to authenticated;
grant execute on function public.upsert_commerce_automation_rule(uuid,text,text,text,text,text,text,text,text,text,integer,integer,integer,jsonb) to authenticated;
grant execute on function public.archive_commerce_automation_rule(uuid) to authenticated;
grant execute on function public.cancel_commerce_automation_job(uuid) to authenticated;
grant execute on function public.cancel_commerce_automation_notification(uuid) to authenticated;
grant execute on function public.cancel_commerce_automation_task(uuid) to authenticated;
grant execute on function public.replay_commerce_automation_event(uuid) to authenticated;

comment on table public.commerce_automation_settings is
 'Runtime pause/resume control for commerce automation. Deployment env remains the hard master gate.';
comment on table public.commerce_automation_channels is
 'Provisioned outbound channels. WhatsApp starts disabled/not_connected and cannot be enabled until certified.';
comment on column public.commerce_automation_jobs.config_snapshot is
 'Immutable rule configuration captured at event fan-out so later rule edits never mutate queued work.';
