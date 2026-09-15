import "server-only";

import { getCampaignExecutionWorkerSecret } from "../../marketing/execution/server/execution-env.ts";
import { getWhatsappFlowManagementMode, getWhatsappMediaMode, getWhatsappTemplateManagementMode } from "./whatsapp-business-env.ts";
import { getWhatsappClickTrackingMode } from "./whatsapp-click-env.ts";
import { getWhatsappOutboundMode } from "./whatsapp-outbound-env.ts";

/**
 * WM-7 — configuration truth for Settings & Compliance, without secrets. Every
 * surface defaults to `disabled`; `local-test` never reaches Meta. The marketing
 * execution gate itself lives in the database send policy, not here.
 */

export interface WhatsappReadinessRow {
  readonly key: string;
  readonly label: string;
  readonly mode: "disabled" | "local-test" | "enabled" | "configured" | "missing";
  readonly note: string;
}

export function getWhatsappMarketingReadiness(): readonly WhatsappReadinessRow[] {
  const outbound = getWhatsappOutboundMode();
  const workerSecret = (() => {
    try {
      return getCampaignExecutionWorkerSecret() ? "configured" : "missing";
    } catch {
      return "missing";
    }
  })();
  return [
    {
      key: "outbound",
      label: "Outbound sends (kill switch)",
      mode: outbound,
      note: outbound === "disabled" ? "No template or text message reaches Meta; campaigns and automations queue but never send." : "Sends are possible once the database execution gate is also on.",
    },
    {
      key: "worker",
      label: "Internal dispatch worker secret",
      mode: workerSecret,
      note: workerSecret === "configured" ? "The internal worker route accepts a bearer caller (e.g. a scheduler relay)." : "The worker route refuses every call.",
    },
    { key: "templates", label: "Template Studio provider", mode: getWhatsappTemplateManagementMode(), note: "Sync and submission to Meta." },
    { key: "flows", label: "Flows provider", mode: getWhatsappFlowManagementMode(), note: "Create, upload, publish, deprecate and sync official Flows." },
    { key: "media", label: "Inbound media view", mode: getWhatsappMediaMode(), note: "Authorised server proxy for inbound media." },
    { key: "clicks", label: "Click tracking redirect", mode: getWhatsappClickTrackingMode(), note: "When disabled, tracked links redirect home and record nothing." },
  ];
}
