-- CRM 2E owner QA fixture (local Supabase only).
--
-- Builds a self-contained CRM 2E dataset: every measurable first-response SLA
-- outcome, a real stage ladder for conversion and velocity, a valued open
-- pipeline for the forecast, and one accepted quotation for target achievement.
--
-- WHY THIS RUNS AS postgres RATHER THAN THROUGH THE SERVICE-ROLE CLIENT
-- public.crm_sla_clocks (and the quotation evidence tables) revoke ALL from
-- authenticated and grant nothing to service_role, so scripts/crm-2b-owner-qa.mjs
-- fails locally with `permission denied for table crm_sla_clocks`. That is a
-- PRE-EXISTING blocker and CRM 2E deliberately does NOT widen any grant to work
-- around it. Instead every privileged fixture write happens here, in psql, as
-- postgres — the same pattern supabase/tests/database/*.sql already uses.
--
-- Every state change a CRM user could make is still made through the CANONICAL
-- RPCs (submit_lead_intake, assign_lead, create_lead_activity,
-- transition_lead_status) under a real authenticated role + JWT claim, so the
-- stage ladder, the CRM 2C gates and the lead_events stream are all genuine.
-- Only evidence a user cannot write directly — SLA clock outcomes, quotation
-- delivery artefacts, and the acceptance whose capability token this fixture
-- cannot mint — is written as postgres.
--
-- ONE statement on purpose: `supabase db query --file` sends the file as a
-- single prepared statement.
--
-- Idempotent. Seeds no SLA policy, no permission, no role grant and no sales
-- target — targets are created through public.create_sales_target by
-- crm-2e-owner-qa.mjs.

do $crm2e$
declare
  c_sa   constant uuid := 'f1111111-1111-1111-1111-111111111111';
  c_mgr  constant uuid := 'f2222222-2222-2222-2222-222222222222';
  c_exa  constant uuid := 'f3333333-3333-3333-3333-333333333333';
  c_exb  constant uuid := 'f4444444-4444-4444-4444-444444444444';

  -- name / phone / owner / stage path. Paths use the canonical graph only.
  v_specs jsonb := jsonb_build_array(
    jsonb_build_object('k','01','n','CRM2E SLA Met A','p','+919811110001','o',c_exa,'path',jsonb_build_array()),
    jsonb_build_object('k','02','n','CRM2E SLA Met B','p','+919811110002','o',c_exa,'path',jsonb_build_array('contacted')),
    jsonb_build_object('k','03','n','CRM2E SLA Breach Silent','p','+919811110003','o',c_exa,'path',jsonb_build_array()),
    jsonb_build_object('k','04','n','CRM2E SLA Breach Late','p','+919811110004','o',c_exb,'path',jsonb_build_array()),
    jsonb_build_object('k','05','n','CRM2E SLA Pending','p','+919811110005','o',c_exb,'path',jsonb_build_array()),
    jsonb_build_object('k','06','n','CRM2E Outside Policy','p','+919811110006','o',c_exa,'path',jsonb_build_array('contacted','qualified')),
    jsonb_build_object('k','07','n','CRM2E On Hold','p','+919811110007','o',c_exb,'path',jsonb_build_array('contacted','on_hold')),
    jsonb_build_object('k','08','n','CRM2E Closed Won','p','+919811110008','o',c_exa,'path',jsonb_build_array('contacted','qualified','consultation_scheduled','proposal_sent','negotiation')),
    jsonb_build_object('k','09','n','CRM2E Closed Lost','p','+919811110009','o',c_exb,'path',jsonb_build_array('contacted','closed_lost')),
    jsonb_build_object('k','10','n','CRM2E Negotiation Valued','p','+919811110010','o',c_exa,'path',jsonb_build_array('contacted','qualified','consultation_scheduled','proposal_sent','negotiation')),
    jsonb_build_object('k','11','n','CRM2E Unknown Value','p','+919811110011','o',c_exa,'path',jsonb_build_array('contacted','qualified'))
  );

  v_spec jsonb;
  v_lead uuid;
  v_stage text;
  v_current text;
  v_owner uuid;

  v_quote_leads uuid[];
  v_quotation uuid;
  v_version uuid;
  v_grant uuid;
  v_exec uuid;
  v_seq integer;
  v_at timestamptz := now() - interval '1 day';
begin
  -- =========================================================================
  -- 0. Identities. auth.users are created by crm-2e-owner-qa.mjs first.
  -- =========================================================================
  update public.profiles set status = 'active', display_name = 'Owner QA Super Admin' where id = c_sa;
  update public.profiles set status = 'active', display_name = 'Owner QA Sales Manager' where id = c_mgr;
  update public.profiles set status = 'active', display_name = 'Owner QA Executive A' where id = c_exa;
  update public.profiles set status = 'active', display_name = 'Owner QA Executive B' where id = c_exb;

  insert into public.user_roles (user_id, role_id)
  select c_sa, id from public.roles where code = 'super_admin' on conflict do nothing;
  insert into public.user_roles (user_id, role_id)
  select c_mgr, id from public.roles where code = 'sales_manager' on conflict do nothing;
  insert into public.user_roles (user_id, role_id)
  select c_exa, id from public.roles where code = 'sales_executive' on conflict do nothing;
  insert into public.user_roles (user_id, role_id)
  select c_exb, id from public.roles where code = 'sales_executive' on conflict do nothing;

  -- =========================================================================
  -- 1. Leads, through the canonical public intake RPC.
  -- =========================================================================
  for v_spec in select * from jsonb_array_elements(v_specs)
  loop
    if exists (select 1 from public.leads where submitted_name = v_spec ->> 'n') then
      continue;
    end if;

    perform public.submit_lead_intake(
      p_idempotency_key => ('2e0000' || (v_spec ->> 'k') || '-0000-4000-8000-0000000000' || (v_spec ->> 'k'))::uuid,
      p_request_hash => encode(sha256(('crm2e-req:' || (v_spec ->> 'k'))::bytea), 'hex'),
      p_network_fingerprint_hash => encode(sha256(('crm2e-net:' || (v_spec ->> 'k'))::bytea), 'hex'),
      p_phone_fingerprint_hash => encode(sha256(('crm2e-phone:' || (v_spec ->> 'k'))::bytea), 'hex'),
      p_planner_version => 'home-r4-v1',
      p_submitted_name => v_spec ->> 'n',
      p_phone_e164 => v_spec ->> 'p',
      p_submitted_email => null,
      p_service_code => 'complete-home-interiors',
      p_property_code => 'apartment-3bhk',
      p_timeline_code => 'within-1-month',
      p_room_codes => array['kitchen', 'wardrobes']::text[],
      p_budget_comfort_code => '12-20l',
      p_estimate_snapshot => null,
      p_locality => 'Pune',
      p_message => null,
      p_landing_path => '/',
      p_attribution => '{}'::jsonb,
      p_source => 'local-test',
      p_consent_service_enquiry => true,
      p_consent_service_phone => true,
      p_consent_service_email => false,
      p_consent_whatsapp => false,
      p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
      p_copy_service_communication => 'service-communication-v0.1-draft',
      p_copy_whatsapp => null,
      p_notice_version => 'privacy-notice-v0.1-draft'
    );
  end loop;

  -- =========================================================================
  -- 2. Assignment, through the canonical RPC under a real super-admin claim.
  -- =========================================================================
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', c_sa::text, true);
  execute 'set local role authenticated';

  for v_spec in select * from jsonb_array_elements(v_specs)
  loop
    select id, assigned_to into v_lead, v_owner
    from public.leads where submitted_name = v_spec ->> 'n';
    if v_lead is not null and v_owner is null then
      perform public.assign_lead(v_lead, (v_spec ->> 'o')::uuid, 'CRM 2E QA seed');
    end if;
  end loop;

  execute 'reset role';

  -- =========================================================================
  -- 3. First-response SLA outcomes.
  --
  -- The local first_contact policy is seeded INACTIVE and CRM 2E must never
  -- activate it, so every due snapshot is NULL out of the box. Writing explicit
  -- outcomes is the only way to exercise the compliance denominator without
  -- touching policy state — and the leads left with a NULL due are exactly what
  -- non-retroactive activation produces in production.
  --
  --   01, 02  MET      attempt 30 minutes after receipt, inside the window
  --   03      BREACH   window elapsed with no attempt at all
  --   04      BREACH   attempt landed 90 minutes after the due instant
  --   05      PENDING  no attempt yet, still inside the window
  --   06..11  OUT OF POLICY (no due snapshot)
  -- =========================================================================
  update public.crm_sla_clocks
  set clock_started_at = now() - interval '3 hours',
      sla_due_at = now() - interval '2 hours',
      first_contact_attempt_at = now() - interval '150 minutes'
  where lead_id in (
    (select id from public.leads where submitted_name = 'CRM2E SLA Met A'),
    (select id from public.leads where submitted_name = 'CRM2E SLA Met B')
  );

  update public.crm_sla_clocks
  set clock_started_at = now() - interval '3 hours',
      sla_due_at = now() - interval '2 hours',
      first_contact_attempt_at = null
  where lead_id = (select id from public.leads where submitted_name = 'CRM2E SLA Breach Silent');

  update public.crm_sla_clocks
  set clock_started_at = now() - interval '4 hours',
      sla_due_at = now() - interval '3 hours',
      first_contact_attempt_at = now() - interval '90 minutes'
  where lead_id = (select id from public.leads where submitted_name = 'CRM2E SLA Breach Late');

  update public.crm_sla_clocks
  set clock_started_at = now() - interval '30 minutes',
      sla_due_at = now() + interval '30 minutes',
      first_contact_attempt_at = null
  where lead_id = (select id from public.leads where submitted_name = 'CRM2E SLA Pending');

  -- First-contact ATTEMPT evidence for every lead that must reach `contacted`.
  -- The CRM 2C gate reads the attempt column and is independent of SLA policy
  -- activation, so these leads keep their NULL due and stay out of policy.
  update public.crm_sla_clocks
  -- Never earlier than the clock start: chk_crm_sla_clocks_attempt_order.
  set first_contact_attempt_at = coalesce(
        first_contact_attempt_at,
        greatest(clock_started_at, now() - interval '110 minutes')
      )
  where lead_id in (
    select l.id from public.leads l
    where l.submitted_name in (
      'CRM2E SLA Met B', 'CRM2E Outside Policy', 'CRM2E On Hold', 'CRM2E Closed Won',
      'CRM2E Closed Lost', 'CRM2E Negotiation Valued', 'CRM2E Unknown Value'
    )
  );

  -- =========================================================================
  -- 4. Quotation delivery evidence for the two leads that reach proposal_sent.
  --
  -- A finalized version carrying a live, non-revoked access grant is the only
  -- thing the CRM 2C proposal gate accepts. capability_token_hash is a fixture
  -- digest, never a real minted token.
  -- =========================================================================
  v_quote_leads := array[
    (select id from public.leads where submitted_name = 'CRM2E Closed Won'),
    (select id from public.leads where submitted_name = 'CRM2E Negotiation Valued')
  ];
  v_seq := 0;

  foreach v_lead in array v_quote_leads
  loop
    v_seq := v_seq + 1;

    select id into v_quotation from public.quotations where lead_id = v_lead;
    if v_quotation is null then
      v_quotation := gen_random_uuid();
      insert into public.quotations (id, lead_id, quotation_number, created_by)
      -- chk_quotations_number_format: OD-Q-<4 digit year>-<6+ digits>.
      values (
        v_quotation,
        v_lead,
        'OD-Q-' || to_char(now(), 'YYYY') || '-9000' || lpad(v_seq::text, 2, '0'),
        c_sa
      );
    end if;

    select id into v_version
    from public.quotation_versions
    where quotation_id = v_quotation and status = 'finalized'
    order by version_number desc
    limit 1;

    if v_version is null then
      v_version := gen_random_uuid();
      -- chk_quotation_versions_taxable_base_eq: the ex-tax base is derived,
      -- never set on its own. Subtotal carries the value; discount is zero.
      insert into public.quotation_versions (
        id, quotation_id, version_number, status, is_current_draft,
        title, subtotal_paise, discount_total_paise, taxable_base_paise,
        finalized_at, created_by
      ) values (
        v_version,
        v_quotation,
        coalesce((select max(version_number) from public.quotation_versions where quotation_id = v_quotation), 0) + 1,
        'finalized',
        false,
        'CRM 2E QA delivered proposal',
        -- Ex-tax canonical deal value, the measure sales targets are
        -- denominated in. Won lead 12,50,000; open negotiation 18,00,000.
        case when v_seq = 1 then 125000000 else 180000000 end,
        0,
        case when v_seq = 1 then 125000000 else 180000000 end,
        now() - interval '2 days',
        c_sa
      );
    else
      update public.quotation_versions
      set subtotal_paise = case when v_seq = 1 then 125000000 else 180000000 end,
          discount_total_paise = 0,
          taxable_base_paise = case when v_seq = 1 then 125000000 else 180000000 end,
          finalized_at = coalesce(finalized_at, now() - interval '2 days')
      where id = v_version;
    end if;

    if not exists (
      select 1 from public.quotation_access_grants
      where quotation_version_id = v_version and revoked_at is null
    ) then
      insert into public.quotation_access_grants (
        id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash
      ) values (
        gen_random_uuid(),
        v_quotation,
        v_version,
        substr(encode(sha256(('crm2e-nonce:' || v_version::text)::bytea), 'hex'), 1, 32),
        encode(sha256(('crm2e-grant:' || v_version::text)::bytea), 'hex')
      );
    end if;
  end loop;

  -- =========================================================================
  -- 5. Consultation evidence + the stage ladder, both through canonical RPCs.
  -- =========================================================================
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', c_sa::text, true);
  execute 'set local role authenticated';

  foreach v_lead in array v_quote_leads
  loop
    if not exists (
      select 1 from public.lead_follow_ups
      where lead_id = v_lead
        and activity_type in ('consultation', 'site_visit')
        and status in ('open', 'completed')
    ) then
      perform public.create_lead_activity(
        v_lead,
        'site_visit',
        'CRM 2E QA measurement visit',
        now() + interval '48 hours',
        'normal',
        (select assigned_to from public.leads where id = v_lead),
        false,
        null,
        null,
        null
      );
    end if;
  end loop;

  for v_spec in select * from jsonb_array_elements(v_specs)
  loop
    select id into v_lead from public.leads where submitted_name = v_spec ->> 'n';

    for v_stage in select jsonb_array_elements_text(v_spec -> 'path')
    loop
      select status into v_current from public.leads where id = v_lead;
      -- Idempotent walk: skip a hop already taken, stop once terminal/parked.
      exit when v_current in ('closed_won', 'closed_lost', 'on_hold');
      continue when v_current = v_stage;

      perform public.transition_lead_status(
        v_lead,
        v_stage,
        case
          when v_stage = 'on_hold' then 'Client travelling until next month'
          when v_stage = 'closed_lost' then 'Budget mismatch after design review'
          else 'CRM 2E QA seed'
        end,
        case when v_stage = 'closed_lost' then 'other' else null end
      );
    end loop;
  end loop;

  execute 'reset role';

  -- =========================================================================
  -- 6. One accepted quotation, replaying accept_quotation_by_capability.
  --
  -- The fixture's access grants carry synthetic capability_token_hash values,
  -- so public.accept_quotation_by_capability cannot be driven against them.
  -- This performs exactly the writes that RPC performs: the same credited
  -- executive (leads.assigned_to at acceptance), the same ex-tax
  -- taxable_base_paise, the same Asia/Kolkata achievement month, and the same
  -- private.accepted_quotation_close_won_impl Closed-Won hop.
  -- =========================================================================
  select id into v_lead from public.leads where submitted_name = 'CRM2E Closed Won';

  if not exists (select 1 from public.quotation_acceptances where lead_id = v_lead) then
    select assigned_to into v_exec from public.leads where id = v_lead;
    select id into v_quotation from public.quotations where lead_id = v_lead;
    select id into v_version
    from public.quotation_versions
    where quotation_id = v_quotation and status = 'finalized'
    order by version_number desc
    limit 1;
    select id into v_grant
    from public.quotation_access_grants
    where quotation_version_id = v_version and revoked_at is null
    limit 1;

    if v_exec is null or v_quotation is null or v_version is null or v_grant is null then
      raise exception 'CRM 2E acceptance fixture is missing its quotation evidence';
    end if;

    insert into public.quotation_acceptances (
      quotation_id, lead_id, quotation_version_id, access_grant_id,
      accepted_by_name, accepted_by_email, accepted_at,
      credited_sales_executive_id, taxable_base_paise, sales_achievement_month
    )
    select
      v_quotation, v_lead, v_version, v_grant,
      'CRM 2E QA Client', null, v_at,
      v_exec,
      qv.taxable_base_paise,
      to_char(v_at at time zone 'Asia/Kolkata', 'YYYY-MM')
    from public.quotation_versions qv
    where qv.id = v_version;

    perform private.accepted_quotation_close_won_impl(v_lead, v_at, v_exec, v_version);
  end if;
end
$crm2e$;
