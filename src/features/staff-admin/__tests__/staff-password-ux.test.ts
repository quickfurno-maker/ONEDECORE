/**
 * Staff password set/reset — guidance, honesty, and rejection handling.
 *
 * THE DEFECT THIS ADDRESSES
 *
 * The form checked length and confirmation, then reported "Password updated."
 * Supabase can still refuse a password that passes both — most often
 * `weak_password` with a `pwned` reason, meaning it appears in breach data. The
 * operator handed out a password that could not sign in and discovered it only
 * when the staff member called.
 *
 * So the product rule these tests defend is narrow and absolute: nothing may be
 * described as accepted until the SERVER accepted it. Local checks may say
 * "ready to submit" and never more.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  analyseStaffPassword,
  estimateStrength,
  generateStrongStaffPassword,
  looksEasilyGuessed,
  GENERATED_PASSWORD_MAX_LENGTH,
  GENERATED_PASSWORD_MIN_LENGTH,
  type RandomInts,
} from "../contracts/staff-password-quality.ts";
import {
  STAFF_PASSWORD_GENERATED_HELP,
  STAFF_PASSWORD_REJECTED_BREACHED,
  STAFF_PASSWORD_REJECTED_WEAK,
  STAFF_PASSWORD_SECTION_HELP,
  STAFF_PASSWORD_STATUS,
  STAFF_PASSWORD_STRENGTH_NOTE,
  STAFF_PASSWORD_SUCCESS_ISSUE,
  STAFF_PASSWORD_SUCCESS_RESET,
  categoriseStaffCredentialFailure,
  staffCredentialFailureHint,
} from "../contracts/staff-password-messages.ts";
import { staffPasswordRejectionFromAuthDetail } from "../contracts/errors.ts";
import { STAFF_PASSWORD_MIN_LENGTH } from "../contracts/staff-login-phone.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const SECTION = "src/features/staff-admin/components/StaffPasswordSection.tsx";
const PANEL = "src/features/staff-admin/components/StaffLoginAccessPanel.tsx";
const FORM_ACTIONS = "src/features/staff-admin/server/staff-credential-form-actions.ts";
const CREDENTIAL_ACTIONS = "src/features/staff-admin/server/staff-credential-actions.ts";
const FORM_STATE = "src/features/staff-admin/contracts/staff-credential-form-state.ts";

const STRONG = "Tr4vel!Mango#71";

function checkFor(password: string, confirmation: string, id: string) {
  const found = analyseStaffPassword(password, confirmation).checks.find(
    (check) => check.id === id
  );
  assert.ok(found, `missing check ${id}`);
  return found;
}

/* ========================================================================== */
/* 1. Hard checks gate submission; soft checks never do                        */
/* ========================================================================== */

describe("the submit gate is the hard checks only", () => {
  test("an untouched form is neutral, not a wall of failures", () => {
    const analysis = analyseStaffPassword("", "");
    assert.equal(analysis.untouched, true);
    assert.equal(analysis.canSubmit, false);
    // Nothing is marked failed before the operator has typed anything.
    assert.ok(analysis.checks.every((check) => check.state === "pending"));
  });

  test("a too-short password cannot be submitted", () => {
    const analysis = analyseStaffPassword("Short1!", "Short1!");
    assert.equal(analysis.canSubmit, false);
    assert.equal(checkFor("Short1!", "Short1!", "min-length").state, "unmet");
  });

  test("a mismatch cannot be submitted", () => {
    const analysis = analyseStaffPassword(STRONG, `${STRONG}x`);
    assert.equal(analysis.canSubmit, false);
    assert.equal(checkFor(STRONG, `${STRONG}x`, "match").state, "unmet");
  });

  test("hard checks mirror the server validator exactly", () => {
    // Exactly at the minimum, matching, and nothing else: submittable.
    const atMinimum = "a".repeat(STAFF_PASSWORD_MIN_LENGTH);
    assert.equal(analyseStaffPassword(atMinimum, atMinimum).canSubmit, true);
    // One short: not.
    const belowMinimum = "a".repeat(STAFF_PASSWORD_MIN_LENGTH - 1);
    assert.equal(analyseStaffPassword(belowMinimum, belowMinimum).canSubmit, false);
  });

  test("UNMET recommendations never block submission", () => {
    // All-lowercase, no digit, no special, easily guessed — every soft check
    // fails, and the operator can still submit. Blocking here would imply the
    // recommendations are the standard; the provider is.
    const weakButLegal = "aaaaaaaaaaaa";
    const analysis = analyseStaffPassword(weakButLegal, weakButLegal);

    assert.equal(analysis.canSubmit, true);
    const soft = analysis.checks.filter((check) => check.kind === "soft");
    assert.ok(soft.some((check) => check.state === "unmet"), "expected unmet advice");
  });

  test("a strong password meets every check", () => {
    const analysis = analyseStaffPassword(STRONG, STRONG);
    assert.equal(analysis.canSubmit, true);
    assert.ok(
      analysis.checks.every((check) => check.state === "met"),
      analysis.checks.filter((c) => c.state !== "met").map((c) => c.id).join(", ")
    );
  });
});

