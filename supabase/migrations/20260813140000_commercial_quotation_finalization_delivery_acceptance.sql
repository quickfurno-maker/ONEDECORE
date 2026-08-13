-- ============================================================================
-- M26 Migration: ONEDECORE Phase 7B Commercial Quotation Finalization,
-- Premium PDF Storage, Secure Delivery & Client Acceptance Data Plane
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System Permissions: Register quotations.finalize and quotations.send
-- ----------------------------------------------------------------------------
INSERT INTO public.system_permissions (permission_key, module_name, description)
VALUES 
  ('quotations.finalize', 'quotations', 'Allows finalizing a draft commercial quotation into an immutable version'),
  ('quotations.send', 'quotations', 'Allows sending a finalized quotation to a client via secure WhatsApp link')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant to canonical system roles: Super Admin, Sales Manager, Sales Executive
-- (PM, Designer, and Kriti receive 0 quotation finalize/send authority)
DO $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Super Admin
  SELECT id INTO v_role_id FROM public.system_roles WHERE role_key = 'super_admin';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM public.system_permissions WHERE permission_key IN ('quotations.finalize', 'quotations.send')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sales Manager
  SELECT id INTO v_role_id FROM public.system_roles WHERE role_key = 'sales_manager';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM public.system_permissions WHERE permission_key IN ('quotations.finalize', 'quotations.send')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sales Executive
  SELECT id INTO v_role_id FROM public.system_roles WHERE role_key = 'sales_executive';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, id FROM public.system_permissions WHERE permission_key IN ('quotations.finalize', 'quotations.send')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Commercial Settings Table (Singleton, NO default seed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_commercial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE DEFAULT 'global',
  max_discount_percentage numeric(5,2) NULL CHECK (max_discount_percentage IS NULL OR (max_discount_percentage >= 0 AND max_discount_percentage <= 100)),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_commercial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotation_commercial_settings_staff_read ON public.quotation_commercial_settings
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 3. Extend public.quotation_versions with Finalization Fields
-- ----------------------------------------------------------------------------
ALTER TABLE public.quotation_versions
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES auth.users(id) NULL,
  ADD COLUMN IF NOT EXISTS finalized_content_sha256 text NULL,
  ADD COLUMN IF NOT EXISTS finalized_content_hash_version text NULL,
  ADD COLUMN IF NOT EXISTS tax_profile_snapshot jsonb NULL;

-- ----------------------------------------------------------------------------
-- 4. Finalized Version Immutability Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_finalized_quotation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version_status text;
BEGIN
  IF TG_TABLE_NAME = 'quotation_versions' THEN
    IF OLD.status IN ('finalized', 'archived') THEN
      RAISE EXCEPTION 'QUOTATION_VERSION_IMMUTABLE: Cannot update or delete a finalized/archived quotation version.';
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME IN ('quotation_sections', 'quotation_items', 'quotation_payment_schedules') THEN
    SELECT status INTO v_version_status
    FROM public.quotation_versions
    WHERE id = OLD.version_id;

    IF v_version_status IN ('finalized', 'archived') THEN
      RAISE EXCEPTION 'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate items, sections, or schedule of a finalized/archived quotation version.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_finalized_version_update ON public.quotation_versions;
CREATE TRIGGER trg_prevent_finalized_version_update
  BEFORE UPDATE ON public.quotation_versions
  FOR EACH ROW
  WHEN (OLD.status IN ('finalized', 'archived'))
  EXECUTE FUNCTION public.prevent_finalized_quotation_mutation();

DROP TRIGGER IF EXISTS trg_prevent_finalized_section_mutation ON public.quotation_sections;
CREATE TRIGGER trg_prevent_finalized_section_mutation
  BEFORE UPDATE OR DELETE ON public.quotation_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_finalized_quotation_mutation();

DROP TRIGGER IF EXISTS trg_prevent_finalized_item_mutation ON public.quotation_items;
CREATE TRIGGER trg_prevent_finalized_item_mutation
  BEFORE UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_finalized_quotation_mutation();

DROP TRIGGER IF EXISTS trg_prevent_finalized_schedule_mutation ON public.quotation_payment_schedules;
CREATE TRIGGER trg_prevent_finalized_schedule_mutation
  BEFORE UPDATE OR DELETE ON public.quotation_payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_finalized_quotation_mutation();

-- ----------------------------------------------------------------------------
-- 5. PDF Documents Table & Private Storage Bucket
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL UNIQUE REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'quotation-documents',
  object_path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  pdf_sha256 text NULL,
  file_size_bytes bigint NULL,
  failure_summary text NULL,
  generated_by uuid REFERENCES auth.users(id) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz NULL
);

