-- ONEDECORE commerce-only automation control plane.
-- Event-driven, transport-neutral, auditable. No WhatsApp/provider dependency.

insert into public.permissions (code, name, description, is_system, is_active) values
  ('commerce.automation.manage', 'Manage commerce automations',
   'Manage and inspect the isolated commerce automation control plane', true, true)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, is_system = true, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'super_admin' and p.code = 'commerce.automation.manage'
on conflict (role_id, permission_id) do nothing;

create table public.commerce_automation_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  event_code text not null,
  action_kind text not null,
  audience text,
  template_code text,
  task_code text,
  delay_seconds integer not null default 0,
  enabled boolean not null default true,
  max_attempts integer not null default 5,  retry_base_seconds integer not null default 60,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_automation_rules_code check (code ~ '^[a-z0-9_.-]{3,120}$'),
  constraint chk_commerce_automation_rules_event check (event_code ~ '^[a-z0-9_.-]{3,120}$'),
  constraint chk_commerce_automation_rules_action check (action_kind in ('notification','task')),
  constraint chk_commerce_automation_rules_audience check (
    (action_kind='notification' and audience in ('customer','vendor','admin') and template_code is not null and task_code is null)
    or (action_kind='task' and audience='admin' and task_code is not null and template_code is null)
  ),
  constraint chk_commerce_automation_rules_delay check (delay_seconds between 0 and 2592000),
  constraint chk_commerce_automation_rules_attempts check (max_attempts between 1 and 10),
  constraint chk_commerce_automation_rules_retry check (retry_base_seconds between 5 and 86400),
  constraint chk_commerce_automation_rules_config check (
    jsonb_typeof(config)='object' and octet_length(config::text) <= 4096
  )
);

create trigger trg_commerce_automation_rules_updated_at
before update on public.commerce_automation_rules
for each row execute function private.set_updated_at();

create table public.commerce_automation_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  source_kind text not null,  source_id uuid not null,
  source_event_id uuid,
  event_code text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_commerce_automation_events_source check (source_kind in ('order','vendor_product')),
  constraint chk_commerce_automation_events_code check (event_code ~ '^[a-z0-9_.-]{3,120}$'),
  constraint chk_commerce_automation_events_payload check (
    jsonb_typeof(payload)='object' and octet_length(payload::text) <= 8192
  )
);
create index commerce_automation_events_recent_idx
  on public.commerce_automation_events (occurred_at desc);
create index commerce_automation_events_source_idx
  on public.commerce_automation_events (source_kind, source_id, occurred_at desc);

create table public.commerce_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.commerce_automation_events(id) on delete restrict,
  rule_id uuid not null references public.commerce_automation_rules(id) on delete restrict,
  status text not null default 'pending',
  scheduled_for timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null,
  claim_token uuid,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  completed_at timestamptz,  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rule_id),
  constraint chk_commerce_automation_jobs_status check (
    status in ('pending','claimed','succeeded','dead')
  ),
  constraint chk_commerce_automation_jobs_attempts check (
    attempt_count between 0 and 10 and max_attempts between 1 and 10 and attempt_count <= max_attempts
  ),
  constraint chk_commerce_automation_jobs_claim check (
    (status='claimed' and claim_token is not null and claimed_by is not null and claimed_at is not null and lease_expires_at is not null)
    or (status<>'claimed')
  )
);
create index commerce_automation_jobs_due_idx
  on public.commerce_automation_jobs (scheduled_for, created_at)
  where status in ('pending','claimed');
create index commerce_automation_jobs_status_idx
  on public.commerce_automation_jobs (status, updated_at desc);
create trigger trg_commerce_automation_jobs_updated_at
before update on public.commerce_automation_jobs
for each row execute function private.set_updated_at();

create table public.commerce_automation_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.commerce_automation_jobs(id) on delete restrict,
  event_id uuid not null references public.commerce_automation_events(id) on delete restrict,
  audience text not null,
  template_code text not null,
  source_kind text not null,
  source_id uuid not null,
  status text not null default 'pending_adapter',  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint chk_commerce_automation_outbox_audience check (audience in ('customer','vendor','admin')),
  constraint chk_commerce_automation_outbox_source check (source_kind in ('order','vendor_product')),
  constraint chk_commerce_automation_outbox_status check (
    status in ('pending_adapter','claimed','sent','failed','cancelled')
  ),
  constraint chk_commerce_automation_outbox_payload check (
    jsonb_typeof(payload)='object' and octet_length(payload::text) <= 8192
  )
);
create index commerce_automation_outbox_status_idx
  on public.commerce_automation_notification_outbox (status, created_at);