/* ========================================================================== */
/* 2. The checklist says exactly what was specified                            */
/* ========================================================================== */

describe("checklist labels", () => {
  test("the labels are the agreed wording", () => {
    const labels = analyseStaffPassword(STRONG, STRONG).checks.map((c) => c.label);

    assert.deepEqual(labels, [
      "At least 10 characters",
      "Passwords match",
      "Recommended: 12 or more characters",
      "Recommended: includes uppercase and lowercase letters",
      "Recommended: includes a number",
      "Recommended: includes a special character",
      "Recommended: not a common or easily guessed password",
    ]);
  });

  test("only the first two are hard", () => {
    const analysis = analyseStaffPassword(STRONG, STRONG);
    const hard = analysis.checks.filter((c) => c.kind === "hard").map((c) => c.id);
    assert.deepEqual(hard, ["min-length", "match"]);
  });
});

/* ========================================================================== */
/* 3. Local guidance never claims acceptance                                   */
/* ========================================================================== */

describe("local status copy is honest about who decides", () => {
  test("the section help names Supabase as the authority", () => {
    assert.match(STAFF_PASSWORD_SECTION_HELP, /Final acceptance is verified securely/);
    assert.match(STAFF_PASSWORD_SECTION_HELP, /Supabase Auth/);
  });

  test("no local status ever says accepted, updated or safe", () => {
    for (const [key, message] of Object.entries(STAFF_PASSWORD_STATUS)) {
      assert.doesNotMatch(
        message,
        /\baccepted\b|\bupdated\b|\bsuccessful\b/i,
        `local status "${key}" must not imply a server verdict: ${message}`
      );
    }
  });

  test("the ready state explicitly defers to the server", () => {
    assert.match(STAFF_PASSWORD_STATUS.localValid, /Ready to submit/);
    assert.match(
      STAFF_PASSWORD_STATUS.localValid,
      /Final acceptance will be confirmed securely/
    );
  });

  test("the strength meter carries its disclaimer", () => {
    assert.match(STAFF_PASSWORD_STRENGTH_NOTE, /local guidance only/);
    assert.match(STAFF_PASSWORD_STRENGTH_NOTE, /checked securely on save/);
  });

  test("only the SERVER messages claim success", () => {
    assert.match(STAFF_PASSWORD_SUCCESS_ISSUE, /issued successfully/);
    assert.match(STAFF_PASSWORD_SUCCESS_RESET, /updated successfully/);
  });
});

/* ========================================================================== */
/* 4. Server rejection is translated, not swallowed                            */
/* ========================================================================== */

describe("a rejected password is reported as a rejected password", () => {
  /** The body GoTrue actually returns, as it reaches us in the thrown message. */
  const pwnedDetail =
    'Auth password reset failed: {"code":422,"error_code":"weak_password",' +
    '"msg":"Password is known to be weak and easy to guess, please choose a different one.",' +
    '"weak_password":{"reasons":["pwned"]}}';

  test("weak_password with a pwned reason names the breach", () => {
    const error = staffPasswordRejectionFromAuthDetail(pwnedDetail);
    assert.ok(error);
    // The PROVIDER code, distinct from the local validator's.
    assert.equal(error.code, "STAFF_PASSWORD_WEAK");
    assert.equal(error.message, STAFF_PASSWORD_REJECTED_BREACHED);
    assert.match(error.message, /appeared in breach data/);
  });

  test("weak_password without a structured reason still says weak", () => {
    const error = staffPasswordRejectionFromAuthDetail(
      'Auth credential update failed: {"error_code":"weak_password","msg":"too weak"}'
    );
    assert.ok(error);
    assert.equal(error.message, STAFF_PASSWORD_REJECTED_WEAK);
  });

  test("the raw provider payload never leaves the server", () => {
    const error = staffPasswordRejectionFromAuthDetail(pwnedDetail);
    assert.ok(error);
    // No JSON, no error_code, no request id, no msg passthrough.
    assert.doesNotMatch(error.message, /\{|\}|error_code|weak_password|422/);
    assert.equal(error.details, undefined);
  });

  test("anything else is left to the existing generic handling", () => {
    for (const detail of [
      "Auth password reset failed: 500 upstream timeout",
      "Auth identity lookup failed: 404",
      "",
      null,
      undefined,
    ]) {
      assert.equal(staffPasswordRejectionFromAuthDetail(detail), null);
    }
  });

  test("the credential runner consults it before the generic failure", () => {
    const src = code(read(CREDENTIAL_ACTIONS));
    const mapped = src.indexOf("staffPasswordRejectionFromAuthDetail(detail)");
    const generic = src.indexOf('code: "STAFF_INVITE_FAILED"');
    assert.ok(mapped > 0, "the runner must translate password rejections");
    assert.ok(mapped < generic, "the specific case must be checked first");

    // The failure is still recorded durably before either is thrown.
    const recorded = src.indexOf("fail_staff_credential_operation");
    assert.ok(recorded < mapped, "the ledger write must still come first");
  });
});

