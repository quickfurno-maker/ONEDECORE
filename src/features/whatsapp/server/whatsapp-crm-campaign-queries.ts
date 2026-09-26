import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  resolveIstMonthWindow,
  type WhatsappCrmAudienceCounts,
  type WhatsappCrmCampaignFilterOptions,
  type WhatsappCrmSalesTemperature,
} from "../contracts/crm-campaigns";

async function countLeads(
  month: string,
  temperature: WhatsappCrmSalesTemperature | "any"
): Promise<number> {
  const supabase = await createClient();
  const { startIso, endIso } = resolveIstMonthWindow(month);
  let query = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (temperature === "lost") {
    query = query.eq("status", "closed_lost");
  } else if (temperature === "cold") {
    // Manual classification is authoritative. An unset temperature is Cold.
    query = query
      .neq("status", "closed_lost")
      .or("manual_sales_temperature.eq.cold,manual_sales_temperature.is.null");
  } else if (temperature !== "any") {
    query = query
      .neq("status", "closed_lost")
      .eq("manual_sales_temperature", temperature);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getWhatsappCrmAudienceCountsForCurrentUser(
  month: string
): Promise<WhatsappCrmAudienceCounts> {
  const [hot, warm, cold, lost, total] = await Promise.all([
    countLeads(month, "hot"),
    countLeads(month, "warm"),
    countLeads(month, "cold"),
    countLeads(month, "lost"),
    countLeads(month, "any"),
  ]);
  return { month, hot, warm, cold, lost, total };
}


export async function getWhatsappCrmCampaignFilterOptionsForCurrentUser(): Promise<WhatsappCrmCampaignFilterOptions> {
  const supabase = await createClient();
  const [sourcesResult, ownersResult, localitiesResult] = await Promise.all([
    supabase
      .from("lead_sources")
      .select("code,display_name")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("id,display_name")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
    supabase
      .from("leads")
      .select("locality")
      .is("deleted_at", null)
      .not("locality", "is", null)
      .limit(5000),
  ]);

  if (sourcesResult.error) throw sourcesResult.error;
  if (ownersResult.error) throw ownersResult.error;
  if (localitiesResult.error) throw localitiesResult.error;

  const localities = Array.from(
    new Set(
      (localitiesResult.data ?? [])
        .map((row) => row.locality?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b, "en-IN"));

  return {
    sources: (sourcesResult.data ?? []).map((row) => ({
      value: row.code,
      label: row.display_name,
    })),
    owners: (ownersResult.data ?? []).map((row) => ({
      value: row.id,
      label: row.display_name?.trim() || "Unnamed team member",
    })),
    localities,
  };
}
