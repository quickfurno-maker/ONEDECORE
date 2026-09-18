import { createBearerClient, readBearerToken } from "@/lib/supabase/bearer";
import {
  fetchWebsiteAnalyticsDashboardForClient,
  WEBSITE_ANALYTICS_SOURCE_LABELS,
  WebsiteAnalyticsReadError,
} from "@/features/website-analytics/server/dashboard";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function currentIstDate(): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return part("year") + "-" + part("month") + "-" + part("day");
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readDate(value: string | null, fallback: string): string | null {
  if (value === null || value === "") return fallback;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function errorResponse(
  status: number,
  error: "unauthenticated" | "forbidden" | "invalid_request" | "unavailable",
  message: string
) {
  return Response.json({ error, message }, { status });
}

export async function GET(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return errorResponse(401, "unauthenticated", "Sign in again to continue.");
  }

  const db = createBearerClient(token);
  const userResult = await db.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return errorResponse(401, "unauthenticated", "Sign in again to continue.");
  }

  const url = new URL(request.url);
  const defaultTo = currentIstDate();
  const defaultFrom = shiftIsoDate(defaultTo, -29);
  const from = readDate(url.searchParams.get("from"), defaultFrom);
  const to = readDate(url.searchParams.get("to"), defaultTo);

  if (!from || !to) {
    return errorResponse(
      400,
      "invalid_request",
      "Use dates in YYYY-MM-DD format."
    );
  }

  try {
    const analytics = await fetchWebsiteAnalyticsDashboardForClient(
      db,
      from,
      to
    );

    return Response.json({
      ...analytics,
      sourceLabels: WEBSITE_ANALYTICS_SOURCE_LABELS,
      loadedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof WebsiteAnalyticsReadError) {
      if (error.code === "42501") {
        return errorResponse(
          403,
          "forbidden",
          "You do not have access to website analytics."
        );
      }

      if (error.code === "22023") {
        return errorResponse(
          400,
          "invalid_request",
          "Choose a valid analytics date range of up to 367 days."
        );
      }
    }

    console.error("[mobile/website-analytics]", error);

    return errorResponse(
      503,
      "unavailable",
      "Website analytics are unavailable right now. Try again."
    );
  }
}
