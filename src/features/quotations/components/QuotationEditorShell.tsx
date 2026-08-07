"use client";

import { useMemo, useState } from "react";
import type { QuotationCalculationAdapter } from "../adapters/quotation-calculation-adapter.ts";
import type { QuotationCalculationInput } from "../contracts/calculation.ts";
import { assertDiscountBasisPoints } from "../contracts/discount.ts";
import type { QuotationLifecycleState } from "../contracts/lifecycle.ts";
import type { QuotationRevisionRef } from "../contracts/reference.ts";
import { validateQuotationCalculationInput } from "../domain/validate-quotation-input.ts";
import { buildQuotationDisplayModel } from "../ui/build-quotation-display-model.ts";
import { QuotationLineItemsEditor } from "./QuotationLineItemsEditor.tsx";
import { QuotationRevisionBanner } from "./QuotationRevisionBanner.tsx";
import { QuotationTotalsPanel } from "./QuotationTotalsPanel.tsx";
import { QuotationValidationSummary } from "./QuotationValidationSummary.tsx";

interface QuotationEditorShellProps {
  readonly adapter: QuotationCalculationAdapter;
  readonly initialInput: QuotationCalculationInput;
  readonly revision: QuotationRevisionRef;
  readonly lifecycleState: QuotationLifecycleState;
  readonly clientName: string;
  readonly projectLabel: string | null;
  readonly onSaveDraft?: (input: QuotationCalculationInput) => Promise<{ success: boolean }>;
}

export function QuotationEditorShell({
  adapter,
  initialInput,
  revision,
  lifecycleState,
  clientName,
  projectLabel,
  onSaveDraft,
}: QuotationEditorShellProps) {
  const [input, setInput] = useState(initialInput);
  const [discountBps, setDiscountBps] = useState(initialInput.discount.discountBps);
  const [pending, setPending] = useState(false);
  const readOnly = lifecycleState !== "draft";

  const workingInput = useMemo(
    () => ({
      ...input,
      discount: { discountBps },
    }),
    [input, discountBps]
  );

  const validation = validateQuotationCalculationInput(workingInput);
  const calculation = validation.ok ? adapter.calculate(workingInput) : null;
  const displayModel =
    calculation &&
    buildQuotationDisplayModel({
      revision,
      lifecycleState,
      clientName,
      projectLabel,
      input: workingInput,
      calculation,
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <div className="space-y-4">
        <QuotationRevisionBanner
          revision={revision}
          lifecycleState={lifecycleState}
          banner={displayModel?.stateBanner ?? null}
        />
        <QuotationValidationSummary validation={validation} />
        <QuotationLineItemsEditor
          items={input.lineItems}
          readOnly={readOnly}
          onChange={(items) => setInput({ ...input, lineItems: items })}
        />
        {!readOnly ? (
          <label className="block text-sm text-neutral-200">
            Quotation discount (bps)
            <input
              className="mt-1 block w-full max-w-xs min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
              inputMode="numeric"
              aria-label="Quotation discount basis points"
              value={String(discountBps)}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (Number.isNaN(parsed)) return;
                setDiscountBps(assertDiscountBasisPoints(parsed));
              }}
            />
          </label>
        ) : null}
      </div>
      <div className="space-y-4">
        {displayModel ? <QuotationTotalsPanel model={displayModel} /> : null}
        {!readOnly && onSaveDraft ? (
          <button
            type="button"
            disabled={!validation.ok || pending}
            className="w-full rounded-md border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
            onClick={async () => {
              setPending(true);
              try {
                await onSaveDraft(workingInput);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Saving draft…" : "Save draft (prebuild adapter)"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
