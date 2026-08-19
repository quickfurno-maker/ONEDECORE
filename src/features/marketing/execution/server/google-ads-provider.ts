import type { CampaignConversionFeedbackCommand, CampaignConversionFeedbackOutcome } from "../contracts/conversion-feedback.ts";
import type { GoogleAdsProviderConfig } from "./provider-config.ts";
import type {
  CampaignExecutionProvider,
  CampaignProviderCommand,
  CampaignProviderMetricWindow,
  CampaignProviderMetricsOutcome,
  CampaignProviderOutcome,
  CampaignProviderReconcileOutcome,
} from "./provider-port.ts";
import type { ProviderHttpTransport } from "./provider-http.ts";
import { GOOGLE_ADS_API_VERSION } from "./provider-config.ts";
import { googleMicrosToSpendMinor, spendMinorToNumber } from "./money.ts";
import { isProviderDataSharingEnabled } from "./execution-env.ts";

export class GoogleAdsCampaignExecutionProvider implements CampaignExecutionProvider {
  public readonly code = "google_ads" as const;
  private accessToken: string | null = null;
  private readonly config: GoogleAdsProviderConfig;
  private readonly transport: ProviderHttpTransport;
  private readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;

  constructor(
    config: GoogleAdsProviderConfig,
    transport: ProviderHttpTransport,
    env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
  ) {
    this.config = config;
    this.transport = transport;
    this.env = env;
  }

