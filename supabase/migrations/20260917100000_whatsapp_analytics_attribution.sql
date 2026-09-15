-- =============================================================================
-- ONEDECORE WM-5 (ADR-0034) — WhatsApp analytics and attribution from
-- canonical evidence.
--
-- Funnel, per governed marketing recipient:
--
--   sent          a canonical outbound message bound to the recipient (WM-4)
--   delivered     a provider status event `delivered` or `read` for that
--                 message (a read receipt is provider evidence of delivery)
--   read          a provider status event `read`
--   clicked       a non-bot click on an opaque token minted for the recipient
--   replied       a reply attribution: exact inbound context first, then a
--                 tightly constrained, explicitly labelled inference
--   consultation  CRM lead_events move to consultation_scheduled
--   quotation     a quotation version finalized for the contact's live lead
--   booking       a quotation acceptance (closed won)
--
-- Every stage is a join over rows that already exist for their own reason.
-- Nothing here writes a provider status, edits a message, or moves a lead.
-- The inbox stays the canonical conversation truth: attribution rows point at
-- messages; messages never point back.
--
-- CLICKS
--
--   A marketing template may carry a Meta URL button whose URL ends in a
--   dynamic `{{1}}` suffix. The campaign spec binds that button to an
--   allowlisted destination. At claim time the database mints one random
--   token per recipient and button, stores only its SHA-256, and hands the
--   token to the worker as the button parameter. The public redirect route
--   exchanges a token for the destination through a service-role RPC. The URL
--   carries no phone number, name, contact id or campaign id.
--
-- ROLES
--
--   whatsapp.analytics.read   Super Admin, Sales Manager (aggregates)
--   whatsapp.reports.export   Super Admin (minimised, audited per-recipient)
--
--   Legacy management/sales and Sales Executive receive nothing.
-- =============================================================================

-- 1. Permissions.
insert into public.permissions (code,name,description,is_system,is_active) values
('whatsapp.analytics.read','Read WhatsApp Analytics','Channel and campaign delivery, click, reply and CRM conversion aggregates',true,true),
('whatsapp.reports.export','Export WhatsApp Reports','Export a minimised, audited per-recipient WhatsApp campaign report',true,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_system=true,is_active=true;

insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from (values
  ('super_admin','whatsapp.analytics.read'),
  ('super_admin','whatsapp.reports.export'),
  ('sales_manager','whatsapp.analytics.read')
) v(role_code,permission_code)
join public.roles r on r.code=v.role_code and r.is_system=true
join public.permissions p on p.code=v.permission_code and p.is_system=true
on conflict (role_id,permission_id) do nothing;

-- 2. Pure helpers.

/*
 * An allowlistable click destination: https, a DNS host (no userinfo, no IP
 * literal, no localhost), bounded, no whitespace or template braces. The
 * redirect route re-validates against the server host allowlist at click time.
 */
create or replace function private.whatsapp_click_destination_url_valid(p_url text)
returns boolean language sql immutable set search_path='' as $$
  select p_url is not null
    and length(p_url) between 12 and 2048
    and p_url ~* '^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:[0-9]{2,5})?([/?#][^[:space:]<>"''`\\{}|^]*)?$'
    and substring(p_url from '^https://([^/?#:]+)') !~ '^[0-9.]+$'
    and lower(substring(p_url from '^https://([^/?#:]+)')) not in ('localhost','localhost.localdomain');
$$;
revoke all on function private.whatsapp_click_destination_url_valid(text) from public,anon,authenticated;

create or replace function private.whatsapp_attribution_window()
returns interval language sql immutable set search_path='' as $$ select interval '30 days'; $$;
revoke all on function private.whatsapp_attribution_window() from public,anon,authenticated;

/* Meta URL buttons whose URL carries a dynamic suffix; index is the button's position. */
create or replace function private.whatsapp_template_dynamic_url_buttons(p_components jsonb)
returns table(button_index integer,url text) language sql immutable set search_path='' as $$
  select (b.ordinality-1)::integer,b.value->>'url'
  from jsonb_array_elements(case when jsonb_typeof(p_components)='array' then p_components else '[]'::jsonb end) c
  cross join lateral jsonb_array_elements(case when jsonb_typeof(c->'buttons')='array' then c->'buttons' else '[]'::jsonb end) with ordinality b(value,ordinality)
  where jsonb_typeof(c)='object' and upper(coalesce(c->>'type',''))='BUTTONS'
    and upper(coalesce(b.value->>'type',''))='URL' and coalesce(b.value->>'url','') ~ '\{\{';
$$;
revoke all on function private.whatsapp_template_dynamic_url_buttons(jsonb) from public,anon,authenticated;

/*
 * Why a template cannot be sent as governed MARKETING, or null. The WM-2 staff
 * rules, plus exactly one kind of parameterised button: a URL button whose
 * https URL ends in `{{1}}`, filled per recipient with an opaque click token.
 */
create or replace function private.whatsapp_marketing_template_send_problem(p_components jsonb,p_parameter_format text)
returns text language plpgsql stable set search_path='' as $$
declare v_normalised jsonb;
begin
  if p_components is null or jsonb_typeof(p_components)<>'array' then return 'components_invalid'; end if;
  if exists(select 1 from private.whatsapp_template_dynamic_url_buttons(p_components) b where b.url !~ '^https://[^{}[:space:]]+\{\{1\}\}$') then
    return 'button_parameters_unsupported';
  end if;
  select coalesce(jsonb_agg(
    case when jsonb_typeof(c.value)='object' and upper(coalesce(c.value->>'type',''))='BUTTONS' and jsonb_typeof(c.value->'buttons')='array' then
      jsonb_set(c.value,'{buttons}',coalesce((
        select jsonb_agg(
          case when jsonb_typeof(b.value)='object' and upper(coalesce(b.value->>'type',''))='URL' and coalesce(b.value->>'url','') ~ '^https://[^{}[:space:]]+\{\{1\}\}$'
            then jsonb_set(b.value,'{url}',to_jsonb(regexp_replace(b.value->>'url','\{\{1\}\}$','token')))
            else b.value end
          order by b.ordinality)
        from jsonb_array_elements(c.value->'buttons') with ordinality b(value,ordinality)
      ),'[]'::jsonb))
    else c.value end
    order by c.ordinality),'[]'::jsonb)
  into v_normalised
  from jsonb_array_elements(p_components) with ordinality c(value,ordinality);
  return private.whatsapp_template_staff_send_problem(v_normalised,p_parameter_format);
end;$$;
revoke all on function private.whatsapp_marketing_template_send_problem(jsonb,text) from public,anon,authenticated;

-- 3. Tables.
create table public.whatsapp_click_destinations (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  destination_url text not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_click_destination_label check (length(trim(label)) between 2 and 80),
  constraint chk_whatsapp_click_destination_url check (private.whatsapp_click_destination_url_valid(destination_url))
);
create unique index uq_whatsapp_click_destinations_label_active on public.whatsapp_click_destinations(lower(label)) where is_active;

create table public.whatsapp_click_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  destination_id uuid not null references public.whatsapp_click_destinations(id) on delete restrict,
  purpose text not null,
  run_id uuid references public.whatsapp_campaign_runs(id) on delete restrict,
  recipient_id uuid references public.whatsapp_campaign_recipients(id) on delete restrict,
  test_send_id uuid references public.whatsapp_campaign_test_sends(id) on delete restrict,
  button_index smallint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint chk_whatsapp_click_token_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_click_token_purpose check (purpose in ('campaign','test')),
  constraint chk_whatsapp_click_token_scope check (
    (purpose='campaign' and run_id is not null and recipient_id is not null and test_send_id is null)
    or (purpose='test' and test_send_id is not null and run_id is null and recipient_id is null)
  ),
  constraint chk_whatsapp_click_token_button check (button_index between 0 and 9),
  constraint chk_whatsapp_click_token_expiry check (expires_at>created_at)
);
create index idx_whatsapp_click_tokens_recipient on public.whatsapp_click_tokens(recipient_id) where recipient_id is not null;
create index idx_whatsapp_click_tokens_run on public.whatsapp_click_tokens(run_id) where run_id is not null;
create index idx_whatsapp_click_tokens_destination on public.whatsapp_click_tokens(destination_id);