ALTER TABLE public.quotation_pdf_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotation_pdf_documents_staff_read ON public.quotation_pdf_documents
  FOR SELECT TO authenticated USING (true);

-- Ensure private storage bucket 'quotation-documents' exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-documents', 'quotation-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Access Grants Table (Capability Tokens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  derivation_nonce text NOT NULL,
  capability_token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz NULL,
  revoked_by uuid REFERENCES auth.users(id) NULL,
  revocation_reason text NULL,
  expires_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotation_access_grants_staff_read ON public.quotation_access_grants
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 7. Client Acceptances Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL UNIQUE REFERENCES public.quotations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL UNIQUE REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  access_grant_id uuid NOT NULL REFERENCES public.quotation_access_grants(id),
  accepted_by_name text NOT NULL,
  accepted_by_email text NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  credited_sales_executive_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotation_acceptances_staff_read ON public.quotation_acceptances
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 8. Phase 6B Send Intents Extension for Secure Content
-- ----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_send_intents
  ADD COLUMN IF NOT EXISTS secure_content_kind text NULL CHECK (secure_content_kind IS NULL OR secure_content_kind IN ('quotation_link')),
  ADD COLUMN IF NOT EXISTS secure_content_ref uuid NULL;

-- ----------------------------------------------------------------------------
-- 9. Super Admin Settings RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_quotation_max_discount(p_max_discount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.system_roles sr ON ur.role_id = sr.id
    WHERE ur.user_id = v_user_id AND sr.role_key = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Super Admin can configure maximum quotation discount.';
  END IF;

  IF p_max_discount IS NOT NULL AND (p_max_discount < 0 OR p_max_discount > 100) THEN
    RAISE EXCEPTION 'INVALID_BOUND: Maximum discount percentage must be between 0.00 and 100.00.';
  END IF;

  INSERT INTO public.quotation_commercial_settings (setting_key, max_discount_percentage, updated_by, updated_at)
  VALUES ('global', p_max_discount, v_user_id, now())
  ON CONFLICT (setting_key) DO UPDATE
  SET max_discount_percentage = EXCLUDED.max_discount_percentage,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  SELECT jsonb_build_object('success', true, 'max_discount_percentage', p_max_discount) INTO v_result;
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Server-Authoritative Finalization RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_quotation_version(
  p_quotation_id uuid,
  p_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text DEFAULT NULL,
  p_canonical_content_sha256 text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quotation RECORD;
  v_version RECORD;
  v_lead RECORD;
  v_max_discount numeric(5,2);
  v_tax_profile RECORD;
  v_total_items integer;
  v_subtotal_paise bigint := 0;
  v_discount_paise bigint := 0;
  v_taxable_base_paise bigint := 0;
  v_tax_total_paise bigint := 0;
  v_grand_total_paise bigint := 0;
  v_schedule_sum_paise bigint := 0;
  v_last_milestone_id uuid;
  v_last_milestone_amount bigint;
  v_diff_paise bigint;
  v_result jsonb;
  v_idempotency_hash text;
  v_existing_req RECORD;
  v_payload_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required.';
  END IF;

  -- RBAC Permission Check
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      JOIN public.system_permissions sp ON rp.permission_id = sp.id
      WHERE ur.user_id = v_user_id AND sp.permission_key = 'quotations.finalize'
    )
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: User lacks quotations.finalize permission.';
  END IF;

  -- Idempotency handling
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    v_idempotency_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
    SELECT * INTO v_existing_req
    FROM private.quotation_idempotency_requests
    WHERE user_id = v_user_id AND idempotency_key_hash = v_idempotency_hash;

    IF FOUND THEN
      IF v_existing_req.status = 'COMPLETED' THEN
        RETURN v_existing_req.response_payload;
      ELSE
        RAISE EXCEPTION 'CONCURRENT_REQUEST: Request is currently processing.';
      END IF;
    END IF;

    INSERT INTO private.quotation_idempotency_requests (user_id, idempotency_key_hash, target_quotation_id, request_path, status)
    VALUES (v_user_id, v_idempotency_hash, p_quotation_id, 'finalize_quotation_version', 'PROCESSING');
  END IF;

  -- Lock quotation root and lead
  SELECT * INTO v_quotation FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTATION_NOT_FOUND: Target quotation does not exist.';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = v_quotation.lead_id;

  -- Scope Check: Executive assigned lead check
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.system_roles sr ON ur.role_id = sr.id
      WHERE ur.user_id = v_user_id AND sr.role_key IN ('super_admin', 'sales_manager')
    )
  ) THEN
    IF v_lead.assigned_to IS NULL OR v_lead.assigned_to <> v_user_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Executive can only finalize quotations for currently assigned leads.';
    END IF;
  END IF;

  -- Lock target version
  SELECT * INTO v_version FROM public.quotation_versions WHERE id = p_version_id AND quotation_id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND: Target quotation version does not exist.';
  END IF;

  IF v_version.status <> 'draft' THEN
    IF v_version.status = 'finalized' THEN
      v_result := jsonb_build_object(
        'success', true,
        'quotation_id', p_quotation_id,
        'version_id', p_version_id,
        'status', 'finalized',
        'finalized_at', v_version.finalized_at,
        'finalized_content_sha256', v_version.finalized_content_sha256,
        'grand_total_paise', v_version.grand_total_paise
      );
      IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        UPDATE private.quotation_idempotency_requests
        SET status = 'COMPLETED', response_payload = v_result, updated_at = now()
        WHERE user_id = v_user_id AND idempotency_key_hash = v_idempotency_hash;
      END IF;
      RETURN v_result;
    ELSE
      RAISE EXCEPTION 'INVALID_VERSION_STATE: Version status must be draft to finalize.';
    END IF;
  END IF;

  IF v_version.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION 'STALE_LOCK_VERSION: Version lock_version mismatch. Draft was updated concurrently.';
  END IF;

  -- Check if root already has an accepted version
  IF EXISTS (SELECT 1 FROM public.quotation_acceptances WHERE quotation_id = p_quotation_id) THEN
    RAISE EXCEPTION 'QUOTATION_ALREADY_ACCEPTED: Quotation root has already been accepted and cannot create/finalize new versions.';
  END IF;

  -- Check items exist
  SELECT COUNT(*) INTO v_total_items FROM public.quotation_items WHERE version_id = p_version_id;
  IF v_total_items = 0 THEN
    RAISE EXCEPTION 'EMPTY_QUOTATION: Cannot finalize a quotation version with 0 items.';
  END IF;

  -- Require configured max discount
  SELECT max_discount_percentage INTO v_max_discount
  FROM public.quotation_commercial_settings WHERE setting_key = 'global';

  IF v_max_discount IS NULL THEN
    RAISE EXCEPTION 'MAX_DISCOUNT_NOT_CONFIGURED: Super Admin must configure maximum quotation discount before finalization.';
  END IF;

  IF v_version.discount_percentage > v_max_discount THEN
    RAISE EXCEPTION 'DISCOUNT_EXCEEDS_MAX: Quotation discount percentage exceeds configured maximum bound.';
  END IF;

  -- Require active selected tax profile
  IF v_version.tax_profile_id IS NULL THEN
    RAISE EXCEPTION 'TAX_PROFILE_REQUIRED: A valid tax profile must be selected before finalization.';
  END IF;

  SELECT * INTO v_tax_profile FROM public.tax_profiles WHERE id = v_version.tax_profile_id;
  IF NOT FOUND OR v_tax_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_TAX_PROFILE: Selected tax profile does not exist or is inactive.';
  END IF;

  -- Server-side money recalculation
  SELECT COALESCE(SUM(line_total_paise), 0) INTO v_subtotal_paise
  FROM public.quotation_items WHERE version_id = p_version_id;

  IF v_version.discount_mode = 'percentage' THEN
    v_discount_paise := ROUND((v_subtotal_paise * (v_version.discount_percentage / 100.00)));
  ELSE
    v_discount_paise := v_version.discount_flat_paise;
  END IF;

  IF v_discount_paise > v_subtotal_paise THEN
    v_discount_paise := v_subtotal_paise;
  END IF;

  v_taxable_base_paise := v_subtotal_paise - v_discount_paise;
  v_tax_total_paise := ROUND((v_taxable_base_paise * (v_tax_profile.tax_rate_percentage / 100.00)));
  v_grand_total_paise := v_taxable_base_paise + v_tax_total_paise;

  -- Payment Schedule residual paise absorption
  IF EXISTS (SELECT 1 FROM public.quotation_payment_schedules WHERE version_id = p_version_id) THEN
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_schedule_sum_paise
    FROM public.quotation_payment_schedules WHERE version_id = p_version_id;

    IF v_schedule_sum_paise <> v_grand_total_paise THEN
      -- Absorb diff in last milestone
      SELECT id, amount_paise INTO v_last_milestone_id, v_last_milestone_amount
      FROM public.quotation_payment_schedules
      WHERE version_id = p_version_id
      ORDER BY milestone_order DESC LIMIT 1;

      v_diff_paise := v_grand_total_paise - v_schedule_sum_paise;
      UPDATE public.quotation_payment_schedules
      SET amount_paise = v_last_milestone_amount + v_diff_paise
      WHERE id = v_last_milestone_id;
    END IF;
  END IF;

  -- Mark version finalized
  UPDATE public.quotation_versions
  SET status = 'finalized',
      is_current_draft = false,
      finalized_at = now(),
      finalized_by = v_user_id,
      finalized_content_sha256 = COALESCE(p_canonical_content_sha256, encode(digest(p_version_id::text || v_grand_total_paise::text, 'sha256'), 'hex')),
      finalized_content_hash_version = 'odq-content-v1',
      tax_profile_snapshot = jsonb_build_object('id', v_tax_profile.id, 'display_name', v_tax_profile.display_name, 'tax_rate_percentage', v_tax_profile.tax_rate_percentage),
      subtotal_paise = v_subtotal_paise,
      discount_paise = v_discount_paise,
      taxable_base_paise = v_taxable_base_paise,
      tax_total_paise = v_tax_total_paise,
      grand_total_paise = v_grand_total_paise,
      tax_rate_percentage = v_tax_profile.tax_rate_percentage,
      lock_version = lock_version + 1,
      updated_at = now()
  WHERE id = p_version_id;

  -- Append audit event
  INSERT INTO public.quotation_events (quotation_id, version_id, event_type, actor_id, payload)
  VALUES (
    p_quotation_id,
    p_version_id,
    'quotation.finalized',
    v_user_id,
    jsonb_build_object(
      'finalized_at', now(),
      'grand_total_paise', v_grand_total_paise,
      'taxable_base_paise', v_taxable_base_paise,
      'finalized_content_sha256', COALESCE(p_canonical_content_sha256, encode(digest(p_version_id::text || v_grand_total_paise::text, 'sha256'), 'hex'))
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'quotation_id', p_quotation_id,
    'version_id', p_version_id,
    'status', 'finalized',
    'finalized_at', now(),
    'grand_total_paise', v_grand_total_paise,
    'finalized_content_sha256', COALESCE(p_canonical_content_sha256, encode(digest(p_version_id::text || v_grand_total_paise::text, 'sha256'), 'hex'))
  );

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    UPDATE private.quotation_idempotency_requests
    SET status = 'COMPLETED', response_payload = v_result, updated_at = now()
    WHERE user_id = v_user_id AND idempotency_key_hash = v_idempotency_hash;
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' AND v_idempotency_hash IS NOT NULL THEN
    UPDATE private.quotation_idempotency_requests
    SET status = 'FAILED', response_payload = jsonb_build_object('error', SQLERRM), updated_at = now()
    WHERE user_id = v_user_id AND idempotency_key_hash = v_idempotency_hash;
  END IF;
  RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Access Grant RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_quotation_access_grant(
  p_version_id uuid,
  p_derivation_nonce text,
  p_capability_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version RECORD;
  v_grant_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required.';
  END IF;

  SELECT * INTO v_version FROM public.quotation_versions WHERE id = p_version_id;
  IF NOT FOUND OR v_version.status <> 'finalized' THEN
    RAISE EXCEPTION 'INVALID_VERSION: Capability grants can only be issued for finalized quotation versions.';
  END IF;

  -- Revoke existing active grants for this version
  UPDATE public.quotation_access_grants
  SET revoked_at = now(), revoked_by = v_user_id, revocation_reason = 'REISSUED'
  WHERE quotation_version_id = p_version_id AND revoked_at IS NULL;

  -- Create new grant
  INSERT INTO public.quotation_access_grants (
    quotation_id, quotation_version_id, derivation_nonce, capability_token_hash, created_by
  )
  VALUES (
    v_version.quotation_id, p_version_id, p_derivation_nonce, p_capability_token_hash, v_user_id
  )
  RETURNING id INTO v_grant_id;

  INSERT INTO public.quotation_events (quotation_id, version_id, event_type, actor_id, payload)
  VALUES (v_version.quotation_id, p_version_id, 'quotation.capability_issued', v_user_id, jsonb_build_object('grant_id', v_grant_id));

  v_result := jsonb_build_object('success', true, 'grant_id', v_grant_id, 'version_id', p_version_id);
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Client Capability Read RPC (Safe Non-Enumerating)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_quotation_by_capability(p_capability_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant RECORD;
  v_version RECORD;
  v_quotation RECORD;
  v_lead RECORD;
  v_sections jsonb;
  v_items jsonb;
  v_schedule jsonb;
  v_pdf RECORD;
  v_acceptance RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_grant
  FROM public.quotation_access_grants
  WHERE capability_token_hash = p_capability_token_hash AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTATION_NOT_FOUND_OR_FORBIDDEN: Invalid or expired access capability token.';
  END IF;

  SELECT * INTO v_version FROM public.quotation_versions WHERE id = v_grant.quotation_version_id;
  IF NOT FOUND OR v_version.status <> 'finalized' THEN
    RAISE EXCEPTION 'QUOTATION_NOT_FOUND_OR_FORBIDDEN: Target quotation is not in a viewable finalized state.';
  END IF;

  SELECT * INTO v_quotation FROM public.quotations WHERE id = v_grant.quotation_id;
  SELECT * INTO v_lead FROM public.leads WHERE id = v_quotation.lead_id;

  -- Sections and items
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'section_name', s.section_name,
      'section_order', s.section_order,
      'section_subtotal_paise', s.section_subtotal_paise,
      'items', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'item_name', i.item_name,
            'description', i.description,
            'quantity', i.quantity,
            'uom', i.uom,
            'unit_rate_paise', i.unit_rate_paise,
            'line_total_paise', i.line_total_paise
          ) ORDER BY i.item_order
        ) FROM public.quotation_items i WHERE i.section_id = s.id
      )
    ) ORDER BY s.section_order
  ) INTO v_sections
  FROM public.quotation_sections s WHERE s.version_id = v_version.id;

  -- Payment Schedule
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ps.id,
      'milestone_name', ps.milestone_name,
      'milestone_order', ps.milestone_order,
      'percentage', ps.percentage,
      'amount_paise', ps.amount_paise
    ) ORDER BY ps.milestone_order
  ) INTO v_schedule
  FROM public.quotation_payment_schedules ps WHERE ps.version_id = v_version.id;

  -- Check PDF
  SELECT * INTO v_pdf FROM public.quotation_pdf_documents WHERE quotation_version_id = v_version.id AND status = 'ready';

  -- Check Acceptance
  SELECT * INTO v_acceptance FROM public.quotation_acceptances WHERE quotation_id = v_quotation.id;

  v_result := jsonb_build_object(
    'quotation_number', v_quotation.quotation_number,
    'version_number', v_version.version_number,
    'finalized_at', v_version.finalized_at,
    'client_name', v_lead.full_name,
    'client_phone', v_lead.phone,
    'property_details', v_version.property_details_snapshot,
    'subtotal_paise', v_version.subtotal_paise,
    'discount_paise', v_version.discount_paise,
    'taxable_base_paise', v_version.taxable_base_paise,
    'tax_total_paise', v_version.tax_total_paise,
    'grand_total_paise', v_version.grand_total_paise,
    'tax_profile', v_version.tax_profile_snapshot,
    'sections', COALESCE(v_sections, '[]'::jsonb),
    'payment_schedule', COALESCE(v_schedule, '[]'::jsonb),
    'inclusions', v_version.inclusions_snapshot,
    'exclusions', v_version.exclusions_snapshot,
    'terms_and_conditions', v_version.terms_snapshot,
    'has_pdf', (v_pdf.id IS NOT NULL),
    'is_accepted', (v_acceptance.id IS NOT NULL),
    'accepted_at', v_acceptance.accepted_at
  );

  RETURN v_result;