create trigger trg_commerce_automation_outbox_updated_at
before update on public.commerce_automation_notification_outbox
for each row execute function private.set_updated_at();

create table public.commerce_automation_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.commerce_automation_jobs(id) on delete restrict,
  event_id uuid not null references public.commerce_automation_events(id) on delete restrict,
  task_code text not null,
  source_kind text not null,
  source_id uuid not null,
  title text not null,
  detail text not null,
  status text not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,  completed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_commerce_automation_tasks_status check (status in ('open','done','cancelled')),
  constraint chk_commerce_automation_tasks_source check (source_kind in ('order','vendor_product')),
  constraint chk_commerce_automation_tasks_completion check (
    (status='done' and completed_at is not null and completed_by is not null)
    or (status<>'done')
  )
);
create index commerce_automation_tasks_open_idx
  on public.commerce_automation_tasks (created_at desc) where status='open';
create trigger trg_commerce_automation_tasks_updated_at
before update on public.commerce_automation_tasks
for each row execute function private.set_updated_at();

create table public.commerce_automation_audit (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  action_code text not null,
  entity_kind text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chk_commerce_automation_audit_action check (action_code ~ '^[a-z0-9_.-]{3,120}$'),
  constraint chk_commerce_automation_audit_entity check (entity_kind in ('rule','job','task')),
  constraint chk_commerce_automation_audit_metadata check (
    jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 4096
  )
);create or replace function private.commerce_automation_fanout_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.commerce_automation_jobs (
    event_id, rule_id, scheduled_for, max_attempts
  )
  select
    new.id, r.id, new.occurred_at + make_interval(secs => r.delay_seconds), r.max_attempts
  from public.commerce_automation_rules r
  where r.enabled and r.event_code = new.event_code
  on conflict (event_id, rule_id) do nothing;
  return new;
end;
$$;

create trigger trg_commerce_automation_event_fanout
after insert on public.commerce_automation_events
for each row execute function private.commerce_automation_fanout_event();

create or replace function private.commerce_automation_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  ref text;
begin  event_name := case new.event_code
    when 'order_confirmed_cod' then 'order.confirmed'
    when 'processing_started' then 'order.processing'
    when 'order_shipped' then 'order.shipped'
    when 'order_delivered' then 'order.delivered'
    when 'order_cancelled' then 'order.cancelled'
    else null
  end;
  if event_name is null then return new; end if;

  select o.order_reference into ref
  from public.commerce_orders o where o.id = new.order_id;

  insert into public.commerce_automation_events (
    event_key, source_kind, source_id, source_event_id, event_code, payload, occurred_at
  ) values (
    'order-event:' || new.id::text,
    'order', new.order_id, new.id, event_name,
    jsonb_strip_nulls(jsonb_build_object(
      'orderReference', ref,
      'fromStatus', new.from_status,
      'toStatus', new.to_status,
      'orderEventCode', new.event_code
    )),
    new.created_at
  ) on conflict (event_key) do nothing;
  return new;
end;
$$;

create trigger trg_commerce_order_event_to_automation
after insert on public.commerce_order_events
for each row execute function private.commerce_automation_order_event();create or replace function private.commerce_automation_vendor_product_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  v_code text;
  v_name text;
