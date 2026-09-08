/**
 * Room categories are many-to-many, and the filtering authority moved with them.
 *
 * WHY THE SCALAR HAD TO GO
 *
 * `portfolio_projects` is a WHOLE-PROJECT record — one row is one delivered
 * home, with a location, a property type, a completion year and a gallery. A
 * delivered home is photographed across its kitchen, its hall and its bedrooms,
 * so it belongs under several room categories at once. The old scalar
 * `portfolio_category_code` allowed exactly one, which left the other
 * categories empty even though the photographs existed.
 *
 * The two escapes were both dishonest: split one home into several fake
 * "projects", or pick one room and pretend the rest were not delivered.
 *
 * WHAT THIS SUITE HOLDS
 *
 * That the listing filters through `portfolio_project_categories` and not the
 * scalar; that a project mapped to several categories appears in each of them
 * and exactly once within any one of them; that service and category remain
 * independent dimensions that compose by intersection; and that the cache
 * cannot serve one category's listing for another.
 *
 * The SQL side — constraints, cascade, RLS, the atomic replacement — is proven
 * in `55_portfolio_project_categories_test.sql`. This file is the application
 * half of the same contract.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CATEGORY_IDS,
  isPortfolioCategoryId,
  type PortfolioCategoryId,
} from "../portfolio-categories.ts";
import { listingCacheKeyParts } from "../public-cache-keys.ts";
import { mapProjectCategories } from "../public-portfolio-mapper.ts";
import {
  queryPaginatedProjects,
  type PublicSupabaseClient,
} from "../public-portfolio-queries.ts";
import { parseListingParams } from "../public-request-validation.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const MIGRATION =
  "supabase/migrations/20260908150000_portfolio_project_categories.sql";
/** Where the allowlist and the replacement RPC were last redefined. */
const ROOM_MIGRATION =
  "supabase/migrations/20260908160000_portfolio_media_room_browse.sql";
const QUERIES = "src/features/portfolio/public/public-portfolio-queries.ts";
const ACTIONS = "src/features/portfolio/server/portfolio-cms-actions.ts";
const FORM = "src/features/portfolio/components/PortfolioProjectForm.tsx";
const EDITOR = "src/app/admin/portfolio/[projectId]/page.tsx";

/* ========================================================================== */
/* A recording fake, shaped like the one in public-portfolio.test.ts           */
/* ========================================================================== */

function fakeClient() {
  const recorded = {
    selects: [] as string[],
    filters: [] as string[],
    tables: [] as string[],
  };

  const builderFor = (table: string) => {
    recorded.tables.push(table);
    const builder = {
      select: (projection: string) => {
        recorded.selects.push(projection);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        recorded.filters.push(`${column}=${String(value)}`);
        return builder;
      },
      not: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      maybeSingle: () => builder,
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        resolve({ data: [], error: null }),
    };
    return builder;
  };

  const client = {
    from: (table: string) => builderFor(table),
  } as unknown as PublicSupabaseClient;

  return { client, recorded };
}

/* ========================================================================== */
/* 1. The filtering authority moved                                            */
/* ========================================================================== */

describe("the listing filters through the join table, not the scalar", () => {
  test("a category filter joins portfolio_project_categories", async () => {
    const { client, recorded } = fakeClient();
    await queryPaginatedProjects(client, 1, undefined, "kitchen");

    const listing = recorded.selects[0]!;
    assert.ok(
      listing.includes("portfolio_project_categories!inner"),
      "the category filter must narrow the parent set through an inner join"
    );
    assert.ok(
      recorded.filters.includes(
        "portfolio_project_categories.category_code=kitchen"
      ),
      "and filter on the join table's column"
    );
  });

  test("the deprecated scalar is never used for filtering", async () => {
    for (const category of PORTFOLIO_CATEGORY_IDS) {
      const { client, recorded } = fakeClient();
      await queryPaginatedProjects(client, 1, undefined, category);
      assert.ok(
        !recorded.filters.some((f) => f.startsWith("portfolio_category_code=")),
        `${category}: filtering must not read portfolio_category_code`
      );
    }
    /*
     * And the module does not mention it at all. The column still exists for
     * historical rows, but two authorities writing or reading the same fact is
     * how they drift — so the runtime has exactly one.
     */
    assert.doesNotMatch(code(read(QUERIES)), /portfolio_category_code/);
  });

  test("all four categories are wired the same way", async () => {
    for (const { id } of PORTFOLIO_CATEGORIES) {
      const { client, recorded } = fakeClient();
      await queryPaginatedProjects(client, 1, undefined, id);
      assert.ok(
        recorded.selects[0]!.includes("portfolio_project_categories!inner"),
        `${id} must filter through the join table`
      );
      assert.ok(
        recorded.filters.includes(
          `portfolio_project_categories.category_code=${id}`
        ),
        `${id} must filter on its own code`
      );
    }
  });

  test("no category filter means no category join", async () => {
    const { client, recorded } = fakeClient();
    await queryPaginatedProjects(client, 1);
    assert.ok(
      !recorded.selects[0]!.includes("portfolio_project_categories"),
      "an unfiltered listing must not narrow to classified projects only"
    );
  });
});

