import type { WhatsappOutboundMode } from "./provider-dispatch.ts";

/**
 * How this deployment sends, as three known words.
 *
 * Lives in contracts rather than beside the server function that builds it so
 * the composer and the list pane can name the type without importing a
 * `server-only` module. The VALUE is still produced on the server; only the
 * shape crosses.
 */
export type SendingStatusView = {
  readonly mode: WhatsappOutboundMode;
  /** "live" | "test" | "off" — drives the dot colour, never the only signal. */
  readonly tone: "live" | "test" | "off";
  readonly label: string;
  readonly detail: string;
  /** True when a reply genuinely leaves ONEDECORE for a customer's phone. */
  readonly reaches: boolean;
};