  private customerPath(): string {
    return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${this.config.customerId}`;
  }

  private async bearer(): Promise<string | { kind: "timeout_unknown"; errorCode: string } | { kind: "validation_failure"; errorCode: string }> {
    if (this.accessToken) return this.accessToken;
    try {
      const response = await this.transport.request({
        method: "POST",
        url: "https://oauth2.googleapis.com/token",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });
      if (response.status !== 200) {
        return { kind: "validation_failure", errorCode: "GOOGLE_ADS_AUTH" };
      }
      const parsed = JSON.parse(response.bodyText) as { access_token?: string };
      if (!parsed.access_token) return { kind: "validation_failure", errorCode: "GOOGLE_ADS_AUTH" };
      this.accessToken = parsed.access_token;
      return this.accessToken;
    } catch {
      return { kind: "timeout_unknown", errorCode: "GOOGLE_ADS_TIMEOUT_UNKNOWN" };
    }
  }

  private headers(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "developer-token": this.config.developerToken,
      "Content-Type": "application/json",
    };
    if (this.config.loginCustomerId) {
      headers["login-customer-id"] = this.config.loginCustomerId;
    }
    return headers;
  }

  private async mutateCampaigns(operations: unknown[]): Promise<CampaignProviderOutcome> {
    const token = await this.bearer();
    if (typeof token !== "string") return token;
    try {
      const response = await this.transport.request({
        method: "POST",
        url: `${this.customerPath()}/campaigns:mutate`,
        headers: this.headers(token),
        body: JSON.stringify({ operations }),
      });
      if (response.status === 429 || response.status >= 500) {
        return { kind: "transient_failure", errorCode: "GOOGLE_ADS_TRANSIENT" };
      }
      if (response.status === 401 || response.status === 403) {
        return { kind: "validation_failure", errorCode: "GOOGLE_ADS_AUTH" };
      }
      if (response.status < 200 || response.status >= 300) {
        return { kind: "validation_failure", errorCode: "GOOGLE_ADS_VALIDATION" };
      }
      const parsed = JSON.parse(response.bodyText) as {
        results?: Array<{ resourceName?: string }>;
      };
      const resourceName = parsed.results?.[0]?.resourceName;
      if (!resourceName) return { kind: "validation_failure", errorCode: "GOOGLE_ADS_MISSING_ID" };
      return { kind: "success", providerCampaignId: resourceName, providerStatus: "PAUSED" };
    } catch {
      return { kind: "timeout_unknown", errorCode: "GOOGLE_ADS_TIMEOUT_UNKNOWN" };
    }
  }

  async create(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    const token = await this.bearer();
    if (typeof token !== "string") return token;
    try {
      const budgetResponse = await this.transport.request({
        method: "POST",
        url: `${this.customerPath()}/campaignBudgets:mutate`,
        headers: this.headers(token),
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: `ONEDECORE budget ${command.runReference}`,
                amountMicros: "100000000",
                explicitlyShared: false,
              },
            },
          ],
        }),
      });
      if (budgetResponse.status === 429 || budgetResponse.status >= 500) {
        return { kind: "transient_failure", errorCode: "GOOGLE_ADS_TRANSIENT" };
      }
      if (budgetResponse.status < 200 || budgetResponse.status >= 300) {
        return { kind: "validation_failure", errorCode: "GOOGLE_ADS_VALIDATION" };
      }
      const budgetParsed = JSON.parse(budgetResponse.bodyText) as {
        results?: Array<{ resourceName?: string }>;
      };
      const budgetName = budgetParsed.results?.[0]?.resourceName;
      if (!budgetName) return { kind: "validation_failure", errorCode: "GOOGLE_ADS_MISSING_ID" };
      return this.mutateCampaigns([
        {
          create: {
            name: `ONEDECORE ${command.runReference}`,
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetName,
          },
        },
      ]);
    } catch {
      return { kind: "timeout_unknown", errorCode: "GOOGLE_ADS_TIMEOUT_UNKNOWN" };
    }
  }

  async activate(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "GOOGLE_ADS_OBJECT_REQUIRED" };
    }
    return this.mutateCampaigns([
      {
        updateMask: "status",
        update: { resourceName: command.boundProviderCampaignId, status: "ENABLED" },
      },
    ]);
  }

  async pause(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "GOOGLE_ADS_OBJECT_REQUIRED" };
    }
    return this.mutateCampaigns([
      {
        updateMask: "status",
        update: { resourceName: command.boundProviderCampaignId, status: "PAUSED" },
      },
    ]);
  }

  async resume(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    return this.activate(command);
  }

  async cancel(command: CampaignProviderCommand): Promise<CampaignProviderOutcome> {
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "GOOGLE_ADS_OBJECT_REQUIRED" };
    }
    const result = await this.mutateCampaigns([
      { remove: command.boundProviderCampaignId },
    ]);
    if (result.kind === "success") return { ...result, providerStatus: "REMOVED" };
    return result;
  }

  async getStatus(command: CampaignProviderCommand): Promise<CampaignProviderReconcileOutcome> {
    const token = await this.bearer();
    if (typeof token !== "string") return { kind: "not_found", errorCode: token.errorCode };
    if (!command.boundProviderCampaignId) return { kind: "not_found", errorCode: "GOOGLE_ADS_NOT_FOUND" };
    try {
      const response = await this.transport.request({
        method: "POST",
        url: `${this.customerPath()}/googleAds:search`,
        headers: this.headers(token),
        body: JSON.stringify({
          query: `SELECT campaign.resource_name, campaign.status FROM campaign WHERE campaign.resource_name = '${command.boundProviderCampaignId}'`,
        }),
      });
      if (response.status === 404) return { kind: "not_found", errorCode: "GOOGLE_ADS_NOT_FOUND" };
      const parsed = JSON.parse(response.bodyText) as {
        results?: Array<{ campaign?: { resourceName?: string; status?: string } }>;
      };
      const campaign = parsed.results?.[0]?.campaign;
      if (!campaign?.resourceName) return { kind: "not_found", errorCode: "GOOGLE_ADS_NOT_FOUND" };
      return {
        kind: "found",
        providerCampaignId: campaign.resourceName,
        providerStatus: campaign.status ?? "UNKNOWN",
      };
    } catch {
      return { kind: "not_found", errorCode: "GOOGLE_ADS_TIMEOUT_UNKNOWN" };
    }
  }

  async fetchMetrics(
    command: CampaignProviderCommand,
    window: CampaignProviderMetricWindow
  ): Promise<CampaignProviderMetricsOutcome> {
    const token = await this.bearer();
    if (typeof token !== "string") return token;
    if (!command.boundProviderCampaignId) {
      return { kind: "validation_failure", errorCode: "GOOGLE_ADS_OBJECT_REQUIRED" };
    }
    try {
      const response = await this.transport.request({
        method: "POST",
        url: `${this.customerPath()}/googleAds:search`,
        headers: this.headers(token),
        body: JSON.stringify({
          query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.resource_name = '${command.boundProviderCampaignId}' AND segments.date BETWEEN '${window.windowStartIso.slice(0, 10)}' AND '${window.windowEndIso.slice(0, 10)}'`,
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        return { kind: "transient_failure", errorCode: "GOOGLE_ADS_TRANSIENT" };
      }
      const parsed = JSON.parse(response.bodyText) as {
        results?: Array<{ metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number } }>;
      };
      let impressions = 0;
      let clicks = 0;
      let micros = BigInt(0);
      let conversions = 0;
      for (const row of parsed.results ?? []) {
        impressions += Number(row.metrics?.impressions ?? 0);
        clicks += Number(row.metrics?.clicks ?? 0);
        micros += BigInt(row.metrics?.costMicros ?? "0");
        conversions += Number(row.metrics?.conversions ?? 0);
      }
      return {
        kind: "success",
        snapshot: {
          spendMinor: spendMinorToNumber(googleMicrosToSpendMinor(micros)),
          impressions,
          clicks,
          providerConversions: Math.trunc(conversions),
          currency: "INR",
          providerRevision: `${window.windowStartIso}:${window.windowEndIso}`,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("GOOGLE_ADS")) {
        return { kind: "validation_failure", errorCode: error.message };
      }
      return { kind: "timeout_unknown", errorCode: "GOOGLE_ADS_TIMEOUT_UNKNOWN" };
    }
  }

  buildConversionFeedbackRequest(command: CampaignConversionFeedbackCommand): Record<string, unknown> {
    return {
      conversionAction: "customers/unspecified/conversionActions/onedecore",
      gclid: command.clickId,
      conversionDateTime: command.occurredAt,
      conversionValue: command.valueMinor != null ? command.valueMinor / 100 : undefined,
      currencyCode: command.currency,
      orderId: command.eventReference,
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
