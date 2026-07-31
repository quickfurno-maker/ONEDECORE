-- ONEDECORE Phase 5C1 owner-review local RLS QA (local Supabase only)
-- Idempotent fixture seed + isolation assertions. Not for managed Supabase.

DO $qa$
DECLARE
  v_exec_a uuid := 'f3333333-3333-3333-3333-333333333333';
  v_exec_b uuid := 'f4444444-4444-4444-4444-444444444444';
  v_lead_unassigned uuid;
  v_lead_a uuid;
  v_lead_b uuid;
  v_hidden uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  v_count integer;
BEGIN
  -- Staff users (auth.users rows expected to exist from companion seed script)
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Super Admin'
  WHERE id = 'f1111111-1111-1111-1111-111111111111';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Sales Manager'
  WHERE id = 'f2222222-2222-2222-2222-222222222222';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Executive A'
  WHERE id = v_exec_a;
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Executive B'
  WHERE id = v_exec_b;
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA PM'
  WHERE id = 'f5555555-5555-5555-5555-555555555555';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Designer'
  WHERE id = 'f7777777-7777-7777-7777-777777777777';

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f1111111-1111-1111-1111-111111111111', id FROM public.roles WHERE code = 'super_admin'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f2222222-2222-2222-2222-222222222222', id FROM public.roles WHERE code = 'sales_manager'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT v_exec_a, id FROM public.roles WHERE code = 'sales_executive'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT v_exec_b, id FROM public.roles WHERE code = 'sales_executive'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f5555555-5555-5555-5555-555555555555', id FROM public.roles WHERE code = 'project_manager'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f7777777-7777-7777-7777-777777777777', id FROM public.roles WHERE code = 'designer'
  ON CONFLICT DO NOTHING;

  -- Leads via intake RPC (idempotent keys)
  PERFORM public.submit_lead_intake(
    p_idempotency_key => 'f0aa0001-0001-4000-8000-000000000001'::uuid,
    p_request_hash => repeat('a', 64),
    p_network_fingerprint_hash => repeat('b', 64),
    p_phone_fingerprint_hash => repeat('c', 64),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => 'Owner QA Unassigned',
    p_phone_e164 => '+919800000001',
    p_submitted_email => null,
    p_service_code => 'complete-home-interiors',
    p_property_code => 'apartment-2bhk',
    p_timeline_code => 'within-3-months',
    p_room_codes => array['living']::text[],
    p_budget_comfort_code => '6-12l',
    p_estimate_snapshot => null,
    p_locality => 'Koregaon Park, Pune',
    p_message => 'Unassigned fixture',
    p_landing_path => '/',
    p_attribution => '{"utm_source":"owner-qa"}'::jsonb,
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

  PERFORM public.submit_lead_intake(
    p_idempotency_key => 'f0aa0002-0002-4000-8000-000000000002'::uuid,
    p_request_hash => repeat('d', 64),
    p_network_fingerprint_hash => repeat('e', 64),
    p_phone_fingerprint_hash => repeat('f', 64),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => 'Owner QA Executive A Lead',
    p_phone_e164 => '+919800000002',
    p_submitted_email => null,
    p_service_code => 'complete-home-interiors',
    p_property_code => 'apartment-2bhk',
    p_timeline_code => 'within-3-months',
    p_room_codes => array['kitchen']::text[],
    p_budget_comfort_code => '6-12l',
    p_estimate_snapshot => null,
    p_locality => 'Baner, Pune',
    p_message => 'Executive A fixture',
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

  PERFORM public.submit_lead_intake(
    p_idempotency_key => 'f0aa0003-0003-4000-8000-000000000003'::uuid,
    p_request_hash => repeat('1', 64),
    p_network_fingerprint_hash => repeat('2', 64),
    p_phone_fingerprint_hash => repeat('3', 64),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => 'Owner QA Executive B Lead',
    p_phone_e164 => '+919800000003',
    p_submitted_email => null,
    p_service_code => 'modular-kitchens',
    p_property_code => 'apartment-3bhk',
    p_timeline_code => 'ready-now',
    p_room_codes => array['kitchen']::text[],
    p_budget_comfort_code => '12-20l',
    p_estimate_snapshot => null,
    p_locality => 'Hinjewadi, Pune',
    p_message => 'Executive B fixture',
    p_landing_path => '/portfolio',
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

  SELECT id INTO v_lead_unassigned FROM public.leads WHERE submitted_name = 'Owner QA Unassigned' LIMIT 1;
  SELECT id INTO v_lead_a FROM public.leads WHERE submitted_name = 'Owner QA Executive A Lead' LIMIT 1;
  SELECT id INTO v_lead_b FROM public.leads WHERE submitted_name = 'Owner QA Executive B Lead' LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
  EXECUTE 'set local role authenticated';
  PERFORM public.assign_lead(v_lead_a, v_exec_a, 'manager assign A');
  PERFORM public.assign_lead(v_lead_b, v_exec_b, 'manager assign B');

  -- Executive A isolation
  PERFORM set_config('request.jwt.claim.sub', v_exec_a::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Executive A expected 1 lead, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.leads WHERE id = v_lead_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Executive A can see Executive B lead';
  END IF;
  SELECT count(*) INTO v_count FROM public.leads WHERE assigned_to IS NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Executive A can see unassigned lead';
  END IF;
  SELECT count(*) INTO v_count FROM public.lead_notes ln
  JOIN public.leads l ON l.id = ln.lead_id
  WHERE l.id = v_lead_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Executive A can see Executive B notes';
  END IF;
  BEGIN
    PERFORM * FROM public.list_crm_assignable_executives();
    RAISE EXCEPTION 'Executive A should be denied assignee directory';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    IF SQLSTATE <> '42501' THEN
      RAISE;
    END IF;
  END;

  -- Executive B symmetry
  PERFORM set_config('request.jwt.claim.sub', v_exec_b::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads WHERE id = v_lead_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Executive B can see Executive A lead';
  END IF;

  -- Sales manager broad read
  PERFORM set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads WHERE submitted_name LIKE 'Owner QA%';
  IF v_count < 3 THEN
    RAISE EXCEPTION 'Sales manager expected >=3 owner QA leads, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.list_crm_assignable_executives();
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Sales manager assignee directory empty';
  END IF;

  -- Project manager denied
  PERFORM set_config('request.jwt.claim.sub', 'f5555555-5555-5555-5555-555555555555', true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Project manager can read leads (% rows)', v_count;
  END IF;

  -- Designer denied
  PERFORM set_config('request.jwt.claim.sub', 'f7777777-7777-7777-7777-777777777777', true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Designer can read leads (% rows)', v_count;
  END IF;

  -- Hidden UUID same as no row for executive A
  PERFORM set_config('request.jwt.claim.sub', v_exec_a::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO v_count FROM public.leads WHERE id = v_hidden;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Executive A can read hidden UUID lead';
  END IF;

  RAISE NOTICE 'PHASE_5C1_RLS_QA: PASS';
END
$qa$;
