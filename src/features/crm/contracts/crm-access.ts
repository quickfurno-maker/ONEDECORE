/**
 * CRM workspace access context — normalized server-side authorization shape.
 */

export interface CrmAccessContext {
  readonly userId: string;
  readonly email: string | null;
  readonly canReadBroad: boolean;
  readonly canReadAssigned: boolean;
  readonly canReadSources: boolean;
  readonly canReadActivities: boolean;
  readonly canReadConsents: boolean;
  readonly canAssignLeads: boolean;
  readonly canCreateLeads: boolean;
  readonly canOverrideLeadDuplicate: boolean;
  readonly canManageLeadSources: boolean;
  readonly canTransitionLeads: boolean;
  readonly canManageLeadNotes: boolean;
  readonly canManageLeadFollowUps: boolean;
  readonly canBulkImportLeads: boolean;
  readonly canApproveLeadImports: boolean;
  readonly canManageLeadAssignmentRules: boolean;
  readonly canReadSalesTargets: boolean;
  readonly canManageSalesTargets: boolean;
  readonly canReadCrmReporting: boolean;
  readonly canManageCadences: boolean;
  readonly canManageSlaPolicy: boolean;
}

export function hasCrmLeadReadAccess(context: CrmAccessContext): boolean {
  return context.canReadBroad || context.canReadAssigned;
}
