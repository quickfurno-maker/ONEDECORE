/**
 * Converts browser `datetime-local` wall time to absolute ISO (UTC Z).
 * Rejects empty, malformed, or timezone-less strings that are not valid local datetimes.
 */

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isValidDatetimeLocalValue(value: string): boolean {
  if (!DATETIME_LOCAL_PATTERN.test(value.trim())) {
    return false;
  }
  const ms = Date.parse(value);
  return !Number.isNaN(ms);
}

export function localDatetimeToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!isValidDatetimeLocalValue(trimmed)) {
    return null;
  }
  return new Date(trimmed).toISOString();
}

export function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultFutureDatetimeLocalValue(hoursAhead = 24): string {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  return isoToDatetimeLocalValue(date.toISOString());
}

/**
 * Maps datetime-local field names to absolute ISO field names on FormData.
 * Returns false when any required local field is invalid.
 */
export function appendAbsoluteTimestampsFromLocalFields(
  formData: FormData,
  mappings: ReadonlyArray<{ readonly local: string; readonly absolute: string; readonly required?: boolean }>
): boolean {
  for (const { local, absolute, required = true } of mappings) {
    const raw = formData.get(local);
    formData.delete(local);

    if (raw == null || String(raw).trim().length === 0) {
      if (required) {
        return false;
      }
      continue;
    }

    const iso = localDatetimeToIso(String(raw));
    if (!iso) {
      return false;
    }
    formData.set(absolute, iso);
  }

  return true;
}
