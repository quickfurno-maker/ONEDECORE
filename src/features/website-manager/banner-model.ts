/**
 * What a promotional banner is, and what a link on one may be.
 *
 * Pure: no server imports, no Supabase, no React. The link rules in particular
 * are asserted directly by tests and reused by the admin form, the server
 * action and the public renderer, so there is exactly one definition of "this
 * href is safe" rather than three that drift.
 *
 * The database enforces the same rules independently in a check constraint.
 * That duplication is on purpose — this file protects the UX, the constraint
 * protects the data, and only one of them is reachable by a script.
 */

export const BANNER_LINK_TYPES = ["none", "internal", "external", "consultation"] as const;
export type BannerLinkType = (typeof BANNER_LINK_TYPES)[number];

/**
 * The recommended artwork, unchanged from the approved design: 5:8 portrait.
 *
 * A warning, not a rejection. An export that is 1000x1601 is a rounding error
 * in somebody's design tool, and refusing it would teach the owner that the
 * uploader is broken. An export that is landscape is a different picture, and
 * they should be told before it reaches the homepage.
 */
export const BANNER_RATIO_W = 5;
export const BANNER_RATIO_H = 8;
export const BANNER_RECOMMENDED_WIDTH = 1000;
export const BANNER_RECOMMENDED_HEIGHT = 1600;
/** Tolerance before the ratio is worth mentioning. */
export const BANNER_RATIO_TOLERANCE = 0.08;

/**
 * The ceiling on enabled banners.
 *
 * Twenty is far past the point where anyone scrolls to the end of the rail; it
 * exists so a scripted client cannot put four hundred cards on the homepage.
 * The database enforces the same number, which is the copy that matters.
 */
export const MAX_ENABLED_BANNERS = 20;

export interface BannerDraft {
  readonly bannerId: string;
  readonly internalName: string;
  readonly image: string | null;
  readonly mobileImage: string | null;
  readonly alt: string | null;
  readonly linkType: BannerLinkType;
  readonly linkValue: string | null;
  readonly newTab: boolean;
  readonly enabled: boolean;
  readonly order: number;
}

/** A banner as the public page receives it. No internal name, no draft state. */
export interface PublicBanner {
  readonly id: string;
  readonly image: string | null;
  readonly mobileImage: string | null;
  readonly alt: string | null;
  readonly linkType: BannerLinkType;
  readonly linkValue: string | null;
  readonly newTab: boolean;
  readonly order: number;
}

export function isBannerLinkType(value: unknown): value is BannerLinkType {
  return (
    typeof value === "string" && (BANNER_LINK_TYPES as readonly string[]).includes(value)
  );
}

export interface LinkValidation {
  readonly valid: boolean;
  readonly error?: string;
  /** The value to store. Null for link types that carry no target. */
  readonly value?: string | null;
}

/**
 * Schemes that must never reach an `href`, whatever the field says.
 *
 * `javascript:` executes. `data:` and `blob:` render attacker-authored content
 * on a URL the visitor reads as ONEDECORE's. `file:` and `ftp:` are neither
 * useful nor safe here. The check is on the normalised, lowercased, whitespace-
 * stripped value because `java\tscript:` and ` JavaScript:` are the same attack
 * wearing a hat.
 */
const BLOCKED_SCHEMES = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "ftp:",
];

function hasBlockedScheme(raw: string): boolean {
  // Whitespace AND C0 control characters. A browser ignores both when parsing
  // a scheme, so `java\u0000script:` and `java\tscript:` are the same attack as
  // `javascript:` — stripping only visible whitespace would miss half of them.
  const normalised = raw.replace(/[\s\u0000-\u001F\u007F]/g, "").toLowerCase();
  return BLOCKED_SCHEMES.some((scheme) => normalised.startsWith(scheme));
}

/**
 * Validate a link for storage.
 *
 * Returns the value to persist rather than just a boolean, so the caller cannot
 * validate one string and store another.
 */
