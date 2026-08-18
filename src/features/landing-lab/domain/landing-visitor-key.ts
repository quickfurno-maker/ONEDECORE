const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLandingLabPublicPath(pathname: string): boolean {
  return pathname === "/lp" || pathname.startsWith("/lp/");
}

export function resolveLandingVisitorKey(existing: string | undefined): {
  readonly visitorKey: string;
  readonly created: boolean;
} {
  const value = existing?.trim() ?? "";
  if (UUID_RE.test(value)) {
    return { visitorKey: value, created: false };
  }
  return { visitorKey: crypto.randomUUID(), created: true };
}
