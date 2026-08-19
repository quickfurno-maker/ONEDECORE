export type CampaignProviderClickIdentifierKind = "gclid" | "gbraid" | "wbraid" | "fbc" | "fbp";

export interface CampaignProviderClickIdentifier {
  readonly kind: CampaignProviderClickIdentifierKind;
  readonly value: string;
}

const FBC_PATTERN = /^fb\.1\.\d+\.[A-Za-z0-9._-]+$/;
const FBP_PATTERN = /^fb\.1\.\d+\.\d+$/;
const GCLID_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

export function parseCapturedClickIdentifiers(source: Record<string, unknown> | null | undefined): CampaignProviderClickIdentifier[] {
  if (!source) return [];
  const out: CampaignProviderClickIdentifier[] = [];
  const gclid = read(source.gclid, GCLID_PATTERN);
  const gbraid = read(source.gbraid, GCLID_PATTERN);
  const wbraid = read(source.wbraid, GCLID_PATTERN);
  const fbc = read(source.fbc, FBC_PATTERN);
  const fbp = read(source.fbp, FBP_PATTERN);
  if (gclid) out.push({ kind: "gclid", value: gclid });
  if (gbraid) out.push({ kind: "gbraid", value: gbraid });
  if (wbraid) out.push({ kind: "wbraid", value: wbraid });
  if (fbc) out.push({ kind: "fbc", value: fbc });
  if (fbp) out.push({ kind: "fbp", value: fbp });
  return out;
}

function read(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!pattern.test(trimmed)) return null;
  return trimmed;
}

export function selectGoogleClickConversionIdentifier(
  identifiers: readonly CampaignProviderClickIdentifier[]
): CampaignProviderClickIdentifier | null {
  return (
    identifiers.find((item) => item.kind === "gclid") ??
    identifiers.find((item) => item.kind === "gbraid") ??
    identifiers.find((item) => item.kind === "wbraid") ??
    null
  );
}

export function selectMetaCapiIdentifiers(
  identifiers: readonly CampaignProviderClickIdentifier[]
): { readonly fbc: string | null; readonly fbp: string | null } {
  return {
    fbc: identifiers.find((item) => item.kind === "fbc")?.value ?? null,
    fbp: identifiers.find((item) => item.kind === "fbp")?.value ?? null,
  };
}
