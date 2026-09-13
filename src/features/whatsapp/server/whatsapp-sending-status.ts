import "server-only";

import { getWhatsappOutboundMode } from "./whatsapp-outbound-env.ts";
import type { SendingStatusView } from "../contracts/sending-status.ts";

/**
 * What actually happens when someone presses Send, in one line.
 *
 * WHY THIS EXISTS.
 *
 * `ONEDECORE_WHATSAPP_OUTBOUND_MODE` decides whether a reply is dispatched to
 * Meta, handed to a fake provider, or recorded and left there. All three paths
 * return `success: true` from the send action and all three put the message in
 * the thread, so from the composer they look identical. In `disabled` mode a
 * member of staff can answer a customer all afternoon and the customer will
 * receive nothing.
 *
 * That is the exact shape of a control that pretends to work, so the mode is
 * stated on screen instead.
 *
 * WHAT IT DOES NOT SAY.
 *
 * A mode name, and nothing else. Not the WABA id, not the phone number id, not
 * the Graph version, not whether a token is present — none of which a reader
 * needs and all of which are account identifiers. `getWhatsappOutboundMode`
 * reads one variable and maps it to one of three known words, so there is no
 * path from this function to a secret.
 *
 * It is also not a health check. It reports how this deployment is configured,
 * not whether Meta is reachable or the number is in good standing; ONEDECORE
 * learns that only from a dispatch attempt, and the attempt's own error is
 * what reports it.
 */

export function getWhatsappSendingStatus(): SendingStatusView {
  const mode = getWhatsappOutboundMode();

  if (mode === "enabled") {
    return {
      mode,
      tone: "live",
      label: "Sending live",
      detail:
        "Replies are dispatched to WhatsApp. Delivery is reported by WhatsApp on each message.",
      reaches: true,
    };
  }

  if (mode === "local-test") {
    return {
      mode,
      tone: "test",
      label: "Test sending",
      detail:
        "This environment is wired to a test provider. Replies are recorded and appear in the thread, but nothing reaches the customer's phone.",
      reaches: false,
    };
  }

  return {
    mode,
    tone: "off",
    label: "Sending off",
    detail:
      "Outbound WhatsApp is turned off in this environment. Replies are recorded in ONEDECORE and will not be delivered to the customer.",
    reaches: false,
  };
}
