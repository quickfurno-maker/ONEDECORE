/**
 * Provider dispatch error classification for Meta WhatsApp Cloud API.
 */

export type MetaDispatchHttpClassification = "transient" | "terminal" | "ambiguous";

export function classifyMetaDispatchHttpStatus(
  status: number
): MetaDispatchHttpClassification {
  if (status === 408 || status === 425 || status === 429 || status >= 500) {
    return "transient";
  }

  if (status === 502 || status === 503 || status === 504) {
    return "transient";
  }

  if (status >= 400 && status < 500) {
    return "terminal";
  }

  return "ambiguous";
}

export function isTransientDispatchErrorClass(
  errorClass: string | null | undefined
): boolean {
  return errorClass === "transient";
}
