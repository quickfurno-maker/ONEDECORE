/**
 * Task-specific structured output schemas (manual validation — no runtime DB).
 */

import type { KritiTaskType } from "./task-types.ts";

export interface KritiFactItem {
  readonly text: string;
  readonly confidence: "fact" | "suggestion";
}

export interface ConversationSummaryOutput {
  readonly summary: string;
  readonly facts: readonly KritiFactItem[];
  readonly openQuestions: readonly string[];
  readonly risks: readonly string[];
}

export interface MissingInformationOutput {
  readonly missingFacts: readonly string[];
  readonly questionsToAsk: readonly string[];
}

export interface ObjectionSuggestion {
  readonly objection: string;
  readonly suggestedResponse: string;
  readonly factsToVerify: readonly string[];
  readonly doNotClaim: readonly string[];
}

export interface ObjectionSuggestionsOutput {
  readonly suggestions: readonly ObjectionSuggestion[];
}

export interface NextActionSuggestion {
  readonly title: string;
  readonly rationale: string;
}

export interface NextActionSuggestionsOutput {
  readonly suggestions: readonly NextActionSuggestion[];
}

export interface DraftOutputBase {
  readonly draftText: string;
  readonly factsUsed: readonly string[];
  readonly missingFacts: readonly string[];
  readonly warnings: readonly string[];
  readonly humanReviewRequired: true;
}

export interface ServiceReplyDraftOutput extends DraftOutputBase {
  readonly purpose: "service_reply";
}

export interface QuotationWordingDraftOutput extends DraftOutputBase {
  readonly purpose: "quotation_wording";
  readonly mustNotAlterCommercialFields: true;
}

export interface ProjectUpdateDraftOutput extends DraftOutputBase {
  readonly purpose: "project_update";
}

export interface DesignSummaryOutput {
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly openQuestions: readonly string[];
  readonly humanReviewRequired: true;
}

export interface CampaignCopyDraftOutput extends DraftOutputBase {
  readonly purpose: "campaign_copy";
  readonly audienceReminder: string;
}

export type KritiStructuredOutput =
  | ConversationSummaryOutput
  | MissingInformationOutput
  | ObjectionSuggestionsOutput
  | NextActionSuggestionsOutput
  | ServiceReplyDraftOutput
  | QuotationWordingDraftOutput
  | ProjectUpdateDraftOutput
  | DesignSummaryOutput
  | CampaignCopyDraftOutput;

export const KRITI_TASK_SCHEMA_NAMES: Record<KritiTaskType, string> = {
  conversation_summary: "kriti.conversation_summary.v1",
  missing_information: "kriti.missing_information.v1",
  objection_suggestions: "kriti.objection_suggestions.v1",
  next_action_suggestions: "kriti.next_action_suggestions.v1",
  service_reply_draft: "kriti.service_reply_draft.v1",
  quotation_wording_draft: "kriti.quotation_wording_draft.v1",
  project_update_draft: "kriti.project_update_draft.v1",
  design_summary: "kriti.design_summary.v1",
  campaign_copy_draft: "kriti.campaign_copy_draft.v1",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }
  return value;
}

function validateDraftBase(record: Record<string, unknown>): DraftOutputBase | null {
  if (typeof record.draftText !== "string") return null;
  const factsUsed = readStringArray(record.factsUsed);
  const missingFacts = readStringArray(record.missingFacts);
  const warnings = readStringArray(record.warnings);
  if (!factsUsed || !missingFacts || !warnings) return null;
  if (record.humanReviewRequired !== true) return null;
  return {
    draftText: record.draftText,
    factsUsed,
    missingFacts,
    warnings,
    humanReviewRequired: true,
  };
}

export function validateKritiStructuredOutput(
  taskType: KritiTaskType,
  value: unknown
): KritiStructuredOutput | null {
  if (!isRecord(value)) return null;

  switch (taskType) {
    case "conversation_summary": {
      if (typeof value.summary !== "string") return null;
      const openQuestions = readStringArray(value.openQuestions);
      const risks = readStringArray(value.risks);
      if (!openQuestions || !risks || !Array.isArray(value.facts)) return null;
      const facts: KritiFactItem[] = [];
      for (const item of value.facts) {
        if (!isRecord(item) || typeof item.text !== "string") return null;
        if (item.confidence !== "fact" && item.confidence !== "suggestion") return null;
        facts.push({ text: item.text, confidence: item.confidence });
      }
      return { summary: value.summary, facts, openQuestions, risks };
    }
    case "missing_information": {
      const missingFacts = readStringArray(value.missingFacts);
      const questionsToAsk = readStringArray(value.questionsToAsk);
      if (!missingFacts || !questionsToAsk) return null;
      return { missingFacts, questionsToAsk };
    }
    case "objection_suggestions": {
      if (!Array.isArray(value.suggestions)) return null;
      const suggestions: ObjectionSuggestion[] = [];
      for (const item of value.suggestions) {
        if (!isRecord(item) || typeof item.objection !== "string") return null;
        if (typeof item.suggestedResponse !== "string") return null;
        const factsToVerify = readStringArray(item.factsToVerify);
        const doNotClaim = readStringArray(item.doNotClaim);
        if (!factsToVerify || !doNotClaim) return null;
        suggestions.push({
          objection: item.objection,
          suggestedResponse: item.suggestedResponse,
          factsToVerify,
          doNotClaim,
        });
      }
      return { suggestions };
    }
    case "next_action_suggestions": {
      if (!Array.isArray(value.suggestions)) return null;
      const suggestions: NextActionSuggestion[] = [];
      for (const item of value.suggestions) {
        if (!isRecord(item) || typeof item.title !== "string") return null;
        if (typeof item.rationale !== "string") return null;
        suggestions.push({ title: item.title, rationale: item.rationale });
      }
      return { suggestions };
    }
    case "service_reply_draft": {
      const base = validateDraftBase(value);
      if (!base) return null;
      return { ...base, purpose: "service_reply" };
    }
    case "quotation_wording_draft": {
      const base = validateDraftBase(value);
      if (!base) return null;
      return { ...base, purpose: "quotation_wording", mustNotAlterCommercialFields: true };
    }
    case "project_update_draft": {
      const base = validateDraftBase(value);
      if (!base) return null;
      return { ...base, purpose: "project_update" };
    }
    case "design_summary": {
      if (typeof value.summary !== "string") return null;
      const highlights = readStringArray(value.highlights);
      const openQuestions = readStringArray(value.openQuestions);
      if (!highlights || !openQuestions) return null;
      if (value.humanReviewRequired !== true) return null;
      return { summary: value.summary, highlights, openQuestions, humanReviewRequired: true };
    }
    case "campaign_copy_draft": {
      const base = validateDraftBase(value);
      if (!base || typeof value.audienceReminder !== "string") return null;
      return { ...base, purpose: "campaign_copy", audienceReminder: value.audienceReminder };
    }
    default:
      return null;
  }
}