create table public.whatsapp_click_events (
  id bigserial primary key,
  token_id uuid not null references public.whatsapp_click_tokens(id) on delete restrict,
  client_class text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_click_event_client check (client_class in ('browser','bot','unknown'))
);
create index idx_whatsapp_click_events_token_time on public.whatsapp_click_events(token_id,occurred_at);

create table public.whatsapp_reply_attributions (
  id uuid primary key default gen_random_uuid(),
  inbound_message_id uuid not null unique references public.whatsapp_messages(id) on delete restrict,
  outbound_message_id uuid not null references public.whatsapp_messages(id) on delete restrict,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete restrict,
  method text not null,
  source_kind text not null,
  run_id uuid references public.whatsapp_campaign_runs(id) on delete restrict,
  recipient_id uuid references public.whatsapp_campaign_recipients(id) on delete restrict,
  campaign_version_id uuid references public.campaign_versions(id) on delete restrict,
  reply_lag_seconds integer not null,
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_reply_attribution_method check (method in ('exact_context','inferred_window')),
  constraint chk_whatsapp_reply_attribution_source check (source_kind='campaign' and run_id is not null and recipient_id is not null and campaign_version_id is not null),
  constraint chk_whatsapp_reply_attribution_lag check (reply_lag_seconds>=0),
  constraint chk_whatsapp_reply_attribution_distinct check (inbound_message_id<>outbound_message_id)
);
create index idx_whatsapp_reply_attributions_recipient on public.whatsapp_reply_attributions(recipient_id) where recipient_id is not null;
create index idx_whatsapp_reply_attributions_run on public.whatsapp_reply_attributions(run_id,created_at) where run_id is not null;
create index idx_whatsapp_reply_attributions_outbound on public.whatsapp_reply_attributions(outbound_message_id);

create table public.whatsapp_report_exports (
  id uuid primary key default gen_random_uuid(),
  report_kind text not null,
  run_id uuid references public.whatsapp_campaign_runs(id) on delete restrict,
  exported_by uuid not null references public.profiles(id) on delete restrict,
  row_count integer not null,
  truncated boolean not null default false,
  exported_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_report_export_kind check (report_kind in ('campaign_run_recipients')),
  constraint chk_whatsapp_report_export_scope check (report_kind<>'campaign_run_recipients' or run_id is not null),
  constraint chk_whatsapp_report_export_rows check (row_count>=0)
);
create index idx_whatsapp_report_exports_run on public.whatsapp_report_exports(run_id,exported_at desc);

-- Spec: which destination fills each dynamic URL button. Frozen with the spec.
alter table public.whatsapp_campaign_specs add column button_bindings jsonb not null default '{}'::jsonb;
alter table public.whatsapp_campaign_specs add constraint chk_whatsapp_campaign_specs_button_bindings
  check (jsonb_typeof(button_bindings)='object' and pg_column_size(button_bindings)<=1024);

-- Status evidence is joined by provider message id through the existing
-- idx_whatsapp_message_status_events_provider_message_timestamp.

-- 4. Guards.
create trigger trg_whatsapp_click_destinations_updated_at before update on public.whatsapp_click_destinations for each row execute function private.set_updated_at();
create trigger trg_whatsapp_click_tokens_no_update before update on public.whatsapp_click_tokens for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_click_tokens_no_delete before delete on public.whatsapp_click_tokens for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_click_events_no_update before update on public.whatsapp_click_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_click_events_no_delete before delete on public.whatsapp_click_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_reply_attributions_no_update before update on public.whatsapp_reply_attributions for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_reply_attributions_no_delete before delete on public.whatsapp_reply_attributions for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_report_exports_no_update before update on public.whatsapp_report_exports for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_report_exports_no_delete before delete on public.whatsapp_report_exports for each row execute function private.whatsapp_wm_append_only_guard();

-- 5. RLS. Tokens and click events are closed to every staff session.
alter table public.whatsapp_click_destinations enable row level security; alter table public.whatsapp_click_destinations force row level security;
alter table public.whatsapp_click_tokens enable row level security; alter table public.whatsapp_click_tokens force row level security;
alter table public.whatsapp_click_events enable row level security; alter table public.whatsapp_click_events force row level security;
alter table public.whatsapp_reply_attributions enable row level security; alter table public.whatsapp_reply_attributions force row level security;
alter table public.whatsapp_report_exports enable row level security; alter table public.whatsapp_report_exports force row level security;

revoke all on table public.whatsapp_click_destinations from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_click_tokens from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_click_events from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_reply_attributions from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_report_exports from public,anon,authenticated,service_role;
revoke all on sequence public.whatsapp_click_events_id_seq from public,anon,authenticated,service_role;

grant select on public.whatsapp_click_destinations,public.whatsapp_reply_attributions,public.whatsapp_report_exports to authenticated;
grant select on public.whatsapp_click_destinations,public.whatsapp_click_tokens,public.whatsapp_click_events,public.whatsapp_reply_attributions,public.whatsapp_report_exports to service_role;
-- WM-4 deliberately kept attributions closed until this permission existed.
grant select on public.whatsapp_message_campaign_attributions to authenticated;

create policy whatsapp_click_destinations_staff_read on public.whatsapp_click_destinations for select to authenticated
  using (private.has_permission('whatsapp.analytics.read') or private.has_permission('whatsapp.settings.read') or private.has_permission('campaigns.draft'));
create policy whatsapp_reply_attributions_staff_read on public.whatsapp_reply_attributions for select to authenticated
  using (private.has_permission('whatsapp.analytics.read'));
create policy whatsapp_report_exports_staff_read on public.whatsapp_report_exports for select to authenticated
  using (private.has_permission('whatsapp.reports.export'));
create policy whatsapp_campaign_attribution_analytics_read on public.whatsapp_message_campaign_attributions for select to authenticated
  using (private.has_permission('whatsapp.analytics.read'));
create policy whatsapp_click_destinations_service_read on public.whatsapp_click_destinations for select to service_role using (true);
create policy whatsapp_click_tokens_service_read on public.whatsapp_click_tokens for select to service_role using (true);
create policy whatsapp_click_events_service_read on public.whatsapp_click_events for select to service_role using (true);
create policy whatsapp_reply_attributions_service_read on public.whatsapp_reply_attributions for select to service_role using (true);
create policy whatsapp_report_exports_service_read on public.whatsapp_report_exports for select to service_role using (true);

-- 6. Button bindings and click tokens.

/*
 * Why a spec's button bindings do not fit its template now, or null. Every
 * dynamic URL button needs exactly one active allowlisted destination; nothing
 * else may be bound.
 */
