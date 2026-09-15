import "server-only";

import type { WhatsappBusinessServerEnv } from "./whatsapp-business-env.ts";
import { classifyMetaDispatchHttpStatus } from "./whatsapp-dispatch-errors.ts";
import { buildMetaGraphUrl } from "./whatsapp-graph-url.ts";

/**
 * WM-6 — official WhatsApp Flows API port (WhatsApp Business Management API).
 *
 *   create    POST /{version}/{waba-id}/flows            {name, categories}
 *   upload    POST /{version}/{flow-id}/assets           multipart flow.json, asset_type FLOW_JSON
 *   publish   POST /{version}/{flow-id}/publish
 *   deprecate POST /{version}/{flow-id}/deprecate
 *   get       GET  /{version}/{flow-id}?fields=id,name,status,categories,validation_errors
 *
 * The bearer token is attached here only. A mutation whose answer is lost is
 * `ambiguous` and is never retried blind; the database then needs a sync. The
 * fake adapter never publishes anything: a local-test Flow stays DRAFT.
 */

export type WhatsappFlowProviderResult =
  | {
      readonly kind: "success";
      readonly providerFlowId: string | null;
      readonly rawStatus: string | null;
      readonly validationErrors: readonly unknown[] | null;
    }
  | { readonly kind: "failed"; readonly code: string; readonly message: string; readonly validationErrors: readonly unknown[] | null }
  | { readonly kind: "ambiguous"; readonly code: string; readonly message: string };

