"use server";
import "server-only";

import crypto from "node:crypto";
import { deriveQuotationCapabilityToken, hashCapabilityToken, redactCapabilitySecrets } from "./quotation-capability.ts";
import { dispatchWhatsappSendIntent } from "../../whatsapp/server/whatsapp-dispatch-service.ts";
import { getWhatsappOutboundMode } from "../../whatsapp/server/whatsapp-outbound-env.ts";

export type QuotationSendStatus =
  | "intent_recorded"
  | "dispatch_disabled"
  | "queued"
  | "pending"
  | "provider_bound"
  | "failure"
  | "reconciliation_required";

export type SendQuotationActionDeps = {
  getUserId?: () => Promise<string | null>;
  userClient?: {
    from: (table: string) => unknown;
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  createAdminClient?: () => {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  dispatchWhatsappSendIntent?: typeof dispatchWhatsappSendIntent;
  getWhatsappOutboundMode?: typeof getWhatsappOutboundMode;
};

type QuotationSendUserClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }> & {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth?: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
};

/** Resolves the caller's own (RLS-bound) client. Never the service role. */
async function resolveUserClient(
  deps: SendQuotationActionDeps
): Promise<QuotationSendUserClient> {
  if (deps.userClient) {
    return deps.userClient as QuotationSendUserClient;
  }
  const { createClient } = await import("../../../lib/supabase/server.ts");
  return (await createClient()) as unknown as QuotationSendUserClient;
}

async function resolveActorId(deps: SendQuotationActionDeps): Promise<string | null> {
  if (deps.getUserId) {
    return deps.getUserId();
  }
  const client = await resolveUserClient(deps);
  return (await client.auth?.getUser())?.data?.user?.id ?? null;
}

export async function sendQuotationAction(
  params: {
    quotationId: string;
    versionId: string;
    reissueToken?: boolean;
  },
  deps: SendQuotationActionDeps = {}
): Promise<{
  success: boolean;
  status?: QuotationSendStatus;
  message?: string;
  sendIntentId?: string;
  grantId?: string;
}> {
  let supabase: QuotationSendUserClient;
  if (deps.userClient) {
    supabase = deps.userClient as QuotationSendUserClient;
  } else {
    const { createClient } = await import("../../../lib/supabase/server.ts");
    supabase = (await createClient()) as unknown as QuotationSendUserClient;
  }
  const actorId = deps.getUserId
    ? await deps.getUserId()
    : (await supabase.auth?.getUser())?.data?.user?.id;
  if (!actorId) {
    return { success: false, status: "failure", message: "UNAUTHENTICATED: Authentication required." };
  }

  const { data: versionData, error: versionErr } = await supabase
    .from("quotation_versions")
    .select(`
      id,
      status,
      version_number,
      quotations!inner(id, quotation_number, lead_id)
    `)
    .eq("id", params.versionId)
    .single();

  if (versionErr || !versionData) {
    return { success: false, status: "failure", message: versionErr?.message || "Quotation version not found." };
  }

  const versionRow = versionData as { status?: string; quotations?: { lead_id?: string } };
  if (versionRow.status !== "finalized") {
    return { success: false, status: "failure", message: "INVALID_STATE: Only finalized quotation versions can be sent." };
  }

  const leadId = String(versionRow.quotations?.lead_id || "");

  const { data: pdfDoc } = await supabase
    .from("quotation_pdf_documents")
    .select("id, status")
    .eq("quotation_version_id", params.versionId)
    .single();

  const pdfRow = pdfDoc as { status?: string } | null;
  if (!pdfRow || pdfRow.status !== "ready") {
    return { success: false, status: "failure", message: "PDF_NOT_READY: Quotation PDF artifact must be ready before sending." };
  }

  const { data: conversations, error: convErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, customer_e164, lead_id")
    .eq("lead_id", leadId);

  if (convErr) {
    return { success: false, status: "failure", message: convErr.message };
  }

  const linked = ((conversations as Array<{ id: string; lead_id: string; customer_e164: string }> | null) ?? []).filter(
    (row) => row.lead_id === leadId
  );
  if (linked.length === 0) {
    return {
      success: false,
      status: "failure",
      message: "NO_ELIGIBLE_CONVERSATION: A real WhatsApp conversation linked to this lead is required.",
    };
  }

  const conversationId = linked.length === 1 ? linked[0].id : null;
  if (!conversationId) {
    return {
      success: false,
      status: "failure",
      message: "NO_ELIGIBLE_CONVERSATION: Multiple WhatsApp conversations are linked; refuse ambiguous send.",
    };
  }

  const grantId = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString("hex");
  const token = deriveQuotationCapabilityToken(params.versionId, grantId, nonce);
  const tokenHash = hashCapabilityToken(token);

  let admin;
  try {
    admin = deps.createAdminClient
      ? deps.createAdminClient()
      : (await import("../../../lib/supabase/service-role.ts")).createAdminClient();
  } catch (err) {
    return {
      success: false,
      status: "failure",
      message: err instanceof Error ? err.message : "Admin client unavailable.",
    };
  }

  const { data: issueResult, error: grantErr } = await admin.rpc("issue_quotation_access_grant_internal", {
    p_actor_id: actorId,
    p_grant_id: grantId,
    p_version_id: params.versionId,
    p_derivation_nonce: nonce,
    p_capability_token_hash: tokenHash,
    p_reissue: Boolean(params.reissueToken),
  });

  const issueObj = issueResult as Record<string, unknown> | null;
  if (grantErr || !issueObj || typeof issueObj.grant_id !== "string") {
    return { success: false, status: "failure", message: grantErr?.message || "Failed to issue access grant capability." };
  }

  const persistedGrantId = issueObj.grant_id;
  const idempotencyKey = `quotation-send:${params.versionId}:${persistedGrantId}`;

  const { data: intentRow, error: intentErr } = await supabase.rpc(
    "create_quotation_whatsapp_service_send_intent",
    {
      p_version_id: params.versionId,
      p_grant_id: persistedGrantId,
      p_conversation_id: conversationId,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (intentErr || !intentRow) {
    return {
      success: false,
      status: "failure",
      message: intentErr?.message || "Failed to create WhatsApp send intent.",
    };
  }

  const sendIntentId = (intentRow as { id?: string }).id;
  if (!sendIntentId) {
    return { success: false, status: "failure", message: "Send intent row missing id." };
  }

  const outboundMode = (deps.getWhatsappOutboundMode ?? getWhatsappOutboundMode)();
  if (outboundMode === "disabled") {
    return {
      success: true,
      status: "dispatch_disabled",
      sendIntentId,
      grantId: persistedGrantId,
      message: "Send intent recorded. Provider dispatch is disabled.",
    };
  }

  const dispatchResult = await (deps.dispatchWhatsappSendIntent ?? dispatchWhatsappSendIntent)(
    sendIntentId
  );

  if (dispatchResult.outcome === "disabled") {
    return {
      success: true,
      status: "dispatch_disabled",
      sendIntentId,
      grantId: persistedGrantId,
      message: redactCapabilitySecrets(dispatchResult.message),
    };
  }

  if (dispatchResult.outcome === "bound" || dispatchResult.outcome === "already_bound") {
    return {
      success: true,
      status: "provider_bound",
      sendIntentId,
      grantId: persistedGrantId,
      message: "Provider-bound. Delivery status follows webhook evidence.",
    };
  }

  if (dispatchResult.outcome === "not_claimable") {
    const pending = /queued/i.test(dispatchResult.message) ? "queued" : "pending";
    return {
      success: true,
      status: pending,
      sendIntentId,
      grantId: persistedGrantId,
      message: redactCapabilitySecrets(dispatchResult.message),
    };
  }

  if (dispatchResult.outcome === "ambiguous") {
    return {
      success: false,
      status: "reconciliation_required",
      sendIntentId,
      grantId: persistedGrantId,
      message: redactCapabilitySecrets(dispatchResult.message),
    };
  }

  return {
    success: false,
    status: "failure",
    sendIntentId,
    grantId: persistedGrantId,
    message: redactCapabilitySecrets(dispatchResult.message || "Quotation WhatsApp dispatch failed."),
  };
}

/**
 * Issues (or recovers) the secure client link WITHOUT WhatsApp.
 *
 * P4 certification cannot depend on P9: outbound is deliberately disabled and
 * production has no usable WhatsApp delivery prerequisite, so a quotation that
 * can only be delivered through a conversation cannot be certified at all.
 * This path creates NO conversation, NO send intent and makes NO provider call.
 * The WhatsApp send above keeps its own prerequisites, untouched, for P9.
 *
 * THE GRANT-REUSE RULE
 * --------------------
 * `issue_quotation_access_grant_internal` may RETURN AN EXISTING active grant.
 * The token is an HMAC over (grantId, versionId, nonce), so deriving it from
 * the freshly generated values we proposed — which in that case were never
 * persisted — produces a token whose hash cannot match the stored grant. The
 * link would simply not work.
 *
 * So the token is always derived from the PERSISTED identity the RPC returns,
 * and then verified against the persisted hash. A mismatch fails closed rather
 * than handing someone a broken link and calling it success.
 */
export async function generateQuotationClientLinkAction(
  params: {
    quotationId: string;
    versionId: string;
    reissue?: boolean;
  },
  deps: SendQuotationActionDeps = {}
): Promise<{
  success: boolean;
  status: "link_ready" | "failure";
  grantId?: string;
  reused?: boolean;
  /** Relative path only. The caller composes the absolute URL. */
  clientLinkPath?: string;
  message: string;
}> {
  const actorId = await resolveActorId(deps);
  if (!actorId) {
    return { success: false, status: "failure", message: "Authentication required." };
  }

  let admin;
  try {
    admin = deps.createAdminClient
      ? deps.createAdminClient()
      : (await import("../../../lib/supabase/service-role.ts")).createAdminClient();
  } catch (err) {
    return {
      success: false,
      status: "failure",
      message: err instanceof Error ? err.message : "Admin client unavailable.",
    };
  }

  // Proposed identity. Used only when the RPC actually creates a new grant.
  const proposedGrantId = crypto.randomUUID();
  const proposedNonce = crypto.randomBytes(32).toString("hex");
  const proposedToken = deriveQuotationCapabilityToken(
    params.versionId,
    proposedGrantId,
    proposedNonce
  );

  const { data: issueResult, error: grantErr } = await admin.rpc(
    "issue_quotation_access_grant_internal",
    {
      p_actor_id: actorId,
      p_grant_id: proposedGrantId,
      p_version_id: params.versionId,
      p_derivation_nonce: proposedNonce,
      p_capability_token_hash: hashCapabilityToken(proposedToken),
      p_reissue: Boolean(params.reissue),
    }
  );

  const issueObj = issueResult as Record<string, unknown> | null;
  if (grantErr || !issueObj || typeof issueObj.grant_id !== "string") {
    // The RPC is the authority on finalized-only, READY-PDF-only, lead scope
    // and already-accepted; its message is the accurate one.
    return {
      success: false,
      status: "failure",
      message: redactCapabilitySecrets(
        grantErr?.message || "Failed to issue quotation access grant."
      ),
    };
  }

  const persistedGrantId = issueObj.grant_id;
  const persistedNonce =
    typeof issueObj.derivation_nonce === "string" ? issueObj.derivation_nonce : null;
  const persistedHash =
    typeof issueObj.capability_token_hash === "string"
      ? issueObj.capability_token_hash
      : null;
  const persistedVersionId =
    typeof issueObj.quotation_version_id === "string"
      ? issueObj.quotation_version_id
      : params.versionId;

  if (!persistedNonce || !persistedHash) {
    return {
      success: false,
      status: "failure",
      message:
        "CAPABILITY_IDENTITY_MISMATCH: The access grant did not return its derivation identity, so a working link cannot be produced.",
    };
  }

  const token = deriveQuotationCapabilityToken(
    persistedVersionId,
    persistedGrantId,
    persistedNonce
  );

  // Fail closed: a token that does not hash to the stored grant is a broken
  // link, and returning it would look like success.
  if (hashCapabilityToken(token) !== persistedHash) {
    return {
      success: false,
      status: "failure",
      message:
        "CAPABILITY_IDENTITY_MISMATCH: Derived capability does not match the stored access grant. No link issued.",
    };
  }

  return {
    success: true,
    status: "link_ready",
    grantId: persistedGrantId,
    reused: issueObj.reused === true,
    clientLinkPath: `/q/${token}`,
    message:
      issueObj.reused === true
        ? "Existing secure client link recovered."
        : "Secure client link issued.",
  };
}

/**
 * Ensures a finalized quotation version has a READY PDF, or retries one that
 * did not finish.
 *
 * Finalization commits the database first and then renders, so a render failure
 * leaves a legitimately finalized quotation without a document. Reversing the
 * finalization for that would be far worse than making it retryable — the
 * commercial record is correct; only the artifact is missing.
 *
 * READY is idempotently reused and never re-rendered or overwritten: the
 * storage upload uses upsert:false and `reserve_quotation_pdf_document` short
 * circuits on a ready row.
 */
export async function ensureQuotationPdfAction(
  params: { quotationId: string; versionId: string },
  deps: SendQuotationActionDeps = {}
): Promise<{
  success: boolean;
  status: "ready" | "failure";
  regenerated?: boolean;
  message: string;
}> {
  const actorId = await resolveActorId(deps);
  if (!actorId) {
    return { success: false, status: "failure", message: "Authentication required." };
  }

  const supabase = await resolveUserClient(deps);

  const { data: versionRow, error: versionErr } = await supabase
    .from("quotation_versions")
    .select("id, status")
    .eq("id", params.versionId)
    .single();

  if (versionErr || !versionRow) {
    // RLS is the authority on visibility; a miss here is genuinely not visible.
    return {
      success: false,
      status: "failure",
      message: "Quotation version not found or not accessible.",
    };
  }

  if ((versionRow as { status?: string }).status !== "finalized") {
    return {
      success: false,
      status: "failure",
      message: "Only a finalized quotation version has a document to generate.",
    };
  }

  const { buildQuotationPdfData } = await import("./quotation-pdf-payload.ts");
  const pdfData = await buildQuotationPdfData(
    supabase as unknown as Parameters<typeof buildQuotationPdfData>[0],
    { quotationId: params.quotationId, versionId: params.versionId }
  );

  if (!pdfData) {
    return {
      success: false,
      status: "failure",
      message: "Finalized quotation content could not be read.",
    };
  }

  try {
    const { ensureQuotationPdfArtifact } = await import("./quotation-pdf-generator.ts");
    const result = await ensureQuotationPdfArtifact(pdfData);
    return {
      success: true,
      status: "ready",
      regenerated: result.skippedRender === false,
      message: result.skippedRender
        ? "Document already generated. The existing PDF is unchanged."
        : "Quotation document generated.",
    };
  } catch (err) {
    return {
      success: false,
      status: "failure",
      message: redactCapabilitySecrets(
        err instanceof Error ? err.message : "Quotation document generation failed."
      ),
    };
  }
}
