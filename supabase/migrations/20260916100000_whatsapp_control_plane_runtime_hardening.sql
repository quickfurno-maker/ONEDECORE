-- =============================================================================
-- ONEDECORE WM-2/3/4 runtime hardening (ADR-0034)
--
-- Forward-only repairs found while wiring the WM-3/WM-4 runtime to its
-- migrations. No table, grant or permission changes; every function keeps its
-- signature and return shape, so callers and generated types stay stable.
--
--   1. list_whatsapp_contacts      one escaped search pattern for both the
--                                  count and the page (the page used to treat
--                                  % and _ in a search as wildcards)
--   2. record_whatsapp_inbound_opt_out
--                                  NFKC normalisation as the WM-0 contract
--                                  states, and Meta's marketing opt-out quick
--                                  reply ("Stop promotions") recognised by its
--                                  button text; still restrictive only
--   3. record_whatsapp_customer_opt_out
--                                  a missing contact answers not-found instead
--                                  of a foreign-key error, for every caller
--                                  that is already allowed to ask
--   4. get_whatsapp_campaign_run_breakdown
--                                  a run of a version the caller cannot see
--                                  answers exactly like a missing run; volatile
--                                  because it reads clock_timestamp()
--   5. whatsapp_campaign_resolve_parameters
--                                  declared stable, as plpgsql_check requires
--   6. cancel_whatsapp_campaign_run  cancel no longer self-completes into the
--                                  terminal guard
-- =============================================================================

