import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseWhatsappAnalyticsOverview,
  parseWhatsappAutomationAnalytics,
  parseWhatsappReferralAnalytics,
  parseWhatsappRunAnalytics,
  WHATSAPP_ANALYTICS_RPC,
  type WhatsappAnalyticsOverview,
  type WhatsappAutomationAnalyticsRow,
  type WhatsappReferralAnalytics,
  type WhatsappRunAnalytics,
} from "../contracts/analytics.ts";
import { isUuid } from "../contracts/control-plane.ts";

/*
 * Analytics reads through the CALLER's session. Every RPC requires
 * whatsapp.analytics.read and returns aggregates only; no conversation text,
 * name or phone number is part of any answer.
 */

export async function getWhatsappAnalyticsOverviewForCurrentUser(range: { readonly from: string; readonly to: string }): Promise<WhatsappAnalyticsOverview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_ANALYTICS_RPC.overview, { p_from: range.from, p_to: range.to });
  if (error) return null;
  return parseWhatsappAnalyticsOverview(data);
}

export async function getWhatsappRunAnalyticsForCurrentUser(runId: string): Promise<WhatsappRunAnalytics | null> {
  if (!isUuid(runId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_ANALYTICS_RPC.runAnalytics, { p_run_id: runId });
  if (error) return null;
  return parseWhatsappRunAnalytics(data);
}

export async function getWhatsappAutomationAnalyticsForCurrentUser(range: {
  readonly from: string;
  readonly to: string;
}): Promise<readonly WhatsappAutomationAnalyticsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_ANALYTICS_RPC.automationAnalytics, { p_from: range.from, p_to: range.to });
  if (error) return [];
  return parseWhatsappAutomationAnalytics(data);
}

export async function getWhatsappReferralAnalyticsForCurrentUser(range: {
  readonly from: string;
  readonly to: string;
}): Promise<WhatsappReferralAnalytics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_ANALYTICS_RPC.referralAnalytics, { p_from: range.from, p_to: range.to });
  if (error) return null;
  return parseWhatsappReferralAnalytics(data);
}
