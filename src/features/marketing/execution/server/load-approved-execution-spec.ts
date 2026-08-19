import { parseCampaignApprovedExecutionSpec } from "../domain/approved-execution-spec.ts";
import type { CampaignApprovedExecutionSpec } from "../contracts/approved-execution-spec.ts";
import { APPROVED_SPEC_HASH_PATTERN } from "../contracts/approved-execution-spec.ts";

export const CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED = "CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED";
export const CAMPAIGN_FROZEN_AUDIENCE_RULE_MISSING = "CAMPAIGN_FROZEN_AUDIENCE_RULE_MISSING";
export const CAMPAIGN_AUDIENCE_RULE_HASH_MISMATCH = "CAMPAIGN_AUDIENCE_RULE_HASH_MISMATCH";
export const CAMPAIGN_APPROVAL_HASH_MISMATCH = "CAMPAIGN_APPROVAL_HASH_MISMATCH";

export const CAMPAIGN_RUNS_APPROVED_SPEC_SELECT =
  "campaign_version_id, configuration_hash, audience_rule_hash, provider_channel, targeting_mode";

export const CAMPAIGN_VERSIONS_APPROVED_SPEC_SELECT =
  "id, status, configuration_hash, budget_snapshot, creative_snapshot, intended_window_snapshot, destination_reference";

export const CAMPAIGN_AUDIENCE_RULE_APPROVED_SPEC_SELECT = "rule_hash, frozen_at";

export const CAMPAIGN_APPROVALS_APPROVED_SPEC_SELECT = "decision, configuration_hash, rule_hash";

export interface ApprovedSpecQueryRow {
  readonly data: Record<string, unknown> | null;
  readonly error: { readonly message?: string } | null;
}

export interface ApprovedSpecStore {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<ApprovedSpecQueryRow>;
      };
    };
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function readRow(
  store: ApprovedSpecStore,
  table: string,
  columns: string,
  column: string,
  value: string
): Promise<{ readonly ok: true; readonly row: Record<string, unknown> | null } | { readonly ok: false; readonly code: string }> {
  const result = await store.from(table).select(columns).eq(column, value).maybeSingle();
  if (result.error) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED };
  }
  if (result.data == null) return { ok: true, row: null };
  return { ok: true, row: asRecord(result.data) };
}

export async function loadApprovedExecutionSpec(
  store: ApprovedSpecStore,
  runId: string
): Promise<
  { readonly ok: true; readonly spec: CampaignApprovedExecutionSpec } | { readonly ok: false; readonly code: string }
> {
  const runRead = await readRow(store, "campaign_runs", CAMPAIGN_RUNS_APPROVED_SPEC_SELECT, "id", runId);
  if (!runRead.ok) return runRead;
  if (!runRead.row) return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED };
  const run = runRead.row;
  const versionId = String(run.campaign_version_id ?? "");
  if (!versionId) return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED };

  const versionRead = await readRow(
    store,
    "campaign_versions",
    CAMPAIGN_VERSIONS_APPROVED_SPEC_SELECT,
    "id",
    versionId
  );
  if (!versionRead.ok) return versionRead;
  if (!versionRead.row) return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED };
  const version = versionRead.row;

  const ruleRead = await readRow(
    store,
    "campaign_audience_rule_versions",
    CAMPAIGN_AUDIENCE_RULE_APPROVED_SPEC_SELECT,
    "campaign_version_id",
    versionId
  );
  if (!ruleRead.ok) return ruleRead;
  if (!ruleRead.row || ruleRead.row.frozen_at == null || String(ruleRead.row.frozen_at) === "") {
    return { ok: false, code: CAMPAIGN_FROZEN_AUDIENCE_RULE_MISSING };
  }
  const frozenHash = String(ruleRead.row.rule_hash ?? "");
  const runRuleHash = String(run.audience_rule_hash ?? "");
  if (!APPROVED_SPEC_HASH_PATTERN.test(frozenHash) || frozenHash !== runRuleHash) {
    return { ok: false, code: CAMPAIGN_AUDIENCE_RULE_HASH_MISMATCH };
  }

  const approvalRead = await readRow(
    store,
    "campaign_approvals",
    CAMPAIGN_APPROVALS_APPROVED_SPEC_SELECT,
    "campaign_version_id",
    versionId
  );
  if (!approvalRead.ok) return approvalRead;
  if (approvalRead.row) {
    const approval = approvalRead.row;
    if (
      String(approval.decision ?? "") !== "approved" ||
      String(approval.configuration_hash ?? "") !== String(version.configuration_hash ?? "") ||
      String(approval.rule_hash ?? "") !== frozenHash
    ) {
      return { ok: false, code: CAMPAIGN_APPROVAL_HASH_MISMATCH };
    }
  }

  return parseCampaignApprovedExecutionSpec({
    campaignVersionId: String(version.id ?? versionId),
    versionStatus: String(version.status ?? ""),
    versionConfigurationHash: String(version.configuration_hash ?? ""),
    runConfigurationHash: String(run.configuration_hash ?? ""),
    providerChannel: String(run.provider_channel ?? ""),
    targetingMode: String(run.targeting_mode ?? ""),
    audienceRuleHash: runRuleHash,
    budgetSnapshot: version.budget_snapshot,
    creativeSnapshot: version.creative_snapshot,
    intendedWindowSnapshot: version.intended_window_snapshot,
    destinationReference: version.destination_reference == null ? null : String(version.destination_reference),
  });
}
