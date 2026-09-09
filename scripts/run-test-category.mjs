/**
 * Runs one classified category of tests.
 *
 * The file list lives in `scripts/test-classification.json` rather than inside
 * a package.json one-liner, so that adding a suite is a one-line change that a
 * reviewer can actually see, and so `verify-test-classification.mjs` can check
 * the same list the runner uses. Two lists would drift; there is one.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const category = process.argv[2];
if (!category) {
  console.error("usage: node scripts/run-test-category.mjs <category>");
  process.exit(2);
}

const manifest = JSON.parse(
  fs.readFileSync("scripts/test-classification.json", "utf8")
);
const files = manifest[category];

if (!Array.isArray(files)) {
  console.error(`Unknown test category "${category}".`);
  process.exit(2);
}
if (files.length === 0) {
  console.log(`No test files classified as "${category}".`);
  process.exit(0);
}

/*
 * The image suite imports nothing server-only, and loading the stub there
 * would hide a real accidental server-only import. Every other category gets
 * it, exactly as the previous hand-written scripts did.
 */
const args = [];
if (category !== "image") {
  args.push("--import", "./scripts/register-server-only-stub.mjs");
}
args.push("--experimental-strip-types", "--test", ...files);

const child = spawn(process.execPath, args, { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
