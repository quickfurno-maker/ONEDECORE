/**
 * XSS-safe text rendering for Kriti AI output — plain text only.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeKritiHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function kritiPlainTextLines(value: string): readonly string[] {
  return value.split(/\r?\n/).map((line) => line.trimEnd());
}
