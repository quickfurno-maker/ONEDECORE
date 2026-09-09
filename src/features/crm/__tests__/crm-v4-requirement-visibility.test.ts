/**
 * THE CUSTOMER'S SIZE AND BUDGET MUST REACH THE PERSON WHO CALLS THEM.
 *
 * THE GAP
 *
 * `public-consult-v4` asks two questions that decide how a salesperson should
 * treat an enquiry — how big the job is, and what the customer is comfortable
 * spending — and writes both to `public.leads`. The CRM then showed neither.
 * A verified local lead stored `kitchen` / `kitchen-2-3l`, and the person
 * picking it up could see only "Modular Kitchens": the customer had already
 * answered "Kitchen, ₹2–3 Lakh" and nobody could read it back.
 *
 * WHAT THIS SUITE PINS
 *
 *   1. THE LABELS. Pure, so they can be asserted directly, and delegating to
 *      `lead-intake/project-scope.ts` — the module that also feeds the public
 *      form. A CRM-local copy of the budget ladders would let the two drift
 *      until the same stored code meant two different amounts of money on two
 *      screens.
 *
 *   2. THE CARRIAGE. The detail query must select both columns, the detail
 *      assembly must map them, and the list DTO must carry them — a perfect
 *      label helper reaching no data renders nothing.
 *
 *   3. THE ABSENCES. `custom-wardrobes` is asked neither question, and pre-v4
 *      leads were asked neither. Both are correct silences, and the list must
 *      not dress them up as missing data with a "— · —" line.
 *
 * Components are asserted by source: this repo has no DOM harness and Node
 * cannot strip JSX, so a `.tsx` cannot be imported here. The rendered result is
 * owner acceptance, as it is for every UI suite in this codebase.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  formatBudgetRangeLabel,
  formatCrmCodeLabel,
  formatProjectRequirementMeta,
  formatProjectScopeLabel,
} from "../contracts/crm-labels.ts";
import {
  CRM_LEAD_LIST_ITEM_PUBLIC_KEYS,
  mapLeadRowToListItem,
  type CrmLeadListRow,
} from "../contracts/lead-dtos.ts";
import {
  BUDGET_RANGES_BY_PROJECT_SCOPE,
  LEAD_PROJECT_SCOPE_CODES,
  PROJECT_SCOPE_LABELS,
} from "../../lead-intake/project-scope.ts";

const root = process.cwd();

/** Source with comments stripped, so assertions cannot match our own prose. */
function readCode(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("v4 requirement labels come from the canonical domain", () => {
  test("every scope renders the label the public form renders", () => {
    /*
     * Parity with the form, stated over the WHOLE vocabulary rather than a
     * sample: a scope added later must not quietly fall through to the
     * generic formatter and read "3 Bhk" in CRM while the form says "3 BHK".
     */
    for (const code of LEAD_PROJECT_SCOPE_CODES) {
      assert.equal(formatProjectScopeLabel(code), PROJECT_SCOPE_LABELS[code]);
    }
  });

  test("every budget band renders its own ladder's label", () => {
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      for (const option of BUDGET_RANGES_BY_PROJECT_SCOPE[scope]) {
        assert.equal(formatBudgetRangeLabel(scope, option.code), option.label);
      }
    }
  });

  test("the worked examples read as the owner specified", () => {
    assert.equal(formatProjectScopeLabel("2-bhk"), "2 BHK");
    assert.equal(formatBudgetRangeLabel("2-bhk", "2bhk-8-12l"), "₹8–12 Lakh");
    assert.equal(formatProjectScopeLabel("kitchen"), "Kitchen");
    assert.equal(formatBudgetRangeLabel("kitchen", "kitchen-2-3l"), "₹2–3 Lakh");
    assert.equal(
      formatBudgetRangeLabel("3-bhk", "3bhk-above-16l"),
      "Above ₹16 Lakh"
    );
    assert.equal(
      formatBudgetRangeLabel("villa", "villa-above-20l"),
      "Above ₹20 Lakh"
    );
  });

  test("a band from ANOTHER scope's ladder is not silently relabelled", () => {
    /*
     * `2bhk-8-12l` is not a kitchen price. Resolving it against the kitchen
     * ladder must fail over to the raw fact rather than borrow a number from
     * a ladder the customer never saw.
     */
    const shown = formatBudgetRangeLabel("kitchen", "2bhk-8-12l");
    assert.notEqual(shown, "₹8–12 Lakh");
    assert.equal(shown, formatCrmCodeLabel("2bhk-8-12l"));
  });

  test("nulls render as a dash, not as a crash or a guess", () => {
    assert.equal(formatProjectScopeLabel(null), "—");
    assert.equal(formatProjectScopeLabel(undefined), "—");
    assert.equal(formatBudgetRangeLabel(null, null), "—");
    assert.equal(formatBudgetRangeLabel("kitchen", null), "—");
  });

  test("an unknown historical code keeps its fact through the fallback", () => {
    assert.equal(formatProjectScopeLabel("penthouse-9-bhk"), "Penthouse 9 Bhk");
    assert.equal(
      formatBudgetRangeLabel("penthouse-9-bhk", "legacy-band-x"),
      "Legacy Band X"
    );
  });
});

