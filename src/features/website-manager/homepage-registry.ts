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
  "complete-interiors",
  "modular-kitchen",
  "wardrobes",
  "renovation",
  "why",
  "factory",
  "estimator",
  "portfolio",
  "materials",
  "process",
  "service-areas",
  "testimonials",
  "faq",
  "consultation",
] as const;

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
  {
    key: "complete-interiors",
    label: "What We Do",
    description: "Everything your home needs, under one roof — the four service cards.",
    defaultOrder: 2,
    pin: null,
    canHide: true,
  },
  {
    key: "modular-kitchen",
    label: "Modular Kitchens",
    description: "The kitchen feature block.",
    defaultOrder: 3,
    pin: null,
    canHide: true,
  },
  {
    key: "wardrobes",
    label: "Wardrobes",
    description: "The custom wardrobe block.",
    defaultOrder: 4,
    pin: null,
    canHide: true,
  },
  {
    key: "renovation",
    label: "Renovation",
    description: "The full-home renovation block.",
    defaultOrder: 5,
    pin: null,
    canHide: true,
  },
  {
    key: "why",
    label: "Why ONEDECORE",
    description: "One team, complete responsibility. Also the target of the About menu link.",
    defaultOrder: 6,
    pin: null,
    canHide: true,
  },
  {
    key: "factory",
    label: "Own Manufacturing",
    description: "The manufacturing capability block.",
    defaultOrder: 7,
    pin: null,
    canHide: true,
  },
  {
    key: "estimator",
    label: "Budget Estimator",
    description: "The indicative planning-range calculator.",
    defaultOrder: 8,
    pin: null,
    canHide: true,
  },
  {
    key: "portfolio",
    label: "Portfolio Bridge",
    description: "See finished ONEDECORE homes — the link across to the portfolio.",
    defaultOrder: 9,
    pin: null,
    canHide: true,
  },
  {
    key: "materials",
    label: "Materials & Finishes",
    description: "Stone, timber, texture and light.",
    defaultOrder: 10,
    pin: null,
    canHide: true,
  },
  {
    key: "process",
    label: "Our Process",
    description: "The four-stage journey from design to handover.",
    defaultOrder: 11,
    pin: null,
    canHide: true,
  },
  {
    key: "service-areas",
    label: "Pune Service Areas",
    description: "All 26 localities ONEDECORE installs in. The only place these are listed.",
    defaultOrder: 12,
    pin: null,
    canHide: true,
  },
  {
    key: "testimonials",
    label: "Reviews",
    description: "Client reviews, subject to the published-claim gates.",
    defaultOrder: 13,
    pin: null,
    canHide: true,
  },
  {
    key: "faq",
    label: "FAQ",
    description: "The ten most-asked questions.",
    defaultOrder: 14,
    pin: null,
    canHide: true,
  },
  {
    key: "consultation",
    label: "Final Consultation",
    description:
      "The closing call to action, and the target of the Contact menu link. Always last.",
    defaultOrder: 15,
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
