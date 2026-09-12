import "server-only";

import { getMetaPixelId } from "../meta-tracking-config.ts";

/**
 * Conversions API configuration, and the gate that keeps it closed.
 *
 * `server-only` is not decoration. This module is the one place the access
 * token is read, and that import is what makes a stray `import` from a client
 * component a build error rather than a token in a JavaScript bundle served to
 * every visitor.
 */

export const META_CAPI_DEFAULT_GRAPH_VERSION = "v21.0";

/** How long a conversion report may delay a lead response. */
export const META_CAPI_TIMEOUT_MS = 1_500;

export interface MetaCapiConfig {
  readonly pixelId: string;
  readonly accessToken: string;
  readonly graphVersion: string;
  /** Present only while certifying in Meta's Test Events view. */
  readonly testEventCode: string | null;
}

/**
 * Graph versions are `v<major>.<minor>`. Validated rather than interpolated
 * blindly: this value becomes part of a URL path, and an unchecked env string
 * there is how a request ends up somewhere other than the Graph API.
 */
function normaliseGraphVersion(raw: string | null | undefined): string {
  if (typeof raw !== "string") return META_CAPI_DEFAULT_GRAPH_VERSION;
  const trimmed = raw.trim();
  return /^v\d{1,3}\.\d{1,3}$/.test(trimmed)
    ? trimmed
    : META_CAPI_DEFAULT_GRAPH_VERSION;
}

/** Meta's test codes are short alphanumerics like `TEST12345`. */
function normaliseTestEventCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * The config, or `null` when the feature is off.
 *
 * BOTH halves are required. A pixel id without a token cannot authenticate; a
 * token without a pixel id has no dataset to write to. Returning null for
 * either is what makes "not configured" a single, obvious state rather than a
 * half-enabled one that fails on every request and fills the log.
 */
export function getMetaCapiConfig(
  env: {
    readonly pixelId?: string | null;
    readonly accessToken?: string | null;
    readonly graphVersion?: string | null;
    readonly testEventCode?: string | null;
  } = {
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    accessToken: process.env.META_CONVERSIONS_API_ACCESS_TOKEN,
    graphVersion: process.env.META_CONVERSIONS_API_GRAPH_VERSION,
    testEventCode: process.env.META_CONVERSIONS_API_TEST_EVENT_CODE,
  }
): MetaCapiConfig | null {
  const pixelId = getMetaPixelId(env.pixelId);
  if (!pixelId) return null;

  const accessToken =
    typeof env.accessToken === "string" ? env.accessToken.trim() : "";
  if (accessToken.length < 20) return null;

  return {
    pixelId,
    accessToken,
    graphVersion: normaliseGraphVersion(env.graphVersion),
    testEventCode: normaliseTestEventCode(env.testEventCode),
  };
}

/** True when a server event would actually be attempted. */
export function isMetaCapiConfigured(
  env?: Parameters<typeof getMetaCapiConfig>[0]
): boolean {
  return getMetaCapiConfig(env) !== null;
}
