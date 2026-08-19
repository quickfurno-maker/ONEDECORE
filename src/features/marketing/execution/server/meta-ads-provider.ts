import type { CampaignConversionFeedbackCommand, CampaignConversionFeedbackOutcome } from "../contracts/conversion-feedback.ts";
import { selectMetaCapiIdentifiers } from "../contracts/click-identifiers.ts";
import { CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE } from "../contracts/approved-execution-spec.ts";
import { buildMetaPausedCreatePlan } from "../domain/meta-paused-plan.ts";
import type { MetaAdsProviderConfig } from "./provider-config.ts";
import type {
  CampaignExecutionProvider,
  CampaignProviderCommand,
  CampaignProviderMetricWindow,
  CampaignProviderMetricsOutcome,
  CampaignProviderOutcome,
  CampaignProviderReconcileOutcome,
} from "./provider-port.ts";
import type { ProviderHttpTransport } from "./provider-http.ts";
import { isProviderDataSharingEnabled } from "./execution-env.ts";

function classifyMetaStatus(status: number, body: string): CampaignProviderOutcome {
  if (status === 400 || status === 422) {
    return { kind: "validation_failure", errorCode: "META_VALIDATION" };
  }
  if (status === 401 || status === 403) {
    return { kind: "validation_failure", errorCode: "META_AUTH" };
  }
  if (status === 429 || status >= 500) {
    return { kind: "transient_failure", errorCode: "META_TRANSIENT" };
  }
  if (status >= 200 && status < 300) {
    try {
      const parsed = JSON.parse(body) as { id?: string; campaign_id?: string };
      const id = parsed.id ?? parsed.campaign_id;
      if (!id) return { kind: "validation_failure", errorCode: "META_MISSING_ID" };
      return {
        kind: "success",
        providerCampaignId: String(id),
        providerStatus: "PAUSED",
      };
    } catch {
      return { kind: "validation_failure", errorCode: "META_INVALID_JSON" };
    }
  }
  return { kind: "validation_failure", errorCode: "META_HTTP" };
}

export class MetaAdsCampaignExecutionProvider implements CampaignExecutionProvider {
  public readonly code = "meta_ads" as const;
  private readonly config: MetaAdsProviderConfig;
  private readonly transport: ProviderHttpTransport;
  private readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;

  constructor(
    config: MetaAdsProviderConfig,
    transport: ProviderHttpTransport,
    env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
  ) {
    this.config = config;
    this.transport = transport;
    this.env = env;
  }

