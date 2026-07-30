import "server-only";

/**
 * Same-site path hardening for attribution paths.
 * Begins with exactly one /, no //, no backslash, no control chars, no scheme.
 */
export function isSafeSameSitePath(path: string, maxLength = 500): boolean {
  if (typeof path !== "string") return false;
  if (path.length < 1 || path.length > maxLength) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("://")) return false;
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return false;
  }
  if (/\s/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}
