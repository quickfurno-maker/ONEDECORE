/**
 * The application's database contract.
 *
 * WHY THIS FILE EXISTS
 *
 * `database.generated.ts` is machine output and nobody edits it. That rule only
 * works if there is somewhere else to put the corrections, because the
 * generator cannot express one thing the database genuinely does: accept SQL
 * NULL for an argument.
 *
 * Without this boundary the two roles collapse into one file, which is what
 * happened before. A stale generated file was patched by hand to add two
 * `leads` columns; regenerating it would then have produced a large diff mixing
 * real schema catch-up with the loss of nullable RPC arguments, so regeneration
 * kept being deferred and the file drifted further. By the time it was measured
 * it was missing seven tables and twenty-five functions.
 *
 * Runtime code imports `Database` from here. Only the type-generation tooling
 * and its tests import the generated file directly.
 *
 * WHAT MAY GO IN HERE
 *
 * Narrow, reviewed corrections with evidence — nothing else. No `any`, no
 * blanket casts, no widening a type because a call site would not compile. If
 * something does not fit, the answer is usually that the call site is wrong, or
 * that the database contract should change in a migration.
 */

import type { Database as GeneratedDatabase } from "./database.generated";

export type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./database.generated";
export { Constants } from "./database.generated";

type GeneratedPublic = GeneratedDatabase["public"];
type GeneratedFunctions = GeneratedPublic["Functions"];

/**
 * RPC arguments that accept SQL NULL, which the generator types as non-null.
 *
 * PostgREST's schema description does not distinguish "this argument may be
 * omitted" from "this argument may be NULL", so the generator emits `p?: string`
 * for an argument declared `DEFAULT NULL` and `p: string` for a required one
 * whose routine handles NULL deliberately. Both are narrower than the database.
 *
 * ENTRY CRITERIA — both must hold, and both are recorded below:
 *
 *   1. The DATABASE accepts NULL: the argument is declared `DEFAULT NULL`, or
 *      the routine body branches on it being NULL, or it is written to a
 *      nullable column while the routine validates its genuinely-required
 *      arguments separately.
 *   2. The APPLICATION depends on it: a current call site passes a value typed
 *      `T | null`. Every entry here was produced by removing the overlay and
 *      recording which call sites the compiler rejected — none was added
 *      speculatively.
 *
 * Two arguments that the historical hand-maintained file marked nullable are
 * deliberately NOT here: `bind_campaign_run_operation.p_provider_status` and
 * `get_crm_management_analytics.p_target_month`. Both are `DEFAULT NULL` in SQL,
 * so the database would accept NULL, but every call site passes a non-null
 * value. Criterion 2 fails, so the generated type stands. Should a caller ever
 * need to pass NULL, add the argument here with its evidence rather than
 * casting at the call site.
 *
 * The pgTAP suites call these routines with explicit SQL NULL, so the contract
 * is executable rather than merely asserted here.
 */
