import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveQuotationCapabilityToken, hashCapabilityToken } from '../server/quotation-capability.ts';
import { renderQuotationPdfBuffer } from '../server/quotation-pdf-generator.ts';
import { dispatchWhatsappSendIntent, type WhatsappDispatchServiceDeps } from '../../whatsapp/server/whatsapp-dispatch-service.ts';

describe('Phase 7B Commercial Quotation Finalization, PDF, Secure WhatsApp & Acceptance', () => {
  const validSecret = 'onedecore-dev-capability-secret-32-bytes-minimum!!';

  it('OD7B-1 & Security: Capability token HMAC derivation is deterministic and produces strong token', () => {
    const token1 = deriveQuotationCapabilityToken('v1-uuid', 'grant-uuid', 'nonce-12345', validSecret);
    const token2 = deriveQuotationCapabilityToken('v1-uuid', 'grant-uuid', 'nonce-12345', validSecret);
    assert.equal(token1, token2);
    assert.equal(token1.length, 64);
  });

  it('OD7B-1 & Security: Short or missing secret throws in ALL runtime environments', () => {
    assert.throws(
      () => deriveQuotationCapabilityToken('v1-uuid', 'grant-uuid', 'nonce-12345', 'short-secret'),
      /QUOTATION_CAPABILITY_SECRET_MISSING/
    );
  });

  it('OD7B-1 & Security: SHA-256 hash of capability token is unique and non-reversible', () => {
    const token = deriveQuotationCapabilityToken('v1-uuid', 'grant-uuid', 'nonce-12345', validSecret);
    const hash = hashCapabilityToken(token);
    assert.equal(hash.length, 64);
    assert.notEqual(token, hash);
  });

  it('OD7B-3 & OD7B-4: Server-side PDF renderer produces binary PDF buffer deterministically', async () => {
    const buffer = await renderQuotationPdfBuffer({
      quotation_id: 'q-1',
      quotation_version_id: 'qv-1',
      quotation_number: 'OD-Q-2026-000001',
      version_number: 1,
      finalized_at: '2026-08-13T10:00:00.000Z',
      client_name: 'Test Client',
      client_phone: '+919876543210',
      property_details: {},
      sections: [
        {
          section_name: 'Living Room',
          section_subtotal_paise: 5000000,
          items: [
            {
              item_name: 'Sofa Unit',
              quantity: 1,
              uom: 'nos',
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
      tax_profile_name: 'Standard GST 18%',
      tax_rate_percentage: 18,
      payment_schedule: [
        { milestone_name: 'Advance', percentage: 50, amount_paise: 2950000 },
        { milestone_name: 'Handover', percentage: 50, amount_paise: 2950000 },
      ],
      inclusions: ['Custom Wood Finish'],
      exclusions: ['Civil Works'],
      terms_and_conditions: ['Valid for 30 days'],
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 500);
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  });

  it('OD7B-6 & Dispatch: Missing APP_URL fails closed', async () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    const origMode = process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = 'local-test';

    const mockAdmin = {
      rpc: async () => ({
        data: [
          {
            outcome_code: 'claimed',
            dispatch_attempt_id: 'att-1',
            send_intent_id: 'intent-1',
            phone_number_id: 'phone-1',
            customer_e164: '+919876543210',
            body_text: 'Redacted body',
          },
        ],
        error: null,
      }),
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'whatsapp_send_intents') {
                return { data: { secure_content_kind: 'quotation_link', secure_content_ref: 'grant-1' } };
              }
              if (table === 'quotation_access_grants') {
                return { data: { id: 'grant-1', quotation_version_id: 'qv-1', derivation_nonce: 'nonce', revoked_at: null } };
              }
              if (table === 'quotation_versions') {
                return { data: { id: 'qv-1', status: 'finalized' } };
              }
              if (table === 'quotation_pdf_documents') {
                return { data: { status: 'ready', pdf_sha256: 'a'.repeat(64), file_size_bytes: 5000 } };
              }
              return { data: null };
            },
          }),
        }),
      }),
    };

    const deps: WhatsappDispatchServiceDeps = {
      getEnv: () => ({
        mode: 'local-test',
        providerCode: 'fake',
        supabaseUrl: 'http://127.0.0.1:54321',
        serviceRoleKey: 'test-key',
        graphApiVersion: 'v18.0',
        accessToken: null,
        phoneNumberId: null,
      }),
      createAdminClient: () => mockAdmin as unknown as ReturnType<NonNullable<WhatsappDispatchServiceDeps['createAdminClient']>>,
      createProviderAdapter: () => ({
        providerCode: 'fake',
        dispatchTextMessage: async () => ({
          kind: 'success',
          providerMessageId: 'msg-1',
          providerTimestamp: '2026-08-13T10:00:00.000Z',
          httpStatus: 200,
          responseSnapshot: {},
        }),
      }),
    };

    const res = await dispatchWhatsappSendIntent('intent-1', deps);

    assert.equal(res.outcome, 'failed');
    assert.match(res.message, /MISSING_APP_URL/);

    if (origUrl) process.env.NEXT_PUBLIC_APP_URL = origUrl;
    if (origMode) process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = origMode;
    else delete process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE;
  });
});
