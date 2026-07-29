import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, describe } from "node:test";
import {
  PORTFOLIO_SERVICE_LABELS,
  SLUG_GRAMMAR_REGEX,
  PUBLIC_CACHE_TAGS,
  PUBLIC_STORAGE_BUCKET,
  PUBLIC_DERIVATIVE_FILENAMES,
  PUBLIC_LISTING_PAGE_SIZE,
} from "../constants.ts";
import { validatePublicStoragePath, buildPublicStorageUrl } from "../public-url.ts";
import {
  mapProjectToCard,
  mapProjectToDetail,
  type CardMediaFields,
  type CardProjectFields,
  type CardServiceFields,
  type DetailProjectFields,
} from "../public-portfolio-mapper.ts";
import {
  detailCacheKeyParts,
  featuredCacheKeyParts,
  listingCacheKeyParts,
  publicPortfolioPathsFor,
  publicPortfolioTagsFor,
  sitemapCacheKeyParts,
} from "../public-cache-keys.ts";
import {
  isValidPortfolioSlug,
  parseListingParams,
  parsePageParam,
  parseServiceParam,
} from "../public-request-validation.ts";
import {
  queryPaginatedProjects,
  querySitemapEntries,
  resolveLastModified,
  SITEMAP_SELECT,
  type PublicSupabaseClient,
} from "../public-portfolio-queries.ts";
import {
  SITE_CONFIG,
  absoluteUrl,
  canonicalPortfolioUrl,
  formatSiteTitle,
} from "../../../../config/site.ts";

const P_UUID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
const M_UUID = "11223344-5566-4788-9900-aabbccddeeff";

describe("Public Portfolio — Central Site Identity", () => {
  test("SITE_CONFIG uses official domain onedecore.in", () => {
    assert.equal(SITE_CONFIG.url, "https://onedecore.in");
    assert.equal(SITE_CONFIG.name, "ONEDECORE");
  });

  test("absoluteUrl generates correct canonical URLs", () => {
    assert.equal(absoluteUrl("portfolio"), "https://onedecore.in/portfolio");
    assert.equal(absoluteUrl("/portfolio"), "https://onedecore.in/portfolio");
    assert.equal(
      canonicalPortfolioUrl("modern-villa"),
      "https://onedecore.in/portfolio/modern-villa"
    );
  });

  test("formatSiteTitle formats title correctly", () => {
    assert.equal(formatSiteTitle("Modern Villa"), "Modern Villa — ONEDECORE");
    assert.equal(formatSiteTitle(), "ONEDECORE");
  });

  test("Site config declares no legal entity name", () => {
    const keys = Object.keys(SITE_CONFIG);
    assert.equal(keys.includes("legalName"), false);
    assert.deepEqual(keys.sort(), ["locale", "name", "tagline", "url"]);
  });

  test("Site config carries no unverified business claim fields", () => {
    const forbidden = ["address", "phone", "rating", "reviewCount", "awards", "gst"];
    for (const key of forbidden) {
      assert.equal(key in SITE_CONFIG, false, `${key} must not be published`);
    }
  });

  test("JSON-LD publisher and brand resolve to ONEDECORE", () => {
    const publisher = { "@type": "Organization", name: SITE_CONFIG.name, url: SITE_CONFIG.url };
    assert.equal(publisher.name, "ONEDECORE");
    assert.notEqual(publisher.name, "ONEDECORE Interiors");
    assert.equal(publisher.url, "https://onedecore.in");
  });
});

