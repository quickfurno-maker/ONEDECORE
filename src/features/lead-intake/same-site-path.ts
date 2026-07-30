/**
 * Same-site path hardening for attribution paths.
 * Begins with exactly one /, no //, no backslash, no control chars, no scheme.
 * Rejects encoded slash/backslash/null/controls and malformed percent encoding.
 * Do not redirect using these values.
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

  // Encoded slash, backslash, null, and C0 / DEL controls
  if (/%2f/i.test(path)) return false;
  if (/%5c/i.test(path)) return false;
  if (/%00/i.test(path)) return false;
  if (/%0[0-9a-f]/i.test(path)) return false;
  if (/%1[0-9a-f]/i.test(path)) return false;
  if (/%7f/i.test(path)) return false;

  // Malformed percent encoding (lone % or incomplete hex)
  if (/%(?![0-9a-fA-F]{2})/.test(path)) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }

  if (decoded.startsWith("//")) return false;
  if (decoded.includes("\\")) return false;
  if (decoded.includes("://")) return false;
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return false;

  return true;
}
