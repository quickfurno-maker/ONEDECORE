/**
 * Quotation integration — wording draft callback only.
 * Never alters commercial fields or lifecycle state.
 */

export interface KritiQuotationWordingCallbacks {
  readonly onInsertWordingDraft?: (text: string) => void;
  readonly onCopyWordingDraft?: (text: string) => void;
}

export function createKritiQuotationWordingCallbacks(
  insertIntoField: (text: string) => void
): KritiQuotationWordingCallbacks {
  return {
    onInsertWordingDraft: (text: string) => {
      insertIntoField(text);
    },
    onCopyWordingDraft: (text: string) => {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text);
      }
    },
  };
}

export const QUOTATION_KRITI_ALLOWED_TASKS = ["quotation_wording_draft"] as const;