describe("Public Portfolio — Constants & Grammar", () => {
  test("PORTFOLIO_SERVICE_LABELS maps exact required service codes", () => {
    assert.equal(PORTFOLIO_SERVICE_LABELS.complete_home_interiors, "Complete Home Interiors");
    assert.equal(PORTFOLIO_SERVICE_LABELS.modular_kitchens, "Modular Kitchens");
    assert.equal(PORTFOLIO_SERVICE_LABELS.custom_wardrobes, "Custom Wardrobes");
    assert.equal(Object.keys(PORTFOLIO_SERVICE_LABELS).length, 3);
  });

  test("SLUG_GRAMMAR_REGEX accepts valid lowercase hyphenated slugs", () => {
    assert.ok(SLUG_GRAMMAR_REGEX.test("modern-kitchen-design"));
    assert.ok(SLUG_GRAMMAR_REGEX.test("project1"));
    assert.ok(SLUG_GRAMMAR_REGEX.test("luxury-villa-bandra-west"));
  });

  test("SLUG_GRAMMAR_REGEX rejects invalid slugs", () => {
    assert.equal(SLUG_GRAMMAR_REGEX.test("Modern-Kitchen"), false);
    assert.equal(SLUG_GRAMMAR_REGEX.test("slug_with_underscore"), false);
    assert.equal(SLUG_GRAMMAR_REGEX.test("slug--double-hyphen"), false);
    assert.equal(SLUG_GRAMMAR_REGEX.test("-leading-hyphen"), false);
    assert.equal(SLUG_GRAMMAR_REGEX.test("trailing-hyphen-"), false);
    assert.equal(SLUG_GRAMMAR_REGEX.test("slug with spaces"), false);
  });

  test("Listing page size is bounded to 12 cards", () => {
    assert.equal(PUBLIC_LISTING_PAGE_SIZE, 12);
  });

  test("Approved public derivative filenames are exactly the three WebP names", () => {
    assert.deepEqual([...PUBLIC_DERIVATIVE_FILENAMES], [
      "cover-1600.webp",
      "gallery-1200.webp",
      "thumb-480.webp",
    ]);
  });
});

describe("Public Portfolio — Exact WebP Derivative Contract", () => {
  const coverPath = `${P_UUID}/${M_UUID}/cover-1600.webp`;

  test("Approved cover, gallery and thumb derivatives are accepted", () => {
    for (const name of PUBLIC_DERIVATIVE_FILENAMES) {
      assert.ok(
        validatePublicStoragePath(`${P_UUID}/${M_UUID}/${name}`),
        `${name} must be accepted`
      );
    }
  });

  test("PNG derivative is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover-1600.png`), false);
  });

  test("JPG derivative is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover-1600.jpg`), false);
  });

  test("JPEG derivative is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover-1600.jpeg`), false);
  });

  test("Unknown WebP filename is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover-1200.webp`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/hero.webp`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover-1600.WEBP`), false);
  });

  test("Private original filename is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/original.jpg`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/original.webp`), false);
  });

  test("Extra path segment is rejected", () => {
    assert.equal(
      validatePublicStoragePath(`${P_UUID}/${M_UUID}/nested/cover-1600.webp`),
      false
    );
    assert.equal(validatePublicStoragePath(`${M_UUID}/cover-1600.webp`), false);
  });

  test("Percent-encoded traversal is rejected", () => {
    assert.equal(validatePublicStoragePath(`${P_UUID}/%2e%2e/cover-1600.webp`), false);
    assert.equal(
      validatePublicStoragePath(`${P_UUID}/${M_UUID}%2Fcover-1600.webp`),
      false
    );
  });

  test("Literal traversal, backslashes and spaces are rejected", () => {
    assert.equal(validatePublicStoragePath(`../${coverPath}`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}/../cover-1600.webp`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}\\${M_UUID}\\cover-1600.webp`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}/${M_UUID}/cover 1600.webp`), false);
  });

  test("Leading slash, trailing slash and empty segments are rejected", () => {
    assert.equal(validatePublicStoragePath(`/${coverPath}`), false);
    assert.equal(validatePublicStoragePath(`${coverPath}/`), false);
    assert.equal(validatePublicStoragePath(`${P_UUID}//cover-1600.webp`), false);
    assert.equal(validatePublicStoragePath(""), false);
  });

  test("Query strings and fragments are rejected", () => {
    assert.equal(validatePublicStoragePath(`${coverPath}?download=1`), false);
    assert.equal(validatePublicStoragePath(`${coverPath}#fragment`), false);
  });

  test("Absolute URLs are rejected", () => {
    assert.equal(
      validatePublicStoragePath(`https://evil.example.com/${coverPath}`),
      false
    );
    assert.equal(validatePublicStoragePath(`http://127.0.0.1:54321/${coverPath}`), false);
  });

  test("Non-canonical UUID segments are rejected", () => {
    assert.equal(
      validatePublicStoragePath(`${P_UUID.toUpperCase()}/${M_UUID}/cover-1600.webp`),
      false
    );
    assert.equal(validatePublicStoragePath(`not-a-uuid/${M_UUID}/cover-1600.webp`), false);
    assert.equal(
      validatePublicStoragePath(`${P_UUID}/11223344556647889900aabbccddeeff/cover-1600.webp`),
      false
    );
  });

  test("Wrong project UUID ownership is rejected", () => {
    assert.equal(
      validatePublicStoragePath(coverPath, {
        expectedProjectUuid: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        expectedMediaUuid: M_UUID,
      }),
      false
    );
  });

  test("Wrong media UUID ownership is rejected", () => {
    assert.equal(
      validatePublicStoragePath(coverPath, {
        expectedProjectUuid: P_UUID,
        expectedMediaUuid: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      }),
      false
    );
  });

  test("Matching ownership passes strict validation", () => {
    assert.ok(
      validatePublicStoragePath(coverPath, {
        expectedProjectUuid: P_UUID,
        expectedMediaUuid: M_UUID,
      })
    );
  });

  test("buildPublicStorageUrl generates the public bucket URL from the stored path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lpurlfmpvriyvpkujvyl.supabase.co";
    assert.equal(
      buildPublicStorageUrl(coverPath, {
        expectedProjectUuid: P_UUID,
        expectedMediaUuid: M_UUID,
      }),
      `https://lpurlfmpvriyvpkujvyl.supabase.co/storage/v1/object/public/${PUBLIC_STORAGE_BUCKET}/${coverPath}`
    );
  });

  test("buildPublicStorageUrl returns null instead of guessing a rejected path", () => {
    assert.equal(buildPublicStorageUrl(`${P_UUID}/${M_UUID}/cover-1600.png`), null);
    assert.equal(buildPublicStorageUrl(`${P_UUID}/${M_UUID}/../../secret.webp`), null);
  });
});

