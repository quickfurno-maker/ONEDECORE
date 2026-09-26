export const WHATSAPP_TEMPLATE_DRAFT_STATUSES = [
  "local_draft",
  "locally_reviewed",
  "archived",
] as const;

export type WhatsappTemplateDraftStatus =
  (typeof WHATSAPP_TEMPLATE_DRAFT_STATUSES)[number];

export interface WhatsappTemplateDraftItem {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly category: "UTILITY" | "MARKETING";
  readonly parameterFormat: "POSITIONAL";
  readonly components: readonly unknown[];
  readonly workflowStatus: WhatsappTemplateDraftStatus;
  readonly sourcePresetId: string | null;
  readonly lockVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WhatsappTemplateDraftQuery {
  readonly status: WhatsappTemplateDraftStatus | null;
  readonly category: "UTILITY" | "MARKETING" | null;
  readonly language: string | null;
  readonly q: string | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface WhatsappTemplateDraftPage {
  readonly items: readonly WhatsappTemplateDraftItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseWhatsappTemplateDraftItem(value: unknown): WhatsappTemplateDraftItem {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.language !== "string" ||
    (value.category !== "UTILITY" && value.category !== "MARKETING") ||
    value.parameter_format !== "POSITIONAL" ||
    !Array.isArray(value.components) ||
    !(WHATSAPP_TEMPLATE_DRAFT_STATUSES as readonly unknown[]).includes(value.workflow_status) ||
    !Number.isInteger(Number(value.lock_version)) ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error("template draft returned an unexpected payload");
  }
  return {
    id: value.id,
    name: value.name,
    language: value.language,
    category: value.category,
    parameterFormat: "POSITIONAL",
    components: value.components,
    workflowStatus: value.workflow_status as WhatsappTemplateDraftStatus,
    sourcePresetId: str(value.source_preset_id),
    lockVersion: Number(value.lock_version),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function parseWhatsappTemplateDraftPage(payload: unknown): WhatsappTemplateDraftPage {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("template draft list returned an unexpected payload");
  }
  const totalCount = Number(payload.total_count);
  const page = Number(payload.page);
  const pageSize = Number(payload.page_size);
  if (
    !Number.isInteger(totalCount) ||
    totalCount < 0 ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    throw new Error("template draft list returned invalid paging");
  }
  return {
    items: payload.items.map(parseWhatsappTemplateDraftItem),
    totalCount,
    page,
    pageSize,
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseWhatsappTemplateDraftQuery(
  params: Record<string, string | string[] | undefined>
): WhatsappTemplateDraftQuery {
  const statusRaw = first(params.draftStatus);
  const categoryRaw = first(params.draftCategory);
  const languageRaw = first(params.language)?.trim() ?? "";
  const qRaw = first(params.draftQ)?.trim() ?? "";
  const pageRaw = Number(first(params.draftPage) ?? "1");
  return {
    status: (WHATSAPP_TEMPLATE_DRAFT_STATUSES as readonly string[]).includes(statusRaw ?? "")
      ? (statusRaw as WhatsappTemplateDraftStatus)
      : null,
    category:
      categoryRaw === "UTILITY" || categoryRaw === "MARKETING" ? categoryRaw : null,
    language: /^[a-z]{2,3}(_[A-Z]{2})?$/.test(languageRaw) ? languageRaw : null,
    q: qRaw ? qRaw.slice(0, 128) : null,
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10000) : 1,
    pageSize: 25,
  };
}


export interface WhatsappTemplateStatusTimelineItem {
  readonly id: number;
  readonly templateId: string | null;
  readonly templateName: string;
  readonly source: string;
  readonly eventKind: string;
  readonly status: string | null;
  readonly category: string | null;
  readonly qualityRating: string | null;
  readonly errorCode: string | null;
  readonly occurredAt: string;
}

export function parseWhatsappTemplateStatusTimeline(
  payload: unknown
): readonly WhatsappTemplateStatusTimelineItem[] {
  if (!Array.isArray(payload)) {
    throw new Error("template status timeline returned an unexpected payload");
  }
  return payload.map((value) => {
    if (
      !isRecord(value) ||
      !Number.isInteger(Number(value.id)) ||
      typeof value.template_name !== "string" ||
      typeof value.source !== "string" ||
      typeof value.event_kind !== "string" ||
      typeof value.occurred_at !== "string"
    ) {
      throw new Error("template status timeline returned an invalid row");
    }
    return {
      id: Number(value.id),
      templateId: str(value.template_id),
      templateName: value.template_name,
      source: value.source,
      eventKind: value.event_kind,
      status: str(value.status),
      category: str(value.category),
      qualityRating: str(value.quality_rating),
      errorCode: str(value.error_code),
      occurredAt: value.occurred_at,
    };
  });
}
