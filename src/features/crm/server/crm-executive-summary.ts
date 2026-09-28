import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";

export interface CrmExecutiveSummary {
  readonly newLeads: number | null;
  readonly openOpportunities: number | null;
  readonly hotLeads: number | null;
  readonly warmLeads: number | null;
  readonly coldLeads: number | null;
  readonly overdueFollowUps: number | null;
  readonly unassignedLeads: number | null;
  readonly whatsappLinked: number | null;
}

async function countLeads(options: {
  readonly status?: string;
  readonly openOnly?: boolean;
  readonly temperature?: "hot" | "warm" | "cold-default";
  readonly unassigned?: boolean;
}): Promise<number | null> {
  const supabase = await createClient();
  let query = supabase.from("leads").select("id", { count: "exact", head: true });

  if (options.status) query = query.eq("status", options.status);
  if (options.openOnly) {
    query = query.not("status", "in", "(closed_won,closed_lost)");
  }
  if (options.temperature === "hot") {
    query = query.eq("manual_sales_temperature", "hot");
  } else if (options.temperature === "warm") {
    query = query.eq("manual_sales_temperature", "warm");
  } else if (options.temperature === "cold-default") {
    query = query.or("manual_sales_temperature.eq.cold,manual_sales_temperature.is.null");
  }
  if (options.unassigned) query = query.is("assigned_to", null);

  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

async function countOverdueFollowUps(context: CrmAccessContext): Promise<number | null> {
  const supabase = await createClient();
  let query = supabase
    .from("lead_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .lt("due_at", new Date().toISOString());

  if (!context.canReadBroad) {
    query = query.eq("owner_id", context.userId);
  }
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

async function countWhatsappLinked(): Promise<number | null> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("whatsapp_conversations")
    .select("id", { count: "exact", head: true })
    .not("lead_id", "is", null);

  return error ? null : (count ?? 0);
}

export async function fetchCrmExecutiveSummary(
  context: CrmAccessContext,
  options: { readonly includeWhatsapp: boolean }
): Promise<CrmExecutiveSummary> {
  const [
    newLeads,
    openOpportunities,
    hotLeads,
    warmLeads,
    coldLeads,
    overdueFollowUps,
    unassignedLeads,
    whatsappLinked,
  ] = await Promise.all([
    countLeads({ status: "new" }),
    countLeads({ openOnly: true }),
    countLeads({ openOnly: true, temperature: "hot" }),
    countLeads({ openOnly: true, temperature: "warm" }),
    countLeads({ openOnly: true, temperature: "cold-default" }),
    countOverdueFollowUps(context),
    context.canReadBroad
      ? countLeads({ openOnly: true, unassigned: true })
      : Promise.resolve(null),
    options.includeWhatsapp
      ? countWhatsappLinked().catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    newLeads,
    openOpportunities,
    hotLeads,
    warmLeads,
    coldLeads,
    overdueFollowUps,
    unassignedLeads,
    whatsappLinked,
  };
}
