import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

import {
  buildLeadListHref,
  parseLeadListQuery,
} from "../contracts/lead-list-query.ts";
import {
  displayLeadTemperature,
} from "../contracts/lead-sales-temperature.ts";

const root = process.cwd();
const read = (file: string) =>
  readFileSync(join(root, file), "utf8");

describe("lead list working temperature", () => {
  test("unmarked leads display and filter as Cold", () => {
    assert.equal(displayLeadTemperature(null), "COLD");
    assert.equal(displayLeadTemperature("HOT"), "HOT");
    assert.equal(displayLeadTemperature("WARM"), "WARM");
    assert.equal(displayLeadTemperature("COLD"), "COLD");
  });

  test("query accepts only Hot, Warm or Cold", () => {
    assert.equal(
      parseLeadListQuery({ temperature: "hot" }).temperature,
      "HOT"
    );
    assert.equal(
      parseLeadListQuery({ temperature: "WARM" }).temperature,
      "WARM"
    );
    assert.equal(
      parseLeadListQuery({ temperature: "lukewarm" }).temperature,
      null
    );
  });

  test("temperature survives links and can be cleared independently", () => {
    const query = parseLeadListQuery({
      temperature: "warm",
      status: "qualified",
      bucket: "hot",
    });

    assert.match(
      buildLeadListHref(query),
      /temperature=warm/
    );
    assert.doesNotMatch(
      buildLeadListHref(query, "temperature"),
      /temperature=/
    );
    assert.match(
      buildLeadListHref(query, "temperature"),
      /bucket=hot/
    );
  });

  test("filtering happens before pagination and treats null as Cold", () => {
    const queries = read(
      "src/features/crm/server/crm-lead-queries.ts"
    );

    assert.match(
      queries,
      /displayLeadTemperature\(item\.manualSalesTemperature\) ===\s*query\.temperature/
    );

    const temperatureAt = queries.indexOf(
      "const temperatureFiltered = query.temperature"
    );
    const orderAt = queries.indexOf(
      "const ordered = orderLeadCohort("
    );
    const sliceAt = queries.indexOf(
      "ordered.slice("
    );

    assert.ok(
      temperatureAt > 0 &&
        orderAt > temperatureAt &&
        sliceAt > orderAt
    );
  });

  test("website cards and rows always render a temperature badge", () => {
    const cards = read(
      "src/features/crm/components/leads/LeadListCards.tsx"
    );
    const table = read(
      "src/features/crm/components/leads/LeadListTable.tsx"
    );
    const filters = read(
      "src/features/crm/components/leads/LeadListFilters.tsx"
    );

    assert.match(
      cards,
      /LeadTemperatureBadge temperature=\{item\.manualSalesTemperature\}/
    );
    assert.match(table, />\s*Temperature\s*</);
    assert.match(
      table,
      /LeadTemperatureBadge temperature=\{item\.manualSalesTemperature\}/
    );
    assert.match(filters, /name="temperature"/);
    assert.match(filters, /Filter by lead temperature/);
  });
});