END;
$$;

-- Grant EXECUTE to public/anon/authenticated for capability RPC
GRANT EXECUTE ON FUNCTION public.get_quotation_by_capability(text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 13. Client Acceptance RPC (Atomic Closed-Won)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_quotation_by_capability(
  p_capability_token_hash text,
  p_accepted_by_name text,
  p_accepted_by_email text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant RECORD;
  v_version RECORD;
  v_quotation RECORD;
  v_lead RECORD;
  v_existing_acceptance RECORD;
  v_acceptance_id uuid;
  v_credited_exec_id uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_grant
  FROM public.quotation_access_grants
  WHERE capability_token_hash = p_capability_token_hash AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTATION_NOT_FOUND_OR_FORBIDDEN: Invalid or expired capability token.';
  END IF;

  SELECT * INTO v_version FROM public.quotation_versions WHERE id = v_grant.quotation_version_id FOR UPDATE;
  IF NOT FOUND OR v_version.status <> 'finalized' THEN
    RAISE EXCEPTION 'INVALID_STATE: Target quotation version is not in a finalized state.';
  END IF;

  SELECT * INTO v_quotation FROM public.quotations WHERE id = v_grant.quotation_id FOR UPDATE;
  SELECT * INTO v_lead FROM public.leads WHERE id = v_quotation.lead_id FOR UPDATE;

  -- Check existing acceptance for root
  SELECT * INTO v_existing_acceptance FROM public.quotation_acceptances WHERE quotation_id = v_quotation.id;
  IF FOUND THEN
    IF v_existing_acceptance.quotation_version_id = v_version.id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_accepted', true,
        'accepted_at', v_existing_acceptance.accepted_at,
        'quotation_number', v_quotation.quotation_number
      );
    ELSE
      RAISE EXCEPTION 'CONFLICTING_ACCEPTANCE: A different version of this quotation has already been accepted.';
    END IF;
  END IF;

  -- Snapshot credited sales executive (assigned_to at acceptance instant)
  v_credited_exec_id := v_lead.assigned_to;
  IF v_credited_exec_id IS NULL THEN
    RAISE EXCEPTION 'UNASSIGNED_LEAD: Cannot accept quotation for lead without an assigned Sales Executive.';
  END IF;

  -- Insert acceptance record
  INSERT INTO public.quotation_acceptances (
    quotation_id, lead_id, quotation_version_id, access_grant_id, accepted_by_name, accepted_by_email, credited_sales_executive_id
  )
  VALUES (
    v_quotation.id, v_quotation.lead_id, v_version.id, v_grant.id, p_accepted_by_name, p_accepted_by_email, v_credited_exec_id
  )
  RETURNING id INTO v_acceptance_id;

  -- Append audit event
  INSERT INTO public.quotation_events (quotation_id, version_id, event_type, actor_id, payload)
  VALUES (
    v_quotation.id,
    v_version.id,
    'quotation.accepted',
    v_credited_exec_id,
    jsonb_build_object(
      'accepted_by_name', p_accepted_by_name,
      'credited_sales_executive_id', v_credited_exec_id,
      'taxable_base_paise', v_version.taxable_base_paise,
      'grand_total_paise', v_version.grand_total_paise,
      'accepted_at', now()
    )
  );

  -- Atomic CRM Lead Stage mutation to Closed-Won
  UPDATE public.leads
  SET stage = 'Closed-Won',
      updated_at = now()
  WHERE id = v_quotation.lead_id;

  -- Record stage history audit
  INSERT INTO public.lead_stage_history (lead_id, previous_stage, new_stage, changed_by, reason)
  VALUES (v_quotation.lead_id, v_lead.stage, 'Closed-Won', v_credited_exec_id, 'Client Accepted Commercial Quotation');

  v_result := jsonb_build_object(
    'success', true,
    'acceptance_id', v_acceptance_id,
    'quotation_number', v_quotation.quotation_number,
    'accepted_at', now(),
    'credited_sales_executive_id', v_credited_exec_id,
    'taxable_base_paise', v_version.taxable_base_paise
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_quotation_by_capability(text, text, text, text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 14. Pre-Acceptance Revision Creation RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_quotation_revision(
  p_source_version_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source RECORD;
  v_quotation RECORD;
  v_lead RECORD;
  v_new_version_id uuid;
  v_new_version_num integer;
  v_section RECORD;
  v_new_section_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required.';
  END IF;

  SELECT * INTO v_source FROM public.quotation_versions WHERE id = p_source_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND: Source quotation version does not exist.';
  END IF;

  SELECT * INTO v_quotation FROM public.quotations WHERE id = v_source.quotation_id FOR UPDATE;
  SELECT * INTO v_lead FROM public.leads WHERE id = v_quotation.lead_id;

  -- Check if root has been accepted
  IF EXISTS (SELECT 1 FROM public.quotation_acceptances WHERE quotation_id = v_quotation.id) THEN
    RAISE EXCEPTION 'QUOTATION_ACCEPTED_IMMUTABLE: Cannot create revision after quotation has been client-accepted.';
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version_num
  FROM public.quotation_versions WHERE quotation_id = v_quotation.id;

  -- Clear is_current_draft on prior drafts
  UPDATE public.quotation_versions
  SET is_current_draft = false
  WHERE quotation_id = v_quotation.id AND is_current_draft = true;

  -- Create new draft version
  INSERT INTO public.quotation_versions (
    quotation_id, version_number, status, is_current_draft, created_by,
    property_details_snapshot, discount_mode, discount_percentage, discount_flat_paise,
    tax_profile_id, tax_rate_percentage, subtotal_paise, discount_paise, taxable_base_paise,
    tax_total_paise, grand_total_paise, inclusions_snapshot, exclusions_snapshot, terms_snapshot
  )
  VALUES (
    v_quotation.id, v_new_version_num, 'draft', true, v_user_id,
    v_source.property_details_snapshot, v_source.discount_mode, v_source.discount_percentage, v_source.discount_flat_paise,
    v_source.tax_profile_id, v_source.tax_rate_percentage, v_source.subtotal_paise, v_source.discount_paise, v_source.taxable_base_paise,
    v_source.tax_total_paise, v_source.grand_total_paise, v_source.inclusions_snapshot, v_source.exclusions_snapshot, v_source.terms_snapshot
  )
  RETURNING id INTO v_new_version_id;

  -- Copy sections and items
  FOR v_section IN SELECT * FROM public.quotation_sections WHERE version_id = v_source.id ORDER BY section_order LOOP
    INSERT INTO public.quotation_sections (
      version_id, section_name, section_order, section_subtotal_paise, created_by
    )
    VALUES (
      v_new_version_id, v_section.section_name, v_section.section_order, v_section.section_subtotal_paise, v_user_id
    )
    RETURNING id INTO v_new_section_id;

    INSERT INTO public.quotation_items (
      section_id, version_id, item_name, description, quantity, uom, unit_rate_paise, line_total_paise, item_order, created_by
    )
    SELECT v_new_section_id, v_new_version_id, item_name, description, quantity, uom, unit_rate_paise, line_total_paise, item_order, v_user_id
    FROM public.quotation_items
    WHERE section_id = v_section.id;
  END LOOP;

  -- Copy payment schedules
  INSERT INTO public.quotation_payment_schedules (
    version_id, milestone_name, milestone_order, percentage, amount_paise, created_by
  )
  SELECT v_new_version_id, milestone_name, milestone_order, percentage, amount_paise, v_user_id
  FROM public.quotation_payment_schedules
  WHERE version_id = v_source.id;

  -- Automatically revoke active capability tokens for previous unaccepted versions
  UPDATE public.quotation_access_grants
  SET revoked_at = now(), revoked_by = v_user_id, revocation_reason = 'PRE_ACCEPTANCE_REVISION_CREATED'
  WHERE quotation_id = v_quotation.id AND revoked_at IS NULL;

  -- Append audit events
  INSERT INTO public.quotation_events (quotation_id, version_id, event_type, actor_id, payload)
  VALUES (
    v_quotation.id,
    v_new_version_id,
    'quotation.revision_created',
    v_user_id,
    jsonb_build_object('source_version_id', v_source.id, 'new_version_number', v_new_version_num)
  );

  v_result := jsonb_build_object(
    'success', true,
    'quotation_id', v_quotation.id,
    'new_version_id', v_new_version_id,
    'version_number', v_new_version_num,
    'status', 'draft'
  );

  RETURN v_result;
END;
$$;