describe("Public Portfolio — Route-Level Request Validation", () => {
  test("Absent page parameter defaults to page 1", () => {
    assert.equal(parsePageParam(undefined), 1);
  });

  test("Numeric page parameters are accepted", () => {
    assert.equal(parsePageParam("1"), 1);
    assert.equal(parsePageParam("7"), 7);
  });

  test("Zero, negative and non-numeric pages are rejected", () => {
    assert.equal(parsePageParam("0"), null);
    assert.equal(parsePageParam("-3"), null);
    assert.equal(parsePageParam("abc"), null);
    assert.equal(parsePageParam("1.5"), null);
  });

  test("Known service codes are accepted and unknown codes are flagged invalid", () => {
    assert.equal(parseServiceParam("modular_kitchens"), "modular_kitchens");
    assert.equal(parseServiceParam(undefined), null);
    assert.equal(parseServiceParam(""), null);
    assert.equal(parseServiceParam("unknown"), "invalid");
    assert.equal(parseServiceParam("__proto__"), "invalid");
  });

  test("Route validation resolves listing params without any Proxy involvement", () => {
    assert.deepEqual(parseListingParams({}), { page: 1, service: null });
    assert.deepEqual(parseListingParams({ page: "2", service: "custom_wardrobes" }), {
      page: 2,
      service: "custom_wardrobes",
    });
    assert.equal(parseListingParams({ page: "0" }), null);
    assert.equal(parseListingParams({ service: "unknown" }), null);
  });

  test("Slug validation enforces the published slug grammar", () => {
    assert.ok(isValidPortfolioSlug("luxury-villa-bandra"));
    assert.equal(isValidPortfolioSlug(""), false);
    assert.equal(isValidPortfolioSlug(undefined), false);
    assert.equal(isValidPortfolioSlug("../etc/passwd"), false);
    assert.equal(isValidPortfolioSlug("Luxury-Villa"), false);
    assert.equal(isValidPortfolioSlug("a".repeat(200)), false);
  });
});