create or replace function public.list_whatsapp_contacts(p_search text default null,p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_search text:=nullif(trim(coalesce(p_search,'')),'');
  v_pattern text;
  v_page integer:=greatest(1,least(coalesce(p_page,1),10000));
  v_size integer:=greatest(1,least(coalesce(p_page_size,25),50));
begin
  if not private.has_permission('whatsapp.contacts.read') then raise exception 'WHATSAPP_CONTACTS_DENIED' using errcode='42501'; end if;
  if v_search is not null then
    v_pattern:='%'||replace(replace(replace(left(v_search,128),'\','\\'),'%','\%'),'_','\_')||'%';
  end if;
  return jsonb_build_object(
    'total_count',(
      select count(*) from public.contacts c
      where v_pattern is null
         or c.display_name ilike v_pattern escape '\'
         or exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.address_normalized ilike v_pattern escape '\')
    ),
    'items',coalesce((select jsonb_agg(x order by (x->>'display_name'),(x->>'contact_id')) from (
      select jsonb_build_object(
        'contact_id',c.id,'display_name',c.display_name,'contact_status',c.status,
        'whatsapp_e164',(select ch.address_normalized from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' order by (ch.status='active') desc,ch.is_primary desc,ch.created_at desc limit 1),
        'whatsapp_channel_status',(select ch.status from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' order by (ch.status='active') desc,ch.is_primary desc,ch.created_at desc limit 1),
        'marketing_consent',private.whatsapp_latest_marketing_consent(c.id),
        'lead_id',(select l.id from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1),
        'lead_stage',(select l.status from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1),
        'locality',(select l.locality from public.leads l where l.contact_id=c.id and l.deleted_at is null order by l.created_at desc limit 1)
      ) x
      from public.contacts c
      where v_pattern is null
         or c.display_name ilike v_pattern escape '\'
         or exists(select 1 from public.contact_channels ch where ch.contact_id=c.id and ch.channel_type='whatsapp' and ch.address_normalized ilike v_pattern escape '\')
      order by c.display_name,c.id offset (v_page-1)*v_size limit v_size
    ) q),'[]'::jsonb)
  );
end;$$;

/*
 * The whole-message opt-out classifier, in SQL. Mirrors
 * `classifyWhatsappInboundOptOut` in src/features/whatsapp/contracts/inbound-opt-out.ts:
 * NFKC, lower case, whitespace collapsed, edge punctuation stripped, hyphen as
 * space; over 40 characters is never classified. A quick-reply button whose
 * text is Meta's marketing opt-out label counts, by its text.
 */
create or replace function private.whatsapp_inbound_opt_out_candidate(p_provider_message_type text,p_body_text text,p_content jsonb)
returns text language sql immutable set search_path='' as $$
  select case
    when p_provider_message_type='text' then p_body_text
    when p_provider_message_type='button' and jsonb_typeof(p_content)='object' and jsonb_typeof(p_content->'text')='string' then p_content->>'text'
    when p_provider_message_type='interactive' and jsonb_typeof(p_content)='object' and jsonb_typeof(p_content->'button_reply'->'title')='string' then p_content->'button_reply'->>'title'
    else null
  end;
$$;
revoke all on function private.whatsapp_inbound_opt_out_candidate(text,text,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_is_inbound_opt_out(p_candidate text)
returns boolean language plpgsql immutable set search_path='' as $$
declare v_text text;
begin
  if p_candidate is null or length(p_candidate)=0 or length(p_candidate)>40 then return false; end if;
  v_text:=lower(normalize(p_candidate,NFKC));
  v_text:=trim(regexp_replace(v_text,'[[:space:]]+',' ','g'));
  v_text:=regexp_replace(v_text,'^[[:punct:][:space:]]+|[[:punct:][:space:]]+$','','g');
  v_text:=regexp_replace(replace(v_text,'-',' '),' +',' ','g');
  return v_text in ('stop','unsubscribe','remove me','no marketing','stop marketing','opt out','optout','stop promotions');
end;$$;
revoke all on function private.whatsapp_is_inbound_opt_out(text) from public,anon,authenticated;

create or replace function public.record_whatsapp_inbound_opt_out(p_message_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m record; v_event uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'WHATSAPP_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select wm.id,wm.provider_message_id,wm.provider_message_type,wm.body_text,wm.content,wm.provider_timestamp,wc.contact_id
    into m
  from public.whatsapp_messages wm join public.whatsapp_conversations wc on wc.id=wm.conversation_id
  where wm.id=p_message_id and wm.direction='inbound';
  if not found or m.contact_id is null then return jsonb_build_object('outcome','not_applicable'); end if;
  if not private.whatsapp_is_inbound_opt_out(private.whatsapp_inbound_opt_out_candidate(m.provider_message_type,m.body_text,m.content)) then
    return jsonb_build_object('outcome','not_opt_out');
  end if;
  -- Idempotent per message, and a no-op when marketing is already withdrawn.
  if exists(select 1 from public.consent_events ce where ce.contact_id=m.contact_id and ce.purpose_code='MARKETING' and ce.evidence->>'message_id'=m.id::text) then
    return jsonb_build_object('outcome','already_recorded');
  end if;
  if private.whatsapp_latest_marketing_consent(m.contact_id)='withdrawn' then return jsonb_build_object('outcome','already_withdrawn'); end if;
  insert into public.consent_events(contact_id,purpose_code,channel,event_type,copy_version,notice_version,source,locale,actor_type,occurred_at,evidence)
  values(m.contact_id,'MARKETING','whatsapp','withdrawn','customer-opt-out-v1','customer-opt-out-v1','whatsapp_inbound_message','en-IN','system',m.provider_timestamp,
         jsonb_build_object('message_id',m.id,'provider_message_id',m.provider_message_id,'message_type',m.provider_message_type))
  returning id into v_event;
  return jsonb_build_object('outcome','withdrawn','consent_event_id',v_event);
end;$$;
revoke all on function public.record_whatsapp_inbound_opt_out(uuid) from public,anon,authenticated;
grant execute on function public.record_whatsapp_inbound_opt_out(uuid) to service_role;

create or replace function public.record_whatsapp_customer_opt_out(p_contact_id uuid,p_conversation_id uuid default null,p_message_id uuid default null,p_source text default 'staff')
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_event uuid; v_allowed boolean:=false;
begin
  if v_actor is null or not private.has_permission('whatsapp.opt_out.record') then raise exception 'WHATSAPP_OPT_OUT_DENIED' using errcode='42501'; end if;
  if private.has_role('super_admin') or private.has_role('sales_manager') then
    if not exists(select 1 from public.contacts c where c.id=p_contact_id) then raise exception 'WHATSAPP_CONTACT_NOT_FOUND' using errcode='P0002'; end if;
    v_allowed:=true;
  elsif p_conversation_id is not null and exists(
    select 1 from public.whatsapp_conversations c
    where c.id=p_conversation_id and c.contact_id=p_contact_id and private.whatsapp_inbox_actor_can_use_conversation(v_actor,c.id)
  ) then
    v_allowed:=true;
  end if;
  -- An executive outside scope learns nothing about whether the contact exists.
  if not v_allowed then raise exception 'WHATSAPP_OPT_OUT_DENIED' using errcode='42501'; end if;
  if p_message_id is not null and not exists(
    select 1 from public.whatsapp_messages m where m.id=p_message_id and m.conversation_id=p_conversation_id
  ) then
    raise exception 'WHATSAPP_OPT_OUT_DENIED' using errcode='42501';
  end if;
  if private.whatsapp_latest_marketing_consent(p_contact_id)='withdrawn' then return jsonb_build_object('outcome','already_withdrawn'); end if;
  insert into public.consent_events(contact_id,purpose_code,channel,event_type,copy_version,notice_version,source,locale,actor_type,occurred_at,evidence)
  values(p_contact_id,'MARKETING','whatsapp','withdrawn','customer-opt-out-v1','customer-opt-out-v1','whatsapp_customer_opt_out','en-IN','staff',clock_timestamp(),
         jsonb_strip_nulls(jsonb_build_object('recorder_profile_id',v_actor,'conversation_id',p_conversation_id,'message_id',p_message_id,'source',left(coalesce(p_source,'staff'),64))))
  returning id into v_event;
  return jsonb_build_object('outcome','withdrawn','consent_event_id',v_event);
end;$$;
revoke all on function public.record_whatsapp_customer_opt_out(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.record_whatsapp_customer_opt_out(uuid,uuid,uuid,text) to authenticated;

create or replace function public.get_whatsapp_campaign_run_breakdown(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.has_permission('campaigns.read') or private.has_permission('whatsapp.campaigns.execute')) then
    raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.whatsapp_campaign_runs r join public.campaign_versions v on v.id=r.campaign_version_id
    where r.id=p_run_id and private.whatsapp_campaign_version_visible(v.status)
  ) then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002';
  end if;
  return jsonb_build_object(
    'run_id',p_run_id,
    'recipient_states',coalesce((select jsonb_object_agg(x.state,x.n) from (select state,count(*) n from public.whatsapp_campaign_recipients where run_id=p_run_id group by state) x),'{}'::jsonb),
    'reasons',coalesce((select jsonb_object_agg(x.reason_code,x.n) from (select reason_code,count(*) n from public.whatsapp_campaign_recipients where run_id=p_run_id and reason_code is not null group by reason_code) x),'{}'::jsonb),
    'job_states',coalesce((select jsonb_object_agg(x.state,x.n) from (select state,count(*) n from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id group by state) x),'{}'::jsonb),
    'deferred_count',(select count(*) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending' and not_before>clock_timestamp()),
    'next_not_before',(select min(not_before) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending'),
    'retrying_count',(select count(*) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending' and attempt_count>0),
    'reconcile_job_ids',case when private.has_permission('whatsapp.campaigns.cancel') and private.has_role('super_admin') then
      coalesce((select jsonb_agg(j.id order by j.updated_at) from public.whatsapp_campaign_dispatch_jobs j where j.run_id=p_run_id and j.state='needs_reconcile'),'[]'::jsonb)
      else '[]'::jsonb end
  );
end;$$;
revoke all on function public.get_whatsapp_campaign_run_breakdown(uuid) from public,anon;
grant execute on function public.get_whatsapp_campaign_run_breakdown(uuid) to authenticated;

-- 5. Parameter resolution reads jsonb operators that are stable, not immutable.
/*
 * Static values overlaid with per-recipient CRM values. An empty resolved value
 * removes the key, so the template parameter check reports it as missing and
 * the recipient is excluded rather than sent a blank.
 */
create or replace function private.whatsapp_campaign_resolve_parameters(p_defaults jsonb,p_bindings jsonb,p_display_name text)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_out jsonb; v_name text; v_component text; v_key text; v_source text; v_value text; v_part jsonb;
begin
  v_out:=case when jsonb_typeof(p_defaults)='object' then p_defaults else '{}'::jsonb end;
  v_name:=nullif(regexp_replace(trim(coalesce(p_display_name,'')),'\s+',' ','g'),'');
  for v_component,v_key,v_source in
    select c.key,k.key,k.value#>>'{}'
    from jsonb_each(case when jsonb_typeof(p_bindings)='object' then p_bindings else '{}'::jsonb end) c
    cross join lateral jsonb_each(case when jsonb_typeof(c.value)='object' then c.value else '{}'::jsonb end) k
  loop
    v_value:=case v_source when 'contact_first_name' then split_part(v_name,' ',1) when 'contact_display_name' then left(v_name,60) else null end;
    v_part:=case when jsonb_typeof(v_out->v_component)='object' then v_out->v_component else '{}'::jsonb end;
    if v_value is null or v_value='' then v_part:=v_part-v_key; else v_part:=v_part||jsonb_build_object(v_key,v_value); end if;
    v_out:=jsonb_set(v_out,array[v_component],v_part,true);
  end loop;
  return v_out;
end;$$;
revoke all on function private.whatsapp_campaign_resolve_parameters(jsonb,jsonb,text) from public,anon,authenticated;

/*
 * 6. cancel_whatsapp_campaign_run: cancelling the last pending jobs used to run
 * the generic refresh first, which saw no pending work, completed the run, and
 * made the following cancel hit the terminal guard. The run is now cancelled
 * and its counters recomputed in one statement.
 */
create or replace function public.cancel_whatsapp_campaign_run(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.whatsapp_campaign_runs%rowtype;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.cancel') or not private.has_role('super_admin') then raise exception 'WHATSAPP_CAMPAIGN_CANCEL_DENIED' using errcode='42501'; end if;
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  -- A claimed job may already be at the provider; an ambiguous one may already be delivered.
  if r.status not in ('scheduled','ready','dispatching','paused')
     or exists(select 1 from public.whatsapp_campaign_dispatch_jobs where run_id=r.id and state in ('claimed','needs_reconcile')) then
    raise exception 'WHATSAPP_CAMPAIGN_CANCEL_UNSAFE' using errcode='22023';
  end if;
  update public.whatsapp_campaign_dispatch_jobs set state='cancelled',last_error_code='run_cancelled' where run_id=r.id and state='pending';
  update public.whatsapp_campaign_recipients set state='cancelled',reason_code='run_cancelled' where run_id=r.id and state='queued';
  update public.whatsapp_campaign_runs set
    status='cancelled',completed_at=clock_timestamp(),
    total_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id),
    eligible_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state<>'excluded'),
    excluded_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state='excluded'),
    sent_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state='sent'),
    skipped_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state='skipped'),
    failed_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state='failed'),
    reconcile_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=r.id and state='needs_reconcile')
  where id=r.id;
  perform private.whatsapp_campaign_append_event(r.id,null,null,'run_cancelled',r.status,'cancelled',null,'staff',a,'{}'::jsonb);
  return jsonb_build_object('run_id',r.id,'status','cancelled');
end;$$;
revoke all on function public.cancel_whatsapp_campaign_run(uuid) from public,anon;
grant execute on function public.cancel_whatsapp_campaign_run(uuid) to authenticated;