describe("the compact list line", () => {
  test("shows both values joined when both were answered", () => {
    assert.equal(
      formatProjectRequirementMeta("2-bhk", "2bhk-8-12l"),
      "2 BHK · ₹8–12 Lakh"
    );
    assert.equal(
      formatProjectRequirementMeta("kitchen", "kitchen-2-3l"),
      "Kitchen · ₹2–3 Lakh"
    );
  });

  test("a wardrobe enquiry produces NO line at all", () => {
    /*
     * The bug this prevents is cosmetic but corrosive: "— · —" on every
     * wardrobe row reads as data we failed to capture, when in fact that
     * service is deliberately never asked either question.
     */
    assert.equal(formatProjectRequirementMeta(null, null), null);
    assert.equal(formatProjectRequirementMeta(undefined, undefined), null);
  });

  test("one answer yields one value, never a half-empty pair", () => {
    assert.equal(formatProjectRequirementMeta("3-bhk", null), "3 BHK");
    assert.equal(
      formatProjectRequirementMeta(null, "kitchen-2-3l"),
      formatCrmCodeLabel("kitchen-2-3l")
    );
    for (const meta of [
      formatProjectRequirementMeta("3-bhk", null),
      formatProjectRequirementMeta(null, "kitchen-2-3l"),
    ]) {
      assert.doesNotMatch(meta ?? "", /—/);
      assert.doesNotMatch(meta ?? "", /·\s*$/);
    }
  });
});

describe("the list DTO carries the two facts", () => {
  const baseRow: CrmLeadListRow = {
    id: "lead-1",
    status: "new",
    submitted_name: "Local Test",
    service_code: "modular-kitchens",
    project_scope_code: "kitchen",
    budget_range_code: "kitchen-2-3l",
    locality: "Kharadi",
    assigned_to: null,
    manual_sales_temperature: null,
    entry_method: "public_form",
    primary_source_id: "src-1",
    created_at: "2026-09-08T16:50:49.903Z",
    updated_at: "2026-09-08T16:50:49.903Z",
    lead_sources: { display_name: "Website Planner" },
  };

  const derived = {
    salesBucket: "cold",
    salesBucketSource: "score",
    manualSalesTemperature: null,
    priorityScore: 0,
    scoreBand: "cold",
    riskFlags: [],
    stageEnteredAt: baseRow.created_at,
    slaBreached: false,
    newUncontacted: true,
    primaryNextActionDueAt: null,
    primaryNextActionTitle: null,
    siteVisitState: "none",
    quotationState: "none",
  } as unknown as Parameters<typeof mapLeadRowToListItem>[1];

  test("the row mapper carries scope and budget through", () => {
    const item = mapLeadRowToListItem(baseRow, derived);
    assert.equal(item.projectScopeCode, "kitchen");
    assert.equal(item.budgetRangeCode, "kitchen-2-3l");
  });

  test("wardrobe nulls survive the mapper as nulls", () => {
    const item = mapLeadRowToListItem(
      { ...baseRow, service_code: "custom-wardrobes", project_scope_code: null, budget_range_code: null },
      derived
    );
    assert.equal(item.projectScopeCode, null);
    assert.equal(item.budgetRangeCode, null);
    assert.equal(
      formatProjectRequirementMeta(item.projectScopeCode, item.budgetRangeCode),
      null
    );
  });

  test("the public key set gained exactly these two keys and nothing else", () => {
    /*
     * The list DTO is deliberately narrow — no message, no phone, no intake
     * evidence. Widening it is a decision, so the delta is asserted rather
     * than the total.
     */
    const keys = new Set<string>(CRM_LEAD_LIST_ITEM_PUBLIC_KEYS as readonly string[]);
    assert.ok(keys.has("projectScopeCode"));
    assert.ok(keys.has("budgetRangeCode"));
    for (const forbidden of [
      "message",
      "submittedEmail",
      "attribution",
      "roomCodes",
      "contactId",
      "submissionReference",
      "mobile",
    ]) {
      assert.ok(!keys.has(forbidden), `${forbidden} must stay out of the list DTO`);
    }
  });
});