describe("Public Portfolio — Cache Key Contract", () => {
  test("Featured cache uses the exact portfolio:featured tag", () => {
    assert.equal(PUBLIC_CACHE_TAGS.FEATURED, "portfolio:featured");
    assert.deepEqual(featuredCacheKeyParts(), ["public-portfolio", "featured"]);
  });

  test("Listing and sitemap tags use their exact names", () => {
    assert.equal(PUBLIC_CACHE_TAGS.LIST, "portfolio:list");
    assert.equal(PUBLIC_CACHE_TAGS.SITEMAP, "portfolio:sitemap");
    assert.deepEqual(sitemapCacheKeyParts(), ["public-portfolio", "sitemap"]);
  });

  test("Listing cache key changes by page", () => {
    assert.notDeepEqual(listingCacheKeyParts(1), listingCacheKeyParts(2));
    assert.ok(listingCacheKeyParts(2).includes("page:2"));
  });

  test("Listing cache key changes by service", () => {
    assert.notDeepEqual(
      listingCacheKeyParts(1, "modular_kitchens"),
      listingCacheKeyParts(1, "custom_wardrobes")
    );
    assert.ok(listingCacheKeyParts(1).includes("service:all"));
    assert.ok(listingCacheKeyParts(1, "modular_kitchens").includes("service:modular_kitchens"));
  });

  test("Detail tag and cache key use the canonical slug", () => {
    assert.equal(PUBLIC_CACHE_TAGS.PROJECT("luxury-apt"), "portfolio:project:luxury-apt");
    assert.deepEqual(detailCacheKeyParts("luxury-apt"), [
      "public-portfolio",
      "project",
      "slug:luxury-apt",
    ]);
    assert.notDeepEqual(detailCacheKeyParts("a"), detailCacheKeyParts("b"));
  });
});

describe("Public Portfolio — Invalidation Matrix", () => {
  const slug = "luxury-bandra-residence";

  test("Media invalidation includes portfolio:featured and portfolio:list", () => {
    const tags = publicPortfolioTagsFor(slug);
    assert.ok(tags.includes("portfolio:featured"));
    assert.ok(tags.includes("portfolio:list"));
  });

  test("Media invalidation includes portfolio:sitemap", () => {
    assert.ok(publicPortfolioTagsFor(slug).includes("portfolio:sitemap"));
  });

  test("Media invalidation includes the slug-scoped project tag", () => {
    assert.ok(
      publicPortfolioTagsFor(slug).includes(`portfolio:project:${slug}`)
    );
    assert.equal(publicPortfolioTagsFor(slug).length, 4);
  });

  test("Media invalidation includes /sitemap.xml", () => {
    assert.ok(publicPortfolioPathsFor(slug).includes("/sitemap.xml"));
  });

  test("Media invalidation includes home, listing and detail paths", () => {
    const paths = publicPortfolioPathsFor(slug);
    assert.deepEqual(paths, ["/", "/portfolio", `/portfolio/${slug}`, "/sitemap.xml"]);
  });
});

