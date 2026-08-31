"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CrmActivityType } from "../../contracts/activity-contracts.ts";

/**
 * CRM 2D-1 — quick-action intent bus.
 *
 * Quick actions live in the command header; the components that actually own
 * each mutation (the activity workspace, the note composer) live further down
 * the page. Rather than duplicate a single mutation path — which would create
 * a second activity/note authority — the header only DISPATCHES an intent and
 * the owning component reacts.
 *
 * Nothing here talks to Supabase, and no intent bypasses a server action.
 */

export type LeadActionIntent =
  | { readonly kind: "create-activity"; readonly activityType: CrmActivityType | null }
  | { readonly kind: "complete-primary" }
  | { readonly kind: "add-note" };

interface LeadActionsContextValue {
  readonly intent: LeadActionIntent | null;
  /**
   * Increments on every dispatch. Consumers key on the nonce rather than
   * clearing the intent, so a repeated identical click still re-fires and no
   * consumer has to write to provider state from an effect.
   */
  readonly nonce: number;
  readonly dispatchIntent: (intent: LeadActionIntent) => void;
}

const LeadActionsContext = createContext<LeadActionsContextValue | null>(null);

export function LeadActionsProvider({ children }: { readonly children: ReactNode }) {
  const [intent, setIntent] = useState<LeadActionIntent | null>(null);
  const [nonce, setNonce] = useState(0);

  const dispatchIntent = useCallback((next: LeadActionIntent) => {
    setIntent(next);
    setNonce((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({ intent, nonce, dispatchIntent }),
    [intent, nonce, dispatchIntent]
  );

  return (
    <LeadActionsContext.Provider value={value}>
      {children}
    </LeadActionsContext.Provider>
  );
}

/**
 * Returns null outside a provider so every consumer stays usable standalone —
 * the activity workspace and note composer must keep working on any surface
 * that does not render the CRM 2D header.
 */
export function useLeadActions(): LeadActionsContextValue | null {
  return useContext(LeadActionsContext);
}