/* ========================================================================== */
/* 2. The two dimensions stay independent                                      */
/* ========================================================================== */

describe("service and category are different questions", () => {
  test("a service filter alone does not touch categories", async () => {
    const { client, recorded } = fakeClient();
    await queryPaginatedProjects(client, 1, "modular_kitchens");
    assert.ok(
      recorded.filters.includes(
        "portfolio_project_services.service_code=modular_kitchens"
      )
    );
    assert.ok(!recorded.selects[0]!.includes("portfolio_project_categories"));
  });

  test("both together intersect, and neither is derived from the other", async () => {
    const { client, recorded } = fakeClient();
    await queryPaginatedProjects(client, 1, "modular_kitchens", "hall");

    const listing = recorded.selects[0]!;
    assert.ok(listing.includes("portfolio_project_services!inner"));
    assert.ok(listing.includes("portfolio_project_categories!inner"));
    assert.ok(
      recorded.filters.includes(
        "portfolio_project_services.service_code=modular_kitchens"
      )
    );
    assert.ok(
      recorded.filters.includes("portfolio_project_categories.category_code=hall")
    );
  });

  test("a service code is not a category code, in either direction", () => {
    for (const service of [
      "complete_home_interiors",
      "modular_kitchens",
      "custom_wardrobes",
    ]) {
      assert.equal(
        isPortfolioCategoryId(service),
        false,
        `${service} is a service, not a room category`
      );
    }
    for (const category of PORTFOLIO_CATEGORY_IDS) {
      assert.doesNotMatch(category, /_/, "category codes are hyphenated");
    }
  });
});

/* ========================================================================== */
/* 3. One project, several categories, counted once                            */
/* ========================================================================== */

describe("a whole-home project spans categories without duplicating", () => {
  const PROJECT = "11111111-1111-4111-8111-111111111111";
  const OTHER = "22222222-2222-4222-8222-222222222222";

  const allFour = PORTFOLIO_CATEGORY_IDS.map((category_code) => ({
    project_id: PROJECT,
    category_code,
  }));

  test("one project can carry all four categories", () => {
    const mapped = mapProjectCategories(PROJECT, allFour);
    assert.equal(mapped.length, 4);
    assert.deepEqual(
      mapped.map((c) => c.categoryId),
      [...PORTFOLIO_CATEGORY_IDS]
    );
  });

  test("the order is canonical, not whatever the database returned", () => {
    const shuffled = [...allFour].reverse();
    assert.deepEqual(
      mapProjectCategories(PROJECT, shuffled).map((c) => c.categoryId),
      [...PORTFOLIO_CATEGORY_IDS],
      "chips must read the same on every request"
    );
  });

  test("a repeated row does not produce a repeated chip", () => {
    /*
     * The composite primary key makes this impossible in the database. The
     * mapper de-duplicates anyway, because a listing that showed "Kitchen"
     * twice would be a visible defect and the cost of the Set is nothing.
     */
    const duplicated = [
      { project_id: PROJECT, category_code: "kitchen" },
      { project_id: PROJECT, category_code: "kitchen" },
    ];
    assert.deepEqual(
      mapProjectCategories(PROJECT, duplicated).map((c) => c.categoryId),
      ["kitchen"]
    );
  });

  test("another project's mappings never leak in", () => {
    const mixed = [
      { project_id: PROJECT, category_code: "kitchen" },
      { project_id: OTHER, category_code: "bedroom" },
    ];
    assert.deepEqual(
      mapProjectCategories(PROJECT, mixed).map((c) => c.categoryId),
      ["kitchen"]
    );
    assert.deepEqual(
      mapProjectCategories(OTHER, mixed).map((c) => c.categoryId),
      ["bedroom"]
    );
  });

  test("an unrecognised stored code is dropped, never labelled", () => {
    const rogue = [
      { project_id: PROJECT, category_code: "balcony" },
      { project_id: PROJECT, category_code: "living-room" },
    ];
    assert.deepEqual(
      mapProjectCategories(PROJECT, rogue).map((c) => c.categoryId),
      ["living-room"],
      "a label this module invented would be worse than an omission"
    );
  });

  test("an unclassified project maps to nothing", () => {
    assert.deepEqual(mapProjectCategories(PROJECT, []), []);
  });
});