export function validateBannerLink(
  linkType: BannerLinkType,
  rawValue: string | null | undefined
): LinkValidation {
  const raw = (rawValue ?? "").trim();

  if (linkType === "none" || linkType === "consultation") {
    // A target on a type that has none is a sign the form state is confused;
    // storing it would leave a link that reappears if the type is changed back.
    return { valid: true, value: null };
  }

  if (raw.length === 0) {
    return { valid: false, error: "Enter a destination for this link." };
  }

  if (hasBlockedScheme(raw)) {
    return { valid: false, error: "That link type is not allowed." };
  }

  if (linkType === "internal") {
    if (!raw.startsWith("/")) {
      return { valid: false, error: "An internal page must start with a slash, e.g. /portfolio" };
    }
    // `//evil.com` is protocol-relative: it starts with a slash and navigates
    // off-site. This is the single most common way an "internal only" field
    // becomes an open redirect.
    if (raw.startsWith("//")) {
      return { valid: false, error: "An internal page cannot start with two slashes." };
    }
    // `#` and `?` are part of ordinary internal destinations — `/#contact` is
    // the consultation anchor the menu itself uses, and a campaign path may
    // carry a query. What stays excluded is whitespace, control characters and
    // anything that could start a scheme.
    if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/.test(raw)) {
      return { valid: false, error: "That internal path contains characters that are not allowed." };
    }
    return { valid: true, value: raw };
  }

  // external
  if (!/^https:\/\//i.test(raw)) {
    return { valid: false, error: "External links must start with https://" };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, error: "That does not look like a valid web address." };
  }
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "External links must use https." };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { valid: false, error: "That web address has no domain name." };
  }
  return { valid: true, value: parsed.toString() };
}

/**
 * `rel` for a banner anchor.
 *
 * `noopener` is the one that matters: without it the opened page gets a handle
 * on `window.opener` and can navigate this tab somewhere else. `noreferrer`
 * follows it because a promotional click-through has no need to leak the path
 * the visitor was on.
 */
export function bannerLinkRel(linkType: BannerLinkType, newTab: boolean): string | undefined {
  return linkType === "external" && newTab ? "noopener noreferrer" : undefined;
}

/**
 * The public URL for a stored banner object path.
 *
 * THE DATABASE STORES A PATH, NOT A URL. A stored absolute URL bakes the
 * Supabase project reference into every row, breaks the day the storage host
 * changes, and makes a signed URL indistinguishable from a permanent one.
 *
 * This lives in the pure model rather than beside the server reader because the
 * carousel is a client component and needs it too — and `NEXT_PUBLIC_*` is
 * inlined at build time, so it resolves identically on both sides. Putting it
 * in a `server-only` module is what broke the build the first time.
 */
export function bannerImageUrl(path: string | null | undefined): string | null {
  if (!path || path.trim().length === 0) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/website-banners/${path.replace(/^\/+/, "")}`;
}

/** A banner shows artwork only when it actually has some. */
export function bannerHasArtwork(banner: {
  readonly image: string | null | undefined;
}): boolean {
  return typeof banner.image === "string" && banner.image.trim().length > 0;
}

export interface RatioAdvice {
  readonly offRatio: boolean;
  readonly message?: string;
}

/** Advice, never a rejection — see the note on the ratio constants. */
export function describeBannerRatio(width: number, height: number): RatioAdvice {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { offRatio: false };
  }
  const target = BANNER_RATIO_W / BANNER_RATIO_H;
  const actual = width / height;
  const drift = Math.abs(actual - target) / target;
  if (drift <= BANNER_RATIO_TOLERANCE) return { offRatio: false };
  return {
    offRatio: true,
    message:
      `This image is ${width}x${height}. Banners are designed for 5:8 portrait ` +
      `(about ${BANNER_RECOMMENDED_WIDTH}x${BANNER_RECOMMENDED_HEIGHT}), so it will be ` +
      `cropped to fit the card.`,
  };
}
