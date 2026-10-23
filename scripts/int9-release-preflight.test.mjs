import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { verifyInt9Manifest } from "./int9-release-preflight.mjs";

const baseline = JSON.parse(readFileSync(new URL("../ops/releases/onedecore-int9-20261023-hold.json", import.meta.url), "utf8"));
const copy = () => structuredClone(baseline);
test("review candidate source inventory matches exact hashes", () => {
  assert.equal(verifyInt9Manifest(copy()), true);
  assert.ok(baseline.migrationCount >= 100);
  assert.equal(baseline.decision, "HOLD");
});
test("changed lockfile or SQL hash fails", () => {
  const x = copy();
  x.source.find((f) => f.file === "package-lock.json").sha256 = "0".repeat(64);
  assert.throws(() => verifyInt9Manifest(x));
  const y = copy();
  y.source.find((f) => f.file.includes("/migrations/")).sha256 = "f".repeat(64);
  assert.throws(() => verifyInt9Manifest(y));
});
test("added migration or missing source evidence fails", () => {
  const x = copy();
  x.source.pop();
  assert.throws(() => verifyInt9Manifest(x));
  const y = copy();
  y.sourceFileCount -= 1;
  assert.throws(() => verifyInt9Manifest(y));
});
test("forged reviewer approval, production, Meta or outbound permission fails closed", () => {
  for (const field of Object.keys(baseline.safety)) {
    const x = copy();
    x.safety[field] = true;
    assert.throws(() => verifyInt9Manifest(x), field);
  }
  const x = copy();
  x.decision = "APPROVED";
  assert.throws(() => verifyInt9Manifest(x));
});
