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
}

export function hasCrmLeadReadAccess(context: CrmAccessContext): boolean {
  return context.canReadBroad || context.canReadAssigned;
}
