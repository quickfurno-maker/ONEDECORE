import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  acceptIndianMobileInput,
  acceptIndianMobileKeystroke,
  indianMobileNationalToE164,
  INDIAN_MOBILE_HELPER,
  INDIAN_MOBILE_INVALID_MESSAGE,
  isValidIndianMobileNational,
} from "../public/indian-mobile.ts";
import { validateLeadFormFields } from "../public/lead-form-errors.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Public Indian mobile national UX", () => {
  test("accepts valid 10-digit Indian mobiles", () => {
    assert.equal(isValidIndianMobileNational("9876543210"), true);
    assert.equal(isValidIndianMobileNational("8987867765"), true);
    assert.equal(isValidIndianMobileNational("6123456789"), true);
    assert.deepEqual(acceptIndianMobileInput("9876543210"), {
      ok: true,
      national: "9876543210",
    });
    assert.deepEqual(acceptIndianMobileInput("8987867765"), {
      ok: true,
      national: "8987867765",
    });
  });

  test("rejects blank, short, long, leading 0/1-5, and letters", () => {
    assert.equal(isValidIndianMobileNational(""), false);
    assert.equal(isValidIndianMobileNational("987654321"), false);
    assert.equal(isValidIndianMobileNational("98765432101"), false);
    assert.equal(isValidIndianMobileNational("0987654321"), false);
    assert.equal(isValidIndianMobileNational("5876543210"), false);
    assert.equal(isValidIndianMobileNational("abcdefghij"), false);
    assert.equal(acceptIndianMobileInput("0987654321").ok, false);
    assert.equal(acceptIndianMobileInput("5876543210").ok, false);
    assert.equal(acceptIndianMobileInput("letters").ok, false);
  });

  test("paste of +91 / 91 converts only when unambiguous; no blind truncation", () => {
    assert.deepEqual(acceptIndianMobileInput("+919876543210"), {
      ok: true,
      national: "9876543210",
    });
    assert.deepEqual(acceptIndianMobileInput("919876543210"), {
      ok: true,
      national: "9876543210",
    });
    assert.deepEqual(acceptIndianMobileInput("98765-43210"), {
      ok: true,
      national: "9876543210",
    });
    assert.deepEqual(acceptIndianMobileInput("98765 43210"), {
      ok: true,
      national: "9876543210",
    });
    assert.equal(acceptIndianMobileInput("98765432101").ok, false);
    assert.equal(acceptIndianMobileInput("19876543210").ok, false);
    assert.equal(acceptIndianMobileKeystroke("98765432101").ok, false);
    assert.deepEqual(acceptIndianMobileKeystroke("987654321"), {
      ok: true,
      national: "987654321",
    });
  });

  test("validated national maps to canonical +91 E.164 for intake", () => {
    assert.equal(indianMobileNationalToE164("9876543210"), "+919876543210");
    assert.equal(indianMobileNationalToE164("8987867765"), "+918987867765");
    assert.equal(indianMobileNationalToE164("0987654321"), null);
    const server = read("src/features/lead-intake/server/phone-normalisation.ts");
    assert.match(server, /INDIAN_MOBILE_10/);
    assert.match(server, /\+91\$\{trimmed\}/);
  });
});

describe("Public lead form field validation + the canonical brief phone UX", () => {
  test("blank and invalid mobile messages; required fields block submit path", () => {
    const blank = validateLeadFormFields({
      name: "",
      mobile: "",
      locality: "",
      message: "",
      serviceEnquiryConsent: false,
      servicePhoneConsent: false,
      service: null,
      property: null,
      timeline: null,
    });
    assert.equal(blank.ok, false);
    assert.equal(blank.fields.mobile, "Enter your mobile number.");
    assert.equal(blank.fields.name, "Enter your full name.");
    assert.equal(blank.firstInvalid, "name");

    const badMobile = validateLeadFormFields({
      name: "Test Person",
      mobile: "5876543210",
      locality: "",
      message: "",
      serviceEnquiryConsent: true,
      servicePhoneConsent: true,
      service: "modular-kitchens",
      property: "apartment-2bhk",
      timeline: "immediate",
    });
    assert.equal(badMobile.ok, false);
    assert.equal(badMobile.fields.mobile, INDIAN_MOBILE_INVALID_MESSAGE);

    const good = validateLeadFormFields({
      name: "Test Person",
      mobile: "9876543210",
      locality: "",
      message: "",
      serviceEnquiryConsent: true,
      servicePhoneConsent: true,
      service: "modular-kitchens",
      property: "apartment-2bhk",
      timeline: "immediate",
    });
    assert.equal(good.fields.mobile, undefined);
    assert.equal(good.ok, true);
    assert.match(INDIAN_MOBILE_HELPER, /10-digit/);
    assert.doesNotMatch(INDIAN_MOBILE_HELPER, /\+91/);
  });

  test("the canonical brief uses national-10 UX without +91 instruction", () => {
    const src = read("src/features/lead-intake/public/UnifiedLeadBrief.tsx");
    assert.match(src, /autoComplete="tel-national"/);
    assert.match(src, /inputMode="numeric"/);
    assert.match(src, /maxLength=\{10\}/);
    assert.match(src, /INDIAN_MOBILE_HELPER/);
    assert.doesNotMatch(src, /Include country code/);
    assert.doesNotMatch(src, /placeholder="\+91/);
    assert.match(src, /navigator\.vibrate/);
    assert.match(src, /pm-field--shake/);
    assert.match(src, /aria-describedby/);
    assert.match(src, /acceptIndianMobileInput/);
    /*
     * `canNetworkSubmit` is gone with the build-time preview mode. The brief
     * only renders once the SERVER has said a lead can be submitted, so there
     * is no longer a client-side "validate but do not send" branch to gate.
     */
    assert.match(src, /canAttemptSubmit/);
    assert.doesNotMatch(src, /type="email"/);
    /*
     * There is exactly ONE visible consent now. The separate WhatsApp checkbox
     * was removed with the legacy form: an optional consent nobody is asked for
     * must be absent from the request, not recorded as false.
     */
    assert.doesNotMatch(src, /whatsappConsent/);
    assert.doesNotMatch(src, /HomePlannerSheet|HomeBudgetEstimator/);
  });

  test("shake respects reduced motion; overflow not introduced by shake keyframes", () => {
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(css, /@keyframes pm-field-shake/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /pm-field--shake/);
    assert.match(css, /pm-field__error/);
    assert.doesNotMatch(css, /translateX\(20px\)|translateX\(40px\)/);
  });

  test("consultation and shop locks remain", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    /*
     * `#contact` is the canonical consultation href now — one closing band,
     * which is also the Contact destination. `#consultation` survives as an
     * alias on that section, and the per-service deep links still use it.
     */
    assert.match(nav, /href: "\/#contact"/);
    assert.match(nav, /#consultation/);
    assert.match(nav, /getPublicNavDestinations/);
    /*
     * The shop gate moved down a layer with the homepage switch: the root
     * renders the Interiors page, and `HomeShell` is what reads
     * `isShopPublicEnabled()` to decide whether Shop appears in the nav. The
     * lock is the same one, asserted where it now lives.
     */
    const shell = read("src/features/public-site/home-r4/HomeShell.tsx");
    assert.match(shell, /isShopPublicEnabled/);
  });
});
