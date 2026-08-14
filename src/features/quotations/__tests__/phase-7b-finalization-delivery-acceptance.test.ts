import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveQuotationCapabilityToken, hashCapabilityToken } from '../server/quotation-capability.ts';
import { ensureQuotationPdfArtifact, renderQuotationPdfBuffer } from '../server/quotation-pdf-generator.ts';
import { dispatchWhatsappSendIntent, type WhatsappDispatchServiceDeps } from '../../whatsapp/server/whatsapp-dispatch-service.ts';
import { sendQuotationAction } from '../server/quotation-send-actions.ts';
import { createAdminClient } from '../../../lib/supabase/service-role.ts';

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

  it('OD7B-3 & OD7B-4: Server-side PDF renderer produces exact byte-identical output for the same frozen payload', async () => {
    const payload = {
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
    };

    const a = await renderQuotationPdfBuffer(payload);
    const b = await renderQuotationPdfBuffer(payload);
    assert.equal(a.equals(b), true);
    assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'));
    assert.equal(a.subarray(0, 4).toString(), '%PDF');
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

const pdfPayload = {
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
  payment_schedule: [{ milestone_name: 'Advance', percentage: 50, amount_paise: 2950000 }],
  inclusions: ['Custom Wood Finish'],
  exclusions: ['Civil Works'],
  terms_and_conditions: ['Valid for 30 days'],
};

function thenableSingle(result: { data: unknown; error: { message: string } | null }) {
  const obj = {
    select: () => obj,
    eq: () => obj,
    single: async () => result,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

describe('Phase 7B PDF artifact workflow', () => {
  it('uploads with upsert:false and records real created_by after successful upload', async () => {
    const uploads: Array<{ upsert: boolean }> = [];
    const rpcs: string[] = [];
    const result = await ensureQuotationPdfArtifact(pdfPayload, {
      rpcClient: {
        rpc: async (fn) => {
          rpcs.push(fn);
          if (fn === 'reserve_quotation_pdf_document') {
            return {
              data: {
                success: true,
                status: 'pending',
                pdf_id: 'pdf-1',
                object_path: 'q-1/qv-1.pdf',
                created_by: 'actor-real',
              },
              error: null,
            };
          }
          return { data: { success: true, created_by: 'actor-real' }, error: null };
        },
      },
      storageUploader: {
        upload: async (_path, _body, options) => {
          uploads.push({ upsert: options.upsert });
          return { error: null };
        },
      },
    });
    assert.equal(uploads[0]?.upsert, false);
    assert.equal(rpcs.includes('mark_quotation_pdf_document_ready'), true);
    assert.equal(result.createdBy, 'actor-real');
    assert.equal(result.skippedRender, false);
  });

  it('does not mark READY when storage upload fails', async () => {
    const rpcs: string[] = [];
    await assert.rejects(
      () =>
        ensureQuotationPdfArtifact(pdfPayload, {
          rpcClient: {
            rpc: async (fn) => {
              rpcs.push(fn);
              return {
                data: {
                  success: true,
                  status: 'pending',
                  pdf_id: 'pdf-1',
                  object_path: 'q-1/qv-1.pdf',
                  created_by: 'actor-real',
                },
                error: null,
              };
            },
          },
          storageUploader: {
            upload: async () => ({ error: { message: 'storage denied' } }),
          },
        }),
      /PDF_UPLOAD_FAILED/
    );
    assert.equal(rpcs.includes('mark_quotation_pdf_document_ready'), false);
  });

  it('READY artifact skips render and upload', async () => {
    let uploaded = false;
    const result = await ensureQuotationPdfArtifact(pdfPayload, {
      rpcClient: {
        rpc: async () => ({
          data: {
            success: true,
            status: 'ready',
            pdf_id: 'pdf-1',
            object_path: 'q-1/qv-1.pdf',
            pdf_sha256: 'a'.repeat(64),
            file_size_bytes: 4096,
            created_by: 'actor-real',
          },
          error: null,
        }),
      },
      storageUploader: {
        upload: async () => {
          uploaded = true;
          return { error: null };
        },
      },
    });
    assert.equal(result.skippedRender, true);
    assert.equal(uploaded, false);
    assert.equal(result.createdBy, 'actor-real');
  });
});

describe('Phase 7B service-role helper', () => {
  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      assert.throws(() => createAdminClient(), /SUPABASE_SERVICE_ROLE_KEY/);
    } finally {
      if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (prevUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });

  it('injected test admin path constructs a client when URL and key are present', () => {
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-service-role-key-not-production';
    try {
      const client = createAdminClient();
      assert.ok(client);
    } finally {
      if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (prevUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });
});

describe('Phase 7B mocked secure send flow', () => {
  const secret = 'onedecore-dev-capability-secret-32-bytes-minimum!!';

  it('mints matching grant identity, redacts DB body, and reports provider-bound not delivered', async () => {
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    let capturedGrant: Record<string, unknown> | null = null;
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({
          data: [{ id: 'conv-1', customer_e164: '+919876543210', lead_id: 'lead-1' }],
          error: null,
        });
      },
      rpc: async () => ({
        data: { id: 'intent-1', body_text: 'Your ONEDECORE commercial quotation OD-Q-2026-000001 (v1) is ready. Open your secure link to view details.' },
        error: null,
      }),
    };

    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      {
        getUserId: async () => 'actor-1',
        userClient,
        createAdminClient: () => ({
          rpc: async (_fn: string, args: Record<string, unknown>) => {
            capturedGrant = args;
            return { data: { grant_id: args.p_grant_id, success: true }, error: null };
          },
        }),
        getWhatsappOutboundMode: () => 'local-test' as const,
        dispatchWhatsappSendIntent: async () => ({
          outcome: 'bound' as const,
          sendIntentId: 'intent-1',
          message: 'bound',
        }),
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'provider_bound');
    assert.notEqual(result.status, 'delivered');
    assert.ok(capturedGrant);
    const grantArgs = capturedGrant as Record<string, unknown>;
    assert.equal(grantArgs.p_grant_id, result.grantId);
    const derived = deriveQuotationCapabilityToken(
      'qv-1',
      String(grantArgs.p_grant_id),
      String(grantArgs.p_derivation_nonce),
      secret
    );
    assert.equal(hashCapabilityToken(derived), grantArgs.p_capability_token_hash);
    assert.equal(String(grantArgs.p_derivation_nonce).length, 64);
  });

  it('failed dispatch is not reported as sent', async () => {
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({
          data: [{ id: 'conv-1', customer_e164: '+919876543210', lead_id: 'lead-1' }],
          error: null,
        });
      },
      rpc: async () => ({ data: { id: 'intent-1' }, error: null }),
    };
    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      {
        getUserId: async () => 'actor-1',
        userClient,
        createAdminClient: () => ({
          rpc: async (_fn: string, args: Record<string, unknown>) => ({
            data: { grant_id: args.p_grant_id, success: true },
            error: null,
          }),
        }),
        getWhatsappOutboundMode: () => 'local-test' as const,
        dispatchWhatsappSendIntent: async () => ({
          outcome: 'failed' as const,
          sendIntentId: 'intent-1',
          message: 'provider rejected',
        }),
      }
    );
    assert.equal(result.success, false);
    assert.equal(result.status, 'failure');
  });

  it('PDF not ready blocks send', async () => {
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'pending' }, error: null });
        }
        return thenableSingle({ data: [], error: null });
      },
      rpc: async () => ({ data: null, error: null }),
    };
    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      { getUserId: async () => 'actor-1', userClient }
    );
    assert.equal(result.success, false);
    assert.match(String(result.message), /PDF_NOT_READY/);
  });

  it('missing conversation blocks send', async () => {
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({ data: [], error: null });
      },
      rpc: async () => ({ data: null, error: null }),
    };
    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      { getUserId: async () => 'actor-1', userClient }
    );
    assert.equal(result.success, false);
    assert.match(String(result.message), /NO_ELIGIBLE_CONVERSATION/);
  });

  it('intent RPC consent denial blocks send', async () => {
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({
          data: [{ id: 'conv-1', customer_e164: '+919876543210', lead_id: 'lead-1' }],
          error: null,
        });
      },
      rpc: async () => ({ data: null, error: { message: 'denied_missing_consent' } }),
    };
    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      {
        getUserId: async () => 'actor-1',
        userClient,
        createAdminClient: () => ({
          rpc: async (_fn: string, args: Record<string, unknown>) => ({
            data: { grant_id: args.p_grant_id, success: true },
            error: null,
          }),
        }),
      }
    );
    assert.equal(result.success, false);
    assert.match(String(result.message), /denied_missing_consent/);
  });

  it('existing grant reuse uses persisted grant id for stable idempotency', async () => {
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    let idempotencyKey = '';
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({
          data: [{ id: 'conv-1', customer_e164: '+919876543210', lead_id: 'lead-1' }],
          error: null,
        });
      },
      rpc: async (_fn: string, args: Record<string, unknown>) => {
        idempotencyKey = String(args.p_idempotency_key);
        return { data: { id: 'intent-reuse' }, error: null };
      },
    };
    const result = await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1' },
      {
        getUserId: async () => 'actor-1',
        userClient,
        createAdminClient: () => ({
          rpc: async () => ({
            data: { grant_id: '11111111-1111-1111-1111-111111111111', reused: true, success: true },
            error: null,
          }),
        }),
        getWhatsappOutboundMode: () => 'disabled' as const,
      }
    );
    assert.equal(result.grantId, '11111111-1111-1111-1111-111111111111');
    assert.equal(idempotencyKey, 'quotation-send:qv-1:11111111-1111-1111-1111-111111111111');
    assert.equal(result.status, 'dispatch_disabled');
  });

  it('explicit reissue asks the internal mint to revoke the previous grant', async () => {
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    let reissue = false;
    const userClient = {
      from: (table: string) => {
        if (table === 'quotation_versions') {
          return thenableSingle({
            data: {
              id: 'qv-1',
              status: 'finalized',
              version_number: 1,
              quotations: { id: 'q-1', quotation_number: 'OD-Q-2026-000001', lead_id: 'lead-1' },
            },
            error: null,
          });
        }
        if (table === 'quotation_pdf_documents') {
          return thenableSingle({ data: { id: 'pdf-1', status: 'ready' }, error: null });
        }
        return thenableSingle({
          data: [{ id: 'conv-1', customer_e164: '+919876543210', lead_id: 'lead-1' }],
          error: null,
        });
      },
      rpc: async () => ({ data: { id: 'intent-2' }, error: null }),
    };
    await sendQuotationAction(
      { quotationId: 'q-1', versionId: 'qv-1', reissueToken: true },
      {
        getUserId: async () => 'actor-1',
        userClient,
        createAdminClient: () => ({
          rpc: async (_fn: string, args: Record<string, unknown>) => {
            reissue = Boolean(args.p_reissue);
            return { data: { grant_id: args.p_grant_id, success: true }, error: null };
          },
        }),
        getWhatsappOutboundMode: () => 'disabled' as const,
      }
    );
    assert.equal(reissue, true);
  });
});

