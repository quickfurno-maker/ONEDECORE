/**
 * Phase 9A — campaign role/capability rules (ADR-0027). Database remains authority.
 */

import type { CrmRoleCode } from "../../crm/contracts/permissions.ts";

export interface CampaignActorContext {
  readonly profileId: string;
  readonly role: CrmRoleCode;
  readonly isVersionCreator: boolean;
  readonly isVersionRequester: boolean;
  /** @deprecated Use isVersionRequester / isVersionCreator. */
  readonly isCampaignRequester?: boolean;
  /** @deprecated Approval is a permission plus self-approval denial. */
  readonly isCampaignApprover?: boolean;
}

export interface CampaignPermissionCapabilities {
  readonly canReadCampaign: boolean;
  readonly canCreateCampaignDraft: boolean;
  readonly canEditCampaignDraft: boolean;
  readonly canRequestCampaignApproval: boolean;
  readonly canApproveCampaign: boolean;
  readonly canManageMarketingConsent: boolean;
}

const CAMPAIGN_STAFF_ROLES = new Set<CrmRoleCode>(["super_admin", "sales_manager"]);

export function isCampaignSelfApproval(actor: CampaignActorContext): boolean {
  if (actor.role !== "sales_manager") return false;
  const isCreator = actor.isVersionCreator;
  const isRequester = actor.isVersionRequester || actor.isCampaignRequester === true;
  return isCreator || isRequester;
}

export function canApproveCampaignVersion(actor: CampaignActorContext): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.role !== "sales_manager") return false;
  return !isCampaignSelfApproval(actor);
}

export function resolveCampaignPermissionCapabilities(
  actor: CampaignActorContext
): CampaignPermissionCapabilities {
  const canStaff = CAMPAIGN_STAFF_ROLES.has(actor.role);
  return {
    canReadCampaign: canStaff,
    canCreateCampaignDraft: canStaff,
    canEditCampaignDraft: canStaff,
    canRequestCampaignApproval: canStaff,
    canApproveCampaign: canApproveCampaignVersion(actor),
    canManageMarketingConsent: canStaff,
  };
}
