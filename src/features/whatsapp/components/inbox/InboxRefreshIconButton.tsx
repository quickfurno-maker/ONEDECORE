"use client";

import { useRouter } from "next/navigation";

/**
 * Manual refresh for the chat pane, as one icon.
 *
 * WHY THIS IS NOT THE OTHER REFRESH CONTROL.
 *
 * The polling loop lives in `InboxManualRefreshButton`, which the list pane
 * renders on both routes — including on a phone, where the list pane is
 * `display: none` but still mounted, so the timer still runs. Rendering that
 * component twice would run two intervals and poll at twice the stated rate,
 * which is the sort of thing that is invisible until someone reads the server
 * logs. So the chat header gets a button that only asks for a refresh, and
 * owns no timer.
 *
 * Icon-only because the full control — checkbox, label, button — is about
 * 190px wide, and spending that in the chat header truncated the customer's
 * name to "Rhea…". Identity wins; the auto-refresh state is on the list header
 * a few centimetres away.
 */
export function InboxRefreshIconButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="od-wa__icon"
      onClick={() => router.refresh()}
      aria-label="Refresh this conversation"
      title="Refresh this conversation"
    >
      <span aria-hidden="true">↻</span>
    </button>
  );
}
