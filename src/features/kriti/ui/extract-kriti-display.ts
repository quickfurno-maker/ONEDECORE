/**
 * Extract human-readable display fields from structured Kriti output.
 */

import type { KritiSuggestion } from "../contracts/result.ts";
import type {
  CampaignCopyDraftOutput,
  ConversationSummaryOutput,
  DesignSummaryOutput,
  DraftOutputBase,
  KritiStructuredOutput,
  MissingInformationOutput,
  NextActionSuggestionsOutput,
  ObjectionSuggestionsOutput,
  QuotationWordingDraftOutput,
  ServiceReplyDraftOutput,
} from "../contracts/task-schemas.ts";

export interface KritiDisplayModel {
  readonly primaryText: string | null;
  readonly warnings: readonly string[];
  readonly humanReviewRequired: boolean;
  readonly insertableDraft: string | null;
}

function fromDraft(draft: DraftOutputBase): KritiDisplayModel {
  return {
    primaryText: draft.draftText,
    warnings: draft.warnings,
    humanReviewRequired: true,
    insertableDraft: draft.draftText,
  };
}

export function buildKritiDisplayModel(suggestion: KritiSuggestion): KritiDisplayModel {
  const output = suggestion.output as KritiStructuredOutput;

  switch (suggestion.taskType) {
    case "conversation_summary": {
      const o = output as ConversationSummaryOutput;
      return {
        primaryText: o.summary,
        warnings: o.risks,
        humanReviewRequired: suggestion.humanReviewRequired,
        insertableDraft: null,
      };
    }
    case "missing_information": {
      const o = output as MissingInformationOutput;
      const text = [
        ...o.missingFacts.map((f) => `Missing: ${f}`),
        ...o.questionsToAsk.map((q) => `Ask: ${q}`),
      ].join("\n");
      return {
        primaryText: text,
        warnings: [],
        humanReviewRequired: suggestion.humanReviewRequired,
        insertableDraft: null,
      };
    }
    case "objection_suggestions": {
      const o = output as ObjectionSuggestionsOutput;
      const text = o.suggestions
        .map(
          (s) =>
            `Objection: ${s.objection}\nSuggested response: ${s.suggestedResponse}`
        )
        .join("\n\n");
      return {
        primaryText: text,
        warnings: o.suggestions.flatMap((s) => s.doNotClaim),
        humanReviewRequired: suggestion.humanReviewRequired,
        insertableDraft: null,
      };
    }
    case "next_action_suggestions": {
      const o = output as NextActionSuggestionsOutput;
      const text = o.suggestions
        .map((s) => `${s.title}: ${s.rationale}`)
        .join("\n");
      return {
        primaryText: text,
        warnings: [],
        humanReviewRequired: suggestion.humanReviewRequired,
        insertableDraft: null,
      };
    }
    case "service_reply_draft":
      return fromDraft(output as ServiceReplyDraftOutput);
    case "quotation_wording_draft":
      return fromDraft(output as QuotationWordingDraftOutput);
    case "project_update_draft":
      return fromDraft(output as ProjectUpdateDraftOutput);
    case "design_summary": {
      const o = output as DesignSummaryOutput;
      const text = [o.summary, ...o.highlights.map((h) => `• ${h}`)].join("\n");
      return {
        primaryText: text,
        warnings: o.openQuestions,
        humanReviewRequired: true,
        insertableDraft: o.summary,
      };
    }
    case "campaign_copy_draft": {
      const o = output as CampaignCopyDraftOutput;
      return {
        ...fromDraft(o),
        warnings: [...o.warnings, o.audienceReminder],
      };
    }
    default:
      return {
        primaryText: null,
        warnings: [],
        humanReviewRequired: true,
        insertableDraft: null,
      };
  }
}