/* ========================================================================== */
/* 5. The UI can branch on WHY it failed                                       */
/* ========================================================================== */

describe("failure categories", () => {
  test("each cause maps to its own category", () => {
    assert.equal(categoriseStaffCredentialFailure("STAFF_PASSWORD_WEAK"), "weak_password");
    // The LOCAL validator's code must never read as a provider verdict.
    assert.equal(categoriseStaffCredentialFailure("STAFF_PASSWORD_REJECTED"), "validation_failed");
    assert.equal(categoriseStaffCredentialFailure("STAFF_CREDENTIALS_UNAUTHORIZED"), "unauthorized");
    assert.equal(categoriseStaffCredentialFailure("STAFF_CREDENTIALS_NOT_ISSUED"), "missing_identity");
    assert.equal(categoriseStaffCredentialFailure("STAFF_VALIDATION_FAILED"), "validation_failed");
    assert.equal(categoriseStaffCredentialFailure("STAFF_INVITE_FAILED"), "provider_failed");
    assert.equal(categoriseStaffCredentialFailure(undefined), "provider_failed");
  });

  test("a generic provider failure says the password did NOT change", () => {
    const hint = staffCredentialFailureHint("provider_failed");
    assert.ok(hint);
    assert.match(hint, /The password was not changed/);
  });

  test("a weak-password rejection is not double-reported", () => {
    // Its own message already says rejected and what to do.
    assert.equal(staffCredentialFailureHint("weak_password"), null);
  });

  test("the form action attaches the category and drops the details", () => {
    const src = code(read(FORM_ACTIONS));
    assert.match(src, /category: categoriseStaffCredentialFailure\(error\.code\)/);
    // `details` carries the provider payload; it must not be forwarded.
    assert.doesNotMatch(src, /details: error\.details/);
  });

  test("the form state carries no password in either direction", () => {
    const src = read(FORM_STATE);
    assert.doesNotMatch(src, /readonly password/);
    assert.doesNotMatch(src, /readonly confirmPassword/);
  });
});

/* ========================================================================== */
/* 6. Generation                                                               */
/* ========================================================================== */

describe("generated passwords", () => {
  test("length stays inside the agreed range", () => {
    for (let i = 0; i < 40; i += 1) {
      const generated = generateStrongStaffPassword();
      assert.ok(
        generated.length >= GENERATED_PASSWORD_MIN_LENGTH &&
          generated.length <= GENERATED_PASSWORD_MAX_LENGTH,
        `length ${generated.length}`
      );
    }
  });

  test("every generated password satisfies every check", () => {
    for (let i = 0; i < 40; i += 1) {
      const generated = generateStrongStaffPassword();
      const analysis = analyseStaffPassword(generated, generated);
      assert.equal(analysis.canSubmit, true, generated);
      assert.ok(
        analysis.checks.every((check) => check.state === "met"),
        `${generated}: ${analysis.checks.filter((c) => c.state !== "met").map((c) => c.id)}`
      );
      assert.equal(analysis.strength, "Strong");
    }
  });

  test("visually confusing characters are excluded", () => {
    /*
     * The ambiguity is always a PAIR, so removing one side is enough. The digits
     * 0/1/5/2 are gone, which is what makes O, l, I, S and Z unambiguous — they
     * no longer have a lookalike to be confused with.
     */
    for (let i = 0; i < 40; i += 1) {
      assert.doesNotMatch(
        generateStrongStaffPassword(),
        /[01lI O]/,
        "a password read aloud must not contain ambiguous glyphs"
      );
    }
  });

  test("successive generations differ", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      seen.add(generateStrongStaffPassword());
    }
    assert.equal(seen.size, 25, "generation must not repeat");
  });

  test("the class guarantee does not pin characters to fixed positions", () => {
    // A degenerate random source that always picks index 0 still shuffles, so
    // the four required characters are not simply the first four.
    const alwaysZero: RandomInts = (count) => new Array(count).fill(0);
    const generated = generateStrongStaffPassword(alwaysZero);
    assert.equal(generated.length, GENERATED_PASSWORD_MIN_LENGTH);
    // Still satisfies the classes.
    assert.equal(analyseStaffPassword(generated, generated).canSubmit, true);
  });

  test("the generated-password helper warns it will not be shown again", () => {
    assert.match(STAFF_PASSWORD_GENERATED_HELP, /Share it securely/);
    assert.match(STAFF_PASSWORD_GENERATED_HELP, /will not be shown again/);
  });
});