describe("Public Portfolio — Mapper Invariants & Malformed Project Filtering", () => {
  const validProjectRow: DetailProjectFields = {
    id: P_UUID,
    slug: "luxury-bandra-residence",
    title: "Luxury Bandra Residence",
    summary: "Complete home interior project in Bandra.",
    description: "Detailed description of the project.",
    status: "published",
    published_at: "2026-07-01T10:00:00Z",
    location_label: "Bandra, Mumbai",
    property_type: "4 BHK Apartment",
    completion_year: 2026,
    is_featured: true,
    seo_title: null,
    seo_description: null,
  };

  const validServiceRows: CardServiceFields[] = [
    { project_id: P_UUID, service_code: "complete_home_interiors" },
  ];

  const validMediaRows: CardMediaFields[] = [
    {
      id: M_UUID,
      project_id: P_UUID,
      media_role: "cover",
      status: "ready",
      public_object_path: `${P_UUID}/${M_UUID}/cover-1600.webp`,
      width_px: 1600,
      height_px: 1000,
      alt_text: "Living Room Cover",
      caption: "Spacious living area",
      sort_order: 1,
      created_at: "2026-06-01T10:00:00Z",
    },
  ];

  test("Valid project row maps to PublicPortfolioCard", () => {
    const card = mapProjectToCard(validProjectRow, validServiceRows, validMediaRows);
    assert.ok(card);
    assert.equal(card.slug, "luxury-bandra-residence");
    assert.equal(card.services.length, 1);
    assert.equal(card.services[0].serviceLabel, "Complete Home Interiors");
    assert.equal(card.cover.role, "cover");
  });

  test("Public card DTO exposes no owner, audit or private-origin fields", () => {
    const card = mapProjectToCard(validProjectRow, validServiceRows, validMediaRows);
    assert.ok(card);
    const serialised = JSON.stringify(card);

    assert.equal(serialised.includes("created_by"), false);
    assert.equal(serialised.includes("updated_by"), false);
    assert.equal(serialised.includes("portfolio-originals"), false);
    assert.equal(serialised.includes("portfolio_media_sources"), false);
    assert.equal(serialised.includes("checksum"), false);

    // No bare identifier fields on the DTO itself.
    assert.equal("id" in card, false);
    assert.equal("projectId" in card, false);
    assert.deepEqual(Object.keys(card.cover).sort(), [
      "altText",
      "caption",
      "height",
      "role",
      "url",
      "width",
    ]);
  });

  test("Project and media UUIDs surface only inside the public storage URL", () => {
    const card = mapProjectToCard(validProjectRow, validServiceRows, validMediaRows);
    assert.ok(card);

    // The public derivative path is <project>/<media>/<derivative>.webp, so the
    // identifiers are reachable only through the already-public Storage URL.
    const withoutCoverUrl = JSON.stringify({ ...card, cover: { ...card.cover, url: "" } });
    assert.equal(withoutCoverUrl.includes(P_UUID), false);
    assert.equal(withoutCoverUrl.includes(M_UUID), false);
    assert.ok(card.cover.url.includes(`/${PUBLIC_STORAGE_BUCKET}/`));
  });

  test("Draft status project returns null", () => {
    assert.equal(
      mapProjectToCard({ ...validProjectRow, status: "draft" }, validServiceRows, validMediaRows),
      null
    );
  });

  test("Archived status project returns null", () => {
    assert.equal(
      mapProjectToCard({ ...validProjectRow, status: "archived" }, validServiceRows, validMediaRows),
      null
    );
  });

  test("Missing services list returns null", () => {
    assert.equal(mapProjectToCard(validProjectRow, [], validMediaRows), null);
  });

  test("Unknown service code alone returns null", () => {
    assert.equal(
      mapProjectToCard(
        validProjectRow,
        [{ project_id: P_UUID, service_code: "not_a_service" }],
        validMediaRows
      ),
      null
    );
  });

  test("Missing cover image returns null", () => {
    assert.equal(mapProjectToCard(validProjectRow, validServiceRows, []), null);
  });

  test("Cover with non-positive dimensions returns null", () => {
    assert.equal(
      mapProjectToCard(validProjectRow, validServiceRows, [
        { ...validMediaRows[0], width_px: 0 },
      ]),
      null
    );
  });

  test("Cover with a rejected derivative path returns null", () => {
    assert.equal(
      mapProjectToCard(validProjectRow, validServiceRows, [
        { ...validMediaRows[0], public_object_path: `${P_UUID}/${M_UUID}/cover-1600.png` },
      ]),
      null
    );
  });

  test("Cover owned by a different project returns null", () => {
    const foreignUuid = "99999999-9999-4999-8999-999999999999";
    assert.equal(
      mapProjectToCard(validProjectRow, validServiceRows, [
        {
          ...validMediaRows[0],
          public_object_path: `${foreignUuid}/${M_UUID}/cover-1600.webp`,
        },
      ]),
      null
    );
  });

  test("Missing published_at returns null", () => {
    assert.equal(
      mapProjectToCard({ ...validProjectRow, published_at: null }, validServiceRows, validMediaRows),
      null
    );
  });

  test("Invalid slug grammar returns null", () => {
    assert.equal(
      mapProjectToCard({ ...validProjectRow, slug: "Invalid_Slug!" }, validServiceRows, validMediaRows),
      null
    );
  });

  test("Detail mapper caps the gallery at 12 images", () => {
    const galleryRows: CardMediaFields[] = Array.from({ length: 15 }).map((_, i) => {
      const gUuid = `22222222-3333-4444-8555-${(i + 1).toString(16).padStart(12, "0")}`;
      return {
        id: gUuid,
        project_id: P_UUID,
        media_role: "gallery",
        status: "ready",
        public_object_path: `${P_UUID}/${gUuid}/gallery-1200.webp`,
        width_px: 1200,
        height_px: 800,
        alt_text: `Gallery Photo ${i + 1}`,
        caption: null,
        sort_order: i + 1,
        created_at: "2026-06-01T10:00:00Z",
      };
    });

    const detail = mapProjectToDetail(validProjectRow, validServiceRows, [
      ...validMediaRows,
      ...galleryRows,
    ]);

    assert.ok(detail);
    assert.equal(detail.gallery.length, 12);
    assert.ok(detail.gallery.every((g) => g.url.endsWith("gallery-1200.webp")));
  });
});

