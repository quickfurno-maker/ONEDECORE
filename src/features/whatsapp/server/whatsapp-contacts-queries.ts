import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";
import {
  deriveWhatsappContactPreferenceStates,
  parseWhatsappContactsPayload,
  type WhatsappContactPreferenceState,
  type WhatsappContactsPage,
  type WhatsappContactsQuery,
} from "../contracts/contacts-compliance.ts";
import { isUuid } from "../contracts/control-plane.ts";

/*
 * Contacts workspace reads, through the CALLER's session only.
 * `list_whatsapp_contacts` refuses without whatsapp.contacts.read, and the
 * preference events table answers through RLS on the same permission.
 */

/** Null when the read failed; the page says so instead of showing an empty list. */
export async function listWhatsappContactsForCurrentUser(query: WhatsappContactsQuery): Promise<WhatsappContactsPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_whatsapp_contacts", {
    p_search: query.q ?? undefined,
    p_page: query.page,
    p_page_size: query.pageSize,
  });
  if (error) return null;
  return parseWhatsappContactsPayload(data);
}

/**
 * Whether to offer the restrictive opt-out inside a conversation. Sales
 * Executives hold only this WM-3 permission; the RPC still requires that they
 * may use the exact conversation under leads.assigned_to.
 */
export async function canCurrentUserRecordWhatsappOptOut(): Promise<boolean> {
  const answers = await authorizeMany(["whatsapp.opt_out.record"] as const);
  return answers["whatsapp.opt_out.record"];
}

/** Bounded: one page of contacts, and the events are append-only per category. */
const PREFERENCE_EVENT_LIMIT = 1000;

export async function listWhatsappPreferenceStatesForContacts(
  contactIds: readonly string[]
): Promise<ReadonlyMap<string, WhatsappContactPreferenceState>> {
  const ids = contactIds.filter(isUuid).slice(0, 50);
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_marketing_preference_events")
    .select("id, contact_id, category, event_type, occurred_at")
    .in("contact_id", ids)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PREFERENCE_EVENT_LIMIT);
  if (error || !data) return new Map();
  return deriveWhatsappContactPreferenceStates(data);
}
