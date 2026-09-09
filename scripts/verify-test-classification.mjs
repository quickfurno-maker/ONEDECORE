/**
 * Every test file must be classified, so none can sit outside CI unnoticed.
 *
 * WHY THIS EXISTS
 *
 * `test:app` used to be a hand-maintained list of ~110 paths inside
 * package.json. A list like that cannot tell the difference between a suite
 * deliberately excluded and a suite somebody forgot to add — both simply are
 * not there. When this guard was written the repository held 135 test files
 * and CI ran 109 of them: 26 suites, 266 assertions, had quietly stopped being
 * anybody's safety net, including regression suites written for incidents that
 * had already happened once.
 *
 * The manifest is now the single list, the runner reads it, and this script
 * fails the build if the manifest and the filesystem disagree. Adding a test
 * file without classifying it is a build error, which is the only way a
 * "we'll add it to CI later" ever actually happens.
 *
 * Excluding a suite stays possible — it just has to be a decision somebody
 * wrote down, rather than an omission nobody can see.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const MANIFEST = "scripts/test-classification.json";
const CATEGORIES = ["application", "image", "integration"];

function discoverTestFiles(root = "src") {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".test.ts")) found.push(full);
    }
  })(root);
  return found.sort();
}

function loadManifest() {
  const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const seen = new Map();
  for (const category of CATEGORIES) {
    for (const file of raw[category] ?? []) {
      if (seen.has(file)) {
        throw new Error(
          `${file} is classified twice: ${seen.get(file)} and ${category}`
        );
      }
      seen.set(file, category);
    }
  }
  return { raw, seen };
}

const problems = [];

const onDisk = discoverTestFiles();
const { raw, seen } = loadManifest();

for (const file of onDisk) {
  if (!seen.has(file)) {
    problems.push(
      `UNCLASSIFIED  ${file}\n` +
        `              Add it to "application" in ${MANIFEST} so CI runs it,\n` +
        `              or to another category if it needs a special environment.`
    );
  }
}

for (const [file] of seen) {
  if (!fs.existsSync(file)) {
    problems.push(
      `MISSING       ${file}\n` +
        `              Listed in ${MANIFEST} but not on disk. Remove the entry\n` +
        `              if the suite was deleted on purpose.`
    );
  }
}

if (problems.length > 0) {
  console.error("\nTest classification is out of date:\n");
  for (const problem of problems) console.error(problem + "\n");
  console.error(
    `${onDisk.length} test files on disk, ${seen.size} classified.\n`
  );
  process.exit(1);
}

const counts = CATEGORIES.map((c) => `${c}=${(raw[c] ?? []).length}`).join(" ");
console.log(`test classification OK: ${onDisk.length} files (${counts})`);
