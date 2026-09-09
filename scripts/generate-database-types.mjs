/**
 * Write the canonical generated database types.
 *
 * The ONLY supported way to change `src/types/database.generated.ts`. Run it
 * after `npx supabase db reset` so the local stack matches the migrations that
 * are actually checked in.
 */

import fs from "node:fs";
import path from "node:path";

import {
  GENERATED_TYPES_FILE,
  GENERATION_COMMAND,
  generateDatabaseTypes,
  readCheckedInTypes,
} from "./lib/database-typegen.mjs";

const before = readCheckedInTypes();
const generated = generateDatabaseTypes();

if (!generated.ok) {
  console.error(`database types: ${generated.reason}`);
  process.exit(1);
}

fs.writeFileSync(GENERATED_TYPES_FILE, generated.source, "utf8");

const relative = path.relative(process.cwd(), GENERATED_TYPES_FILE).replace(/\\/g, "/");
const lines = generated.source.split("\n").length - 1;

if (before === generated.source) {
  console.log(`database types unchanged: ${relative} (${lines} lines)`);
} else {
  console.log(`database types written: ${relative} (${lines} lines)`);
  console.log(`source: ${GENERATION_COMMAND}`);
}
