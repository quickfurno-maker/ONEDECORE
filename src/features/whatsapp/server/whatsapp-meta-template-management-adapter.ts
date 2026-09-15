import "server-only";

import type {
  WhatsappProviderCallFailure,
  WhatsappProviderTemplateRecord,
  WhatsappTemplateCreateResult,
  WhatsappTemplateGetResult,
  WhatsappTemplateListResult,
} from "../contracts/template-studio.ts";
import type { WhatsappBusinessServerEnv } from "./whatsapp-business-env.ts";
import { classifyMetaDispatchHttpStatus } from "./whatsapp-dispatch-errors.ts";
import { buildMetaGraphUrl } from "./whatsapp-graph-url.ts";
import type { WhatsappTemplateManagementAdapter } from "./whatsapp-template-provider-adapter.ts";

/**
 * WM-2 — official WhatsApp Business Management API adapter for message
 * templates on the configured WABA.
 *
 *   list    GET  /{version}/{waba-id}/message_templates   (cursor paging, bounded)
 *   get     GET  /{version}/{template-id}
 *   create  POST /{version}/{waba-id}/message_templates   (create = submit for review)
 *
 * The Graph version comes from configuration. The bearer token is attached
 * here and nowhere else; it never reaches a snapshot, an error message or the
 * database. Provider rows are bounded before they leave this file, and the raw
 * status/category/quality strings are passed through untouched for the database
 * to normalise — this adapter never decides a template is approved.
 */

export const META_TEMPLATE_FIELDS =
  "id,name,language,status,category,quality_score,parameter_format,components,rejected_reason";

/** At most 20 pages of 100: a WABA is capped far below that by Meta. */
export const META_TEMPLATE_LIST_MAX_PAGES = 20;
const COMPONENTS_MAX_BYTES = 12_000;

type MetaError = { message?: string; type?: string; code?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

/** Normalise one provider template row, or null when it cannot be trusted. */
export function readMetaTemplateRecord(row: unknown): WhatsappProviderTemplateRecord | null {
  if (!isRecord(row)) return null;
  const id = typeof row.id === "string" ? row.id : typeof row.id === "number" ? String(row.id) : null;
  if (!id || !/^[0-9]{1,64}$/.test(id)) return null;
  if (typeof row.name !== "string" || row.name.length < 1 || row.name.length > 128) return null;
  if (typeof row.language !== "string" || !/^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})?$/.test(row.language)) return null;
  const components = Array.isArray(row.components) ? row.components : [];
  if (new TextEncoder().encode(JSON.stringify(components)).length > COMPONENTS_MAX_BYTES) return null;
  const quality = isRecord(row.quality_score) ? row.quality_score.score : row.quality_score;
  return {
    providerTemplateId: id,
    name: row.name,
    language: row.language,
    rawStatus: boundedString(row.status, 64),
    rawCategory: boundedString(row.category, 64),
    rawQualityRating: boundedString(quality, 64),
    parameterFormat: boundedString(row.parameter_format, 16),
    components,
    rejectedReason: boundedString(row.rejected_reason, 256),
  };
}

