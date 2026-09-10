/**
 * There is exactly one public lead form, and it speaks only v4.
 *
 * WHY THIS FILE EXISTS — A LOST ENQUIRY
 *
 * A real homepage enquiry was submitted and never arrived. Two architectural
 * faults made that possible, and both are structural, so both can come back the
 * moment somebody adds a component in good faith.
 *
 * FAULT ONE: FOUR PUBLIC FORMS. The homepage had one, `/interiors` had one,
 * Landing Lab had its own, and a legacy planner form was still importable. Each
 * had its own fields, its own validation and its own request body — one of them
 * still stamping `home-r4-v1`. Four implementations means four ways to be
 * wrong and one place to look when something breaks.
 *
 * FAULT TWO: A SPLIT BRAIN. `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` told the
 * browser whether the form was live; `ONEDECORE_LEAD_INTAKE_MODE` told the
 * server whether it could accept anything. A public flag is baked into HTML at
 * build time and cannot know the state of the running server, so the two could
 * disagree — and when they did, a visitor completed four steps into nothing.
 *
 * This suite fails CI if either fault returns. It reads source rather than
 * rendering, because both faults are about which files exist and what they
 * import, and that is exactly what source text shows.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/** The one canonical public lead form and the host that mounts it. */
const BRIEF = "src/features/lead-intake/public/UnifiedLeadBrief.tsx";
const HOST = "src/features/lead-intake/public/LeadConsultationHost.tsx";
const SHEET = "src/features/public-site/home-r4/HomePlanner.tsx";
const ADAPTER = "src/features/lead-intake/public/unified-lead-request.ts";

/**
 * The public surfaces a lead can be started from. Admin and commerce are
 * deliberately out of scope: they have legitimate forms of their own, and a
 * repo-wide `<form>` ban would be a brittle test that punishes unrelated work.
 */
const PUBLIC_ROOTS = [
  "src/features/lead-intake/public",
  "src/features/public-site",
  "src/features/portfolio/public",
  // `/` IS the interiors experience now; `src/app/interiors` no longer exists.
  "src/app/page.tsx",
  "src/features/public-site/interiors",
  "src/app/portfolio",
  "src/app/lp",
  // Landing Lab is mostly an ADMIN workspace. Only the components a published
  // page renders belong to the public surface; the authoring UI has its own
  // legitimate forms and a blanket ban there would punish unrelated work.
  "src/features/landing-lab/components/LandingPublicRenderer.tsx",
  "src/features/landing-lab/components/LandingLeadLauncher.tsx",
  "src/features/landing-lab/components/LeadFormBlockPreview.tsx",
];

/**
 * The one client module allowed to name the intake endpoint.
 *
 * It IS the boundary — headers, timeout, outcome mapping, and the rule that
 * only an accepted response counts as success. Excluding it from the scans
 * below is the point of having it.
 */
const CLIENT = "src/features/lead-intake/public/lead-intake-client.ts";

/** Every legacy public form and adapter this consolidation removed. */
const DELETED = [
  "src/features/lead-intake/public/PremiumRequirementForm.tsx",
  "src/features/lead-intake/public/ConsultationLeadForm.tsx",
  "src/features/lead-intake/public/HomeLeadCapture.tsx",
  "src/features/public-site/discovery/HomeConsultationCapture.tsx",
  "src/features/landing-lab/components/LiveLandingLeadForm.tsx",
  "src/features/lead-intake/public/lead-form-mode.ts",
  "src/features/lead-intake/public/requirement-to-lead-request.ts",
  "src/features/lead-intake/public/consultation-to-lead-request.ts",
  "src/features/lead-intake/public/plan-to-lead-request.ts",
  "src/features/lead-intake/public/premium-requirement-form.css",
];

function walk(rel: string, acc: string[] = []): string[] {
  const full = join(root, rel);
  if (!existsSync(full)) return acc;
  if (statSync(full).isFile()) {
    if (/\.(ts|tsx)$/.test(rel)) acc.push(rel);
    return acc;
  }
  for (const entry of readdirSync(full)) {
    if (entry === "__tests__") continue;
    walk(`${rel}/${entry}`, acc);
  }
  return acc;
}

const PUBLIC_FILES = PUBLIC_ROOTS.flatMap((r) => walk(r));

/* ========================================================================== */
/* 1. The legacy forms are gone, not merely unused                             */
/* ========================================================================== */

