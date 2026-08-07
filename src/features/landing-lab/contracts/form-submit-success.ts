/**
 * Phase 9 migration-independent — form submit success idempotency contract.
 */

export interface FormSubmitSuccessEvent {
  readonly submissionId: string;
  readonly canonicalPayloadHash: string;
  readonly publicationReference: string;
  readonly leadReference: string | null;
  readonly recordedAt: string;
}

export type FormSubmitIdempotencyOutcome =
  | { readonly status: "created"; readonly event: FormSubmitSuccessEvent }
  | { readonly status: "reused"; readonly event: FormSubmitSuccessEvent }
  | { readonly status: "conflict"; readonly message: string };

export function resolveFormSubmitIdempotency(input: {
  readonly submissionId: string;
  readonly canonicalPayloadHash: string;
  readonly existing: FormSubmitSuccessEvent | null;
}): FormSubmitIdempotencyOutcome {
  if (!input.existing) {
    return {
      status: "created",
      event: {
        submissionId: input.submissionId,
        canonicalPayloadHash: input.canonicalPayloadHash,
        publicationReference: "",
        leadReference: null,
        recordedAt: new Date(0).toISOString(),
      },
    };
  }
  if (input.existing.canonicalPayloadHash === input.canonicalPayloadHash) {
    return { status: "reused", event: input.existing };
  }
  return {
    status: "conflict",
    message: "Submission id reused with different canonical payload hash.",
  };
}