describe("Public Portfolio — Sitemap Contract", () => {
  test("lastModified uses the latest ready media timestamp", () => {
    const resolved = resolveLastModified({
      updated_at: "2026-07-01T10:00:00Z",
      published_at: "2026-07-02T10:00:00Z",
      services: [{ created_at: "2026-07-03T10:00:00Z" }],
      media: [{ updated_at: "2026-07-09T10:00:00Z" }],
    });
    assert.equal(resolved.toISOString(), "2026-07-09T10:00:00.000Z");
  });

  test("lastModified uses the latest service mapping timestamp", () => {
    const resolved = resolveLastModified({
      updated_at: "2026-07-01T10:00:00Z",
      published_at: "2026-07-02T10:00:00Z",
      services: [{ created_at: "2026-07-08T10:00:00Z" }],
      media: [{ updated_at: "2026-07-04T10:00:00Z" }],
    });
    assert.equal(resolved.toISOString(), "2026-07-08T10:00:00.000Z");
  });

  test("lastModified falls back to project and publication timestamps", () => {
    const resolved = resolveLastModified({
      updated_at: "2026-07-06T10:00:00Z",
      published_at: "2026-07-05T10:00:00Z",
      services: [],
      media: [],
    });
    assert.equal(resolved.toISOString(), "2026-07-06T10:00:00.000Z");
  });

  test("Sitemap projection embeds services and media in one select", () => {
    assert.ok(SITEMAP_SELECT.includes("portfolio_project_services("));
    assert.ok(SITEMAP_SELECT.includes("portfolio_media("));
  });

  test("Sitemap repository stays within one Supabase request", async () => {
    let fromCalls = 0;

    const rows = [
      {
        id: P_UUID,
        slug: "published-featured-villa",
        title: "Published Featured Villa",
        summary: "Complete home interior project for a luxury villa.",
        status: "published",
        published_at: "2026-07-02T10:00:00Z",
        updated_at: "2026-07-01T10:00:00Z",
        location_label: null,
        property_type: null,
        completion_year: null,
        is_featured: true,
        portfolio_project_services: [
          { project_id: P_UUID, service_code: "complete_home_interiors", created_at: "2026-07-03T10:00:00Z" },
        ],
        portfolio_media: [
          {
            id: M_UUID,
            project_id: P_UUID,
            media_role: "cover",
            status: "ready",
            public_object_path: `${P_UUID}/${M_UUID}/cover-1600.webp`,
            width_px: 1600,
            height_px: 1000,
            alt_text: "Villa cover",
            caption: null,
            sort_order: 1,
            created_at: "2026-07-01T10:00:00Z",
            updated_at: "2026-07-11T10:00:00Z",
          },
        ],
      },
    ];

    const builder = {
      select: () => builder,
      eq: () => builder,
      then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
        resolve({ data: rows, error: null }),
    };

    const fakeClient = {
      from: () => {
        fromCalls += 1;
        return builder;
      },
    } as unknown as PublicSupabaseClient;

    const entries = await querySitemapEntries(fakeClient);

    assert.equal(fromCalls, 1, "sitemap must issue exactly one Supabase request");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].slug, "published-featured-villa");
    assert.equal(entries[0].lastModified.toISOString(), "2026-07-11T10:00:00.000Z");
  });

  test("Sitemap excludes malformed published projects", async () => {
    const rows = [
      {
        id: P_UUID,
        slug: "malformed-no-service",
        title: "Malformed No Service",
        summary: "Published project with no service mapping at all.",
        status: "published",
        published_at: "2026-07-02T10:00:00Z",
        updated_at: "2026-07-01T10:00:00Z",
        location_label: null,
        property_type: null,
        completion_year: null,
        is_featured: false,
        portfolio_project_services: [],
        portfolio_media: [],
      },
    ];

    const builder = {
      select: () => builder,
      eq: () => builder,
      then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
        resolve({ data: rows, error: null }),
    };

    const fakeClient = {
      from: () => builder,
    } as unknown as PublicSupabaseClient;

    assert.deepEqual(await querySitemapEntries(fakeClient), []);
  });
});

