/**
 * Phase 9A migration-independent — campaign role/capability rules.
 */

import type { CrmRoleCode } from "../../crm/contracts/permissions.ts";

export interface CampaignActorContext {
  readonly profileId: string;
  readonly role: CrmRoleCode;
  readonly isCampaignRequester: boolean;
  readonly isCampaignApprover: boolean;
}

export interface CampaignPermissionCapabilities {
  readonly canCreateCampaignDraft: boolean;
  readonly canEditCampaignDraft: boolean;
  readonly canRequestCampaignApproval: boolean;
  readonly canApproveCampaign: boolean;
  readonly canPublishLater: boolean;
  readonly canBulkExecuteCampaign: boolean;
}

const CAMPAIGN_DRAFT_ROLES = new Set<CrmRoleCode>(["super_admin", "sales_manager"]);

export function resolveCampaignPermissionCapabilities(
  actor: CampaignActorContext
): CampaignPermissionCapabilities {
  const canDraft = CAMPAIGN_DRAFT_ROLES.has(actor.role);
  const isSuperAdmin = actor.role === "super_admin";

  const canApprove =
    isSuperAdmin ||
    (actor.isCampaignApprover && !actor.isCampaignRequester);

  return {
    canCreateCampaignDraft: canDraft,
    canEditCampaignDraft: canDraft,
    canRequestCampaignApproval: canDraft,
    canApproveCampaign: canApprove,
    canPublishLater: isSuperAdmin,
    canBulkExecuteCampaign: isSuperAdmin,
  };
}

export function canSelfApproveCampaign(actor: CampaignActorContext): boolean {
  if (actor.role !== "sales_manager") return false;
  return actor.isCampaignRequester && actor.isCampaignApprover;
}