type NullableRpcArguments = {
  /**
   * `p_variant_id uuid` (no default). The routine validates it only when
   * present: `p_variant_id is not null and not exists (...)`. NULL means media
   * attached to the product rather than to one variant, which is what the
   * upload form submits when no variant is chosen.
   */
  authorize_commerce_product_media_upload: "p_variant_id";

  /**
   * `p_provider_ad_set_id text DEFAULT NULL`, `p_provider_ad_group_id text
   * DEFAULT NULL`. A provider returns one or the other depending on whether it
   * models ad sets or ad groups, never both, so the dispatcher passes `?? null`
   * for the one the provider did not return.
   */
  bind_campaign_run_operation: "p_provider_ad_set_id" | "p_provider_ad_group_id";

  /**
   * `p_campaign_reference text`, `p_campaign_version_number integer` (no
   * defaults). The routine reads both through `coalesce`, and the publish form
   * sends NULL for both when a publication is not bound to a campaign.
   */
  create_landing_publication: "p_campaign_reference" | "p_campaign_version_number";

  /**
   * `p_owner_id uuid DEFAULT NULL`, `p_source_id uuid DEFAULT NULL`. NULL is
   * the unfiltered case: a manager reading across all owners, or no source
   * filter applied.
   */
  get_crm_management_analytics: "p_owner_id" | "p_source_id";

  /**
   * `p_owner_id uuid DEFAULT NULL`. NULL means "every owner", which is the
   * broad-read case; a user without broad read has their own id substituted
   * before the call.
   */
  get_crm_my_day: "p_owner_id";

  /** `p_owner_id uuid DEFAULT NULL`, same broad-read semantics. */
  get_crm_pipeline_value_summary: "p_owner_id";

  /**
   * `p_experiment_id uuid`, `p_variant_key text` (no defaults). The routine
   * raises `LANDING_EXPOSURE_INVALID` for a NULL publication, visitor hash or
   * epoch and pointedly does not check these two, then writes them to columns
   * declared nullable — and applies `nullif(p_variant_key, '')`, which
   * *produces* NULL. A page with no running experiment records exposure with
   * both NULL.
   */
  record_landing_exposure: "p_experiment_id" | "p_variant_key";

  /**
   * `p_experiment_id uuid` (no default). `if p_experiment_id is null then
   * insert ...` — NULL is the create branch, as opposed to updating an existing
   * draft.
   */
  save_landing_experiment_draft: "p_experiment_id";

  /**
   * `requested_room_code text` (no default). `if requested_room_code is not
   * null and requested_room_code not in (...)` — NULL clears the room category
   * instead of setting one, and the action passes NULL for exactly that.
   */
  set_portfolio_media_room_category: "requested_room_code";

  /**
   * `p_experiment_reference text`, `p_variant_key text` (no defaults). The
   * routine branches on both: `if p_experiment_reference is not null then ...
   * else if p_variant_key is not null then return ... 'variant'`. A signed
   * context for a page with no experiment carries NULL for both, and the
   * routine must be able to tell that apart from a mismatched variant.
   */
  verify_live_landing_publication_context: "p_experiment_reference" | "p_variant_key";
};

/**
 * Widen the named arguments of one function to accept NULL.
 *
 * The mapped type is homomorphic, so optionality is preserved: an argument that
 * was `p?: string` becomes `p?: string | null` (may be omitted OR passed as
 * NULL) and one that was `p: string` becomes `p: string | null` (still
 * required, NULL permitted). Everything else about the function — its other
 * arguments and its return type — is untouched.
 */
type WithNullableArguments<Signature, NullableArgument extends string> = Signature extends {
  Args: infer Args;
}
  ? Omit<Signature, "Args"> & {
      Args: {
        [Argument in keyof Args]: Argument extends NullableArgument
          ? Args[Argument] | null
          : Args[Argument];
      };
    }
  : Signature;

type CorrectedFunctions = {
  [Name in keyof GeneratedFunctions]: Name extends keyof NullableRpcArguments
    ? WithNullableArguments<GeneratedFunctions[Name], NullableRpcArguments[Name]>
    : GeneratedFunctions[Name];
};

/**
 * The type every Supabase client in this application is parameterised by.
 *
 * Tables, views, enums and composite types come through exactly as generated —
 * only the argument types of the functions listed above differ.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublic, "Functions"> & {
    Functions: CorrectedFunctions;
  };
};

/**
 * The override allowlist as a value, so tests can assert its exact contents
 * rather than trusting that the type above says what this file claims. Keep it
 * in step with `NullableRpcArguments`; the test suite fails if it drifts.
 */
export const NULLABLE_RPC_ARGUMENT_OVERRIDES = {
  authorize_commerce_product_media_upload: ["p_variant_id"],
  bind_campaign_run_operation: ["p_provider_ad_set_id", "p_provider_ad_group_id"],
  create_landing_publication: ["p_campaign_reference", "p_campaign_version_number"],
  get_crm_management_analytics: ["p_owner_id", "p_source_id"],
  get_crm_my_day: ["p_owner_id"],
  get_crm_pipeline_value_summary: ["p_owner_id"],
  record_landing_exposure: ["p_experiment_id", "p_variant_key"],
  save_landing_experiment_draft: ["p_experiment_id"],
  set_portfolio_media_room_category: ["requested_room_code"],
  verify_live_landing_publication_context: ["p_experiment_reference", "p_variant_key"],
} as const satisfies Record<keyof NullableRpcArguments, readonly string[]>;