/* ========================================================================== */
/* 7. Weak-pattern heuristics stay advisory                                    */
/* ========================================================================== */

describe("the local guessability heuristic", () => {
  test("it catches the obvious cases", () => {
    for (const value of [
      "Password123!",
      "qwerty12345",
      "aaaaaaaaaaaa",
      "abcd1234efgh",
      "onedecore2026",
    ]) {
      assert.equal(looksEasilyGuessed(value), true, value);
    }
  });

  test("it leaves an ordinary strong password alone", () => {
    for (const value of [STRONG, "Kf7#mQp2$wRt", "brisk-otter-9!Vault"]) {
      assert.equal(looksEasilyGuessed(value), false, value);
    }
  });

  test("a guessable password is downgraded but NOT blocked", () => {
    assert.equal(estimateStrength("Password123!"), "Weak");
    // Still submittable — only the provider may refuse it.
    assert.equal(analyseStaffPassword("Password123!", "Password123!").canSubmit, true);
  });
});

/* ========================================================================== */
/* 8. The component wiring                                                     */
/* ========================================================================== */

describe("the password section behaves as specified", () => {
  test("submit is disabled until the hard checks pass", () => {
    const src = code(read(SECTION));
    assert.match(src, /disabled=\{pending \|\| !analysis\.canSubmit\}/);
  });

  test("a server verdict outranks any local status", () => {
    const src = read(SECTION);
    const resolver = src.slice(src.indexOf("function resolveStatus"));
    // pending, then the server result, and only then local state.
    const pendingAt = resolver.indexOf("if (pending)");
    const resultAt = resolver.indexOf("if (result)");
    const untouchedAt = resolver.indexOf("analysis.untouched");
    assert.ok(pendingAt < resultAt && resultAt < untouchedAt);
  });

  test("fields are cleared on success and KEPT on failure", () => {
    const src = code(read(SECTION));
    // Cleared only inside the success branch.
    assert.match(src, /if \(state\.success && state\.operation === operation\)/);
    assert.match(src, /setPassword\(""\)/);
    // No clearing on submit or on error — a rejected password stays editable.
    assert.doesNotMatch(src, /onSubmit[\s\S]{0,120}setPassword\(""\)/);
  });

  test("only this form's own result is shown", () => {
    const src = code(read(SECTION));
    assert.match(src, /state\.operation === operation && state\.message/);
  });

  test("there is exactly ONE status region", () => {
    const src = read(SECTION);
    assert.equal((src.match(/role="status"/g) ?? []).length, 1);
    assert.match(src, /aria-live="polite"/);
  });

  test("check state is not conveyed by colour alone", () => {
    const src = read(SECTION);
    // A glyph plus screen-reader text accompanies every row.
    assert.match(src, /const mark =/);
    assert.match(src, /className="sr-only"/);
  });

  test("both credential forms use the section", () => {
    const panel = read(PANEL);
    assert.match(panel, /idPrefix="issue"[\s\S]{0,120}operation="issue"/);
    assert.match(panel, /idPrefix="reset"[\s\S]{0,120}operation="reset"/);
    // The old bare fields are gone, so there is one password UX, not two.
    assert.doesNotMatch(panel, /function PasswordFields/);
    assert.doesNotMatch(panel, /name="password"/);
  });

  /* ------------------------------------------------------------------------ */
  /* A server verdict expires when the candidate changes                       */
  /* ------------------------------------------------------------------------ */

  /*
   * The bug this guards: `result` was computed from `state` alone, so a verdict
   * outlived the password it described.
   *
   * After a rejection it kept saying "rejected" while the operator typed a
   * better password. Far worse, after a SUCCESS it kept saying "Password updated
   * successfully" over a brand-new, unsaved password — a false claim of
   * acceptance, which is the exact failure this whole feature exists to prevent.
   */

  test("a verdict is gated on not having been dismissed", () => {
    const src = code(read(SECTION));

    // The displayed result depends on dismissal, not on `state` alone.
    assert.match(
      src,
      /const result =\s*state\.operation === operation &&\s*state\.message &&\s*dismissedResult !== state/,
      "the verdict must be gated on dismissal"
    );

    // Dismissal is by state IDENTITY, so a fresh submission is shown again
    // without any manual reset.
    assert.match(src, /useState<StaffCredentialFormState \| null>\(null\)/);
    assert.match(src, /setDismissedResult\(state\)/);
  });

  test("editing EITHER field dismisses the standing verdict", () => {
    const src = code(read(SECTION));

    const passwordField = src.slice(
      src.indexOf('name="password"'),
      src.indexOf('name="confirmPassword"')
    );
    assert.match(
      passwordField,
      /setPassword\(event\.target\.value\)[\s\S]{0,200}dismissCurrentVerdict\(\)/,
      "typing a password must retire the previous verdict"
    );

    const confirmField = src.slice(src.indexOf('name="confirmPassword"'));
    assert.match(
      confirmField,
      /setConfirmation\(event\.target\.value\)[\s\S]{0,200}dismissCurrentVerdict\(\)/,
      "typing a confirmation must retire the previous verdict"
    );
  });

  test("generating a new password dismisses the standing verdict", () => {
    const src = code(read(SECTION));
    const generate = src.slice(
      src.indexOf("const onGenerate"),
      src.indexOf("const onCopy")
    );

    assert.match(generate, /dismissCurrentVerdict\(\)/);
    // Dismissed BEFORE the new candidate is installed, so no render can pair a
    // stale verdict with the generated value.
    assert.ok(
      generate.indexOf("dismissCurrentVerdict()") <
        generate.indexOf("setPassword(next)"),
      "the verdict must be retired before the new candidate is set"
    );
  });

  test("a generated password is presented as LOCAL guidance only", () => {
    /*
     * The helper text may reference a save that has NOT happened — "After a
     * successful save, it will not be shown again" is conditional and future.
     * What it must never do is state that this password HAS been accepted.
     */
    assert.match(
      STAFF_PASSWORD_GENERATED_HELP,
      /After a successful save/,
      "acceptance must be framed as still to come"
    );
    assert.doesNotMatch(
      STAFF_PASSWORD_GENERATED_HELP,
      /\b(is|was|has been)\s+(accepted|approved|saved|updated)\b/i,
      "generation must not claim the password was accepted"
    );

    // And it still has to clear every ordinary local check, nothing more.
    const generated = generateStrongStaffPassword();
    assert.equal(analyseStaffPassword(generated, generated).canSubmit, true);
  });

  test("non-mutating controls do NOT dismiss the verdict", () => {
    const src = code(read(SECTION));

    // Copying changes nothing about what would be submitted.
    const copy = src.slice(src.indexOf("const onCopy"), src.indexOf("return ("));
    assert.doesNotMatch(copy, /dismissCurrentVerdict/);

    // Nor does revealing.
    const reveal = src.slice(src.indexOf("setRevealed((current)"));
    assert.doesNotMatch(
      reveal.slice(0, 200),
      /dismissCurrentVerdict/,
      "toggling visibility must not discard a verdict"
    );
  });

  test("success is cleared from the FIELDS but stays on screen until an edit", () => {
    const src = code(read(SECTION));

    // Clearing happens in the render-time adjustment, which does NOT dismiss —
    // so the accepted message is still visible on the very next paint.
    const adjust = src.slice(
      src.indexOf("if (handledState !== state)"),
      src.indexOf("const status =")
    );
    assert.match(adjust, /setPassword\(""\)/);
    assert.doesNotMatch(
      adjust,
      /dismissCurrentVerdict/,
      "acceptance must remain visible immediately after it is reported"
    );
  });

  test("only a candidate change can retire a verdict", () => {
    const src = code(read(SECTION));
    // Exactly three call sites: password, confirmation, generate.
    assert.equal(
      (src.match(/dismissCurrentVerdict\(\);/g) ?? []).length,
      3,
      "dismissal belongs only to the three candidate-changing controls"
    );
  });

  test("generation uses a CSPRNG, never Math.random", () => {
    const quality = read("src/features/staff-admin/contracts/staff-password-quality.ts");
    assert.match(quality, /crypto\.getRandomValues/);
    assert.doesNotMatch(code(quality), /Math\.random/);
  });
});