  private accountPath(): string {
    const id = this.config.adAccountId.replace(/^act_/, "");
    return `https://graph.facebook.com/${this.config.graphVersion}/act_${id}`;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.accessToken}` };
  }

  private async mutate(
    url: string,
    params: Record<string, string>
  ): Promise<CampaignProviderOutcome> {
    try {
      const body = new URLSearchParams(params).toString();
      const response = await this.transport.request({
        method: "POST",
        url,
        headers: {
          ...this.authHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      return classifyMetaStatus(response.status, response.bodyText);
    } catch {
      return { kind: "timeout_unknown", errorCode: "META_TIMEOUT_UNKNOWN" };
    }
  }

  async create(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.approvedSpec) {
      return { kind: "validation_failure", errorCode: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
    }
    if (!this.config.pageId) {
      return { kind: "validation_failure", errorCode: "CAMPAIGN_PROVIDER_CONFIG_MISSING" };
    }
    const planned = buildMetaPausedCreatePlan(command.approvedSpec, { pageId: this.config.pageId });
    if (!planned.ok) {
      return { kind: "validation_failure", errorCode: planned.code };
    }
    const result = await this.mutate(`${this.accountPath()}${planned.plan.urlPath}`, planned.plan.params);
    if (result.kind === "success") {
      return { ...result, providerStatus: "PAUSED" };
    }
    return result;
  }

  async activate(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "META_OBJECT_REQUIRED" };
    }
    return this.mutate(
      `https://graph.facebook.com/${this.config.graphVersion}/${command.boundProviderCampaignId}`,
      { status: "ACTIVE" }
    );
  }

  async pause(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "META_OBJECT_REQUIRED" };
    }
    return this.mutate(
      `https://graph.facebook.com/${this.config.graphVersion}/${command.boundProviderCampaignId}`,
      { status: "PAUSED" }
    );
  }

  async resume(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.activate(command);
  }

  async cancel(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "META_OBJECT_REQUIRED" };
    }
    const result = await this.mutate(
      `https://graph.facebook.com/${this.config.graphVersion}/${command.boundProviderCampaignId}`,
      { status: "PAUSED" }
    );
    if (result.kind === "success") return { ...result, providerStatus: "CANCELLED" };
    return result;
  }

  async getStatus(command: CampaignProviderCommand): Promise<CampaignProviderReconcileOutcome> {
    const id = command.boundProviderCampaignId;
    if (!id) return { kind: "not_found", errorCode: "META_NOT_FOUND" };
    try {
      const response = await this.transport.request({
        method: "GET",
        url: `https://graph.facebook.com/${this.config.graphVersion}/${id}?fields=id,status,effective_status`,
        headers: this.authHeaders(),
      });
      if (response.status === 404) return { kind: "not_found", errorCode: "META_NOT_FOUND" };
      if (response.status === 401 || response.status === 403) {
        return { kind: "auth_config", errorCode: "META_AUTH" };
      }
      if (response.status === 429 || response.status >= 500) {
        return { kind: "transient", errorCode: "META_TRANSIENT" };
      }
      if (response.status < 200 || response.status >= 300) {
        return { kind: "auth_config", errorCode: "META_STATUS" };
      }
      const parsed = JSON.parse(response.bodyText) as { id?: string; status?: string };
      if (!parsed.id) return { kind: "not_found", errorCode: "META_NOT_FOUND" };
      return { kind: "found", providerCampaignId: parsed.id, providerStatus: parsed.status ?? "UNKNOWN" };
    } catch {
      return { kind: "timeout_unknown", errorCode: "META_TIMEOUT_UNKNOWN" };
    }
  }

  async fetchMetrics(
    command: CampaignProviderCommand,
    window: CampaignProviderMetricWindow
  ): Promise<CampaignProviderMetricsOutcome> {
    const id = command.boundProviderCampaignId;
    if (!id) return { kind: "validation_failure", errorCode: "META_OBJECT_REQUIRED" };
    try {
      const since = window.windowStartIso.slice(0, 10);
      const until = window.windowEndIso.slice(0, 10);
      const url = `https://graph.facebook.com/${this.config.graphVersion}/${id}/insights?fields=impressions,clicks,spend,actions&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
      const response = await this.transport.request({ method: "GET", url, headers: this.authHeaders() });
      if (response.status === 429 || response.status >= 500) {
        return { kind: "transient_failure", errorCode: "META_TRANSIENT" };
      }
      const parsed = JSON.parse(response.bodyText) as {
        data?: Array<{ impressions?: string; clicks?: string; spend?: string; actions?: Array<{ action_type?: string; value?: string }> }>;
      };
      const row = parsed.data?.[0];
      const spend = String(row?.spend ?? "0");
      const [whole, fraction = ""] = spend.split(".");
      const spendMinor = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
      if (!Number.isInteger(spendMinor) || spendMinor < 0) {
        return { kind: "validation_failure", errorCode: "META_SPEND_INVALID" };
      }
      return {
        kind: "success",
        snapshot: {
          spendMinor,
          impressions: Number(row?.impressions ?? 0),
          clicks: Number(row?.clicks ?? 0),
          providerConversions: Number(row?.actions?.find((a) => a.action_type === "lead")?.value ?? 0),
          currency: "INR",
          providerRevision: `${since}:${until}`,
        },
      };
    } catch {
      return { kind: "timeout_unknown", errorCode: "META_TIMEOUT_UNKNOWN" };
    }
  }

  buildConversionFeedbackRequest(command: CampaignConversionFeedbackCommand): Record<string, unknown> {
    const datasetId = command.pixelOrDatasetId ?? this.config.datasetId;
    if (!datasetId) {
      return { errorCode: "CAMPAIGN_CONVERSION_DATASET_MISSING" };
    }
    const capi = selectMetaCapiIdentifiers(command.clickIdentifiers);
    const userData: Record<string, string> = {};
    if (capi.fbc) userData.fbc = capi.fbc;
    if (capi.fbp) userData.fbp = capi.fbp;
    return {
      dataset_id: datasetId,
      event_name: command.conversionType,
      event_time: command.occurredAt,
      event_id: command.eventReference,
      action_source: "website",
      user_data: userData,
      custom_data:
        command.valueMinor != null
          ? { currency: command.currency, value: command.valueMinor / 100 }
          : {},
    };
  }

  async submitConversionFeedback(
    command: CampaignConversionFeedbackCommand
  ): Promise<CampaignConversionFeedbackOutcome> {
    if (!isProviderDataSharingEnabled(this.env)) {
      return { kind: "blocked", errorCode: "PROVIDER_DATA_SHARING_GATE_OFF" };
    }
    void command;
    return { kind: "blocked", errorCode: "PROVIDER_CUSTOMER_DATA_TRANSPORT_BLOCKED_IN_9C_C" };
  }
}
