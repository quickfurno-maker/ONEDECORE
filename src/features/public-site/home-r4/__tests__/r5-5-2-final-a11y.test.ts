/**
 * R5.5.2 forced-colours focus + loading status announcement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

const root = process.cwd();
const theme = join(root, "src/features/public-site/theme");
const portfolioApp = join(root, "src/app/portfolio");
const evidence = join(root, "onedecore-chatgpt/phase-2f-r5-5-2-final-a11y");

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("R5.5.2 forced-colours focus", () => {
  test("forced-colours media query uses Highlight outline and clears box-shadow", () => {
    const css = read(join(theme, "public-dark-theme.css"));
    assert.match(css, /@media \(forced-colors:\s*active\)/);
    assert.match(css, /outline:\s*2px solid Highlight/);
    assert.match(css, /box-shadow:\s*none/);
    assert.match(css, /\.od-skip:focus-visible/);
    // Normal-mode gold focus ring preserved
    assert.match(css, /box-shadow:\s*var\(--od-focus\)/);
    assert.match(css, /--od-focus:\s*0 0 0 2px/);
  });
});

describe("R5.5.2 loading status announcement", () => {
  test("status is outside busy region with single spoken message", () => {
    const source = read(join(portfolioApp, "loading.tsx"));
    assert.match(source, /role="status"/);
    assert.match(source, /aria-busy="true"/);
    assert.match(source, /aria-label="Loading Portfolio"/);
    assert.doesNotMatch(source, /aria-live/);
    assert.match(source, /aria-hidden="true"/);
    assert.match(source, /Loading ONEDECORE Portfolio projects/);

    const statusIdx = source.indexOf('role="status"');
    const busyIdx = source.indexOf('aria-busy="true"');
    assert.ok(statusIdx >= 0 && busyIdx > statusIdx, "status precedes busy region");

    const statusBlock = source.slice(
      source.indexOf("<p role=\"status\""),
      source.indexOf("</p>", source.indexOf("<p role=\"status\"")) + 4
    );
    assert.match(statusBlock, /Loading ONEDECORE Portfolio projects/);
    assert.equal(
      (source.match(/Loading ONEDECORE Portfolio projects/g) ?? []).length,
      1
    );
  });
});

describe("R5.5.2 evidence truth and no fake fixtures", () => {
  test("no production Portfolio fixture and contracts untouched in this change set", () => {
    assert.equal(existsSync(join(root, "src/app/portfolio/__fixtures__")), false);
    assert.equal(
      existsSync(join(root, "src/features/portfolio/public/__fixtures__")),
      false
    );
    const cache = read(
      join(root, "src/features/portfolio/public/public-portfolio-cache.ts")
    );
    assert.match(cache, /queryPaginatedProjects|getPaginatedProjects|unstable_cache/);
  });

  test("evidence ledger marks card/detail/gallery as visual pending", () => {
    const ledger = join(evidence, "03-evidence-truth-ledger.md");
    assert.equal(existsSync(ledger), true);
    const text = read(ledger);
    assert.match(text, /SOURCE VERIFIED, VISUAL PENDING REAL CONTENT/i);
    assert.match(text, /Real Portfolio card layout/i);
    assert.match(text, /gallery/i);
    const liveSection = text.split(/## SOURCE VERIFIED/i)[0] ?? "";
    assert.match(liveSection, /LIVE VISUALLY VERIFIED/i);
    assert.doesNotMatch(liveSection, /Real Portfolio card layout/i);
    assert.doesNotMatch(liveSection, /Project gallery/i);
  });
});