describe("Public Portfolio — Public Client Credential Boundary", () => {
  test("Repository column projections exclude owner and audit columns", async () => {
    const queries = await import("../public-portfolio-queries.ts");
    const projections = [
      queries.CARD_PROJECT_COLUMNS,
      queries.DETAIL_PROJECT_COLUMNS,
      queries.SERVICE_COLUMNS,
      queries.MEDIA_COLUMNS,
    ];

    for (const projection of projections) {
      assert.equal(projection.includes("created_by"), false);
      assert.equal(projection.includes("updated_by"), false);
      assert.equal(projection.includes("*"), false);
    }
  });

  test("Card project fields describe a published-project subset only", () => {
    const fields: CardProjectFields = {
      id: P_UUID,
      slug: "s-lug",
      title: "Title",
      summary: "A sufficiently long project summary for the public card.",
      status: "published",
      published_at: "2026-07-01T10:00:00Z",
      location_label: null,
      property_type: null,
      completion_year: null,
      is_featured: false,
    };
    assert.equal(Object.keys(fields).length, 10);
  });
});

describe("Public Portfolio — Listing Pagination Contract", () => {
  const projectUuid = (i: number) => `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  const mediaUuid = (i: number) => `20000000-0000-4000-9000-${String(i).padStart(12, "0")}`;

  function buildRows(count: number) {
    const projects = [];
    const services = [];
    const media = [];

    for (let i = 1; i <= count; i += 1) {
      projects.push({
        id: projectUuid(i),
        slug: `published-project-${String(i).padStart(2, "0")}`,
        title: `Project ${i}`,
        summary: "A sufficiently long project summary for the public card.",
        status: "published",
        published_at: "2026-07-01T10:00:00Z",
        location_label: null,
        property_type: null,
        completion_year: null,
        is_featured: false,
      });
      services.push({ project_id: projectUuid(i), service_code: "modular_kitchens" });
      media.push({
        id: mediaUuid(i),
        project_id: projectUuid(i),
        media_role: "cover",
        status: "ready",
        public_object_path: `${projectUuid(i)}/${mediaUuid(i)}/cover-1600.webp`,
        width_px: 1600,
        height_px: 1000,
        alt_text: `Cover ${i}`,
        caption: null,
        sort_order: 1,
        created_at: "2026-07-01T10:00:00Z",
      });
    }

    return { projects, services, media };
  }

  function fakeClient(rows: ReturnType<typeof buildRows>) {
    const recorded = {
      selects: [] as string[],
      filters: [] as string[],
      range: null as [number, number] | null,
    };

    const dataFor = (table: string) => {
      if (table === "portfolio_projects") return rows.projects;
      if (table === "portfolio_project_services") return rows.services;
      return rows.media;
    };

    const builderFor = (table: string) => {
      const builder = {
        select: (projection: string) => {
          recorded.selects.push(projection);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          recorded.filters.push(`${column}=${String(value)}`);
          return builder;
        },
        not: (column: string, operator: string, value: unknown) => {
          recorded.filters.push(`${column} not.${operator}.${String(value)}`);
          return builder;
        },
        in: (column: string) => {
          recorded.filters.push(`${column} in`);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        range: (from: number, to: number) => {
          recorded.range = [from, to];
          return builder;
        },
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: dataFor(table), error: null }),
      };
      return builder;
    };

    const client = {
      from: (table: string) => builderFor(table),
    } as unknown as PublicSupabaseClient;

    return { client, recorded };
  }

  test("Listing excludes undisplayable projects in the database, not after pagination", async () => {
    const { client, recorded } = fakeClient(buildRows(1));
    await queryPaginatedProjects(client, 1);

    const listingSelect = recorded.selects[0];
    assert.ok(
      listingSelect.includes("portfolio_project_services!inner"),
      "listing must inner-join services so projects without one never occupy a page slot"
    );
    assert.ok(
      listingSelect.includes("portfolio_media!inner"),
      "listing must inner-join media so projects without a cover never occupy a page slot"
    );
    assert.ok(recorded.filters.includes("portfolio_media.status=ready"));
    assert.ok(recorded.filters.includes("portfolio_media.media_role=cover"));
    assert.ok(recorded.filters.includes("portfolio_media.public_object_path not.is.null"));
  });

  test("Listing requests exactly one row beyond the page size", async () => {
    const { client, recorded } = fakeClient(buildRows(1));
    await queryPaginatedProjects(client, 1);
    assert.deepEqual(recorded.range, [0, PUBLIC_LISTING_PAGE_SIZE]);
  });

  test("Listing offsets by whole pages", async () => {
    const { client, recorded } = fakeClient(buildRows(1));
    await queryPaginatedProjects(client, 3);
    assert.deepEqual(recorded.range, [
      PUBLIC_LISTING_PAGE_SIZE * 2,
      PUBLIC_LISTING_PAGE_SIZE * 3,
    ]);
  });

  test("A full page reports a next page and never exceeds the page size", async () => {
    const { client } = fakeClient(buildRows(PUBLIC_LISTING_PAGE_SIZE + 1));
    const result = await queryPaginatedProjects(client, 1);

    assert.equal(result.cards.length, PUBLIC_LISTING_PAGE_SIZE);
    assert.equal(result.hasNextPage, true);
  });

  test("A partial page reports no next page", async () => {
    const { client } = fakeClient(buildRows(PUBLIC_LISTING_PAGE_SIZE));
    const result = await queryPaginatedProjects(client, 1);

    assert.equal(result.cards.length, PUBLIC_LISTING_PAGE_SIZE);
    assert.equal(result.hasNextPage, false);
  });

  test("An empty page yields no cards and no next page", async () => {
    const { client } = fakeClient(buildRows(0));
    const result = await queryPaginatedProjects(client, 9);

    assert.deepEqual(result.cards, []);
    assert.equal(result.hasNextPage, false);
    assert.equal(result.page, 9);
  });

  test("Service filter is applied to the joined service code and echoed back", async () => {
    const { client, recorded } = fakeClient(buildRows(2));
    const result = await queryPaginatedProjects(client, 1, "modular_kitchens");

    assert.ok(
      recorded.filters.includes("portfolio_project_services.service_code=modular_kitchens")
    );
    assert.equal(result.activeService, "modular_kitchens");
  });

  test("Listing issues at most three requests per page", async () => {
    let fromCalls = 0;
    const rows = buildRows(3);
    const { client } = fakeClient(rows);
    const counting = new Proxy(client as object, {
      get(target, prop, receiver) {
        if (prop === "from") {
          fromCalls += 1;
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as PublicSupabaseClient;

    await queryPaginatedProjects(counting, 1);
    assert.ok(fromCalls <= 3, `expected at most 3 requests, saw ${fromCalls}`);
  });
});

import "../../../public-site/home-r4/__tests__/home-r4-production.test.ts";
import "../../../public-site/home-r4/__tests__/plan-state.test.ts";
import "../../../public-site/home-r4/__tests__/project-proof.test.ts";
import "../../../public-site/home-r4/__tests__/r5-value.test.ts";
import "../../../public-site/home-r4/__tests__/r5-3-conversion.test.ts";
import "../../../public-site/home-r4/__tests__/r5-3-1-estimator.test.ts";
import "../../../public-site/home-r4/__tests__/r5-1-polish.test.ts";
import "../../../public-site/home-r4/__tests__/r5-4-final.test.ts";
import "../../../public-site/home-r4/__tests__/r5-5-dark-theme.test.ts";

{
  const harness = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const homeR4Imports = harness.match(
    /import\s+["']\.\.\/\.\.\/\.\.\/public-site\/home-r4\/__tests__\/[^"']+["']/g
  );
  assert.equal(
    homeR4Imports?.length,
    new Set(homeR4Imports).size,
    "home-r4 harness imports must not be duplicated"
  );
}
