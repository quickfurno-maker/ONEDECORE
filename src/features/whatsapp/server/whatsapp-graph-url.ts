/**
 * WM-2 — the only way WM-2 server code builds a Meta Graph API URL.
 *
 * Every path segment is either a numeric Meta id or a reviewed edge name, and
 * the version must look like `v22.0`. That makes it impossible for a
 * provider-supplied value (a paging `next` URL, a media id from a webhook, a
 * template id from a form) to steer the request to another host, another path
 * or another API. Paging follows the `after` cursor through this builder; the
 * provider's own `next` URL is never fetched.
 */

export const META_GRAPH_ORIGIN = "https://graph.facebook.com";

/** WM-2 templates and media; WM-6 official Flows (create, JSON asset upload, publish, deprecate). */
const EDGES = new Set(["message_templates", "media", "flows", "assets", "publish", "deprecate"]);

export function buildMetaGraphUrl(
  graphApiVersion: string,
  segments: readonly string[],
  query: Readonly<Record<string, string | number | undefined>> = {}
): string {
  if (!/^v\d{1,3}\.\d{1,2}$/.test(graphApiVersion)) {
    throw new Error("meta_graph_version_invalid");
  }
  if (segments.length === 0 || segments.length > 2) {
    throw new Error("meta_graph_path_invalid");
  }
  for (const segment of segments) {
    if (!/^[0-9]{1,64}$/.test(segment) && !EDGES.has(segment)) {
      throw new Error("meta_graph_path_invalid");
    }
  }
  const url = new URL(`${META_GRAPH_ORIGIN}/${graphApiVersion}/${segments.join("/")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (!/^[a-z_]{1,32}$/.test(key)) throw new Error("meta_graph_query_invalid");
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