export interface WhatsappFlowProviderAdapter {
  readonly providerCode: "meta" | "fake";
  createFlow(request: { readonly wabaId: string; readonly name: string; readonly categories: readonly string[] }): Promise<WhatsappFlowProviderResult>;
  uploadFlowJson(request: { readonly providerFlowId: string; readonly flowJson: unknown }): Promise<WhatsappFlowProviderResult>;
  publishFlow(request: { readonly providerFlowId: string }): Promise<WhatsappFlowProviderResult>;
  deprecateFlow(request: { readonly providerFlowId: string }): Promise<WhatsappFlowProviderResult>;
  getFlow(request: { readonly providerFlowId: string }): Promise<WhatsappFlowProviderResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validation errors are kept bounded: at most 20 entries of allowlisted scalar fields. */
export function boundMetaFlowValidationErrors(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).map((entry) => {
    if (!isRecord(entry)) return { error: "unreadable" };
    const out: Record<string, string | number> = {};
    for (const key of ["error", "error_type", "message", "line_start", "line_end", "column_start", "column_end"]) {
      const field = entry[key];
      if (typeof field === "string") out[key] = field.slice(0, 160);
      else if (typeof field === "number" && Number.isFinite(field)) out[key] = field;
    }
    return out;
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await response.text());
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function idFrom(value: unknown): string | null {
  const id = typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
  return id && /^[0-9]{1,64}$/.test(id) ? id : null;
}

export function createMetaWhatsappFlowProviderAdapter(env: WhatsappBusinessServerEnv): WhatsappFlowProviderAdapter {
  if (env.mode !== "enabled" || !env.accessToken) {
    throw new Error("[ONEDECORE Meta Flow Adapter] enabled mode with credentials required.");
  }
  const authorization = { Authorization: `Bearer ${env.accessToken}` };

  async function mutate(url: string, body: BodyInit, contentType: string | null): Promise<WhatsappFlowProviderResult & { body?: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: contentType ? { ...authorization, "Content-Type": contentType } : authorization,
        body,
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
    } catch {
      return { kind: "ambiguous", code: "network_error", message: "The Flows API request may have been received." };
    }
    const json = await readJson(response);
    const error = isRecord(json.error) ? json.error : {};
    if (response.ok) {
      return {
        kind: "success",
        providerFlowId: idFrom(json.id),
        rawStatus: typeof json.status === "string" ? json.status.slice(0, 64) : null,
        validationErrors: boundMetaFlowValidationErrors(json.validation_errors),
        body: json,
      };
    }
    if (response.status >= 500) {
      return { kind: "ambiguous", code: String(error.type ?? "meta_ambiguous").slice(0, 64), message: "Meta's answer was unclear." };
    }
    return {
      kind: "failed",
      code: String(error.type ?? (classifyMetaDispatchHttpStatus(response.status) === "terminal" ? "meta_flow_rejected" : "meta_flow_transient")).slice(0, 64),
      message: String(error.message ?? "Meta rejected the Flow request.").slice(0, 300),
      validationErrors: boundMetaFlowValidationErrors(isRecord(error.error_data) ? error.error_data.details : null),
    };
  }

  return {
    providerCode: "meta",

    async createFlow({ wabaId, name, categories }) {
      const result = await mutate(
        buildMetaGraphUrl(env.graphApiVersion, [wabaId, "flows"]),
        JSON.stringify({ name, categories }),
        "application/json"
      );
      if (result.kind === "success" && !result.providerFlowId) {
        return { kind: "ambiguous", code: "missing_flow_id", message: "Meta accepted the request without a Flow id." };
      }
      return result;
    },

    async uploadFlowJson({ providerFlowId, flowJson }) {
      const form = new FormData();
      form.append("name", "flow.json");
      form.append("asset_type", "FLOW_JSON");
      form.append("file", new Blob([JSON.stringify(flowJson)], { type: "application/json" }), "flow.json");
      return mutate(buildMetaGraphUrl(env.graphApiVersion, [providerFlowId, "assets"]), form, null);
    },

    async publishFlow({ providerFlowId }) {
      return mutate(buildMetaGraphUrl(env.graphApiVersion, [providerFlowId, "publish"]), "", "application/json");
    },

    async deprecateFlow({ providerFlowId }) {
      return mutate(buildMetaGraphUrl(env.graphApiVersion, [providerFlowId, "deprecate"]), "", "application/json");
    },

    async getFlow({ providerFlowId }) {
      let response: Response;
      try {
        response = await fetch(
          buildMetaGraphUrl(env.graphApiVersion, [providerFlowId], { fields: "id,name,status,categories,validation_errors" }),
          { method: "GET", headers: authorization, signal: AbortSignal.timeout(15_000), redirect: "error" }
        );
      } catch {
        return { kind: "failed", code: "network_error", message: "The Flows API could not be reached.", validationErrors: null };
      }
      const json = await readJson(response);
      if (!response.ok) {
        const error = isRecord(json.error) ? json.error : {};
        return { kind: "failed", code: String(error.type ?? "meta_flow_get_failed").slice(0, 64), message: "Meta did not return the Flow.", validationErrors: null };
      }
      return {
        kind: "success",
        providerFlowId: idFrom(json.id),
        rawStatus: typeof json.status === "string" ? json.status.slice(0, 64) : null,
        validationErrors: boundMetaFlowValidationErrors(json.validation_errors) ?? [],
      };
    },
  };
}

/**
 * local-test only. Creates DRAFT Flows with synthetic ids in process memory
 * and accepts JSON uploads, but refuses to publish: nothing here can make a
 * Flow look live when Meta was never called.
 */
export function createFakeWhatsappFlowProviderAdapter(store: Map<string, { status: string }>): WhatsappFlowProviderAdapter {
  return {
    providerCode: "fake",
    async createFlow() {
      const id = `9${String(Date.now()).slice(-12)}${String(store.size).padStart(3, "0")}`;
      store.set(id, { status: "DRAFT" });
      return { kind: "success", providerFlowId: id, rawStatus: "DRAFT", validationErrors: [] };
    },
    async uploadFlowJson({ providerFlowId }) {
      return store.has(providerFlowId)
        ? { kind: "success", providerFlowId, rawStatus: null, validationErrors: [] }
        : { kind: "failed", code: "fake_flow_not_found", message: "Unknown local-test Flow.", validationErrors: null };
    },
    async publishFlow() {
      return { kind: "failed", code: "fake_provider_cannot_publish", message: "local-test never publishes a Flow.", validationErrors: null };
    },
    async deprecateFlow() {
      return { kind: "failed", code: "fake_provider_cannot_deprecate", message: "local-test Flows are never published.", validationErrors: null };
    },
    async getFlow({ providerFlowId }) {
      const flow = store.get(providerFlowId);
      return flow
        ? { kind: "success", providerFlowId, rawStatus: flow.status, validationErrors: [] }
        : { kind: "failed", code: "fake_flow_not_found", message: "Unknown local-test Flow.", validationErrors: null };
    },
  };
}
