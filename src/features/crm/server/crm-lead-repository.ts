import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  mapLeadRowToListItem,
  type CrmLeadListItem,
  type CrmLeadListRow,
} from "../contracts/lead-dtos.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

const CRM_LEAD_LIST_SELECT =
  "id, status, submitted_name, service_code, locality, assigned_to, created_at, updated_at";

/**
 * Returns leads visible to the authenticated user via CRM RLS (`crm_can_view_lead`).
 * Broad-read roles see the full queue; assignment-scoped roles see owned leads only.
 */
export async function getLeadsForCurrentUser(): Promise<CrmLeadListItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw crmErrorFromPostgresMessage(authError.message, "RPC_FAILED");
  }

  if (!user) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const { data, error } = await supabase
    .from("leads")
    .select(CRM_LEAD_LIST_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data as CrmLeadListRow[] | null)?.map(mapLeadRowToListItem) ?? [];
}
