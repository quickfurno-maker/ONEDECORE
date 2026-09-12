/**
 * The homepage section registry: the only place a section key means a component.
 *
 * WHY THE COMPONENT NAME IS NOT IN THE DATABASE
 *
 * The obvious CMS shape stores `"HomeHero"` in a row and looks it up at render
 * time. That turns a database write into code execution: anyone who can insert
 * a section row chooses which component the front page mounts, and a typo
 * becomes a blank homepage rather than a failed migration.
 *
 * So the mapping lives here, in code, and the database stores only a key, an
 * order and a boolean. A key that is not in this registry is not a bug to
 * recover from — it is refused. The worst a bad row can do is be ignored.
 *
 * WHAT THE DATABASE MAY DECIDE
 *
 *   - the order of these sections
 *   - whether each one is visible
 *
 * and nothing else. Not the copy, not the components, not which sections exist.
 *
 * WHAT IT MAY NEVER DECIDE
 *
 * The hero is pinned first and cannot be hidden: a homepage whose first
 * element is a testimonial carousel is not a homepage, and the failure would
 * be one drag away. The consultation block is pinned last for the same reason
 * from the other end — it is the close, and a close in the middle of the page
 * is just another section.
 *
 * Global chrome is deliberately absent from this file. The header, the
 * WhatsApp FAB, the sticky Call Now bar and the footer are not sections and
 * are not manageable here; they are contact surfaces with their own
 * fail-closed config, and "hide the phone number" is not an editorial choice
 * this tool should offer.
 */

/** Every section key the homepage understands. The database may use no others. */
export const HOMEPAGE_SECTION_KEYS = [
  "hero",
  "promo-carousel",
  // Room by room comes straight after the banner rail: a visitor who has just
  // scrolled past photographs of finished spaces is looking for their own
  // room, not a list of services. "What we do" answers the next question.
  "room-explorer",
  "complete-interiors",
  "why",
  "process",
  "factory",
  "estimator",
  "portfolio",
  "testimonials",
  "faq",
  "consultation",
] as const;

/**
 * Keys that were once managed and are not any more.
 *
 * They are listed rather than deleted because stored configurations still
 * mention them. A published version from before the redesign carries
 * `materials` and `service-areas`, and a resolver that merely did not
 * RECOGNISE them would be indistinguishable from one that had a typo. Naming
 * them says: this was removed on purpose, drop it quietly.
 *
 *   modular-kitchen, wardrobes, renovation
 *       Three long single-service sections that repeated, at length, what the
 *       four Interactive Services cards now say in a sentence each.
 *
 *   materials
 *       Removed from the public flow by owner decision. The materials DATA and
 *       its imagery are untouched and still used elsewhere.
 *
 *   service-areas
 *       The 26-locality list. Its answer survives as the `areas` FAQ entry,
 *       which is why that entry is one of the five the FAQ shows.
 */
export const RETIRED_HOMEPAGE_SECTION_KEYS = [
  "modular-kitchen",
  "wardrobes",
  "renovation",
  "materials",
  "service-areas",
] as const;

export type RetiredHomepageSectionKey =
  (typeof RETIRED_HOMEPAGE_SECTION_KEYS)[number];

export function isRetiredHomepageSectionKey(value: string): boolean {
  return (RETIRED_HOMEPAGE_SECTION_KEYS as readonly string[]).includes(value);
}

export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];

/**
 * How a section may be moved.
 *
 * `first` and `last` are structural pins, not preferences. They are enforced in
 * the admin UI, in the save RPC and again at render — a disabled drag handle
 * is a courtesy, not a guarantee.
 */
export type HomepageSectionPin = "first" | "last" | null;

export interface HomepageSectionDefinition {
  readonly key: HomepageSectionKey;
  /** What the owner sees in the Website Manager. */
  readonly label: string;
  /** One line explaining what this section actually is, in the owner's terms. */
  readonly description: string;
  /** Position in the approved default order. */
  readonly defaultOrder: number;
  readonly pin: HomepageSectionPin;
  /** A pinned-visible section cannot be switched off. */
  readonly canHide: boolean;
}

