import type {
  CampaignExecutionProvider,
  CampaignProviderCommand,
  CampaignProviderOutcome,
  CampaignProviderReconcileOutcome,
} from "./provider-port.ts";

export type MockCampaignScenario =
  | "success"
  | "transient_failure"
  | "validation_failure"
  | "timeout_unknown"
  | "reconcile_found"
  | "reconcile_not_found";

export class MockCampaignExecutionProvider implements CampaignExecutionProvider {
  public readonly code = "mock" as const;
  public readonly networkRequestCount = 0;
  private readonly scenario: MockCampaignScenario;

  constructor(scenario: MockCampaignScenario = "success") {
    this.scenario = scenario;
  }

  private objectId(command: CampaignProviderCommand): string {
    return `mock-${command.providerChannel}-${command.runReference}`;
  }

  private outcome(command: CampaignProviderCommand): CampaignProviderOutcome {
    if (this.scenario === "transient_failure") {
      return { kind: "transient_failure", errorCode: "MOCK_TRANSIENT" };
    }
    if (this.scenario === "validation_failure") {
      return { kind: "validation_failure", errorCode: "MOCK_VALIDATION" };
    }
    if (this.scenario === "timeout_unknown") {
      return { kind: "timeout_unknown", errorCode: "MOCK_TIMEOUT_UNKNOWN" };
    }
    return {
      kind: "success",
      providerCampaignId: this.objectId(command),
      providerAdSetId: `mock-adset-${command.runTargetReference}`,
      providerAdGroupId: null,
      providerStatus:
        command.operationType === "create"
          ? "CREATED"
          : command.operationType === "pause"
            ? "PAUSED"
            : command.operationType === "cancel"
              ? "CANCELLED"
              : "ACTIVE",
    };
  }

  async create(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.outcome(command);
  }

  async activate(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.outcome(command);
  }

  async pause(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.outcome(command);
  }

  async resume(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.outcome(command);
  }

  async cancel(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.outcome(command);
  }

  async getStatus(command: CampaignProviderCommand): Promise<CampaignProviderReconcileOutcome> {
    if (this.scenario === "reconcile_not_found") {
      return { kind: "not_found", errorCode: "MOCK_NOT_FOUND" };
    }
    return {
      kind: "found",
      providerCampaignId: command.boundProviderCampaignId ?? this.objectId(command),
      providerStatus:
        command.operationType === "create"
          ? "CREATED"
          : command.operationType === "pause"
            ? "PAUSED"
            : command.operationType === "cancel"
              ? "CANCELLED"
              : "ACTIVE",
    };
  }

  async fetchMetrics(): Promise<import("./provider-port.ts").CampaignProviderMetricsOutcome> {
    if (this.scenario === "transient_failure") {
      return { kind: "transient_failure", errorCode: "MOCK_TRANSIENT" };
    }
    return {
      kind: "success",
      snapshot: {
        spendMinor: 0,
        impressions: 0,
        clicks: 0,
        providerConversions: 0,
        currency: "INR",
        providerRevision: "mock",
      },
    };
  }

  buildConversionFeedbackRequest(command: import("../contracts/conversion-feedback.ts").CampaignConversionFeedbackCommand) {
    return {
      event_reference: command.eventReference,
      conversion_type: command.conversionType,
      provider: "mock",
    };
  }

  async submitConversionFeedback() {
    return { kind: "blocked" as const, errorCode: "PROVIDER_DATA_SHARING_GATE_OFF" };
  }
}

export function parseMockScenario(raw: string | null | undefined): MockCampaignScenario {
  switch (raw) {
    case "transient_failure":
    case "validation_failure":
    case "timeout_unknown":
    case "reconcile_found":
    case "reconcile_not_found":
      return raw;
    default:
      return "success";
  }
}
