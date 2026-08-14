import "server-only";
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.generated';
import type {
  WhatsappDispatchBindRow,
  WhatsappDispatchClaimRow,
  WhatsappDispatchServiceResult,
} from '../contracts/provider-dispatch.ts';
import { createFakeWhatsappProviderAdapter } from './whatsapp-fake-provider-adapter.ts';
import { createMetaWhatsappProviderAdapter } from './whatsapp-meta-provider-adapter.ts';
import type { WhatsappProviderAdapter } from './whatsapp-provider-adapter.ts';
import {
  getWhatsappOutboundMode,
  getWhatsappOutboundServerEnv,
  type WhatsappOutboundServerEnv,
} from './whatsapp-outbound-env.ts';
import { deriveQuotationCapabilityToken, hashCapabilityToken } from '../../quotations/server/quotation-capability.ts';

export type WhatsappDispatchServiceDeps = {
  readonly getEnv?: typeof getWhatsappOutboundServerEnv;
  readonly createAdminClient?: (env: WhatsappOutboundServerEnv) => ReturnType<typeof createDispatchAdminClient>;
  readonly createProviderAdapter?: (env: WhatsappOutboundServerEnv) => WhatsappProviderAdapter;
};

function createDispatchAdminClient(env: WhatsappOutboundServerEnv) {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error('[ONEDECORE WhatsApp Dispatch] Admin client unavailable.');
  }

  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function resolveProviderAdapter(
  env: WhatsappOutboundServerEnv,
  factory?: WhatsappDispatchServiceDeps['createProviderAdapter']
): WhatsappProviderAdapter {
  if (factory) {
    return factory(env);
  }

  if (env.providerCode === 'fake') {
    return createFakeWhatsappProviderAdapter();
  }

  return createMetaWhatsappProviderAdapter(env);
}

function firstRow<T>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0] ?? null;
}

function asJsonSnapshot(value: Record<string, unknown>): Json {
  return value as Json;
}

function sanitizeDispatchMessage(message: string): string {
  return message
    .replace(/\/q\/[0-9a-f]{32,128}/gi, "/q/[redacted]")
    .replace(/odq-capability-v1\|[^\s]+/gi, "odq-capability-v1|[redacted]");
}

