import "server-only";

/**
 * Deterministic recursive JSON serialization for event_hash inputs.
 * Object keys are sorted at every nesting level; array order is preserved.
 */
export function canonicalJsonSerialize(value: unknown): string {
  if (value === null) {
    return "null";
  }

  const valueType = typeof value;
  if (valueType === "string") {
    return JSON.stringify(value);
  }
  if (valueType === "number" || valueType === "boolean") {
    return JSON.stringify(value);
  }
  if (valueType !== "object") {
    return JSON.stringify(null);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonSerialize(record[key])}`
  );
  return `{${parts.join(",")}}`;
}