function failure(status: number | null, error: MetaError | undefined, fallback: string): WhatsappProviderCallFailure {
  const classification = status === null ? "transient" : classifyMetaDispatchHttpStatus(status);
  return {
    kind: "failed",
    errorClass: classification === "terminal" ? "terminal" : "transient",
    code: (error?.type ?? fallback).slice(0, 64),
    message: (error?.message ?? fallback).slice(0, 300),
    httpStatus: status,
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await response.text());
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createMetaWhatsappTemplateManagementAdapter(
  env: WhatsappBusinessServerEnv
): WhatsappTemplateManagementAdapter {
  if (env.mode !== "enabled" || !env.accessToken) {
    throw new Error("[ONEDECORE Meta Template Adapter] enabled mode with credentials required.");
  }
  const accessToken = env.accessToken;
  const headers = { Authorization: `Bearer ${accessToken}` };

  async function get(url: string): Promise<Response | null> {
    try {
      return await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(15_000), redirect: "error" });
    } catch {
      return null;
    }
  }

  return {
    providerCode: "meta",

    async listTemplates({ wabaId }): Promise<WhatsappTemplateListResult> {
      const templates: WhatsappProviderTemplateRecord[] = [];
      let skipped = 0;
      let after: string | undefined;

      for (let page = 0; page < META_TEMPLATE_LIST_MAX_PAGES; page += 1) {
        const url = buildMetaGraphUrl(env.graphApiVersion, [wabaId, "message_templates"], {
          fields: META_TEMPLATE_FIELDS,
          limit: 100,
          after,
        });
        const response = await get(url);
        if (!response) return failure(null, undefined, "network_error");
        const body = await readJson(response);
        if (!response.ok) return failure(response.status, body.error as MetaError | undefined, "meta_template_list_failed");

        for (const row of Array.isArray(body.data) ? body.data : []) {
          const record = readMetaTemplateRecord(row);
          if (record) templates.push(record);
          else skipped += 1;
        }

        const paging = isRecord(body.paging) ? body.paging : {};
        const cursors = isRecord(paging.cursors) ? paging.cursors : {};
        const nextAfter = typeof cursors.after === "string" && /^[A-Za-z0-9_=-]{1,512}$/.test(cursors.after)
          ? cursors.after
          : undefined;
        if (!paging.next || !nextAfter) {
          return { kind: "success", templates, skipped, truncated: false };
        }
        after = nextAfter;
      }
      return { kind: "success", templates, skipped, truncated: true };
    },

    async getTemplate({ providerTemplateId }): Promise<WhatsappTemplateGetResult> {
      const url = buildMetaGraphUrl(env.graphApiVersion, [providerTemplateId], { fields: META_TEMPLATE_FIELDS });
      const response = await get(url);
      if (!response) return failure(null, undefined, "network_error");
      const body = await readJson(response);
      if (!response.ok) return failure(response.status, body.error as MetaError | undefined, "meta_template_get_failed");
      const template = readMetaTemplateRecord(body);
      return template
        ? { kind: "success", template }
        : { kind: "failed", errorClass: "terminal", code: "meta_template_unreadable", message: "Provider template could not be read.", httpStatus: response.status };
    },

    async createTemplate(request): Promise<WhatsappTemplateCreateResult> {
      const url = buildMetaGraphUrl(env.graphApiVersion, [request.wabaId, "message_templates"]);
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: request.name,
            language: request.language,
            category: request.category,
            parameter_format: request.parameterFormat,
            components: request.components,
          }),
          signal: AbortSignal.timeout(20_000),
          redirect: "error",
        });
      } catch (error) {
        // The request may have been received. A create is never retried blind.
        return {
          kind: "ambiguous",
          code: "network_error",
          message: error instanceof Error ? error.message.slice(0, 300) : "Meta network request failed",
          httpStatus: null,
        };
      }

      const body = await readJson(response);
      if (response.ok) {
        const id = typeof body.id === "string" ? body.id : typeof body.id === "number" ? String(body.id) : null;
        if (!id || !/^[0-9]{1,64}$/.test(id)) {
          return { kind: "ambiguous", code: "missing_template_id", message: "Meta accepted the request without a template id.", httpStatus: response.status };
        }
        return {
          kind: "success",
          providerTemplateId: id,
          rawStatus: boundedString(body.status, 64),
          rawCategory: boundedString(body.category, 64),
          httpStatus: response.status,
        };
      }
      if (response.status >= 500) {
        const error = body.error as MetaError | undefined;
        return { kind: "ambiguous", code: (error?.type ?? "meta_ambiguous").slice(0, 64), message: (error?.message ?? "Meta create result ambiguous.").slice(0, 300), httpStatus: response.status };
      }
      return failure(response.status, body.error as MetaError | undefined, "meta_template_create_failed");
    },
  };
}
