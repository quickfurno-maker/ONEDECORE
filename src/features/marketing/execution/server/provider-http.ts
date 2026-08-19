export interface ProviderHttpRequest {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
}

export interface ProviderHttpResponse {
  readonly status: number;
  readonly bodyText: string;
}

export interface ProviderHttpTransport {
  request(input: ProviderHttpRequest): Promise<ProviderHttpResponse>;
}

const BLOCKED_HOSTS = new Set([
  "graph.facebook.com",
  "googleads.googleapis.com",
  "oauth2.googleapis.com",
]);

export function assertProviderUrlAllowed(url: string, allowLiveHosts: boolean): void {
  const host = new URL(url).hostname;
  if (!allowLiveHosts && BLOCKED_HOSTS.has(host)) {
    throw new Error("PROVIDER_NETWORK_BLOCKED");
  }
}

export function redactProviderHeaders(
  headers: Readonly<Record<string, string>>
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower === "authorization" ||
      lower === "developer-token" ||
      lower === "cookie" ||
      lower.includes("token")
    ) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function createMemoryProviderHttpTransport(
  handler: (input: ProviderHttpRequest) => Promise<ProviderHttpResponse> | ProviderHttpResponse
): ProviderHttpTransport {
  return {
    async request(input) {
      assertProviderUrlAllowed(input.url, true);
      return handler(input);
    },
  };
}

export function createFetchProviderHttpTransport(options?: {
  readonly allowLiveHosts?: boolean;
}): ProviderHttpTransport {
  const allowLiveHosts = options?.allowLiveHosts === true;
  return {
    async request(input) {
      assertProviderUrlAllowed(input.url, allowLiveHosts);
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
      });
      return { status: response.status, bodyText: await response.text() };
    },
  };
}