begin
  if new.vendor_id is null then return new; end if;

  if old.vendor_submission_status is distinct from new.vendor_submission_status then
    event_name := case new.vendor_submission_status
      when 'pending_review' then 'vendor.product_submitted'
      when 'changes_requested' then 'vendor.changes_requested'
      when 'approved' then 'vendor.product_approved'
      when 'rejected' then 'vendor.product_rejected'
      else null
    end;
    if event_name is not null then
      select vendor_code, display_name into v_code, v_name
      from public.commerce_vendors where id = new.vendor_id;
      insert into public.commerce_automation_events (
        event_key, source_kind, source_id, event_code, payload, occurred_at
      ) values (
        'vendor-product:' || new.id::text || ':' || event_name || ':' || new.lock_version::text,
        'vendor_product', new.id, event_name,
        jsonb_strip_nulls(jsonb_build_object(
          'productReference', new.product_reference,
          'productName', new.name,
          'vendorId', new.vendor_id,
          'vendorCode', v_code,
          'vendorName', v_name,
          'reviewStatus', new.vendor_submission_status,
          'reviewNote', new.review_note
        )), now()
      ) on conflict (event_key) do nothing;
    end if;
  end if;  if old.status is distinct from new.status and new.status='published' then
    select vendor_code, display_name into v_code, v_name
    from public.commerce_vendors where id = new.vendor_id;
    insert into public.commerce_automation_events (
      event_key, source_kind, source_id, event_code, payload, occurred_at
    ) values (
      'vendor-product:' || new.id::text || ':vendor.product_published:' || new.lock_version::text,
      'vendor_product', new.id, 'vendor.product_published',
      jsonb_build_object(
        'productReference', new.product_reference,
        'productName', new.name,
        'vendorId', new.vendor_id,
        'vendorCode', v_code,
        'vendorName', v_name
      ), now()
    ) on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_commerce_vendor_product_to_automation
after update of vendor_submission_status, status on public.commerce_products
for each row execute function private.commerce_automation_vendor_product_event();

insert into public.commerce_automation_rules
(code,event_code,action_kind,audience,template_code,task_code,delay_seconds,enabled,max_attempts,retry_base_seconds,config)
values
('vendor-submit-admin-review','vendor.product_submitted','task','admin',null,'vendor_product_review',0,true,5,60,'{}'),
('vendor-changes-notify','vendor.changes_requested','notification','vendor','vendor_product_changes_requested',null,0,true,5,60,'{}'),
('vendor-approved-notify','vendor.product_approved','notification','vendor','vendor_product_approved',null,0,true,5,60,'{}'),
('vendor-approved-catalogue-task','vendor.product_approved','task','admin',null,'vendor_catalogue_completion',0,true,5,60,'{}'),
('vendor-rejected-notify','vendor.product_rejected','notification','vendor','vendor_product_rejected',null,0,true,5,60,'{}'),
('vendor-published-notify','vendor.product_published','notification','vendor','vendor_product_published',null,0,true,5,60,'{}')
on conflict (code) do nothing;insert into public.commerce_automation_rules
(code,event_code,action_kind,audience,template_code,task_code,delay_seconds,enabled,max_attempts,retry_base_seconds,config)
values
('order-confirmed-customer','order.confirmed','notification','customer','order_confirmed_cod',null,0,true,5,60,'{}'),
('order-confirmed-fulfilment-task','order.confirmed','task','admin',null,'order_start_fulfilment',0,true,5,60,'{}'),
('order-processing-customer','order.processing','notification','customer','order_processing',null,0,true,5,60,'{}'),
('order-shipped-customer','order.shipped','notification','customer','order_shipped',null,0,true,5,60,'{}'),
('order-delivered-customer','order.delivered','notification','customer','order_delivered',null,0,true,5,60,'{}'),
('order-delivered-review-request','order.delivered','notification','customer','order_review_request',null,172800,false,5,60,
 '{"reason":"disabled until customer-communication policy is explicitly approved"}'),
('order-cancelled-customer','order.cancelled','notification','customer','order_cancelled',null,0,true,5,60,'{}')
on conflict (code) do nothing;

create or replace function public.claim_commerce_automation_job(
  p_worker_id text,
  p_lease_seconds integer default 120
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  j public.commerce_automation_jobs%rowtype;
  r public.commerce_automation_rules%rowtype;
  e public.commerce_automation_events%rowtype;
  tok uuid:=gen_random_uuid();
begin
  if current_user not in ('service_role','postgres') then raise exception 'COMMERCE_UNAUTHORIZED' using errcode='42501'; end if;
  if length(trim(coalesce(p_worker_id,''))) not between 1 and 80 or p_lease_seconds not between 30 and 600 then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  select * into j from public.commerce_automation_jobs
  where (status='pending' and scheduled_for<=now())
     or (status='claimed' and lease_expires_at<now())
  order by scheduled_for, created_at
  for update skip locked limit 1;  if not found then return jsonb_build_object('outcome_code','none'); end if;
  if j.attempt_count >= j.max_attempts then
    update public.commerce_automation_jobs set status='dead',claim_token=null,claimed_by=null,claimed_at=null,lease_expires_at=null
    where id=j.id;
    return jsonb_build_object('outcome_code','dead','job_id',j.id);
  end if;
  update public.commerce_automation_jobs
  set status='claimed',attempt_count=attempt_count+1,claim_token=tok,claimed_by=trim(p_worker_id),
      claimed_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),last_error_code=null
  where id=j.id returning * into j;
  select * into r from public.commerce_automation_rules where id=j.rule_id;
  select * into e from public.commerce_automation_events where id=j.event_id;
  return jsonb_build_object(
    'outcome_code','claimed','job_id',j.id,'claim_token',tok,'attempt_count',j.attempt_count,
    'action_kind',r.action_kind,'audience',r.audience,'template_code',r.template_code,'task_code',r.task_code,
    'source_kind',e.source_kind,'source_id',e.source_id,'event_code',e.event_code,'payload',e.payload,
    'config',r.config
  );
