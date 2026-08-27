import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  mapMyDayRpcPayload,
  type MyDaySnapshot,
} from "../contracts/my-day-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

export interface FetchMyDayOptions {
  readonly ownerId?: string | null;
  readonly upcomingLimit?: number;
  readonly attentionLimit?: number;
}

export async function fetchCrmMyDaySnapshot(
  context: CrmAccessContext,
  options: FetchMyDayOptions = {}
): Promise<MyDaySnapshot> {
  const supabase = await createClient();

  let ownerId: string | null = options.ownerId ?? null;
  if (!context.canReadBroad) {
    ownerId = context.userId;
  }

  const { data, error } = await supabase.rpc("get_crm_my_day", {
    p_owner_id: ownerId,
    p_upcoming_limit: options.upcomingLimit ?? 50,
    p_attention_limit: options.attentionLimit ?? 50,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw crmErrorFromPostgresMessage("empty my day payload", "RPC_FAILED");
  }

  return mapMyDayRpcPayload(
    data as unknown as Parameters<typeof mapMyDayRpcPayload>[0]
  );
}

export async function getCrmMyDayForCurrentUser(
  options: FetchMyDayOptions = {}
): Promise<MyDaySnapshot | null> {
  const { getCrmAccessContext } = await import("./crm-auth.ts");
  const context = await getCrmAccessContext();
  if (!context) {
    return null;
  }
  return fetchCrmMyDaySnapshot(context, options);
}
