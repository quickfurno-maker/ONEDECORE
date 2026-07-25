-- ONEDECORE — Phase 2E2A Status RPC Exposure Hardening
-- Migration: 20260725123040_harden_portfolio_status_rpc_exposure.sql
-- Replaces public SECURITY DEFINER RPC with public SECURITY INVOKER wrapper delegating to private SECURITY DEFINER helper.

CREATE SCHEMA IF NOT EXISTS private;

-- 1. Create Private SECURITY DEFINER Implementation Helper
CREATE OR REPLACE FUNCTION private.set_portfolio_project_status_impl(
  requested_project_id uuid,
  requested_status text
)
RETURNS public.portfolio_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_project public.portfolio_projects%ROWTYPE;
  v_service_count integer;
  v_cover_count integer;
BEGIN
  v_actor_id := (SELECT auth.uid());

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (SELECT public.authorize('portfolio.manage')) THEN
    RAISE EXCEPTION 'Permission denied to manage portfolio project status' USING ERRCODE = '42501';
  END IF;

  IF requested_status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid project status value: %', requested_status USING ERRCODE = '22023';
  END IF;

  -- Lock target project row
  PERFORM 1
  FROM public.portfolio_projects
  WHERE id = requested_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project % not found.', requested_project_id USING ERRCODE = 'P0002';
  END IF;

  -- Enforce publication prerequisites
  IF requested_status = 'published' THEN
    SELECT COUNT(*) INTO v_service_count
    FROM public.portfolio_project_services
    WHERE project_id = requested_project_id;

    IF v_service_count = 0 THEN
      RAISE EXCEPTION 'Cannot publish portfolio project without at least one assigned service.' USING ERRCODE = '22000';
    END IF;

    SELECT COUNT(*) INTO v_cover_count
    FROM public.portfolio_media
    WHERE project_id = requested_project_id
      AND media_role = 'cover'
      AND status = 'ready'
      AND public_object_path IS NOT NULL;

    IF v_cover_count = 0 THEN
      RAISE EXCEPTION 'Cannot publish portfolio project without at least one ready cover image.' USING ERRCODE = '22000';
    END IF;

    UPDATE public.portfolio_projects
    SET status = 'published',
        published_at = COALESCE(published_at, NOW()),
        updated_by = v_actor_id
    WHERE id = requested_project_id
    RETURNING * INTO v_project;
  ELSE
    UPDATE public.portfolio_projects
    SET status = requested_status,
        published_at = NULL,
        is_featured = false,
        updated_by = v_actor_id
    WHERE id = requested_project_id
    RETURNING * INTO v_project;
  END IF;

  RETURN v_project;
END;
$$;

ALTER FUNCTION private.set_portfolio_project_status_impl(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION private.set_portfolio_project_status_impl(uuid, text) IS 'Private SECURITY DEFINER helper executing portfolio project status transitions with elevated postgres privileges after enforcing authentication and authorization.';

-- 2. Create Public SECURITY INVOKER Wrapper (Recreated in place without dropping)
CREATE OR REPLACE FUNCTION public.set_portfolio_project_status(
  requested_project_id uuid,
  requested_status text
)
RETURNS public.portfolio_projects
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN private.set_portfolio_project_status_impl(requested_project_id, requested_status);
END;
$$;

ALTER FUNCTION public.set_portfolio_project_status(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.set_portfolio_project_status(uuid, text) IS 'Public SECURITY INVOKER wrapper for portfolio project status transitions. Enforces RPC authentication, authorization and publication prerequisites.';

-- 3. Access Control Lists (ACLs)
REVOKE ALL ON FUNCTION public.set_portfolio_project_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_portfolio_project_status(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION private.set_portfolio_project_status_impl(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.set_portfolio_project_status_impl(uuid, text) TO authenticated;

-- 4. Storage Objects SELECT Policy Alignment for Portfolio Public Bucket
DROP POLICY IF EXISTS "Staff select portfolio public" ON storage.objects;
DROP POLICY IF EXISTS staff_select_portfolio_public ON storage.objects;

CREATE POLICY "Staff select portfolio public"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'portfolio-public'
    AND (SELECT public.authorize('portfolio.manage'))
  );
