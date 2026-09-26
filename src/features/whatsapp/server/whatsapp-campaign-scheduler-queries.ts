import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseWhatsappSchedulerEvents,
  schedulerCalendarWindow,
  type WhatsappSchedulerEvent,
} from "../contracts/campaign-scheduler.ts";
import { WHATSAPP_CAMPAIGN_EXECUTION_RPC } from "../contracts/campaign-execution.ts";

export async function listWhatsappSchedulerEventsForCurrentUser(
  month: string
): Promise<readonly WhatsappSchedulerEvent[]> {
  const supabase = await createClient();
  const window = schedulerCalendarWindow(month);
  const { data, error } = await supabase.rpc(
    WHATSAPP_CAMPAIGN_EXECUTION_RPC.listSchedulerRuns,
    {
      p_from: window.fromIso,
      p_to: window.toIso,
    }
  );
  if (error) return [];
  return parseWhatsappSchedulerEvents(data);
}
