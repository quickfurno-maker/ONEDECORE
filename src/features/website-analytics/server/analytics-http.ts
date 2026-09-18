import "server-only";

/**
 * A consent denial/absence is not an error and carries no response payload.
 * Fetch/Response forbids a body on 204 responses, so keep this helper separate
 * from the JSON response path.
 */
export function websiteAnalyticsNoContentResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
    },
  });
}
