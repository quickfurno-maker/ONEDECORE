/**
 * Fail when the checked-in database types no longer match the migrations.
 *
 * Type staleness is silent: the application keeps compiling against a contract
 * the database stopped having, and the first symptom is a runtime error on a
 * column TypeScript was certain existed. That is exactly how seven tables and
 * twenty-five RPCs came to be missing from the checked-in file while every
 * check stayed green.
 *
 * This runs in Database Quality, after the local reset, because it is the only
 * lane that has a database. It never writes the file — a guard that repairs
 * what it is measuring cannot fail.
 */

import path from "node:path";

import {
  GENERATED_TYPES_FILE,
  generateDatabaseTypes,
  readCheckedInTypes,
} from "./lib/database-typegen.mjs";

const relative = path.relative(process.cwd(), GENERATED_TYPES_FILE).replace(/\\/g, "/");

const checkedIn = readCheckedInTypes();
if (checkedIn === null) {
  console.error(`database types: ${relative} is missing.`);
  console.error("              Run: npx supabase db reset && npm run db:types:generate");
  process.exit(1);
}

const generated = generateDatabaseTypes();
if (!generated.ok) {
  console.error(`database types: ${generated.reason}`);
  process.exit(1);
}

if (generated.source === checkedIn) {
  const lines = checkedIn.split("\n").length - 1;
  console.log(`database types OK: ${relative} matches the local schema (${lines} lines)`);
  process.exit(0);
}

/*
 * A ten-thousand-line diff in a CI log tells a reader nothing they can act on.
 * The line counts and the first divergence are enough to see whether this is a
 * forgotten regeneration or something stranger.
 */
const checkedInLines = checkedIn.split("\n");
const generatedLines = generated.source.split("\n");
const firstDifference = (() => {
  const limit = Math.max(checkedInLines.length, generatedLines.length);
  for (let index = 0; index < limit; index += 1) {
    if (checkedInLines[index] !== generatedLines[index]) return index;
  }
  return -1;
})();

console.error(`STALE TYPES   ${relative} does not match the local database schema.`);
console.error("");
console.error(`  checked in : ${checkedInLines.length - 1} lines`);
console.error(`  generated  : ${generatedLines.length - 1} lines`);
if (firstDifference >= 0) {
  console.error(`  first difference at line ${firstDifference + 1}:`);
  console.error(`    checked in : ${(checkedInLines[firstDifference] ?? "<end of file>").trim().slice(0, 120)}`);
  console.error(`    generated  : ${(generatedLines[firstDifference] ?? "<end of file>").trim().slice(0, 120)}`);
}
console.error("");
console.error("  Database types are stale. Run:");
console.error("    npx supabase db reset && npm run db:types:generate");
console.error("");
console.error("  Do not edit the generated file by hand. Application-specific");
console.error("  corrections belong in src/types/database.ts.");
process.exit(1);
