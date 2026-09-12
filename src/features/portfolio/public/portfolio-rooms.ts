/**
 * The four public portfolio views, declared once.
 *
 * `Kitchen | Living Room | Bedroom | Projects`
 *
 * TWO BROWSE MODES, NOT FOUR CATEGORIES
 *
 * `projects` lists whole-home case studies: one card per delivered home.
 * The three room views list PHOTOGRAPHS — every published image tagged as that
 * room, each still carrying the project it came from. A visitor who clicks
 * "Bedroom" wants to look at bedrooms, and the only way to answer that without
 * splitting one delivered home into fake room-level "projects" is to browse the
 * photographs directly.
 *
 * THERE IS NO HALL
 *
 * "Hall" and "Living Room" name the same room to a visitor, and offering both
 * words only invites them to wonder which one their space is. Living Room is
 * the single public term; migration 20260908160000 translated the stored Hall
 * values and removed it from the database allowlists, so it cannot come back
 * through the CMS either.
 *
 * ROOMS ARE NOT SERVICES
 *
 * A room says what a photograph SHOWS. `service_code` says what a project was
 * SOLD as and is read by CRM and lead matching. Neither is derived from the
 * other and they must not be merged.
 */

/**
 * Rooms a photograph can be tagged with. Matches the DB check constraint.
 *
 * THIS ORDER IS NOT THE PUBLIC ORDER.
 *
 * It is the vocabulary, and it is read by the admin room selector, the bulk
 * uploader, the project-detail room filter and the storage path validator. The
 * public tab sequence is a presentation decision and lives in
 * `PORTFOLIO_PUBLIC_VIEW_ORDER` below; reordering this constant to move a tab
 * would silently reorder the CMS as well.
 */
export const PORTFOLIO_ROOM_CODES = [
  "living-room",
  "bedroom",
  "kitchen",
] as const;

export type PortfolioRoomCode = (typeof PORTFOLIO_ROOM_CODES)[number];

export const PORTFOLIO_ROOM_LABELS: Readonly<
  Record<PortfolioRoomCode, string>
> = {
  "living-room": "Living Room",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
};

export type PortfolioViewCode = PortfolioRoomCode | "projects";

/**
 * THE PUBLIC TAB SEQUENCE, WRITTEN OUT.
 *
 * `Kitchen | Living Room | Bedroom | Projects`
 *
 * Declared as a literal rather than derived from `PORTFOLIO_ROOM_CODES`,
 * because the two answer different questions. That constant is the vocabulary
 * the CMS writes and the database constrains; this is the order a visitor meets
 * the work in, and the business reason Kitchen leads has nothing to do with how
 * a room code is stored. Deriving one from the other is what makes a public
 * presentation change quietly reorder the admin uploader.
 *
 * Kitchen leads because it is what most visitors arrive wanting to see, so it
 * is also the bare `/portfolio` answer. Projects is last: it is the deeper
 * read — whole-home case studies — for a visitor who has already looked.
 */
export const PORTFOLIO_PUBLIC_VIEW_ORDER = [
  "kitchen",
  "living-room",
  "bedroom",
  "projects",
] as const satisfies readonly PortfolioViewCode[];

/** The view that answers a bare `/portfolio`. */
export const PORTFOLIO_DEFAULT_VIEW: PortfolioViewCode = "kitchen";

/** The whole-home case-study listing. Never the default, always addressed. */
export const PORTFOLIO_PROJECTS_VIEW: PortfolioViewCode = "projects";

/**
 * The canonical URL of a view.
 *
 * The default view is the ONLY one without a query parameter, so there is one
 * address per listing. Everything else — Projects included — is addressed
 * explicitly, which is why `PORTFOLIO_PROJECTS_HREF` exists: nothing may mint
 * a bare `/portfolio` meaning "all projects" any more, because bare
 * `/portfolio` now means Kitchen.
 */
export function portfolioViewHref(view: PortfolioViewCode): string {
  return view === PORTFOLIO_DEFAULT_VIEW ? "/portfolio" : `/portfolio?view=${view}`;
}

/** `/portfolio?view=projects` — the project listing, page 1. */
export const PORTFOLIO_PROJECTS_HREF = portfolioViewHref(PORTFOLIO_PROJECTS_VIEW);

