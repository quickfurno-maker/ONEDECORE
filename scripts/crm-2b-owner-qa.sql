-- CRM 2B owner QA role fixture (local Supabase only).
-- Activates the six QA staff profiles and grants their canonical roles.
-- Idempotent and assertion-free: unlike phase-5c1-owner-rls-qa.sql it makes no
-- claims about lead counts, so it stays valid alongside the CRM 2B fixtures.

DO $crm2b$
BEGIN
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Super Admin'
  WHERE id = 'f1111111-1111-1111-1111-111111111111';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Sales Manager'
  WHERE id = 'f2222222-2222-2222-2222-222222222222';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Executive A'
  WHERE id = 'f3333333-3333-3333-3333-333333333333';
  UPDATE public.profiles SET status = 'active', display_name = 'Owner QA Executive B'
  WHERE id = 'f4444444-4444-4444-4444-444444444444';
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
  SELECT 'f3333333-3333-3333-3333-333333333333', id FROM public.roles WHERE code = 'sales_executive'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f4444444-4444-4444-4444-444444444444', id FROM public.roles WHERE code = 'sales_executive'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f5555555-5555-5555-5555-555555555555', id FROM public.roles WHERE code = 'project_manager'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT 'f7777777-7777-7777-7777-777777777777', id FROM public.roles WHERE code = 'designer'
  ON CONFLICT DO NOTHING;
END
$crm2b$;