describe("the data actually reaches the screen", () => {
  const repository = readCode("src/features/crm/server/crm-lead-repository.ts");
  const queries = readCode("src/features/crm/server/crm-lead-queries.ts");
  const detailDtos = readCode("src/features/crm/contracts/lead-detail-dtos.ts");
  const overview = readCode(
    "src/features/crm/components/leads/LeadDetailOverview.tsx"
  );
  const table = readCode("src/features/crm/components/leads/LeadListTable.tsx");
  const cards = readCode("src/features/crm/components/leads/LeadListCards.tsx");

  test("the detail DTO declares both fields", () => {
    assert.match(detailDtos, /readonly projectScopeCode: string \| null/);
    assert.match(detailDtos, /readonly budgetRangeCode: string \| null/);
    // The legacy answers stay: a pre-v4 lead still has only these.
    assert.match(detailDtos, /readonly propertyCode: string \| null/);
    assert.match(detailDtos, /readonly budgetComfortCode: string \| null/);
    assert.match(detailDtos, /readonly roomCodes: readonly string\[\]/);
  });

  test("the ONE detail query selects both columns and maps them", () => {
    assert.match(repository, /project_scope_code,/);
    assert.match(repository, /budget_range_code,/);
    assert.match(repository, /projectScopeCode: lead\.project_scope_code/);
    assert.match(repository, /budgetRangeCode: lead\.budget_range_code/);
  });

  test("the canonical list select reads both columns", () => {
    const select = queries.slice(
      queries.indexOf("const CRM_LEAD_LIST_SELECT"),
      queries.indexOf("function startOfTodayIso")
    );
    assert.match(select, /project_scope_code/);
    assert.match(select, /budget_range_code/);
  });

  test("the detail screen renders both, beside the service", () => {
    assert.match(overview, /Project scope</);
    assert.match(overview, /Budget range</);
    assert.match(overview, /formatProjectScopeLabel\(overview\.projectScopeCode\)/);
    assert.match(overview, /overview\.budgetRangeCode/);
    // Legacy fields are not removed by this change.
    assert.match(overview, /Property</);
    assert.match(overview, /Budget comfort</);
    assert.match(overview, /Rooms</);
    // Requirement order: scope and budget sit between Service and Property.
    assert.ok(
      overview.indexOf("Service<") < overview.indexOf("Project scope<") &&
        overview.indexOf("Project scope<") < overview.indexOf("Budget range<") &&
        overview.indexOf("Budget range<") < overview.indexOf("Property<"),
      "scope and budget must read as part of the requirement"
    );
  });

  test("both list surfaces render the compact line, conditionally", () => {
    for (const [name, src] of [
      ["desktop table", table],
      ["mobile card", cards],
    ] as const) {
      assert.match(src, /formatProjectRequirementMeta\(/, name);
      assert.match(src, /item\.projectScopeCode/, name);
      assert.match(src, /item\.budgetRangeCode/, name);
      // Rendered only when there is something to render.
      assert.match(src, /requirementMeta \? \(/, name);
      // and never as a literal empty pair
      assert.doesNotMatch(src, /— · —/, name);
    }
    assert.match(table, /data-testid="lead-row-requirement-meta"/);
    assert.match(cards, /data-testid="lead-card-requirement-meta"/);
  });

  test("no surface keeps its own scope or budget vocabulary", () => {
    /*
     * The whole point of routing through `crm-labels`: one definition. A
     * second copy of "2 BHK" or a lakh figure in a component is the drift
     * this test exists to stop.
     */
    for (const [name, src] of [
      ["detail", overview],
      ["table", table],
      ["cards", cards],
    ] as const) {
      assert.doesNotMatch(src, /"2 BHK"|'2 BHK'/, name);
      assert.doesNotMatch(src, /Lakh/, name);
      assert.doesNotMatch(src, /BUDGET_RANGES_BY_PROJECT_SCOPE/, name);
    }
  });

  test("the CRM label module delegates rather than re-declaring ladders", () => {
    const labels = readCode("src/features/crm/contracts/crm-labels.ts");
    assert.match(labels, /from "\.\.\/\.\.\/lead-intake\/project-scope\.ts"/);
    assert.match(labels, /budgetRangeLabel/);
    assert.match(labels, /PROJECT_SCOPE_LABELS/);
    // No second ladder, no second scope map.
    assert.doesNotMatch(labels, /kitchen-below-1l|2bhk-4-8l|villa-5-10l/);
  });

  test("this change touches display only — not scoring, not assignment", () => {
    const score = readCode("src/features/crm/server/crm-lead-score-batch.ts");
    assert.doesNotMatch(score, /project_scope_code|projectScopeCode/);
    assert.doesNotMatch(score, /budget_range_code|budgetRangeCode/);
  });
});