describe("the deleted public forms stay deleted", () => {
  test("none of the legacy files exists", () => {
    for (const rel of DELETED) {
      assert.equal(
        existsSync(join(root, rel)),
        false,
        `${rel} came back — a dormant second public form is the failure this repair removed`
      );
    }
  });

  test("nothing imports them", () => {
    const names = [
      "PremiumRequirementForm",
      "ConsultationLeadForm",
      "HomeLeadCapture",
      "HomeConsultationCapture",
      "LiveLandingLeadForm",
      "lead-form-mode",
      "requirement-to-lead-request",
      "consultation-to-lead-request",
      "plan-to-lead-request",
    ];
    for (const rel of PUBLIC_FILES) {
      const src = code(read(rel));
      for (const name of names) {
        assert.ok(
          !src.includes(name),
          `${rel} still references ${name}`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 2. Exactly one public lead form owner                                       */
/* ========================================================================== */

describe("exactly one public component owns a lead form", () => {
  test("only the canonical brief renders a lead <form>", () => {
    const owners = PUBLIC_FILES.filter((rel) => /<form\b/.test(code(read(rel))));
    assert.deepEqual(
      owners,
      [BRIEF],
      `expected only ${BRIEF} to own a public <form>, found: ${owners.join(", ")}`
    );
  });

  test("only the canonical brief calls the submit boundary", () => {
    const submitters = PUBLIC_FILES.filter(
      (rel) => rel !== CLIENT && code(read(rel)).includes("submitLeadIntake(")
    );
    assert.deepEqual(submitters, [BRIEF]);
  });

  test("no public component POSTs the intake endpoint itself", () => {
    /*
     * `submitLeadIntake` is the one client boundary: it owns the headers, the
     * timeout, the outcome mapping and the rule that only an accepted response
     * counts as success. A component doing its own `fetch` would be a second
     * client with its own idea of what "worked" means.
     */
    for (const rel of PUBLIC_FILES) {
      if (rel === CLIENT) continue;
      const src = code(read(rel));
      assert.ok(
        !src.includes("/api/public/lead-intake\""),
        `${rel} addresses the intake endpoint directly`
      );
      assert.ok(
        !/fetch\([^)]*api\/public\/lead-intake(?!\/readiness)/.test(src),
        `${rel} POSTs the intake endpoint directly`
      );
    }
  });

  test("the Landing Lab block is a launcher, not a form", () => {
    const launcher = read(
      "src/features/landing-lab/components/LandingLeadLauncher.tsx"
    );
    assert.doesNotMatch(code(launcher), /<form\b/);
    assert.match(launcher, /openPlanner\(\)/);

    // And the admin preview stopped imitating one.
    const preview = read(
      "src/features/landing-lab/components/LeadFormBlockPreview.tsx"
    );
    assert.doesNotMatch(code(preview), /<form\b/);
    assert.doesNotMatch(code(preview), /<input\b/);
  });
});

/* ========================================================================== */
/* 3. The current UI emits v4 and nothing else                                 */
/* ========================================================================== */

describe("public runtime emits public-consult-v4 only", () => {
  test("the canonical adapter stamps v4", () => {
    assert.match(
      read(ADAPTER),
      /plannerVersion: PUBLIC_CONSULT_V4_PLANNER_VERSION/
    );
  });

  test("no public file names an older planner version", () => {
    /*
     * The SERVER still accepts v1, v2, v3 and home-r4-v1 — stored rows have to
     * keep their meaning, and that compatibility is proven in
     * `planner-version-server-compatibility.test.ts`. What must never happen
     * again is a public form EMITTING one.
     */
    const legacy = [
      "LEAD_INTAKE_PLANNER_VERSION",
      "PUBLIC_CONSULT_V1_PLANNER_VERSION",
      "PUBLIC_CONSULT_V2_PLANNER_VERSION",
      "PUBLIC_CONSULT_V3_PLANNER_VERSION",
      "home-r4-v1",
      "public-consult-v1",
      "public-consult-v2",
      "public-consult-v3",
    ];
    for (const rel of PUBLIC_FILES) {
      const src = code(read(rel));
      for (const token of legacy) {
        assert.ok(
          !src.includes(token),
          `${rel} references ${token}; only public-consult-v4 may be emitted by current UI`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 4. The split brain is gone                                                  */
/* ========================================================================== */

describe("server runtime is the only authority on availability", () => {
  test("the public form-mode flag is absent from the codebase", () => {
    for (const rel of PUBLIC_FILES) {
      assert.ok(
        !read(rel).includes("NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE"),
        `${rel} still reads the public form-mode flag`
      );
    }
    assert.equal(
      existsSync(join(root, "src/features/lead-intake/public/lead-form-mode.ts")),
      false
    );
  });

  test("the environment template no longer SETS it, and says why", () => {
    /*
     * The name may appear — explaining why a variable was removed is worth
     * more than pretending it never existed, and an operator who finds it in
     * an old deployment script needs to know what happened to it. What must
     * not appear is an ASSIGNMENT, which is an instruction to set it.
     */
    const env = read(".env.example");
    assert.doesNotMatch(
      env,
      /^\s*NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE\s*=/m,
      ".env.example must not instruct anyone to set the removed flag"
    );
    assert.match(env, /ONLY AUTHORITY/);

    const runbook = read("docs/runbooks/lead-intake-public-activation.md");
    assert.doesNotMatch(
      runbook,
      /^\s*NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE\s*=/m,
      "the runbook must not instruct anyone to set the removed flag"
    );
    assert.match(runbook, /single/i);
    assert.match(runbook, /authority/i);
    assert.match(runbook, /has been \*\*removed\*\*/);
  });

  test("readiness is evaluated per request, server-side, uncached", () => {
    const route = read("src/app/api/public/lead-intake/readiness/route.ts");
    assert.match(route, /export const runtime = "nodejs"/);
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /no-store/);
    assert.match(route, /getLeadIntakeReadiness/);
  });

  test("readiness reveals no configuration detail", () => {
    /*
     * A public endpoint that explains WHY it is unavailable tells an attacker
     * which credential to go looking for. One boolean and a coarse word.
     */
    const route = code(read("src/app/api/public/lead-intake/readiness/route.ts"));
    for (const leak of [
      "SUPABASE",
      "SERVICE_ROLE",
      "HASH_SECRET",
      "TRUST_PROXY",
      "hashSecret",
      "serviceRoleKey",
      "supabaseUrl",
      "message",
      "stack",
    ]) {
      assert.ok(!route.includes(leak), `readiness must not expose ${leak}`);
    }
    const readiness = code(
      read("src/features/lead-intake/server/lead-intake-readiness.ts")
    );
    assert.match(readiness, /catch/, "an unreadable config must fail closed");
  });

  test("the readiness check fails closed in the browser too", () => {
    const hook = code(
      read("src/features/lead-intake/public/use-lead-intake-readiness.ts")
    );
    // Every failure path lands on unavailable; none defaults to available.
    assert.match(hook, /catch\s*\{\s*\n?\s*setState\("unavailable"\)/);
    assert.match(hook, /if \(!res\.ok\) \{\s*\n?\s*setState\("unavailable"\)/);
    assert.doesNotMatch(hook, /setState\("available"\)(?![\s\S]{0,80}available \?)/);
  });

  test("the sheet renders no editable field until the server says yes", () => {
    const sheet = read(SHEET);
    assert.match(sheet, /readiness === "unavailable" \?/);
    assert.match(sheet, /<LeadIntakeUnavailable/);
    assert.match(sheet, /readiness === "available" \?/);
    // The check is tied to opening, not to page load.
    assert.match(sheet, /if \(isOpen\) void checkReadiness\(\)/);
  });

  test("the unavailable state offers no editable field and no invented number", () => {
    const unavailable = read(
      "src/features/lead-intake/public/LeadIntakeUnavailable.tsx"
    );
    assert.doesNotMatch(code(unavailable), /<input\b|<textarea\b|<form\b/);
    // The contact route is configured or absent — never a literal.
    assert.match(unavailable, /getPublicWhatsAppHref\(\)/);
    assert.doesNotMatch(unavailable, /\+91|wa\.me\/\d/);
  });
});

/* ========================================================================== */
/* 5. One host, one sheet, one consent                                         */
/* ========================================================================== */

describe("one host mounts the sheet, once", () => {
  test("only the canonical host mounts the sheet", () => {
    const mounters = PUBLIC_FILES.filter((rel) =>
      /<HomePlannerSheet\b/.test(code(read(rel)))
    );
    assert.deepEqual(mounters, [HOST]);
  });

  test("no public page mounts a bare PlanProvider around its own sheet", () => {
    for (const rel of PUBLIC_FILES) {
      if (rel === HOST) continue;
      const src = code(read(rel));
      if (!src.includes("<PlanProvider")) continue;
      assert.ok(
        !src.includes("<HomePlannerSheet"),
        `${rel} pairs its own provider with its own sheet`
      );
    }
  });

  test("the form shows exactly one consent checkbox", () => {
    const brief = read(BRIEF);
    const checkboxes = brief.match(/type="checkbox"/g) ?? [];
    /*
     * Two matches, one visible: the consent box and the honeypot, which is
     * aria-hidden and off-screen. A second VISIBLE consent would mean the
     * two-checkbox presentation came back.
     */
    assert.ok(checkboxes.length <= 2, "unexpected extra checkbox in the brief");
    assert.match(brief, /SINGLE_CONSENT_CONCISE_COPY/);
    assert.doesNotMatch(code(brief), /whatsappService|marketing|serviceEmail/i);
  });

  test("the final submit carries the owner-approved label", () => {
    assert.match(read(BRIEF), /UNIFIED_BRIEF_SUBMITTING_LABEL : SUBMIT_LABEL/);
  });
});
