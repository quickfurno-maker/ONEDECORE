import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
export const ONEDECORE_EAS_PROJECT_ID =
  "cedd75cd-60ee-4e8f-8795-f5e893b1894a" as const;

const EXPO_TOKEN_RE =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

type ActivePushToken = {
  expo_push_token: string;
};

type LeadForPush = {
  id: string;
  submitted_name: string | null;
  service_code: string | null;
  locality: string | null;
};

type ExpoPushTicket = {
  status?: unknown;
  message?: unknown;
  details?: {
    error?: unknown;
  };
};

export type EnquiryPushDispatchResult = {
  readonly attempted: number;
  readonly accepted: number;
  readonly disabled: number;
  readonly outcome:
    | "sent"
    | "no_devices"
    | "lead_not_found"
    | "unavailable";
};

function titleCaseCode(value: string | null): string {
  if (!value) return "New enquiry";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function notificationBody(lead: LeadForPush): string {
  const parts = [
    lead.submitted_name?.trim() || "New customer",
    titleCaseCode(lead.service_code),
    lead.locality?.trim() || null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" • ");
}

async function disableTokens(tokens: readonly string[]): Promise<void> {
  if (tokens.length === 0) return;

  try {
    const admin = createAdminClient();
    await admin
      .from("mobile_push_tokens" as never)
      .update({
        enabled: false,
        disabled_at: new Date().toISOString(),
        last_error_code: "DeviceNotRegistered",
        updated_at: new Date().toISOString(),
      } as never)
      .in("expo_push_token", [...tokens] as never);
  } catch {
    // Delivery cleanup is best effort. It must never affect the enquiry.
  }
}

export async function dispatchNewWebsiteEnquiryPush(
  submissionReference: string
): Promise<EnquiryPushDispatchResult> {
  try {
    const admin = createAdminClient();

    const leadResult = await admin
      .from("leads")
      .select("id, submitted_name, service_code, locality")
      .eq("submission_reference", submissionReference)
      .maybeSingle();

    if (leadResult.error) {
      return {
        attempted: 0,
        accepted: 0,
        disabled: 0,
        outcome: "unavailable",
      };
    }

    const lead = leadResult.data as LeadForPush | null;
    if (!lead) {
      return {
        attempted: 0,
        accepted: 0,
        disabled: 0,
        outcome: "lead_not_found",
      };
    }

    const tokenResult = await admin
      .from("mobile_push_tokens" as never)
      .select("expo_push_token")
      .eq("project_id", ONEDECORE_EAS_PROJECT_ID)
      .eq("enabled", true);

    if (tokenResult.error) {
      return {
        attempted: 0,
        accepted: 0,
        disabled: 0,
        outcome: "unavailable",
      };
    }

    const tokens = Array.from(
      new Set(
        ((tokenResult.data ?? []) as unknown as ActivePushToken[])
          .map((row) => row.expo_push_token)
          .filter((token) => EXPO_TOKEN_RE.test(token))
      )
    );

    if (tokens.length === 0) {
      return {
        attempted: 0,
        accepted: 0,
        disabled: 0,
        outcome: "no_devices",
      };
    }

    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      body: JSON.stringify(
        tokens.map((token) => ({
          to: token,
          title: "New Website Enquiry",
          body: notificationBody(lead),
          sound: "default",
          priority: "high",
          channelId: "enquiries",
          data: {
            kind: "website_enquiry",
            leadId: lead.id,
          },
        }))
      ),
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return {
        attempted: tokens.length,
        accepted: 0,
        disabled: 0,
        outcome: "unavailable",
      };
    }

    const payload = (await response.json()) as {
      data?: ExpoPushTicket | ExpoPushTicket[];
    };
    const tickets = Array.isArray(payload.data)
      ? payload.data
      : payload.data
        ? [payload.data]
        : [];

    const invalidTokens: string[] = [];
    let accepted = 0;

    tickets.forEach((ticket, index) => {
      if (ticket?.status === "ok") {
        accepted += 1;
        return;
      }

      if (
        ticket?.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered" &&
        tokens[index]
      ) {
        invalidTokens.push(tokens[index]);
      }
    });

    await disableTokens(invalidTokens);

    return {
      attempted: tokens.length,
      accepted,
      disabled: invalidTokens.length,
      outcome: "sent",
    };
  } catch {
    return {
      attempted: 0,
      accepted: 0,
      disabled: 0,
      outcome: "unavailable",
    };
  }
}

export function safeEnquiryPushLog(
  result: EnquiryPushDispatchResult
): Record<string, unknown> {
  return {
    pushOutcome: result.outcome,
    pushAttempted: result.attempted,
    pushAccepted: result.accepted,
    pushDisabled: result.disabled,
  };
}