create or replace function private.whatsapp_campaign_button_bindings_problem(p_components jsonb,p_bindings jsonb)
returns text language plpgsql stable security definer set search_path='' as $$
declare b record; v_binding jsonb;
begin
  if p_bindings is null or jsonb_typeof(p_bindings)<>'object' or pg_column_size(p_bindings)>1024 then return 'button_bindings_invalid'; end if;
  for b in select e.key,e.value from jsonb_each(p_bindings) e loop
    if b.key !~ '^[0-9]$' or jsonb_typeof(b.value)<>'object' then return 'button_bindings_invalid'; end if;
    if not exists(select 1 from private.whatsapp_template_dynamic_url_buttons(p_components) d where d.button_index=b.key::integer) then
      return 'button_binding_unexpected';
    end if;
    if b.value->>'kind' is distinct from 'click_destination' or coalesce(b.value->>'destination_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return 'button_bindings_invalid';
    end if;
    if not exists(select 1 from public.whatsapp_click_destinations d where d.id=(b.value->>'destination_id')::uuid and d.is_active) then
      return 'click_destination_unavailable';
    end if;
  end loop;
  for b in select * from private.whatsapp_template_dynamic_url_buttons(p_components) loop
    v_binding:=p_bindings->(b.button_index::text);
    if v_binding is null then return 'button_binding_missing'; end if;
  end loop;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_button_bindings_problem(jsonb,jsonb) from public,anon,authenticated;

/*
 * One random token per call. 32 bytes, base64url, 43 characters. Only the
 * SHA-256 is stored, so the table cannot be read back into working links.
 * `p_enrollment_id` is reserved for WM-6 automations and must be null here.
 */
create or replace function private.whatsapp_mint_click_token(
  p_destination_id uuid,p_purpose text,p_run_id uuid,p_recipient_id uuid,p_test_send_id uuid,p_enrollment_id uuid,p_button_index integer
)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_token text;
begin
  if p_enrollment_id is not null then raise exception 'WHATSAPP_CLICK_TOKEN_SCOPE_INVALID' using errcode='22023'; end if;
  v_token:=translate(encode(extensions.gen_random_bytes(32),'base64'),'+/=','-_');
  insert into public.whatsapp_click_tokens(token_hash,destination_id,purpose,run_id,recipient_id,test_send_id,button_index,expires_at)
  values(encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),p_destination_id,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_button_index,
         clock_timestamp()+interval '90 days');
  return v_token;