/* ========================================================================== */
/* 4. The cache cannot cross categories                                        */
/* ========================================================================== */

describe("listing cache identity carries all three components", () => {
  test("page, service and category all appear in the key", () => {
    const parts = listingCacheKeyParts(2, "modular_kitchens", "kitchen");
    assert.ok(parts.includes("page:2"));
    assert.ok(parts.includes("service:modular_kitchens"));
    assert.ok(parts.includes("category:kitchen"));
  });

  test("two categories never share an entry", () => {
    const kitchen = listingCacheKeyParts(1, undefined, "kitchen").join("|");
    const bedroom = listingCacheKeyParts(1, undefined, "bedroom").join("|");
    const unfiltered = listingCacheKeyParts(1).join("|");
    assert.notEqual(kitchen, bedroom);
    assert.notEqual(kitchen, unfiltered);
    assert.notEqual(bedroom, unfiltered);
  });

  test("the absent filters are named rather than omitted", () => {
    /*
     * "all" rather than a dropped segment: if the parts were simply shorter,
     * `["…","page:1","kitchen"]` and `["…","page:1","service:kitchen"]` could
     * collide depending on which filter was missing.
     */
    const parts = listingCacheKeyParts(1);
    assert.ok(parts.includes("service:all"));
    assert.ok(parts.includes("category:all"));
  });

  test("the cache module uses the key function rather than appending", () => {
    const cache = code(
      read("src/features/portfolio/public/public-portfolio-cache.ts")
    );
    assert.match(
      cache,
      /listingCacheKeyParts\(page, serviceFilter, categoryFilter\)/
    );
    assert.doesNotMatch(
      cache,
      /\.\.\.listingCacheKeyParts/,
      "the key function must own every component, so a test can assert it"
    );
  });
});

/* ========================================================================== */
/* 5. Request validation is unchanged                                          */
/* ========================================================================== */

describe("invalid categories still produce a real 404", () => {
  test("every canonical category is accepted", () => {
    for (const id of PORTFOLIO_CATEGORY_IDS) {
      const parsed = parseListingParams({ category: id });
      assert.ok(parsed, id);
      assert.equal(parsed!.category, id);
    }
  });

  test("an unknown category refuses the request", () => {
    for (const bogus of ["balcony", "bathroom", "__proto__", "KITCHEN"]) {
      assert.equal(parseListingParams({ category: bogus }), null, bogus);
    }
  });

  test("the default listing carries no category", () => {
    const parsed = parseListingParams({});
    assert.ok(parsed);
    assert.equal(parsed!.category, null);
    assert.equal(parsed!.page, 1);
  });
});

/* ========================================================================== */
/* 6. Admin: multi-select, replaced atomically, validated server-side          */
/* ========================================================================== */

