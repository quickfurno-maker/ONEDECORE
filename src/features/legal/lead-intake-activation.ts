/**
 * Canonical lead-intake production activation decision source.
 *
 * Fail-closed by default. Owner/legal facts and approvals must be recorded
 * here (and in BUSINESS_IDENTITY) before ONEDECORE_LEAD_INTAKE_MODE=enabled
 * can succeed. Generic business completeness alone must never activate intake.
 *
 * Do not invent owner values in this module.
 */
import {
  getMissingLeadIntakeActivationFields,
  type LeadIntakeActivationInput,
} from "./business-identity.ts";

/**
 * Owner approval of Privacy/Terms/consent customer copy recorded 2026-08-25
 * against reviewed head 2609bbca1ba661989fd0e8f468b0724a47adcd5d (PR #92).
 * This is OWNER approval only — not counsel approval.
 *
 * leadProcessorsRegistered set true 2026-08-25 after verified Supabase + Hostinger
 * processor evidence and owner attestation (PR #92).
 */
export const LEAD_INTAKE_ACTIVATION: LeadIntakeActivationInput = {
  privacyTermsVersionApproved: true,
  serviceEnquiryCopyApproved: true,
  serviceCommunicationCopyApproved: true,
  /** Owner approved MVP retention recommendations 2026-08-25 (see retention-matrix). */
  leadRetentionDecided: true,
  consentRetentionDecided: true,
  auditRetentionDecided: true,
  suppressionRetentionDecided: true,
  /** Verified Supabase + Hostinger processor register complete 2026-08-25. */
  leadProcessorsRegistered: true,
};

export function getLeadIntakeActivationMissingFields(
  input: LeadIntakeActivationInput = LEAD_INTAKE_ACTIVATION
): readonly string[] {
  return getMissingLeadIntakeActivationFields(input);
}

export function isLeadIntakeActivationComplete(
  input: LeadIntakeActivationInput = LEAD_INTAKE_ACTIVATION
): boolean {
  return getLeadIntakeActivationMissingFields(input).length === 0;
}