export async function dispatchWhatsappSendIntent(
  sendIntentId: string,
  deps: WhatsappDispatchServiceDeps = {}
): Promise<WhatsappDispatchServiceResult> {
  const globalMode = getWhatsappOutboundMode();
  if (globalMode === 'disabled') {
    return {
      outcome: 'disabled',
      sendIntentId,
      message: 'Provider dispatch is disabled. Send intent recorded without provider call.',
    };
  }

  const getEnv = deps.getEnv ?? getWhatsappOutboundServerEnv;
  const env = getEnv();
  const mode = env.mode;

  if (mode === 'disabled') {
    return {
      outcome: 'disabled',
      sendIntentId,
      message: 'Provider dispatch is disabled. Send intent recorded without provider call.',
    };
  }

  const admin = (deps.createAdminClient ?? createDispatchAdminClient)(env);
  const provider = resolveProviderAdapter(env, deps.createProviderAdapter);
  const providerAttemptKey = `${sendIntentId}:${provider.providerCode}`;

  const { data: claimRows, error: claimError } = await admin.rpc('claim_whatsapp_send_intent_for_dispatch', {
    p_send_intent_id: sendIntentId,
    p_provider_code: provider.providerCode,
    p_provider_attempt_key: providerAttemptKey,
  });

  if (claimError) {
    return {
      outcome: 'failed',
      sendIntentId,
      message: claimError.message,
    };
  }

  const claim = firstRow(claimRows as WhatsappDispatchClaimRow[] | null);
  if (!claim) {
    return {
      outcome: 'failed',
      sendIntentId,
      message: 'Dispatch claim returned no row.',
    };
  }

  if (claim.outcome_code === 'already_bound') {
    return {
      outcome: 'already_bound',
      sendIntentId: claim.send_intent_id,
      message: 'Send intent is already dispatch-bound.',
    };
  }

  if (claim.outcome_code !== 'claimed' && claim.outcome_code !== 'attempt_idempotent_reuse') {
    return {
      outcome: 'not_claimable',
      sendIntentId: claim.send_intent_id ?? sendIntentId,
      message: `Dispatch claim rejected: ${claim.outcome_code}`,
    };
  }

  if (!claim.dispatch_attempt_id || !claim.phone_number_id || !claim.customer_e164 || !claim.body_text) {
    return {
      outcome: 'failed',
      sendIntentId: claim.send_intent_id ?? sendIntentId,
      dispatchAttemptId: claim.dispatch_attempt_id ?? undefined,
      message: 'Dispatch claim missing provider request fields.',
    };
  }

  // Secure Ephemeral Content Resolution for quotation links
  let dispatchBodyText = claim.body_text;
  if (typeof (admin as unknown as { from?: unknown }).from === 'function') {
    const { data: intentRow } = await admin
      .from('whatsapp_send_intents')
      .select('secure_content_kind, secure_content_ref')
      .eq('id', claim.send_intent_id)
      .single();

    if (intentRow && intentRow.secure_content_kind === 'quotation_link' && intentRow.secure_content_ref) {
      // 1. Fetch grant
      const { data: grant } = await admin
        .from('quotation_access_grants')
        .select('id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash, revoked_at, expires_at')
        .eq('id', intentRow.secure_content_ref)
        .single();

      if (!grant || grant.revoked_at) {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'QUOTATION_GRANT_REVOKED: Secure quotation access grant is invalid or revoked.',
        };
      }

      if (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now()) {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'QUOTATION_GRANT_EXPIRED: Access grant has expired.',
        };
      }

      // 2. Verify quotation version status === finalized
      const { data: version } = await admin
        .from('quotation_versions')
        .select('id, status, is_current_draft')
        .eq('id', grant.quotation_version_id)
        .single();

      if (!version || version.status !== 'finalized') {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'QUOTATION_VERSION_NOT_FINALIZED: Quotation version is not finalized.',
        };
      }

      // 3. Verify PDF document status === ready
      const { data: pdfDoc } = await admin
        .from('quotation_pdf_documents')
        .select('status, pdf_sha256, file_size_bytes')
        .eq('quotation_version_id', grant.quotation_version_id)
        .single();

      if (
        !pdfDoc ||
        pdfDoc.status !== 'ready' ||
        !pdfDoc.pdf_sha256 ||
        !/^[0-9a-f]{64}$/.test(pdfDoc.pdf_sha256) ||
        !pdfDoc.file_size_bytes ||
        pdfDoc.file_size_bytes <= 0
      ) {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'QUOTATION_PDF_NOT_READY: PDF document is not ready or has invalid checksum/size.',
        };
      }

      // 4. Validate APP_URL fail-closed
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl || (!appUrl.startsWith('http://') && !appUrl.startsWith('https://'))) {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'MISSING_APP_URL: NEXT_PUBLIC_APP_URL environment variable is missing or invalid.',
        };
      }

      // 5. Derive capability token & verify SHA-256 match
      const derivedToken = deriveQuotationCapabilityToken(
        grant.quotation_version_id,
        grant.id,
        grant.derivation_nonce
      );

      const derivedHash = hashCapabilityToken(derivedToken);
      const expectedHash = grant.capability_token_hash;

      const derivedBuf = Buffer.from(derivedHash, 'utf8');
      const expectedBuf = Buffer.from(expectedHash, 'utf8');

      if (derivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(derivedBuf, expectedBuf)) {
        return {
          outcome: 'failed',
          sendIntentId: claim.send_intent_id,
          dispatchAttemptId: claim.dispatch_attempt_id,
          message: 'CAPABILITY_TOKEN_MISMATCH: Derived capability token SHA-256 digest mismatch.',
        };
      }

      // Construct link in memory ONLY. Never persist, log, or snapshot the bearer token.
      const cleanAppUrl = appUrl.replace(/\/+$/, '');
      dispatchBodyText = `Your ONEDECORE commercial quotation is ready. View and accept securely:\n${cleanAppUrl}/q/${derivedToken}`;
    }
  }

  const providerResult = await provider.dispatchTextMessage({
    phoneNumberId: claim.phone_number_id,
    customerE164: claim.customer_e164,
    bodyText: dispatchBodyText,
    providerAttemptKey,
  });

  if (providerResult.kind === 'success') {
    const { data: bindRows, error: bindError } = await admin.rpc('bind_whatsapp_send_intent_dispatch', {
      p_dispatch_attempt_id: claim.dispatch_attempt_id,
      p_provider_message_id: providerResult.providerMessageId,
      p_provider_timestamp: providerResult.providerTimestamp,
    });

    if (bindError) {
      await admin.rpc('record_whatsapp_dispatch_attempt_outcome', {
        p_dispatch_attempt_id: claim.dispatch_attempt_id,
        p_status: 'ambiguous',
        p_error_class: 'ambiguous',
        p_http_status: providerResult.httpStatus,
        p_response_snapshot: asJsonSnapshot(providerResult.responseSnapshot),
      });

      return {
        outcome: 'ambiguous',
        sendIntentId: claim.send_intent_id,
        dispatchAttemptId: claim.dispatch_attempt_id,
      message: sanitizeDispatchMessage('Provider accepted the request but local binding failed. Reconciliation required.'),
      };
    }

    const bind = firstRow(bindRows as WhatsappDispatchBindRow[] | null);
    return {
      outcome: 'bound',
      sendIntentId: bind?.send_intent_id ?? claim.send_intent_id,
      dispatchAttemptId: claim.dispatch_attempt_id,
      providerMessageId: bind?.provider_message_id ?? providerResult.providerMessageId,
      outboundMessageId: bind?.outbound_message_id ?? undefined,
      message: 'Service message dispatched and bound to provider evidence. Delivery status follows webhook evidence.',
    };
  }

  if (providerResult.kind === 'ambiguous') {
    await admin.rpc('record_whatsapp_dispatch_attempt_outcome', {
      p_dispatch_attempt_id: claim.dispatch_attempt_id,
      p_status: 'ambiguous',
      p_error_class: 'ambiguous',
      p_http_status: providerResult.httpStatus ?? undefined,
      p_response_snapshot: asJsonSnapshot(providerResult.responseSnapshot),
    });

    return {
      outcome: 'ambiguous',
      sendIntentId: claim.send_intent_id,
      dispatchAttemptId: claim.dispatch_attempt_id,
      message: sanitizeDispatchMessage(providerResult.message),
    };
  }

  await admin.rpc('record_whatsapp_dispatch_attempt_outcome', {
    p_dispatch_attempt_id: claim.dispatch_attempt_id,
    p_status: 'failed',
    p_error_class: providerResult.errorClass,
    p_http_status: providerResult.httpStatus ?? undefined,
    p_response_snapshot: asJsonSnapshot(providerResult.responseSnapshot),
  });

  return {
    outcome: 'failed',
    sendIntentId: claim.send_intent_id,
    dispatchAttemptId: claim.dispatch_attempt_id,
    message: sanitizeDispatchMessage(providerResult.message),
  };
}