end;$$;
revoke all on function private.whatsapp_mint_click_token(uuid,text,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;

/* The `button` components of a type=template send: one url parameter per bound dynamic button. */
create or replace function private.whatsapp_mint_button_components(
  p_components jsonb,p_bindings jsonb,p_purpose text,p_run_id uuid,p_recipient_id uuid,p_test_send_id uuid,p_enrollment_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare b record; v_out jsonb:='[]'::jsonb; v_binding jsonb; v_token text;
begin
  for b in select * from private.whatsapp_template_dynamic_url_buttons(p_components) order by button_index loop
    v_binding:=coalesce(p_bindings,'{}'::jsonb)->(b.button_index::text);
    if v_binding is null or v_binding->>'kind' is distinct from 'click_destination' then
      raise exception 'WHATSAPP_BUTTON_BINDING_MISSING' using errcode='22023';
    end if;
    v_token:=private.whatsapp_mint_click_token((v_binding->>'destination_id')::uuid,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_enrollment_id,b.button_index);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'type','button','sub_type','url','index',b.button_index::text,
      'parameters',jsonb_build_array(jsonb_build_object('type','text','text',v_token))
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function private.whatsapp_mint_button_components(jsonb,jsonb,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;

-- 7. Campaign template gate: marketing sends may carry tracked URL buttons.
create or replace function private.whatsapp_campaign_template_problem(p_snapshot_id uuid,p_expected_hash text default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare s public.whatsapp_template_snapshots%rowtype; t public.whatsapp_templates%rowtype; v_problem text;
begin
  select * into s from public.whatsapp_template_snapshots where id=p_snapshot_id;
  if not found then return 'template_snapshot_not_found'; end if;
  if s.observed_status<>'APPROVED' then return 'template_not_approved'; end if;
  if s.category<>'MARKETING' then return 'template_category_not_marketing'; end if;
  select * into t from public.whatsapp_templates where id=s.template_id;
  if not found or t.status<>'APPROVED' then return 'template_not_approved'; end if;
  if t.category<>'MARKETING' then return 'template_category_not_marketing'; end if;
  if t.content_hash is distinct from s.content_hash or (p_expected_hash is not null and s.content_hash is distinct from p_expected_hash) then return 'template_content_changed'; end if;
  v_problem:=private.whatsapp_marketing_template_send_problem(s.components,s.parameter_format);
  if v_problem is not null then return 'template_'||v_problem; end if;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_template_problem(uuid,text) from public,anon,authenticated;

create or replace function public.set_whatsapp_campaign_spec_button_bindings(p_campaign_version_id uuid,p_button_bindings jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_version public.campaign_versions%rowtype; v_spec public.whatsapp_campaign_specs%rowtype;
  v_snapshot public.whatsapp_template_snapshots%rowtype; v_problem text; v_bindings jsonb:=coalesce(p_button_bindings,'{}'::jsonb);
begin
  if v_actor is null or not private.has_permission('campaigns.draft') or not private.has_permission('whatsapp.templates.read') then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_DENIED' using errcode='42501';
  end if;
  select * into v_version from public.campaign_versions where id=p_campaign_version_id for update;
  if not found or v_version.intended_channels is distinct from array['whatsapp']::text[] then raise exception 'WHATSAPP_CAMPAIGN_NOT_FOUND' using errcode='P0002'; end if;
  if v_version.status<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_FROZEN' using errcode='22023'; end if;
  select * into v_spec from public.whatsapp_campaign_specs where campaign_version_id=v_version.id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='P0002'; end if;
  if v_spec.state<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_FROZEN' using errcode='22023'; end if;
  select * into v_snapshot from public.whatsapp_template_snapshots where id=v_spec.template_snapshot_id;
  v_problem:=private.whatsapp_campaign_button_bindings_problem(v_snapshot.components,v_bindings);
  -- A partial mapping may be saved while drafting; submission requires every button.
  if v_problem is not null and v_problem<>'button_binding_missing' then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_INVALID: %',v_problem using errcode='22023';
  end if;
  update public.whatsapp_campaign_specs set button_bindings=v_bindings,updated_by=v_actor where id=v_spec.id;
  return jsonb_build_object('spec_id',v_spec.id,'button_bindings',v_bindings,'complete',v_problem is null);
end;$$;
revoke all on function public.set_whatsapp_campaign_spec_button_bindings(uuid,jsonb) from public,anon;
grant execute on function public.set_whatsapp_campaign_spec_button_bindings(uuid,jsonb) to authenticated;

create or replace function private.whatsapp_campaign_freeze_spec_on_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_spec public.whatsapp_campaign_specs%rowtype; v_problem text; v_components jsonb;
begin
  if old.status='draft' and new.status='pending_approval' and new.intended_channels=array['whatsapp']::text[] then
    select * into v_spec from public.whatsapp_campaign_specs where campaign_version_id=new.id for update;
    if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='22023'; end if;
    if v_spec.state<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_ALREADY_FROZEN' using errcode='22023'; end if;
    v_problem:=private.whatsapp_campaign_spec_problem(new.id,v_spec.template_snapshot_id,v_spec.default_parameters,v_spec.parameter_bindings);
    if v_problem is null and v_spec.segment_id is not null and not private.whatsapp_segment_rule_group_valid(v_spec.segment_rule_group) then v_problem:='segment_rules_invalid'; end if;
    if v_problem is null then
      select components into v_components from public.whatsapp_template_snapshots where id=v_spec.template_snapshot_id;
      v_problem:=private.whatsapp_campaign_button_bindings_problem(v_components,v_spec.button_bindings);
    end if;
    if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_SPEC_INVALID: %',v_problem using errcode='22023'; end if;
    update public.whatsapp_campaign_specs set state='frozen',frozen_at=clock_timestamp(),frozen_by=new.requested_by,updated_by=new.requested_by where id=v_spec.id;
  end if;
  return new;
end;$$;
revoke all on function private.whatsapp_campaign_freeze_spec_on_submission() from public,anon,authenticated;

/*
 * Counts only, in WM-0 precedence; never a recipient list. WM-5 adds the button
 * binding state and aligns the policy bucket with JIT eligibility: a closed
 * execution gate counts as send_policy_unconfigured, never as eligible.
 */
create or replace function public.preview_whatsapp_campaign_audience(p_campaign_version_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_spec public.whatsapp_campaign_specs%rowtype;
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_policy public.whatsapp_marketing_send_policies%rowtype;
  v_has_policy boolean;
  v_rule jsonb;
  v_rule_frozen boolean;
  v_reasons jsonb:='{}'::jsonb;
  v_total integer:=0;
  v_eligible integer:=0;
  v_reason text;
  v_live_hash text;
  rec record;
begin
  if auth.uid() is null or not exists(
    select 1 from public.campaign_versions v where v.id=p_campaign_version_id and v.intended_channels=array['whatsapp']::text[]
      and private.whatsapp_campaign_version_visible(v.status)
  ) then raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501'; end if;
  select * into v_spec from public.whatsapp_campaign_specs where campaign_version_id=p_campaign_version_id;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='P0002'; end if;
  select r.rule_group,r.frozen_at is not null into v_rule,v_rule_frozen from public.campaign_audience_rule_versions r where r.campaign_version_id=p_campaign_version_id;
  if v_rule is null then raise exception 'WHATSAPP_CAMPAIGN_AUDIENCE_REQUIRED' using errcode='P0002'; end if;
  select * into v_snapshot from public.whatsapp_template_snapshots where id=v_spec.template_snapshot_id;
  select * into v_policy from private.whatsapp_campaign_latest_policy();
  v_has_policy:=found;

  for rec in
    select a.contact_id,e.o_reason
    from private.whatsapp_campaign_audience_contact_ids(v_rule,v_spec.segment_rule_group) a
    cross join lateral private.whatsapp_campaign_evaluate_contact(a.contact_id,v_spec.preference_category,v_snapshot.components,v_spec.default_parameters,v_spec.parameter_bindings) e
  loop
    v_total:=v_total+1;
    v_reason:=rec.o_reason;
    -- Same rule as JIT: no policy, or a closed execution gate, sends nobody.
    if v_reason is null and (not v_has_policy or v_policy.execution_enabled is not true) then v_reason:='send_policy_unconfigured';
    elsif v_reason is null and private.whatsapp_campaign_frequency_capped(rec.contact_id,v_policy,clock_timestamp()) then v_reason:='frequency_capped';
    end if;
    if v_reason is null then
      v_eligible:=v_eligible+1;
    else
      v_reasons:=jsonb_set(v_reasons,array[v_reason],to_jsonb(coalesce((v_reasons->>v_reason)::integer,0)+1),true);
    end if;
  end loop;

  if v_spec.segment_id is not null then
    select private.marketing_sha256(s.rule_group::text) into v_live_hash from public.whatsapp_segments s where s.id=v_spec.segment_id and s.is_active=true;
  end if;

  return jsonb_build_object(
    'campaign_version_id',p_campaign_version_id,
    'total_matched',v_total,
    'eligible',v_eligible,
    'reasons',v_reasons,
    'audience_rule_frozen',coalesce(v_rule_frozen,false),
    'segment_changed_since_saved',v_spec.segment_id is not null and v_live_hash is distinct from v_spec.segment_rule_hash,
    'template_problem',private.whatsapp_campaign_template_problem(v_spec.template_snapshot_id,null),
    'button_bindings_problem',private.whatsapp_campaign_button_bindings_problem(v_snapshot.components,v_spec.button_bindings),
    'policy_configured',v_has_policy,
    'policy_version',case when v_has_policy then v_policy.version end,
    'execution_enabled',coalesce(v_has_policy and v_policy.execution_enabled,false),
    'quiet_until',case when v_has_policy then private.whatsapp_campaign_quiet_until(v_policy,clock_timestamp()) end,
    'evaluated_at',clock_timestamp()
  );
end;$$;
revoke all on function public.preview_whatsapp_campaign_audience(uuid) from public,anon;
grant execute on function public.preview_whatsapp_campaign_audience(uuid) to authenticated;

-- 8. Claims now carry tracked button parameters. Everything else is WM-4 unchanged.
create or replace function public.claim_whatsapp_campaign_dispatch_jobs(p_worker_id text,p_batch_size integer default 20)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  n integer:=greatest(1,least(coalesce(p_batch_size,20),50)); x record; e record; tok uuid; v_out jsonb:='[]'::jsonb; v_worker text;
  wr public.whatsapp_campaign_recipients%rowtype; r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; wp public.whatsapp_phone_numbers%rowtype; v_sender text; v_attempt integer;
  v_button_problem text; v_components jsonb;
begin
  perform private.whatsapp_campaign_require_service_role();
  v_worker:=trim(coalesce(p_worker_id,''));
  if length(v_worker) not between 1 and 80 then raise exception 'WHATSAPP_WORKER_ID_INVALID' using errcode='22023'; end if;

  -- Expired claims: reclaimable only when no provider request was recorded.
  for x in select * from public.whatsapp_campaign_dispatch_jobs where state='claimed' and claim_expires_at<clock_timestamp() order by claim_expires_at limit 200 for update skip locked loop
    if x.provider_request_started_at is null then
      update public.whatsapp_campaign_dispatch_jobs set state='pending',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,not_before=clock_timestamp(),last_error_code='claim_expired_before_provider' where id=x.id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'claim_expired','claimed','pending',x.attempt_count,'worker',null,jsonb_build_object('worker_id',v_worker));
    else
      update public.whatsapp_campaign_dispatch_jobs set state='needs_reconcile',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code='claim_expired_after_provider_start' where id=x.id;
      update public.whatsapp_campaign_recipients set state='needs_reconcile',reason_code='provider_outcome_unknown' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'claim_ambiguous_timeout','claimed','needs_reconcile',x.attempt_count,'worker',null,jsonb_build_object('worker_id',v_worker));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
    end if;
  end loop;

  for x in
    select j.* from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_runs cr on cr.id=j.run_id
    where j.state='pending' and j.not_before<=clock_timestamp() and cr.status='dispatching'
    order by j.not_before,j.created_at,j.id for update of j skip locked limit n
  loop
    if x.attempt_count>=3 then
      update public.whatsapp_campaign_dispatch_jobs set state='failed',last_error_code='attempts_exhausted' where id=x.id;
      update public.whatsapp_campaign_recipients set state='failed',reason_code='attempts_exhausted' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_failed','pending','failed',x.attempt_count,'worker',null,jsonb_build_object('reason','attempts_exhausted'));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;

    select * into e from private.whatsapp_campaign_job_eligibility(x.id,clock_timestamp());
    if e.decision='defer' then
      update public.whatsapp_campaign_dispatch_jobs set not_before=e.defer_until,last_error_code=e.reason where id=x.id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_deferred','pending','pending',x.attempt_count,'worker',null,jsonb_build_object('reason',e.reason,'not_before',e.defer_until));
      continue;
    elsif e.decision<>'eligible' then
      update public.whatsapp_campaign_dispatch_jobs set state='skipped',last_error_code=e.reason where id=x.id;
      update public.whatsapp_campaign_recipients set state='skipped',reason_code=e.reason where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_skipped','pending','skipped',x.attempt_count,'worker',null,jsonb_build_object('reason',e.reason));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;

    select * into wr from public.whatsapp_campaign_recipients where id=x.recipient_id;
    select * into r from public.whatsapp_campaign_runs where id=x.run_id;
    select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
    select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;

    -- A deactivated destination is never replaced silently: the recipient is skipped.
    v_button_problem:=private.whatsapp_campaign_button_bindings_problem(snap.components,s.button_bindings);
    if v_button_problem is not null then
      update public.whatsapp_campaign_dispatch_jobs set state='skipped',last_error_code=v_button_problem where id=x.id;
      update public.whatsapp_campaign_recipients set state='skipped',reason_code=v_button_problem where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_skipped','pending','skipped',x.attempt_count,'worker',null,jsonb_build_object('reason',v_button_problem));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;

    wp:=null;
    -- Prefer the business number the customer already talks to.
    select p.* into wp from public.whatsapp_phone_numbers p
    left join public.whatsapp_conversations wc on wc.id=wr.conversation_id
    where p.business_account_id=snap.business_account_id and p.status='active'
    order by (p.id=wc.phone_number_id) desc nulls last,p.created_at,p.id limit 1;
    v_sender:=case when wp.id is null then null else private.whatsapp_business_sender_e164(wp.display_phone_number) end;
    if wp.id is null or v_sender is null then
      update public.whatsapp_campaign_dispatch_jobs set state='failed',last_error_code='business_phone_unavailable' where id=x.id;
      update public.whatsapp_campaign_recipients set state='failed',reason_code='business_phone_unavailable' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_failed','pending','failed',x.attempt_count,'worker',null,jsonb_build_object('reason','business_phone_unavailable'));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;
    tok:=gen_random_uuid(); v_attempt:=x.attempt_count+1;
    update public.whatsapp_campaign_dispatch_jobs set state='claimed',attempt_count=v_attempt,claim_token=tok,claimed_by=v_worker,claimed_at=clock_timestamp(),
      claim_expires_at=clock_timestamp()+interval '120 seconds',phone_number_id=wp.id,sender_e164=v_sender,last_error_code=null
    where id=x.id;
    perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_claimed','pending','claimed',v_attempt,'worker',null,jsonb_build_object('worker_id',v_worker));
    -- A retry mints fresh tokens; every token still resolves to this recipient.
    v_components:=private.whatsapp_build_template_send_components(snap.components,snap.parameter_format,wr.template_parameters)
      ||private.whatsapp_mint_button_components(snap.components,s.button_bindings,'campaign',x.run_id,x.recipient_id,null,null);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'job_id',x.id,'claim_token',tok,'attempt',v_attempt,'run_id',x.run_id,'recipient_id',x.recipient_id,
      'phone_number_id',wp.phone_number_id,'recipient_e164',wr.recipient_e164,
      'template_name',snap.name,'template_language',snap.language,
      'template_components',v_components
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function public.claim_whatsapp_campaign_dispatch_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_campaign_dispatch_jobs(text,integer) to service_role;

create or replace function public.claim_whatsapp_campaign_test_sends(p_worker_id text,p_limit integer default 5)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare n integer:=greatest(1,least(coalesce(p_limit,5),20)); x record; v_out jsonb:='[]'::jsonb; tok uuid; v_problem text;
  snap public.whatsapp_template_snapshots%rowtype; wp public.whatsapp_phone_numbers%rowtype; v_bindings jsonb; v_components jsonb;
begin
  perform private.whatsapp_campaign_require_service_role();
  if length(trim(coalesce(p_worker_id,''))) not between 1 and 80 then raise exception 'WHATSAPP_WORKER_ID_INVALID' using errcode='22023'; end if;
  for x in select * from public.whatsapp_campaign_test_sends where outcome='pending' and claim_token is not null and claim_expires_at<clock_timestamp() limit 100 for update skip locked loop
    if x.provider_request_started_at is null then
      update public.whatsapp_campaign_test_sends set claim_token=null,claimed_at=null,claim_expires_at=null where id=x.id;
    else
      update public.whatsapp_campaign_test_sends set outcome='needs_reconcile',claim_token=null,claimed_at=null,claim_expires_at=null,last_error_code='claim_expired_after_provider_start',completed_at=clock_timestamp() where id=x.id;
    end if;
  end loop;
  for x in select * from public.whatsapp_campaign_test_sends where outcome='pending' and claim_token is null order by created_at,id limit n for update skip locked loop
    v_problem:=private.whatsapp_campaign_template_problem(x.template_snapshot_id,null);
    if v_problem is null and not private.whatsapp_campaign_test_destination_ok(x.destination_profile_id) then v_problem:='destination_not_registered'; end if;
    if v_problem is null and x.created_at<clock_timestamp()-interval '1 hour' then v_problem:='test_send_expired'; end if;
    select * into snap from public.whatsapp_template_snapshots where id=x.template_snapshot_id;
    select s.button_bindings into v_bindings from public.whatsapp_campaign_specs s where s.campaign_version_id=x.campaign_version_id and s.template_snapshot_id=x.template_snapshot_id;
    if v_problem is null then
      v_problem:=private.whatsapp_campaign_button_bindings_problem(snap.components,coalesce(v_bindings,'{}'::jsonb));
    end if;
    wp:=null;
    if v_problem is null then
      select p.* into wp from public.whatsapp_phone_numbers p where p.business_account_id=snap.business_account_id and p.status='active' order by p.created_at,p.id limit 1;
      if wp.id is null or private.whatsapp_business_sender_e164(wp.display_phone_number) is null then v_problem:='business_phone_unavailable'; end if;
    end if;
    if v_problem is not null then
      update public.whatsapp_campaign_test_sends set outcome='skipped',last_error_code=left(v_problem,128),completed_at=clock_timestamp() where id=x.id;
      continue;
    end if;
    tok:=gen_random_uuid();
    update public.whatsapp_campaign_test_sends set claim_token=tok,claimed_at=clock_timestamp(),claim_expires_at=clock_timestamp()+interval '120 seconds',phone_number_id=wp.id where id=x.id;
    v_components:=private.whatsapp_build_template_send_components(snap.components,snap.parameter_format,x.template_parameters)
      ||private.whatsapp_mint_button_components(snap.components,coalesce(v_bindings,'{}'::jsonb),'test',null,null,x.id,null);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'test_send_id',x.id,'claim_token',tok,'phone_number_id',wp.phone_number_id,'recipient_e164',x.destination_e164,
      'template_name',snap.name,'template_language',snap.language,
      'template_components',v_components
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function public.claim_whatsapp_campaign_test_sends(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_campaign_test_sends(text,integer) to service_role;

-- 9. Click redirect: token in, allowlisted destination out. No token, no oracle.
create or replace function public.record_whatsapp_click(p_token text,p_client_class text default 'unknown')
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_token public.whatsapp_click_tokens%rowtype; v_destination public.whatsapp_click_destinations%rowtype; v_class text;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return jsonb_build_object('destination_url',null); end if;
  select * into v_token from public.whatsapp_click_tokens
  where token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  if not found or v_token.expires_at<=clock_timestamp() then return jsonb_build_object('destination_url',null); end if;
  select * into v_destination from public.whatsapp_click_destinations where id=v_token.destination_id;
  if not found or not v_destination.is_active or not private.whatsapp_click_destination_url_valid(v_destination.destination_url) then
    return jsonb_build_object('destination_url',null);
  end if;
  v_class:=case when p_client_class in ('browser','bot','unknown') then p_client_class else 'unknown' end;
  -- Evidence is bounded per token; the redirect itself never is.
  if (select count(*) from public.whatsapp_click_events ce where ce.token_id=v_token.id)<20 then
    insert into public.whatsapp_click_events(token_id,client_class) values(v_token.id,v_class);
  end if;
  return jsonb_build_object('destination_url',v_destination.destination_url);
end;$$;
revoke all on function public.record_whatsapp_click(text,text) from public,anon,authenticated;
grant execute on function public.record_whatsapp_click(text,text) to service_role;

create or replace function public.list_whatsapp_click_destinations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.has_permission('whatsapp.analytics.read') or private.has_permission('whatsapp.settings.read') or private.has_permission('campaigns.draft')) then
    raise exception 'WHATSAPP_CLICK_DESTINATIONS_DENIED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'label',d.label,'destination_url',d.destination_url,'is_active',d.is_active,'updated_at',d.updated_at)
      order by d.is_active desc,lower(d.label),d.id)
    from public.whatsapp_click_destinations d
  ),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_click_destinations() from public,anon;
grant execute on function public.list_whatsapp_click_destinations() to authenticated;

create or replace function public.save_whatsapp_click_destination(p_destination_id uuid,p_label text,p_destination_url text,p_active boolean default true)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_url text:=trim(coalesce(p_destination_url,''));
begin
  if v_actor is null or not private.has_permission('whatsapp.settings.manage') or not private.has_role('super_admin') then
    raise exception 'WHATSAPP_SETTINGS_DENIED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_label,''))) not between 2 and 80 or not private.whatsapp_click_destination_url_valid(v_url) then
    raise exception 'WHATSAPP_CLICK_DESTINATION_VALIDATION' using errcode='22023';
  end if;
  if p_destination_id is null then
    insert into public.whatsapp_click_destinations(label,destination_url,is_active,created_by,updated_by)
    values(trim(p_label),v_url,coalesce(p_active,true),v_actor,v_actor) returning id into v_id;
  else
    -- A destination already on tokens keeps its URL: a sent link never changes where it goes.
    if exists(select 1 from public.whatsapp_click_tokens t where t.destination_id=p_destination_id)
       and exists(select 1 from public.whatsapp_click_destinations d where d.id=p_destination_id and d.destination_url<>v_url) then
      raise exception 'WHATSAPP_CLICK_DESTINATION_IN_USE' using errcode='22023';
    end if;
    update public.whatsapp_click_destinations set label=trim(p_label),destination_url=v_url,is_active=coalesce(p_active,true),updated_by=v_actor
    where id=p_destination_id returning id into v_id;
    if v_id is null then raise exception 'WHATSAPP_CLICK_DESTINATION_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  return jsonb_build_object('destination_id',v_id);
end;$$;
revoke all on function public.save_whatsapp_click_destination(uuid,text,text,boolean) from public,anon;
grant execute on function public.save_whatsapp_click_destination(uuid,text,text,boolean) to authenticated;

-- 10. Reply attribution.

/*
 * The governed marketing origin of an outbound message, if any. WM-6 widens
 * this to automation sends; the columns for it are already in the shape.
 */
create or replace function private.whatsapp_outbound_marketing_source(p_message_id uuid)
returns table(source_kind text,run_id uuid,recipient_id uuid,campaign_version_id uuid,automation_id uuid,enrollment_id uuid)
language sql stable security definer set search_path='' as $$
  select 'campaign'::text,a.run_id,a.recipient_id,a.campaign_version_id,null::uuid,null::uuid
  from public.whatsapp_message_campaign_attributions a where a.whatsapp_message_id=p_message_id;
$$;
revoke all on function private.whatsapp_outbound_marketing_source(uuid) from public,anon,authenticated;

/*
 * exact_context    the customer replied to the message itself: Meta's inbound
 *                  context id is that outbound message's provider id.
 * inferred_window  no context id; the most recent outbound message in the same
 *                  conversation is a governed marketing send, it is at most 72
 *                  hours older, and this is the customer's FIRST message since
 *                  it. Anything looser is conversation, not response.
 * A context id pointing anywhere else is never re-inferred.
 */
create or replace function private.whatsapp_attribute_inbound_reply(p_message_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare m public.whatsapp_messages%rowtype; o public.whatsapp_messages%rowtype; src record; v_method text;
begin
  select * into m from public.whatsapp_messages where id=p_message_id and direction='inbound';
  if not found then return 'not_applicable'; end if;
  if exists(select 1 from public.whatsapp_reply_attributions a where a.inbound_message_id=m.id) then return 'already_attributed'; end if;

  if m.context_provider_message_id is not null then
    select * into o from public.whatsapp_messages
    where provider_message_id=m.context_provider_message_id and direction='outbound' and conversation_id=m.conversation_id;
    if not found then return 'context_not_attributable'; end if;
    v_method:='exact_context';
  else
    select * into o from public.whatsapp_messages
    where conversation_id=m.conversation_id and direction='outbound' and provider_timestamp<=m.provider_timestamp
    order by provider_timestamp desc,created_at desc limit 1;
    if not found then return 'no_prior_outbound'; end if;
    if m.provider_timestamp-o.provider_timestamp>interval '72 hours' then return 'outside_inference_window'; end if;
    if exists(
      select 1 from public.whatsapp_messages i
      where i.conversation_id=m.conversation_id and i.direction='inbound' and i.id<>m.id
        and i.provider_timestamp>=o.provider_timestamp
        and (i.provider_timestamp<m.provider_timestamp or (i.provider_timestamp=m.provider_timestamp and i.created_at<m.created_at))
    ) then
      return 'not_first_reply';
    end if;
    v_method:='inferred_window';
  end if;

  select * into src from private.whatsapp_outbound_marketing_source(o.id) limit 1;
  if not found then return case when v_method='exact_context' then 'context_not_attributable' else 'latest_outbound_not_marketing' end; end if;

  insert into public.whatsapp_reply_attributions(inbound_message_id,outbound_message_id,conversation_id,method,source_kind,run_id,recipient_id,campaign_version_id,reply_lag_seconds)
  values(m.id,o.id,m.conversation_id,v_method,src.source_kind,src.run_id,src.recipient_id,src.campaign_version_id,
         greatest(0,floor(extract(epoch from (m.provider_timestamp-o.provider_timestamp))))::integer)
  on conflict (inbound_message_id) do nothing;
  return v_method;
end;$$;
revoke all on function private.whatsapp_attribute_inbound_reply(uuid) from public,anon,authenticated;

/* Post-ingest evidence for one inbound message. Idempotent; the webhook retries on error. */
create or replace function public.record_whatsapp_inbound_evidence(p_message_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_message_id is null then raise exception 'WHATSAPP_MESSAGE_ID_REQUIRED' using errcode='22023'; end if;
  return jsonb_build_object('reply',private.whatsapp_attribute_inbound_reply(p_message_id));
end;$$;
revoke all on function public.record_whatsapp_inbound_evidence(uuid) from public,anon,authenticated;
grant execute on function public.record_whatsapp_inbound_evidence(uuid) to service_role;

-- 11. Funnel read models.

/*
 * CRM conversions for a contact's LIVE leads inside the attribution window
 * after a send. "Influenced within 30 days", never "caused by".
 */
create or replace function private.whatsapp_contact_conversion_evidence(p_contact_id uuid,p_since timestamptz)
returns table(consultation_at timestamptz,quotation_at timestamptz,booking_at timestamptz)
language sql stable security definer set search_path='' as $$
  select
    (select min(le.occurred_at) from public.leads l join public.lead_events le on le.lead_id=l.id
      where p_since is not null and l.contact_id=p_contact_id and l.deleted_at is null
        and le.event_type in ('lead.status_changed','lead.resumed')
        and coalesce(le.event_data->>'to',le.event_data->>'to_status')='consultation_scheduled'
        and le.occurred_at>=p_since and le.occurred_at<p_since+private.whatsapp_attribution_window()),
    (select min(qv.finalized_at) from public.leads l join public.quotations q on q.lead_id=l.id join public.quotation_versions qv on qv.quotation_id=q.id
      where p_since is not null and l.contact_id=p_contact_id and l.deleted_at is null
        and qv.finalized_at>=p_since and qv.finalized_at<p_since+private.whatsapp_attribution_window()),
    (select min(qa.accepted_at) from public.leads l join public.quotation_acceptances qa on qa.lead_id=l.id
      where p_since is not null and l.contact_id=p_contact_id and l.deleted_at is null
        and qa.accepted_at>=p_since and qa.accepted_at<p_since+private.whatsapp_attribution_window());
$$;
revoke all on function private.whatsapp_contact_conversion_evidence(uuid,timestamptz) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_recipient_funnel(p_run_ids uuid[])
returns table(
  run_id uuid,recipient_id uuid,contact_id uuid,recipient_state text,reason_code text,recipient_e164 text,
  message_id uuid,sent_at timestamptz,delivered_at timestamptz,read_at timestamptz,failed_at timestamptz,
  first_click_at timestamptz,click_count integer,replied_at timestamptz,reply_method text,
  consultation_at timestamptz,quotation_at timestamptz,booking_at timestamptz,opted_out_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select
    r.run_id,r.id,r.contact_id,r.state,r.reason_code,r.recipient_e164,
    m.id,m.provider_timestamp,
    ev.delivered_at,ev.read_at,ev.failed_at,
    ck.first_click_at,coalesce(ck.click_count,0),
    ra.replied_at,ra.method,
    cv.consultation_at,cv.quotation_at,cv.booking_at,
    oo.opted_out_at
  from public.whatsapp_campaign_recipients r
  left join public.whatsapp_messages m on m.id=r.canonical_message_id
  left join lateral (
    select min(se.provider_timestamp) filter (where se.status in ('delivered','read')) as delivered_at,
           min(se.provider_timestamp) filter (where se.status='read') as read_at,
           min(se.provider_timestamp) filter (where se.status='failed') as failed_at
    from public.whatsapp_message_status_events se
    where m.id is not null and se.provider_message_id=m.provider_message_id
  ) ev on true
  left join lateral (
    select min(ce.occurred_at) as first_click_at,count(ce.id)::integer as click_count
    from public.whatsapp_click_tokens t join public.whatsapp_click_events ce on ce.token_id=t.id
    where t.recipient_id=r.id and t.purpose='campaign' and ce.client_class<>'bot'
  ) ck on true
  left join lateral (
    select im.provider_timestamp as replied_at,a.method
    from public.whatsapp_reply_attributions a join public.whatsapp_messages im on im.id=a.inbound_message_id
    where a.recipient_id=r.id
    order by im.provider_timestamp,(a.method='exact_context') desc
    limit 1
  ) ra on true
  left join lateral private.whatsapp_contact_conversion_evidence(r.contact_id,m.provider_timestamp) cv on true
  left join lateral (
    select min(ce.occurred_at) as opted_out_at from public.consent_events ce
    where m.id is not null and ce.contact_id=r.contact_id and ce.purpose_code='MARKETING' and ce.event_type='withdrawn'
      and ce.occurred_at>=m.provider_timestamp and ce.occurred_at<m.provider_timestamp+private.whatsapp_attribution_window()
  ) oo on true
  where r.run_id=any(p_run_ids);
$$;
revoke all on function private.whatsapp_campaign_recipient_funnel(uuid[]) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_funnel_summary(p_run_ids uuid[])
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'matched',count(*),
    'excluded',count(*) filter (where f.recipient_state='excluded'),
    'targeted',count(*) filter (where f.recipient_state<>'excluded'),
    'queued',count(*) filter (where f.recipient_state='queued'),
    'skipped',count(*) filter (where f.recipient_state='skipped'),
    'cancelled',count(*) filter (where f.recipient_state='cancelled'),
    'dispatch_failed',count(*) filter (where f.recipient_state='failed'),
    'needs_reconcile',count(*) filter (where f.recipient_state='needs_reconcile'),
    'sent',count(*) filter (where f.message_id is not null),
    'delivered',count(*) filter (where f.delivered_at is not null),
    'read',count(*) filter (where f.read_at is not null),
    'provider_failed',count(*) filter (where f.failed_at is not null and f.delivered_at is null),
    'clicked',count(*) filter (where f.first_click_at is not null),
    'replied',count(*) filter (where f.replied_at is not null),
    'replied_exact',count(*) filter (where f.reply_method='exact_context'),
    'replied_inferred',count(*) filter (where f.reply_method='inferred_window'),
    'consultation',count(*) filter (where f.consultation_at is not null),
    'quotation',count(*) filter (where f.quotation_at is not null),
    'booking',count(*) filter (where f.booking_at is not null),
    'opted_out',count(*) filter (where f.opted_out_at is not null)
  )
  from private.whatsapp_campaign_recipient_funnel(p_run_ids) f;
$$;
revoke all on function private.whatsapp_campaign_funnel_summary(uuid[]) from public,anon,authenticated;

create or replace function private.whatsapp_analytics_require_read()
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_permission('whatsapp.analytics.read') then
    raise exception 'WHATSAPP_ANALYTICS_DENIED' using errcode='42501';
  end if;
end;$$;
revoke all on function private.whatsapp_analytics_require_read() from public,anon,authenticated;

create or replace function private.whatsapp_analytics_range(p_from timestamptz,p_to timestamptz)
returns table(range_from timestamptz,range_to timestamptz) language plpgsql volatile set search_path='' as $$
declare v_to timestamptz:=coalesce(p_to,clock_timestamp()); v_from timestamptz;
begin
  v_from:=coalesce(p_from,v_to-interval '30 days');
  if v_from>=v_to or v_to-v_from>interval '366 days' then raise exception 'WHATSAPP_ANALYTICS_RANGE_INVALID' using errcode='22023'; end if;
  return query select v_from,v_to;
end;$$;
revoke all on function private.whatsapp_analytics_range(timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.get_whatsapp_analytics_overview(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_from timestamptz; v_to timestamptz; v_runs uuid[];
begin
  perform private.whatsapp_analytics_require_read();
  select range_from,range_to into v_from,v_to from private.whatsapp_analytics_range(p_from,p_to);
  select coalesce(array_agg(r.id),'{}'::uuid[]) into v_runs
  from public.whatsapp_campaign_runs r where r.created_at>=v_from and r.created_at<v_to;

  return jsonb_build_object(
    'range',jsonb_build_object('from',v_from,'to',v_to),
    'attribution_window_days',extract(day from private.whatsapp_attribution_window())::integer,
    'channel',(
      select jsonb_build_object(
        'outbound_messages',count(*) filter (where m.direction='outbound'),
        'inbound_messages',count(*) filter (where m.direction='inbound'),
        'active_conversations',count(distinct m.conversation_id),
        'outbound_with_delivered_evidence',count(*) filter (where m.direction='outbound' and exists(
          select 1 from public.whatsapp_message_status_events se where se.provider_message_id=m.provider_message_id and se.status in ('delivered','read'))),
        'outbound_with_read_evidence',count(*) filter (where m.direction='outbound' and exists(
          select 1 from public.whatsapp_message_status_events se where se.provider_message_id=m.provider_message_id and se.status='read')),
        'outbound_with_failed_evidence',count(*) filter (where m.direction='outbound' and exists(
          select 1 from public.whatsapp_message_status_events se where se.provider_message_id=m.provider_message_id and se.status='failed'))
      )
      from public.whatsapp_messages m where m.provider_timestamp>=v_from and m.provider_timestamp<v_to
    ),
    'campaign_funnel',private.whatsapp_campaign_funnel_summary(v_runs),
    'runs',coalesce((
      select jsonb_agg(x.item order by x.created_at desc)
      from (
        select r.created_at,jsonb_build_object(
          'run_id',r.id,'status',r.status,'created_at',r.created_at,'started_at',r.started_at,'completed_at',r.completed_at,
          'campaign_version_id',r.campaign_version_id,'campaign_name',c.name,'version_number',v.version_number,'version_title',v.title,
          'template_name',snap.name,'funnel',private.whatsapp_campaign_funnel_summary(array[r.id])
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
end;$$;
revoke all on function public.get_whatsapp_analytics_overview(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_whatsapp_analytics_overview(timestamptz,timestamptz) to authenticated;

create or replace function public.get_whatsapp_campaign_run_analytics(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r public.whatsapp_campaign_runs%rowtype; v public.campaign_versions%rowtype; c public.campaigns%rowtype;
begin
  perform private.whatsapp_analytics_require_read();
  select * into r from public.whatsapp_campaign_runs where id=p_run_id;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  select * into v from public.campaign_versions where id=r.campaign_version_id;
  select * into c from public.campaigns where id=v.campaign_id;
  return jsonb_build_object(
    'run_id',r.id,'status',r.status,'created_at',r.created_at,'started_at',r.started_at,'completed_at',r.completed_at,
    'campaign_name',c.name,'version_number',v.version_number,'version_title',v.title,
    'funnel',private.whatsapp_campaign_funnel_summary(array[r.id]),
    'clicks_by_destination',coalesce((
      select jsonb_agg(jsonb_build_object('destination_id',x.destination_id,'label',x.label,'clicks',x.clicks,'recipients',x.recipients) order by x.clicks desc,x.label)
      from (
        select d.id as destination_id,d.label,count(ce.id)::integer as clicks,count(distinct t.recipient_id)::integer as recipients
        from public.whatsapp_click_tokens t
        join public.whatsapp_click_destinations d on d.id=t.destination_id
        join public.whatsapp_click_events ce on ce.token_id=t.id and ce.client_class<>'bot'
        where t.run_id=r.id and t.purpose='campaign'
        group by d.id,d.label
      ) x
    ),'[]'::jsonb),
    'bot_clicks',(select count(ce.id) from public.whatsapp_click_tokens t join public.whatsapp_click_events ce on ce.token_id=t.id where t.run_id=r.id and ce.client_class='bot'),
    'reply_lag',(
      select jsonb_build_object(
        'under_1h',count(*) filter (where a.reply_lag_seconds<3600),
        'from_1h_to_24h',count(*) filter (where a.reply_lag_seconds>=3600 and a.reply_lag_seconds<86400),
        'over_24h',count(*) filter (where a.reply_lag_seconds>=86400)
      )
      from public.whatsapp_reply_attributions a where a.run_id=r.id
    ),
    'reasons',coalesce((select jsonb_object_agg(x.reason_code,x.n) from (
      select reason_code,count(*) n from public.whatsapp_campaign_recipients where run_id=r.id and reason_code is not null group by reason_code) x),'{}'::jsonb),
    'generated_at',clock_timestamp()
  );
end;$$;
revoke all on function public.get_whatsapp_campaign_run_analytics(uuid) from public,anon;
grant execute on function public.get_whatsapp_campaign_run_analytics(uuid) to authenticated;

/*
 * Super Admin only. Minimised: no name, no full number, no message text. Each
 * export is recorded before the rows are returned, in the same transaction.
 */
create or replace function public.export_whatsapp_campaign_run_report(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_rows jsonb; v_total integer; v_export uuid; v_limit constant integer:=20000;
begin
  if a is null or not private.has_permission('whatsapp.reports.export') or not private.has_role('super_admin') then
    raise exception 'WHATSAPP_REPORT_EXPORT_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.whatsapp_campaign_runs where id=p_run_id) then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002';
  end if;
  select count(*) into v_total from public.whatsapp_campaign_recipients where run_id=p_run_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'recipient_ref',f.recipient_id,'contact_id',f.contact_id,'phone_last4',right(f.recipient_e164,4),
      'state',f.recipient_state,'reason_code',f.reason_code,'sent_at',f.sent_at,'delivered_at',f.delivered_at,'read_at',f.read_at,
      'provider_failed_at',f.failed_at,'first_click_at',f.first_click_at,'click_count',f.click_count,
      'replied_at',f.replied_at,'reply_method',f.reply_method,
      'consultation',f.consultation_at is not null,'quotation',f.quotation_at is not null,'booking',f.booking_at is not null,
      'opted_out',f.opted_out_at is not null
    ) order by f.sent_at nulls last,f.recipient_id),'[]'::jsonb)
  into v_rows
  from (select * from private.whatsapp_campaign_recipient_funnel(array[p_run_id]) order by sent_at nulls last,recipient_id limit v_limit) f;
  insert into public.whatsapp_report_exports(report_kind,run_id,exported_by,row_count,truncated)
  values('campaign_run_recipients',p_run_id,a,jsonb_array_length(v_rows),v_total>v_limit) returning id into v_export;
  return jsonb_build_object('export_id',v_export,'run_id',p_run_id,'generated_at',clock_timestamp(),'truncated',v_total>v_limit,'rows',v_rows);
end;$$;
revoke all on function public.export_whatsapp_campaign_run_report(uuid) from public,anon;
grant execute on function public.export_whatsapp_campaign_run_report(uuid) to authenticated;
