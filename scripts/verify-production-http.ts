import assert from "node:assert/strict";

const BASE_URL = "http://127.0.0.1:3100";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface CheckResult {
  url: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string[];
}

async function verifyEndpoint(
  path: string,
  expectedStatus: number,
  bodyCheck?: (body: string) => void
): Promise<CheckResult> {
  const url = `${BASE_URL}${path}`;
  const notes: string[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const actualStatus = res.status;
    const body = await res.text();

    let passed = actualStatus === expectedStatus;
    if (actualStatus !== expectedStatus) {
      notes.push(`Status mismatch: expected ${expectedStatus}, got ${actualStatus}`);
    } else {
      notes.push(`Status matches ${expectedStatus}`);
    }

    if (actualStatus === 200 && bodyCheck) {
      try {
        bodyCheck(body);
        notes.push("Body assertions passed");
      } catch (err: unknown) {
        passed = false;
        notes.push(`Body assertion failed: ${errorMessage(err)}`);
      }
    }

    return { url: path, expectedStatus, actualStatus, passed, notes };
  } catch (err: unknown) {
    return {
      url: path,
      expectedStatus,
      actualStatus: 0,
      passed: false,
      notes: [`Fetch failed: ${errorMessage(err)}`],
    };
  }
}

export async function runHttpVerification() {
  console.log("=== Phase 2E3B Production HTTP Verification ===");
  const results: CheckResult[] = [];

  // 1. GET /
  results.push(
    await verifyEndpoint("/", 200, (body) => {
      assert.ok(body.includes("ONEDECORE"), "Includes brand name");
      assert.ok(body.includes("published-featured-villa"), "Includes featured project card link");
      assert.ok(!body.includes("published-regular-kitchen"), "Excludes non-featured projects from homepage");
    })
  );

  // 2. GET /portfolio
  results.push(
    await verifyEndpoint("/portfolio", 200, (body) => {
      assert.ok(body.includes("Interior Design Portfolio"), "Includes page header");
      assert.ok(body.includes("https://onedecore.in/portfolio"), "Includes .in canonical URL");
      const cardMatches = (body.match(/id="portfolio-card-/g) || []).length;
      // React Server Components render DOM element + flight payload string (2 per card)
      const uniqueCards = Math.ceil(cardMatches / 2);
      assert.ok(uniqueCards > 0 && uniqueCards <= 12, `Maximum 12 listing cards (found ${uniqueCards})`);
    })
  );

  // 3. GET /portfolio?page=2
  results.push(
    await verifyEndpoint("/portfolio?page=2", 200, (body) => {
      assert.ok(/Page\s*(?:<!--.*?-->)?\s*2/i.test(body) || body.includes("page=2"), "Indicates page 2");
    })
  );

  // 4. GET /portfolio?service=modular_kitchens
  results.push(
    await verifyEndpoint("/portfolio?service=modular_kitchens", 200, (body) => {
      assert.ok(body.includes("Modular Kitchens"), "Shows modular kitchens filter text");
    })
  );

  // 5. GET /portfolio?page=0 -> 404
  results.push(await verifyEndpoint("/portfolio?page=0", 404));

  // 6. GET /portfolio?page=abc -> 404
  results.push(await verifyEndpoint("/portfolio?page=abc", 404));

  // 7. GET /portfolio?service=unknown -> 404
  results.push(await verifyEndpoint("/portfolio?service=unknown", 404));

  // 8. GET /portfolio/published-featured-villa -> 200
  results.push(
    await verifyEndpoint("/portfolio/published-featured-villa", 200, (body) => {
      assert.ok(body.includes("Published Featured Villa"), "Shows title");
      assert.ok(body.includes("https://onedecore.in/portfolio/published-featured-villa"), "Shows canonical .in URL");
      assert.ok(body.includes("application/ld+json"), "Includes JSON-LD script");
      assert.ok(body.includes("@graph"), "JSON-LD uses @graph syntax");
      assert.ok(!body.includes("portfolio-originals"), "Does not leak portfolio-originals bucket");
      assert.ok(!body.includes("created_by"), "Does not leak internal user identity fields");
    })
  );

  // 9. GET /portfolio/draft-penthouse-design -> 404
  results.push(await verifyEndpoint("/portfolio/draft-penthouse-design", 404));

  // 10. GET /portfolio/archived-legacy-project -> 404
  results.push(await verifyEndpoint("/portfolio/archived-legacy-project", 404));

  // 11. GET /portfolio/malformed-no-service -> 404
  results.push(await verifyEndpoint("/portfolio/malformed-no-service", 404));

  // 12. GET /sitemap.xml -> 200
  results.push(
    await verifyEndpoint("/sitemap.xml", 200, (body) => {
      assert.ok(body.includes("https://onedecore.in"), "Uses onedecore.in canonical domain");
      assert.ok(body.includes("https://onedecore.in/portfolio/published-featured-villa"), "Includes published project");
      assert.ok(!body.includes("draft-penthouse-design"), "Excludes draft project from sitemap");
      assert.ok(!body.includes("archived-legacy-project"), "Excludes archived project from sitemap");
      assert.ok(!body.includes("malformed-no-service"), "Excludes malformed project from sitemap");
    })
  );

  // 13. GET /robots.txt -> 200
  results.push(
    await verifyEndpoint("/robots.txt", 200, (body) => {
      assert.ok(body.includes("Host: https://onedecore.in"), "Specifies Host header with onedecore.in");
      assert.ok(body.includes("Sitemap: https://onedecore.in/sitemap.xml"), "Specifies sitemap URL");
      assert.ok(body.includes("Disallow: /admin/"), "Disallows admin routes");
      assert.ok(body.includes("Disallow: /auth/"), "Disallows auth routes");
    })
  );

  console.log("\nResults Summary:");
  let allPassed = true;
  for (const r of results) {
    const statusStr = r.passed ? "PASS" : "FAIL";
    console.log(`[${statusStr}] ${r.url} -> Expected: ${r.expectedStatus}, Got: ${r.actualStatus} (${r.notes.join("; ")})`);
    if (!r.passed) allPassed = false;
  }

  if (!allPassed) {
    console.error("HTTP verification FAILED!");
    process.exit(1);
  } else {
    console.log("\nAll 13 Production HTTP verification endpoints PASSED!");
  }
}

if (process.argv[1]?.includes("verify-production-http")) {
  runHttpVerification().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