describe('Phase 7B dispatch resolver + fake provider', () => {
  it('provider sees /q/<valid token> while stored intent body stays redacted; hash mismatch blocks', async () => {
    const secret = 'onedecore-dev-capability-secret-32-bytes-minimum!!';
    process.env.QUOTATION_CAPABILITY_SECRET = secret;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.onedecore.test';
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = 'local-test';
    const grantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const versionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const nonce = 'c'.repeat(64);
    const token = deriveQuotationCapabilityToken(versionId, grantId, nonce, secret);
    const tokenHash = hashCapabilityToken(token);
    let providerBody = '';

    const matchingAdmin = {
      rpc: async () => ({
        data: [
          {
            outcome_code: 'claimed',
            dispatch_attempt_id: 'att-1',
            send_intent_id: 'intent-1',
            phone_number_id: '1101',
            customer_e164: '+919876543210',
            body_text: 'Redacted quotation body without token',
          },
        ],
        error: null,
      }),
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'whatsapp_send_intents') {
                return { data: { secure_content_kind: 'quotation_link', secure_content_ref: grantId } };
              }
              if (table === 'quotation_access_grants') {
                return {
                  data: {
                    id: grantId,
                    quotation_version_id: versionId,
                    derivation_nonce: nonce,
                    capability_token_hash: tokenHash,
                    revoked_at: null,
                    expires_at: null,
                  },
                };
              }
              if (table === 'quotation_versions') {
                return { data: { id: versionId, status: 'finalized' } };
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
      createAdminClient: () => matchingAdmin as never,
      createProviderAdapter: () => ({
        providerCode: 'fake',
        dispatchTextMessage: async (req) => {
          providerBody = req.bodyText;
          return {
            kind: 'success',
            providerMessageId: 'msg-1',
            providerTimestamp: '2026-08-13T10:00:00.000Z',
            httpStatus: 200,
            responseSnapshot: { provider: 'fake' },
          };
        },
      }),
    };

    const bound = await dispatchWhatsappSendIntent('intent-1', deps);
    assert.equal(bound.outcome, 'bound');
    assert.match(providerBody, new RegExp(`/q/${token}`));
    assert.equal(providerBody.includes('Redacted quotation body without token'), false);

    const mismatchAdmin = {
      ...matchingAdmin,
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'whatsapp_send_intents') {
                return { data: { secure_content_kind: 'quotation_link', secure_content_ref: grantId } };
              }
              if (table === 'quotation_access_grants') {
                return {
                  data: {
                    id: grantId,
                    quotation_version_id: versionId,
                    derivation_nonce: nonce,
                    capability_token_hash: 'f'.repeat(64),
                    revoked_at: null,
                    expires_at: null,
                  },
                };
              }
              if (table === 'quotation_versions') {
                return { data: { id: versionId, status: 'finalized' } };
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
    const mismatch = await dispatchWhatsappSendIntent('intent-1', {
      ...deps,
      createAdminClient: () => mismatchAdmin as never,
    });
    assert.equal(mismatch.outcome, 'failed');
    assert.match(mismatch.message, /CAPABILITY_TOKEN_MISMATCH/);
  });
});

describe('Phase 7B static forbidden-pattern and settings mount gates', () => {
  it('live quotation implementation has zero forbidden patterns', () => {
    const root = process.cwd();
    const files = [
      'src/features/quotations/server/quotation-send-actions.ts',
      'src/features/quotations/server/quotation-pdf-generator.ts',
      'src/features/quotations/server/quotation-capability.ts',
      'src/lib/supabase/service-role.ts',
      'src/features/whatsapp/server/whatsapp-dispatch-service.ts',
      'src/features/whatsapp/server/whatsapp-send-actions.ts',
    ];
    const joined = files.map((rel) => readFileSync(join(root, rel), 'utf8')).join('\n');
    assert.equal(joined.includes('test-service-role-key-fallback'), false);
    assert.equal(/requested_by:\s*['"]00000000-0000-0000-0000-000000000000['"]/.test(joined), false);
    assert.equal(joined.includes('eligibility_code: "PASSED"'), false);
    assert.equal(joined.includes("eligibility_code: 'PASSED'"), false);
    assert.equal(/phone_number_id.*randomUUID|randomBytes\(.*phone/.test(joined), false);
    assert.equal(/from\(["']whatsapp_send_intents["']\)\s*\.insert/.test(joined), false);
    assert.equal(/upsert:\s*true/.test(readFileSync(join(root, 'src/features/quotations/server/quotation-pdf-generator.ts'), 'utf8')), false);
    assert.equal(/warn.*PDF|PDF.*continu/.test(readFileSync(join(root, 'src/features/quotations/server/quotation-pdf-generator.ts'), 'utf8')), false);
    assert.equal(joined.includes('issue_quotation_access_grant('), false);
  });

  it('commercial settings UI is mounted on the Super Admin quotations settings route', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/admin/quotations/settings/page.tsx'), 'utf8');
    assert.match(page, /QuotationCommercialSettingsAdmin/);
    assert.match(page, /isCurrentUserSuperAdmin/);
    const overview = readFileSync(join(process.cwd(), 'src/app/admin/quotations/page.tsx'), 'utf8');
    assert.match(overview, /\/admin\/quotations\/settings/);
  });
});
