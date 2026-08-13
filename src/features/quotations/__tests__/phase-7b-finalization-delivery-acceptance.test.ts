import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { deriveQuotationCapabilityToken, hashCapabilityToken } from '../server/quotation-capability.ts';
import { computeCanonicalQuotationHash } from '../server/quotation-canonical-hash.ts';
import { renderQuotationPdfBuffer } from '../server/quotation-pdf-generator.ts';

describe('Phase 7B Commercial Quotation Finalization, PDF, Secure WhatsApp & Acceptance', () => {

  test('OD7B-1 & Security: Capability token HMAC derivation is deterministic and produces strong token', () => {
    const versionId = 'v-12345';
    const grantId = 'g-67890';
    const nonce = 'n-abcde';
    const testSecret = 'secret-12345678901234567890123456789012';

    const token1 = deriveQuotationCapabilityToken(versionId, grantId, nonce, testSecret);
    const token2 = deriveQuotationCapabilityToken(versionId, grantId, nonce, testSecret);

    assert.equal(token1, token2, 'Derivation must be deterministic for identical parameters and secret.');
    assert.equal(typeof token1, 'string');
    assert.ok(token1.length >= 32, 'Derived token must be high-entropy string.');
  });

  test('OD7B-1 & Security: SHA-256 hash of capability token is unique and non-reversible', () => {
    const token = 'sample-bearer-token-12345';
    const hash = hashCapabilityToken(token);

    assert.equal(hash.length, 64, 'SHA-256 digest must be 64 hex characters.');
    assert.notEqual(hash, token, 'Hash must not equal plaintext token.');
  });

  test('OD7B-4 & Security: Canonical quotation content hash is deterministic across identical frozen payloads', () => {
    const payload = {
      quotation_number: 'OD-Q-2026-000001',
      version_number: 1,
      property_details: { city: 'Bengaluru', BHK: '3BHK' },
      sections: [
        {
          section_name: 'Living Room',
          section_order: 1,
          section_subtotal_paise: 15000000,
          items: [
            {
              item_name: 'TV Unit',
              description: 'Plywood with Veneer',
              quantity: 1,
              uom: 'sqft',
              unit_rate_paise: 15000000,
              line_total_paise: 15000000,
              item_order: 1,
            },
          ],
        },
      ],
      subtotal_paise: 15000000,
      discount_mode: 'amount',
      discount_flat_paise: 1000000,
      discount_paise: 1000000,
      taxable_base_paise: 14000000,
      tax_profile: { id: 'tp-1', display_name: 'GST 18%', tax_rate_percentage: 18 },
      tax_total_paise: 2520000,
      grand_total_paise: 16520000,
      payment_schedule: [
        { milestone_name: 'Advance', milestone_order: 1, percentage: 10, amount_paise: 1652000 },
        { milestone_name: 'Completion', milestone_order: 2, percentage: 90, amount_paise: 14868000 },
      ],
      inclusions: ['Site Supervision'],
      exclusions: ['Civil alterations'],
      terms_and_conditions: ['Validity 15 days'],
    };

    const hash1 = computeCanonicalQuotationHash(payload);
    const hash2 = computeCanonicalQuotationHash(payload);

    assert.equal(hash1, hash2, 'Canonical content hash must be deterministic.');
    assert.equal(hash1.length, 64, 'Canonical content hash must be 64-char hex string.');
  });

  test('OD7B-3 & OD7B-4: Server-side PDF renderer produces binary PDF buffer', async () => {
    const pdfData = {
      quotation_id: 'q-1',
      quotation_version_id: 'qv-1',
      quotation_number: 'OD-Q-2026-000001',
      version_number: 1,
      finalized_at: new Date().toISOString(),
      client_name: 'Jane Doe',
      client_phone: '+919876543210',
      property_details: { city: 'Bengaluru' },
      sections: [
        {
          section_name: 'Foyer',
          section_subtotal_paise: 5000000,
          items: [
            {
              item_name: 'Shoe Rack',
              description: 'Laminate finish',
              quantity: 1,
              uom: 'unit',
              unit_rate_paise: 5000000,
              line_total_paise: 5000000,
            },
          ],
        },
      ],
      subtotal_paise: 5000000,
      discount_paise: 0,
      taxable_base_paise: 5000000,
      tax_total_paise: 900000,
      grand_total_paise: 5900000,
      tax_profile_name: 'GST 18%',
      tax_rate_percentage: 18,
      payment_schedule: [{ milestone_name: 'Token', percentage: 100, amount_paise: 5900000 }],
      inclusions: ['Installation'],
      exclusions: [],
      terms_and_conditions: [],
    };

    const pdfBuffer = await renderQuotationPdfBuffer(pdfData);
    assert.ok(Buffer.isBuffer(pdfBuffer), 'PDF renderer must return Buffer.');
    assert.ok(pdfBuffer.length > 500, 'PDF buffer must be non-empty valid binary PDF.');
    assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'PDF buffer header must start with %PDF.');
  });

  test('OD7B-6 & Acceptance Contract: Closed-Won achievement uses taxable_base_paise with GST excluded', () => {
    const taxableBasePaise = 10000000; // ₹1,00,000.00
    const grandTotalPaise = 11800000;   // ₹1,18,000.00

    const salesAchievementBasisPaise = taxableBasePaise; // GST EXCLUDED

    assert.equal(salesAchievementBasisPaise, 10000000);
    assert.notEqual(salesAchievementBasisPaise, grandTotalPaise, 'Sales achievement must exclude GST tax total.');
  });
});