describe("the CMS edits a set, not a single value", () => {
  test("the form renders one checkbox per canonical category", () => {
    const form = read(FORM);
    assert.match(form, /PORTFOLIO_CATEGORIES\.map/);
    assert.match(form, /type="checkbox"/);
    assert.match(form, /name="categories"/);
    assert.match(form, /value=\{category\.id\}/);
    // Labels, not raw codes.
    assert.match(form, /\{category\.label\}/);
  });

  test("existing mappings preselect, and nothing is preselected by default", () => {
    const form = code(read(FORM));
    assert.match(form, /defaultChecked=\{assignedCategories\.includes\(category\.id\)\}/);
    assert.match(
      form,
      /assignedCategories = initialValues\?\.categories \?\? \[\]/,
      "a new project starts unclassified — pre-ticking would be guesswork"
    );
  });

  test("the editor page loads the project's current categories", () => {
    const editor = read(EDITOR);
    assert.match(editor, /portfolio_project_categories\(category_code\)/);
    assert.match(editor, /isPortfolioCategoryId/);
    assert.match(editor, /categories: assignedCategories/);
  });

  test("both create and update replace the set through the atomic RPC", () => {
    const actions = read(ACTIONS);
    const calls = actions.match(/replace_portfolio_project_categories/g) ?? [];
    assert.equal(calls.length, 2, "create and update must both go through it");
    assert.match(actions, /requested_category_codes/);
    // The service RPC is untouched and still separate.
    assert.equal(
      (actions.match(/replace_portfolio_project_services/g) ?? []).length,
      2
    );
  });

  test("an unknown code is refused rather than filtered out", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /function readRequestedCategories/);
    assert.match(actions, /if \(raw\.some\(\(code\) => !isPortfolioCategoryId\(code\)\)\)/);
    assert.match(actions, /return null;/);
    assert.match(actions, /fieldErrors\.categories/);
  });

  test("the submitted set is de-duplicated into canonical order", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /const chosen = new Set\(raw\)/);
    assert.match(
      actions,
      /PORTFOLIO_CATEGORY_IDS\.filter\(\(id\) => chosen\.has\(id\)\)/
    );
  });
});

/* ========================================================================== */
/* 7. Compatibility: the scalar survives but no longer decides                 */
/* ========================================================================== */

describe("the deprecated scalar is retained and unused", () => {
  test("the migration does not drop the column", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql.toLowerCase(), /drop column/);
    assert.doesNotMatch(sql.toLowerCase(), /drop table/);
    assert.match(sql, /DEPRECATED compatibility column/);
  });

  test("it carries existing classifications across, and invents none", () => {
    const sql = read(MIGRATION);
    assert.match(
      sql,
      /insert into public\.portfolio_project_categories \(project_id, category_code\)/
    );
    assert.match(sql, /where p\.portfolio_category_code is not null/);
    assert.match(sql, /on conflict \(project_id, category_code\) do nothing/);
  });

  test("the migration creates no project or media content", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /insert into public\.portfolio_projects/);
    assert.doesNotMatch(sql, /insert into public\.portfolio_media/);
  });

  test("the join table is additive: the service dimension is untouched", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /alter table public\.portfolio_project_services/);
    assert.doesNotMatch(sql, /drop .*portfolio_project_services/i);
  });

  test("the RPC is invoker with a pinned search_path, not a definer shortcut", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /security invoker/);
    assert.match(sql, /set search_path = ''/);
    assert.doesNotMatch(sql, /security definer/);
    assert.match(sql, /authorize\('portfolio\.manage'\)/);
    assert.match(
      sql,
      /revoke execute on function public\.replace_portfolio_project_categories/
    );
  });
});

/* ========================================================================== */
/* 8. One definition of the four categories                                    */
/* ========================================================================== */

describe("the category vocabulary is declared once", () => {
  test("the ids match the SQL check constraint exactly", () => {
    /*
     * The CURRENT constraint, not the one this table was born with. Migration
     * 20260908160000 rewrote the allowlist to drop Hall for Living Room, and
     * reading 20260908150000 here would assert a definition the database has
     * already replaced.
     */
    const sql = read(ROOM_MIGRATION);
    const constraint = /check \(category_code in \(([^)]*)\)\)/.exec(sql);
    assert.ok(constraint, "the migration must carry a category allowlist");
    const listed = [...constraint![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [...PORTFOLIO_CATEGORY_IDS].sort());
  });

  test("the RPC validates against the same four", () => {
    const sql = read(ROOM_MIGRATION);
    const guard = /if v_code not in \(([^)]*)\) then/.exec(sql);
    assert.ok(guard);
    const listed = [...guard![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [...PORTFOLIO_CATEGORY_IDS].sort());
  });

  test("the homepage cards still name the approved four, in order", () => {
    assert.deepEqual(
      PORTFOLIO_CATEGORIES.map((c) => c.id),
      ["complete-interiors", "kitchen", "living-room", "bedroom"]
    );
    assert.deepEqual(
      PORTFOLIO_CATEGORIES.map((c) => c.label),
      ["Complete Interiors", "Kitchen", "Living Room", "Bedroom"]
    );
  });

  test("the type and the runtime list cannot drift apart", () => {
    const ids: readonly PortfolioCategoryId[] = PORTFOLIO_CATEGORY_IDS;
    assert.equal(ids.length, 4);
    for (const id of ids) {
      assert.equal(isPortfolioCategoryId(id), true, id);
    }
  });
});