export const HOMEPAGE_SECTION_REGISTRY: readonly HomepageSectionDefinition[] = [
  {
    key: "hero",
    label: "Hero",
    description:
      "The opening image, headline, Get Free Consultation button and the four-card counter.",
    defaultOrder: 0,
    pin: "first",
    canHide: false,
  },
  {
    key: "promo-carousel",
    label: "Promotional Banners",
    description: "The sliding banner rail. Its contents are managed on the Banners tab.",
    defaultOrder: 1,
    pin: null,
    canHide: true,
  },
  /*
   * Room by room sits directly under the banner rail, ahead of What We Do.
   *
   * A visitor who has just scrolled past photographs of finished rooms is
   * looking for their own room, not for a list of service categories. "What we
   * do" answers the question that comes after.
   *
   * `defaultOrder` is what actually sorts the page (`defaultHomepageSections`
   * sorts on it), so the numbers move with the entries rather than the array
   * position alone.
   */
  {
    key: "room-explorer",
    label: "Room Explorer",
    description: "Tabs that show the three planning priorities for each room.",
    defaultOrder: 2,
    pin: null,
    canHide: true,
  },
  {
    key: "complete-interiors",
    label: "What We Do",
    description: "The four interactive service cards: interiors, kitchens, wardrobes, renovation.",
    defaultOrder: 3,
    pin: null,
    canHide: true,
  },
  {
    key: "why",
    label: "Why ONEDECORE",
    description: "Four proof panels. Also the target of the About menu link.",
    defaultOrder: 4,
    pin: null,
    canHide: true,
  },
  {
    key: "process",
    label: "How It Works",
    description: "The four-stage journey from consultation to handover.",
    defaultOrder: 5,
    pin: null,
    canHide: true,
  },
  {
    key: "factory",
    label: "Own Manufacturing",
    description: "Three manufacturing capability cards.",
    defaultOrder: 6,
    pin: null,
    canHide: true,
  },
  {
    key: "estimator",
    label: "Budget Explorer",
    description: "Home-type tabs showing the planning ranges, with one consultation CTA.",
    defaultOrder: 7,
    pin: null,
    canHide: true,
  },
  {
    key: "portfolio",
    label: "Portfolio Link",
    description: "One visual that links straight to the portfolio page.",
    defaultOrder: 8,
    pin: null,
    canHide: true,
  },
  {
    key: "testimonials",
    label: "Client Reviews",
    description:
      "Shows verified reviews when approved review content exists. Currently none, so it renders process copy instead of a score.",
    defaultOrder: 9,
    pin: null,
    canHide: true,
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Five approved questions in an accordion.",
    defaultOrder: 10,
    pin: null,
    canHide: true,
  },
  {
    key: "consultation",
    label: "Final Consultation",
    description:
      "The closing call to action, and the target of the Contact menu link. Always last.",
    defaultOrder: 11,
    pin: "last",
    canHide: false,
  },
];

const REGISTRY_BY_KEY = new Map(
  HOMEPAGE_SECTION_REGISTRY.map((entry) => [entry.key, entry])
);

export function isHomepageSectionKey(value: string): value is HomepageSectionKey {
  return REGISTRY_BY_KEY.has(value as HomepageSectionKey);
}

export function getHomepageSection(
  key: HomepageSectionKey
): HomepageSectionDefinition {
  const entry = REGISTRY_BY_KEY.get(key);
  if (!entry) throw new Error(`Unknown homepage section: ${key}`);
  return entry;
}

export interface ResolvedHomepageSection {
  readonly key: HomepageSectionKey;
  readonly visible: boolean;
}

/** The approved homepage, as code defines it. Every section, in order, visible. */
export function defaultHomepageSections(): readonly ResolvedHomepageSection[] {
  return [...HOMEPAGE_SECTION_REGISTRY]
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((entry) => ({ key: entry.key, visible: true }));
}

export interface StoredHomepageSection {
  readonly key: string;
  readonly order: number;
  readonly visible: boolean;
}

/**
 * Turn whatever the database returned into a homepage that can actually render.
 *
 * THIS FUNCTION ASSUMES THE INPUT IS WRONG
 *
 * It is the boundary between stored data and mounted components, and it is the
 * last place a mistake is cheap. So: unknown keys are dropped rather than
 * throwing, duplicates keep their first occurrence, missing keys fall back to
 * their registry default, the hero is forced first and visible, and the
 * consultation block is forced last. Ordering ties break on the registry order
 * so the result is deterministic rather than dependent on row arrival.
 *
 * An empty or unusable config returns the code-defined default. A homepage that
 * renders the wrong order is a bad day; a homepage that renders nothing because
 * a row was malformed is an outage.
 */
export function resolveHomepageSections(
  stored: readonly StoredHomepageSection[] | null | undefined
): readonly ResolvedHomepageSection[] {
  if (!stored || stored.length === 0) return defaultHomepageSections();

  const seen = new Set<HomepageSectionKey>();
  const known: Array<{ key: HomepageSectionKey; order: number; visible: boolean }> = [];

  for (const row of stored) {
    if (typeof row?.key !== "string" || !isHomepageSectionKey(row.key)) continue;
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    known.push({
      key: row.key,
      order: Number.isFinite(row.order) ? row.order : Number.MAX_SAFE_INTEGER,
      visible: row.visible !== false,
    });
  }

  if (known.length === 0) return defaultHomepageSections();

  /*
   * A section the stored config never mentioned is a section somebody ADDED to
   * the registry since the last publish. Dropping it would mean new code
   * shipping invisible until an editor happens to publish; appending it at its
   * registry position means the homepage keeps working the way the code says.
   */
  for (const entry of HOMEPAGE_SECTION_REGISTRY) {
    if (!seen.has(entry.key)) {
      known.push({ key: entry.key, order: entry.defaultOrder, visible: true });
    }
  }

  known.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return getHomepageSection(a.key).defaultOrder - getHomepageSection(b.key).defaultOrder;
  });

  // The pins, applied after sorting so no stored order can defeat them.
  const hero = known.find((row) => row.key === "hero");
  const rest = known.filter((row) => row.key !== "hero" && row.key !== "consultation");
  const consultation = known.find((row) => row.key === "consultation");

  const resolved: ResolvedHomepageSection[] = [];
  resolved.push({ key: "hero", visible: true });
  void hero;
  for (const row of rest) resolved.push({ key: row.key, visible: row.visible });
  if (consultation) resolved.push({ key: "consultation", visible: true });

  return resolved;
}
