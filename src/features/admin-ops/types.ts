export interface OpsNavFlags {
  readonly crm: boolean;
  readonly quotations: boolean;
  readonly projects: boolean;
  readonly whatsapp: boolean;
  readonly campaigns: boolean;
  readonly landingLab: boolean;
  readonly commerce: boolean;
  readonly staff: boolean;
  readonly attendance: boolean;
  readonly leave: boolean;
  readonly crmLeads: boolean;
  readonly crmTargets: boolean;
  readonly crmReports: boolean;
  readonly crmImports: boolean;
  readonly crmAssignmentRules: boolean;
  readonly createLead: boolean;
  readonly createQuotation: boolean;
  readonly commerceCatalog: boolean;
  readonly commerceInventory: boolean;
  readonly commerceSettings: boolean;
}

export interface OpsIdentity {
  readonly userId: string;
  readonly email: string | null;
  readonly displayName: string;
  readonly firstName: string;
  readonly roleLabel: string | null;
}

export interface OpsCommandRoute {
  readonly href: string;
  readonly label: string;
  readonly group: string;
}

export interface OpsAttentionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly actionLabel: string;
  readonly tone: "urgent" | "attention" | "info";
}

export interface OpsKpiItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly context: string;
  readonly href: string;
  readonly accent: "purple" | "warning" | "blue" | "teal" | "positive" | "gold";
  readonly sparkline: readonly number[] | null;
}

export interface OpsPipelineStage {
  readonly status: string;
  readonly label: string;
  readonly count: number;
}

export interface OpsSourceSlice {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface OpsActivityItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly occurredAt: string;
}

export interface OpsRecentLead {
  readonly id: string;
  readonly name: string;
  readonly requirement: string;
  readonly locality: string;
  readonly status: string;
  readonly source: string;
  readonly assignee: string;
  readonly createdAt: string;
}

export interface OpsTargetCard {
  readonly month: string;
  readonly revenueLabel: string;
  readonly closedWonCountTarget: number;
  readonly notice: string;
}
