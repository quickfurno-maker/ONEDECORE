export interface WhatsappCrmLeadCandidate {
  readonly leadId: string;
  readonly name: string;
  readonly status: string;
  readonly service: string;
  readonly locality: string | null;
  readonly ownerLabel: string;
  readonly salesBucket: "HOT" | "WARM" | "COLD" | "LOST";
  readonly phoneMatch: boolean;
  readonly createdAt: string;
}

export interface WhatsappCrmLinkResult {
  readonly outcomeCode: "linked" | "already_linked";
  readonly leadId: string;
  readonly contactId: string;
  readonly phoneMatch: boolean;
}

export interface WhatsappCrmResolutionActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly candidates?: readonly WhatsappCrmLeadCandidate[];
  readonly leadId?: string;
  readonly requiresExistingLeadResolution?: boolean;
}

export const WHATSAPP_CRM_INITIAL_ACTION_STATE: WhatsappCrmResolutionActionState = {
  success: false,
  message: "",
};
