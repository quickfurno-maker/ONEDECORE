/**
 * Human-control callback contracts — assistance only, no business mutation.
 */

export interface KritiHumanControlCallbacks {
  readonly onCopy?: (text: string) => void;
  readonly onInsertDraft?: (text: string) => void;
  readonly onDismiss?: () => void;
}

export const KRITI_HUMAN_CONTROL_DISCLAIMER =
  "Kriti suggestions require human review before any customer-visible use.";

export const KRITI_FORBIDDEN_CALLBACK_NAMES = [
  "autoSend",
  "executeSuggestion",
  "applyBusinessMutation",
  "sendMessage",
  "mutateAssignment",
  "closeLead",
] as const;