end;
$$;

create or replace function public.complete_commerce_automation_job(
  p_job_id uuid,p_claim_token uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  j public.commerce_automation_jobs%rowtype;
  r public.commerce_automation_rules%rowtype;
  e public.commerce_automation_events%rowtype;
  ttl text; det text;
begin
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found or j.status<>'claimed' or j.claim_token is distinct from p_claim_token or j.lease_expires_at<now() then
    raise exception 'COMMERCE_AUTOMATION_CLAIM_INVALID' using errcode='22023';
  end if;
  select * into r from public.commerce_automation_rules where id=j.rule_id;
  select * into e from public.commerce_automation_events where id=j.event_id;  if r.action_kind='notification' then
    insert into public.commerce_automation_notification_outbox(
      job_id,event_id,audience,template_code,source_kind,source_id,payload
    ) values (j.id,e.id,r.audience,r.template_code,e.source_kind,e.source_id,e.payload)
    on conflict (job_id) do nothing;
  elsif r.action_kind='task' then
    ttl := case r.task_code
      when 'vendor_product_review' then 'Review vendor product'
      when 'vendor_catalogue_completion' then 'Complete approved product catalogue setup'
      when 'order_start_fulfilment' then 'Start order fulfilment'
      else 'Commerce automation task'
    end;
    det := case e.source_kind
      when 'order' then coalesce(e.payload->>'orderReference','Commerce order')
      when 'vendor_product' then coalesce(e.payload->>'productName',e.payload->>'productReference','Vendor product')
      else 'Commerce item'
    end;
    insert into public.commerce_automation_tasks(
      job_id,event_id,task_code,source_kind,source_id,title,detail,due_at
    ) values (j.id,e.id,r.task_code,e.source_kind,e.source_id,ttl,det,now())
    on conflict (job_id) do nothing;
  else
    raise exception 'COMMERCE_AUTOMATION_RULE_INVALID' using errcode='22023';
  end if;

  update public.commerce_automation_jobs
  set status='succeeded',completed_at=now(),claim_token=null,claimed_by=null,claimed_at=null,lease_expires_at=null
  where id=j.id;
  return jsonb_build_object('job_id',j.id,'status','succeeded');
end;
$$;create or replace function public.fail_commerce_automation_job(
  p_job_id uuid,p_claim_token uuid,p_error_code text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  j public.commerce_automation_jobs%rowtype;
  r public.commerce_automation_rules%rowtype;
  next_status text;
  wait_seconds integer;
begin
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found or j.status<>'claimed' or j.claim_token is distinct from p_claim_token then
    raise exception 'COMMERCE_AUTOMATION_CLAIM_INVALID' using errcode='22023';
  end if;
  select * into r from public.commerce_automation_rules where id=j.rule_id;
  next_status := case when j.attempt_count>=j.max_attempts then 'dead' else 'pending' end;
  wait_seconds := least(86400, r.retry_base_seconds * (2 ^ greatest(j.attempt_count-1,0))::integer);
  update public.commerce_automation_jobs
  set status=next_status,
      scheduled_for=case when next_status='pending' then now()+make_interval(secs=>wait_seconds) else scheduled_for end,
      claim_token=null,claimed_by=null,claimed_at=null,lease_expires_at=null,
      last_error_code=left(coalesce(nullif(trim(p_error_code),''),'COMMERCE_AUTOMATION_FAILED'),120),
      completed_at=case when next_status='dead' then now() else null end
  where id=j.id;
  return jsonb_build_object('job_id',j.id,'status',next_status,'retry_after_seconds',case when next_status='pending' then wait_seconds else null end);
end;
$$;

create or replace function public.set_commerce_automation_rule_enabled(
  p_rule_id uuid,p_enabled boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare a uuid; r public.commerce_automation_rules%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');  update public.commerce_automation_rules
  set enabled=coalesce(p_enabled,false),updated_by=a
  where id=p_rule_id returning * into r;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,case when r.enabled then 'rule.enabled' else 'rule.disabled' end,'rule',r.id,jsonb_build_object('code',r.code));
  return jsonb_build_object('id',r.id,'code',r.code,'enabled',r.enabled);
end;
$$;

create or replace function public.retry_commerce_automation_job(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare a uuid; j public.commerce_automation_jobs%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  select * into j from public.commerce_automation_jobs where id=p_job_id for update;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if j.status not in ('dead','claimed') then raise exception 'COMMERCE_AUTOMATION_RETRY_INVALID' using errcode='22023'; end if;
  if j.status='claimed' and j.lease_expires_at>=now() then raise exception 'COMMERCE_AUTOMATION_RETRY_INVALID' using errcode='22023'; end if;
  update public.commerce_automation_jobs
  set status='pending',scheduled_for=now(),attempt_count=0,claim_token=null,claimed_by=null,claimed_at=null,
      lease_expires_at=null,last_error_code=null,completed_at=null
  where id=j.id returning * into j;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'job.manual_retry','job',j.id,'{}'::jsonb);
  return jsonb_build_object('id',j.id,'status',j.status);
end;
$$;create or replace function public.complete_commerce_automation_task(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare a uuid; t public.commerce_automation_tasks%rowtype;
begin
  a:=private.commerce_require_actor('commerce.automation.manage');
  update public.commerce_automation_tasks
  set status='done',completed_at=now(),completed_by=a
  where id=p_task_id and status='open' returning * into t;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.commerce_automation_audit(actor_profile_id,action_code,entity_kind,entity_id,metadata)
  values(a,'task.completed','task',t.id,jsonb_build_object('taskCode',t.task_code));
  return jsonb_build_object('id',t.id,'status',t.status);
end;
$$;

-- Automation tables are read-only to authorized staff. All writes are RPC/trigger owned.
do $$
declare t text;
begin
  foreach t in array array[
    'commerce_automation_rules','commerce_automation_events','commerce_automation_jobs',
    'commerce_automation_notification_outbox','commerce_automation_tasks','commerce_automation_audit'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.authorize(''commerce.automation.manage'')))',
      t||'_automation_manage_read',t
    );
  end loop;
end $$;revoke all on function private.commerce_automation_fanout_event() from public,anon,authenticated;
revoke all on function private.commerce_automation_order_event() from public,anon,authenticated;
revoke all on function private.commerce_automation_vendor_product_event() from public,anon,authenticated;

revoke all on function public.claim_commerce_automation_job(text,integer) from public,anon,authenticated;
revoke all on function public.complete_commerce_automation_job(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fail_commerce_automation_job(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.set_commerce_automation_rule_enabled(uuid,boolean) from public,anon,authenticated;
revoke all on function public.retry_commerce_automation_job(uuid) from public,anon,authenticated;
revoke all on function public.complete_commerce_automation_task(uuid) from public,anon,authenticated;

grant execute on function public.claim_commerce_automation_job(text,integer) to service_role;
grant execute on function public.complete_commerce_automation_job(uuid,uuid) to service_role;
grant execute on function public.fail_commerce_automation_job(uuid,uuid,text) to service_role;
grant execute on function public.set_commerce_automation_rule_enabled(uuid,boolean) to authenticated;
grant execute on function public.retry_commerce_automation_job(uuid) to authenticated;
grant execute on function public.complete_commerce_automation_task(uuid) to authenticated;

comment on table public.commerce_automation_notification_outbox is
 'Transport-neutral commerce notification intents. pending_adapter means intentionally not sent; future WhatsApp/email adapters consume this table.';
comment on table public.commerce_automation_jobs is
 'Durable ecommerce-only automation queue with leasing, exponential retry and dead-letter state.';
comment on table public.commerce_automation_events is
 'Immutable automation intake sourced from canonical commerce order/vendor lifecycle changes.';