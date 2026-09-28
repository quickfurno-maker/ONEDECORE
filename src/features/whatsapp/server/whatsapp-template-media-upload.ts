import "server-only";

import { safeWhatsappMediaFilename } from "../contracts/media-policy";
import { getWhatsappTemplateManagementServerEnv } from "./whatsapp-business-env";

const MB = 1024 * 1024;
const POLICY = {
  IMAGE: {
    mimeTypes: ["image/jpeg", "image/png"] as const,
    maxBytes: 5 * MB,
    filenameKind: "image" as const,
  },
  VIDEO: {
    mimeTypes: ["video/mp4", "video/3gpp"] as const,
    maxBytes: 16 * MB,
    filenameKind: "video" as const,
  },
  DOCUMENT: {
    mimeTypes: ["application/pdf"] as const,
    maxBytes: 100 * MB,
    filenameKind: "document" as const,
  },
} as const;

export type WhatsappTemplateMediaHeaderType = keyof typeof POLICY;

export type WhatsappTemplateMediaUploadResult =
  | { readonly outcome: "uploaded"; readonly handle: string; readonly message: string }
  | { readonly outcome: "disabled"; readonly message: string }
  | { readonly outcome: "failed"; readonly code: string; readonly message: string };

export interface WhatsappTemplateMediaUploadDeps {
  readonly fetcher?: typeof fetch;
  readonly getEnv?: typeof getWhatsappTemplateManagementServerEnv;
}

function magicMatches(type: WhatsappTemplateMediaHeaderType, mime: string, bytes: Uint8Array): boolean {
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "application/pdf") {
    return bytes.length >= 4 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (type === "VIDEO") {
    return bytes.length >= 12 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  return false;
}

function safeUploadSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("upload:") || value.length > 2048) return null;
  if (
    value.includes(String.fromCharCode(10)) ||
    value.includes(String.fromCharCode(13)) ||
    value.includes("#") ||
    value.includes("://") ||
    value.includes("/")
  ) return null;
  return value;
}

function safeHeaderHandle(value: unknown): string | null {
  return typeof value === "string" &&
    value.startsWith("4::") &&
    value.length >= 20 &&
    value.length <= 4096 &&
    !value.includes(String.fromCharCode(10)) &&
    !value.includes(String.fromCharCode(13))
    ? value
    : null;
}

export async function uploadWhatsappTemplateHeaderMedia(
  input: {
    readonly headerType: string;
    readonly file: File;
  },
  deps: WhatsappTemplateMediaUploadDeps = {}
): Promise<WhatsappTemplateMediaUploadResult> {
  const headerType = input.headerType as WhatsappTemplateMediaHeaderType;
  const policy = POLICY[headerType];
  if (!policy) {
    return { outcome: "failed", code: "TYPE", message: "Choose Image, Video or Document before uploading." };
  }

  const mime = input.file.type.toLowerCase();
  if (!(policy.mimeTypes as readonly string[]).includes(mime)) {
    return { outcome: "failed", code: "MIME", message: "That file type is not supported for this template header." };
  }
  if (input.file.size <= 0 || input.file.size > policy.maxBytes) {
    return { outcome: "failed", code: "SIZE", message: "The selected file is empty or larger than the allowed Meta header limit." };
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (!magicMatches(headerType, mime, bytes)) {
    return { outcome: "failed", code: "CONTENT", message: "The file contents do not match the declared file type." };
  }

  let env;
  try {
    env = (deps.getEnv ?? getWhatsappTemplateManagementServerEnv)();
  } catch {
    return { outcome: "failed", code: "ENV", message: "Template media upload is not configured correctly." };
  }
  if (env.mode === "disabled") {
    return { outcome: "disabled", message: "Template provider mode is off. The file was not uploaded to Meta." };
  }
  if (env.mode === "local-test") {
    return {
      outcome: "uploaded",
      handle: "4::onedecore_local_test_header_handle",
      message: "Local-test media handle prepared. Nothing was uploaded to Meta.",
    };
  }
  if (!env.accessToken || !env.appId) {
    return {
      outcome: "failed",
      code: "ENV",
      message: "META_WHATSAPP_APP_ID and the WhatsApp access token are required for template media upload.",
    };
  }

  const fetcher = deps.fetcher ?? fetch;
  const safeName = safeWhatsappMediaFilename(input.file.name, policy.filenameKind, mime);
  const params = new URLSearchParams({
    file_length: String(bytes.byteLength),
    file_type: mime,
    file_name: safeName,
  });
  const createUrl =
    "https://graph.facebook.com/" +
    env.graphApiVersion +
    "/" +
    env.appId +
    "/uploads?" +
    params.toString();
  let sessionResponse: Response;
  try {
    sessionResponse = await fetcher(createUrl, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.accessToken },
      cache: "no-store",
    });
  } catch {
    return { outcome: "failed", code: "NETWORK", message: "Meta upload session could not be created." };
  }
  const sessionPayload = await sessionResponse.json().catch(() => null) as Record<string, unknown> | null;
  const sessionId = safeUploadSessionId(sessionPayload?.id);
  if (!sessionResponse.ok || !sessionId) {
    return { outcome: "failed", code: "SESSION", message: "Meta did not create a valid upload session." };
  }

  const uploadUrl =
    "https://graph.facebook.com/" + env.graphApiVersion + "/" + sessionId;
  let uploadResponse: Response;
  try {
    uploadResponse = await fetcher(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.accessToken,
        "Content-Type": mime,
        file_offset: "0",
      },
      body: bytes,
      cache: "no-store",
    });
  } catch {
    return { outcome: "failed", code: "NETWORK", message: "The file could not be uploaded to Meta." };
  }
  const uploadPayload = await uploadResponse.json().catch(() => null) as Record<string, unknown> | null;
  const handle = safeHeaderHandle(uploadPayload?.h);
  if (!uploadResponse.ok || !handle) {
    return { outcome: "failed", code: "UPLOAD", message: "Meta did not return a valid template media handle." };
  }

  return {
    outcome: "uploaded",
    handle,
    message: "Header sample uploaded to Meta. The handle is ready for template review submission.",
  };
}
