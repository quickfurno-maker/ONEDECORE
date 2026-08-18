import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import {
  LP_VISITOR_COOKIE_MAX_AGE_SECONDS,
  LP_VISITOR_COOKIE_NAME,
} from "./landing-lab-env.ts";
import { resolveLandingVisitorKey } from "../domain/landing-visitor-key.ts";

export { isLandingLabPublicPath } from "../domain/landing-visitor-key.ts";

export function readOrCreateLandingVisitorKey(request: NextRequest): {
  readonly visitorKey: string;
  readonly created: boolean;
} {
  return resolveLandingVisitorKey(request.cookies.get(LP_VISITOR_COOKIE_NAME)?.value);
}

export function applyLandingVisitorCookie(
  request: NextRequest,
  response: NextResponse,
  visitorKey: string
): NextResponse {
  const secure = process.env.NODE_ENV === "production";
  request.cookies.set(LP_VISITOR_COOKIE_NAME, visitorKey);
  response.cookies.set({
    name: LP_VISITOR_COOKIE_NAME,
    value: visitorKey,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: LP_VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export function ensureLandingVisitorCookie(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const { visitorKey, created } = readOrCreateLandingVisitorKey(request);
  if (created) {
    requestHeaders.set("cookie", mergeCookieHeader(request.headers.get("cookie"), visitorKey));
  }
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return applyLandingVisitorCookie(request, response, visitorKey);
}

function mergeCookieHeader(existing: string | null, visitorKey: string): string {
  const parts = (existing ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${LP_VISITOR_COOKIE_NAME}=`));
  parts.push(`${LP_VISITOR_COOKIE_NAME}=${visitorKey}`);
  return parts.join("; ");
}
