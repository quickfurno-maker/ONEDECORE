import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeWaIdToE164 } from "../../whatsapp/server/meta-webhook-contract.ts";
import { normalisePhoneToE164 } from "../../lead-intake/server/phone-normalisation.ts";
import {
  normalizeManualLeadPhone,
  sanitizeManualLeadPhoneInput,
} from "../lib/phone-e164.ts";

/**
 * WhatsApp ↔ CRM lead-link repair — canonical identity contract.
 *
 * The deterministic lead link matches `whatsapp_conversations.customer_e164`
 * against `contact_channels.address_normalized` (channel_type = 'phone'). This
 * suite proves that the three existing entry points that produce those two
 * columns agree on one canonical E.164 string for the same subscriber, and
 * that none of them widens matching beyond it. Nothing here introduces a new
 * normalizer; it pins the ones that already exist.
 */

const E164 = /^\+[1-9]\d{1,14}$/;

describe("canonical identity shared by WhatsApp and CRM", () => {
  it("wa_id, public intake and manual CRM entry converge on one E.164", () => {
    // Same subscriber reaching ONEDECORE through all three doors.
    const fromWhatsapp = normalizeWaIdToE164("919812300001");
    const fromIntake = normalisePhoneToE164("9812300001");
    const fromManual = normalizeManualLeadPhone("9812300001");

    assert.equal(fromWhatsapp, "+919812300001");
    assert.equal(fromIntake.ok && fromIntake.e164, "+919812300001");
    assert.equal(fromManual.kind === "valid" && fromManual.e164, "+919812300001");
  });

  it("every produced identity satisfies the shared E.164 database constraint", () => {
    const intake = normalisePhoneToE164("+919812300001");
    const manual = normalizeManualLeadPhone("9812300001");
    const produced = [
      normalizeWaIdToE164("919812300001"),
      intake.ok ? intake.e164 : null,
      manual.kind === "valid" ? manual.e164 : null,
    ];
    for (const value of produced) {
      assert.ok(value !== null);
      assert.match(value, E164);
    }
  });
});

describe("India normalization edge cases follow the existing contract", () => {
  it("accepts the documented Indian mobile shapes on the intake path", () => {
    assert.deepEqual(normalisePhoneToE164("9812300001"), {
      ok: true,
      e164: "+919812300001",
    });
    assert.deepEqual(normalisePhoneToE164("09812300001"), {
      ok: true,
      e164: "+919812300001",
    });
    assert.deepEqual(normalisePhoneToE164("919812300001"), {
      ok: true,
      e164: "+919812300001",
    });
    assert.deepEqual(normalisePhoneToE164("+91 98123 00001"), {
      ok: true,
      e164: "+919812300001",
    });
  });

  it("refuses to invent a country code for ambiguous digit strings", () => {
    assert.deepEqual(normalisePhoneToE164("12345678"), {
      ok: false,
      code: "PHONE_AMBIGUOUS",
    });
    assert.deepEqual(normalisePhoneToE164("5812300001"), {
      ok: false,
      code: "PHONE_AMBIGUOUS",
    });
  });

  it("keeps the manual CRM path strict at exactly ten digits", () => {
    assert.equal(normalizeManualLeadPhone("+919812300001").kind, "invalid");
    assert.equal(normalizeManualLeadPhone("98123000012").kind, "invalid");
    assert.equal(normalizeManualLeadPhone("").kind, "empty");
    // Pasting an E.164 value still canonicalizes to the same identity.
    assert.equal(sanitizeManualLeadPhoneInput("+919812300001"), "9812300001");
  });
});

describe("no widened matching reaches the lead link", () => {
  it("rejects wa_id values that are not canonical E.164", () => {
    assert.equal(normalizeWaIdToE164(""), null);
    assert.equal(normalizeWaIdToE164("abc"), null);
    // Leading zero cannot be a country code, so no identity is produced.
    assert.equal(normalizeWaIdToE164("09812300001"), null);
  });

  it("distinguishes identities that share their trailing ten digits", () => {
    const india = normalizeWaIdToE164("919812300001");
    const uk = normalizeWaIdToE164("449812300001");
    assert.equal(india, "+919812300001");
    assert.equal(uk, "+449812300001");
    assert.notEqual(india, uk);
  });

  it("distinguishes an identity from a longer number containing it", () => {
    const exact = normalizeWaIdToE164("919812300001");
    const longer = normalizeWaIdToE164("9198123000010");
    assert.notEqual(exact, longer);
    assert.ok(longer !== null && longer.startsWith(exact as string));
  });
});