export interface PortfolioViewOption {
  readonly id: PortfolioViewCode;
  readonly label: string;
  /** Canonical href. The default view carries no query parameter. */
  readonly href: string;
  /** Whether this view lists photographs rather than project cards. */
  readonly isRoomView: boolean;
}

export const PORTFOLIO_VIEWS: readonly PortfolioViewOption[] =
  PORTFOLIO_PUBLIC_VIEW_ORDER.map((id) => ({
    id,
    label: isPortfolioRoomCode(id) ? PORTFOLIO_ROOM_LABELS[id] : "Projects",
    href: portfolioViewHref(id),
    isRoomView: isPortfolioRoomCode(id),
  }));

/**
 * The `?view=` values. Derived from the public order so the vocabulary and the
 * tab rail cannot disagree about which views exist.
 */
export const PORTFOLIO_VIEW_CODES: readonly PortfolioViewCode[] =
  PORTFOLIO_PUBLIC_VIEW_ORDER;

export function isPortfolioRoomCode(
  value: unknown
): value is PortfolioRoomCode {
  return (
    typeof value === "string" &&
    (PORTFOLIO_ROOM_CODES as readonly string[]).includes(value)
  );
}

export function isPortfolioViewCode(
  value: unknown
): value is PortfolioViewCode {
  return (
    typeof value === "string" &&
    (PORTFOLIO_VIEW_CODES as readonly string[]).includes(value)
  );
}

/** The room a view browses, or null for the Projects view. */
export function roomForView(view: PortfolioViewCode): PortfolioRoomCode | null {
  return isPortfolioRoomCode(view) ? view : null;
}

export function portfolioRoomLabel(value: unknown): string | null {
  return isPortfolioRoomCode(value) ? PORTFOLIO_ROOM_LABELS[value] : null;
}

/**
 * The admin room selector, including the unclassified option.
 *
 * "Unclassified" is a real answer, not a missing one: a cover shot, a material
 * detail or an exterior belongs to no room, and forcing one on it would put the
 * photograph in front of somebody who asked for bedrooms. It writes NULL.
 */
export const PORTFOLIO_ROOM_SELECT_OPTIONS: readonly {
  readonly value: "" | PortfolioRoomCode;
  readonly label: string;
}[] = [
  { value: "", label: "Unclassified" },
  ...PORTFOLIO_ROOM_CODES.map((room) => ({
    value: room,
    label: PORTFOLIO_ROOM_LABELS[room],
  })),
];

/**
 * Display aspect ratios, so one uploaded original serves every surface.
 *
 * The owner uploads once. Which shape a photograph is shown in is a decision
 * about the SURFACE, not about the file, and re-cropping in the browser with a
 * focal point costs nothing and loses nothing — the original is untouched in
 * the private bucket either way.
 */
export const PORTFOLIO_ASPECT_RATIOS = {
  /** Project and portfolio cards. */
  card: "4 / 5",
  /**
   * Room-gallery thumbnails. Square, because a dense grid of photographs only
   * reads as a grid when every tile is the same shape — and the square is the
   * shape that wastes the least of a phone's width at three columns.
   */
  roomThumbnail: "1 / 1",
  /** Mobile vertical feature, where a tall frame earns its place. */
  mobileFeature: "9 / 16",
  /** Project detail hero. */
  hero: "16 / 9",
} as const;

export type PortfolioAspectRatioKey = keyof typeof PORTFOLIO_ASPECT_RATIOS;

export const FOCAL_DEFAULT = 50;
export const FOCAL_MIN = 0;
export const FOCAL_MAX = 100;

/** Clamps to the stored bounds and rejects anything non-finite. */
export function normaliseFocalValue(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return FOCAL_DEFAULT;
  return Math.min(FOCAL_MAX, Math.max(FOCAL_MIN, Math.round(n)));
}

/** `object-position` for a focal point, ready for a style attribute. */
export function focalObjectPosition(
  focalX: number | null | undefined,
  focalY: number | null | undefined
): string {
  return `${normaliseFocalValue(focalX ?? FOCAL_DEFAULT)}% ${normaliseFocalValue(
    focalY ?? FOCAL_DEFAULT
  )}%`;
}
