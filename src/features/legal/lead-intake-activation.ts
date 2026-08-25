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
 * Production activation input consumed by getLeadIntakeServerEnv.
 * All approval/decision flags remain false until owner evidence is recorded.
 */
export const LEAD_INTAKE_ACTIVATION: LeadIntakeActivationInput = {
  privacyTermsVersionApproved: false,
  serviceEnquiryCopyApproved: false,
  serviceCommunicationCopyApproved: false,
  /** Owner approved MVP retention recommendations 2026-08-25 (see retention-matrix). */
  leadRetentionDecided: true,
  consentRetentionDecided: true,
  auditRetentionDecided: true,
  suppressionRetentionDecided: true,
  /** Remains false until processor register is complete enough for lead data. */
  leadProcessorsRegistered: false,
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
