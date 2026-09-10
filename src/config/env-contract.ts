/**
 * The canonical list of environment variables ONEDECORE supports.
 *
 * WHAT THIS OWNS, AND WHAT IT DOES NOT
 *
 * This module owns WHICH KEYS EXIST and what kind of thing each one is. It does
 * not read them, validate them, or decide when a feature is allowed to run.
 * That stays with the feature that owns the behaviour — `server-env.ts` decides
 * when lead intake may accept a lead, `landing-lab-env.ts` decides when a
 * publication context may be signed — because those decisions are the features'
 * fail-closed logic and centralising them would turn four careful gates into
 * one blunt config object.
 *
 * So: names and metadata here, values and rules there.
 *
 * NO VALUES LIVE IN THIS FILE. It is safe to import anywhere, including the
 * browser bundle, precisely because it contains no secret — only the fact that
 * a secret by that name exists.
 *
 * WHY IT EXISTS
 *
 * `.env.example` had drifted to 22 declared keys while source read 47. Twenty-
 * one supported variables — every Meta Ads credential, every Google Ads
 * credential, the whole Kriti group, both campaign activation gates — were
 * undocumented. Someone provisioning an environment had no way to learn they
 * existed short of grepping, and no way to tell an activation gate from a
 * required secret.
 *
 * `scripts/verify-env-contract.mjs` compares this registry against what source
 * actually reads and against `.env.example`, and fails the build on any
 * disagreement. Adding a `process.env` read without registering it is now a
 * build error.
 */

/** Where the value is visible. `public` is inlined into the browser bundle. */
export type EnvScope = "public" | "server";

/** What kind of value it is. `secret` must never be public-scoped. */
export type EnvSensitivity = "public" | "secret" | "config";

/**
 * When the value must be present.
 *
 * `activation-gated` is the important one: the feature is built and fails
 * closed without it. Absence is a deliberate OFF state, not a misconfiguration.
 */
export type EnvLifecycle =
  | "required"
  | "optional"
  | "activation-gated"
  | "local-test-only";

export type EnvSubsystem =
  | "core"
  | "lead"
  | "quotation"
  | "commerce"
  | "landing"
  | "whatsapp"
  | "campaign"
  | "meta-ads"
  | "google-ads"
  | "kriti";

export interface EnvKeyContract {
  readonly name: string;
  readonly scope: EnvScope;
  readonly sensitivity: EnvSensitivity;
  readonly lifecycle: EnvLifecycle;
  readonly subsystem: EnvSubsystem;
  /** Why it exists and what happens without it. */
  readonly purpose: string;
  /**
   * Whether `.env.example` should carry it as a `KEY=` line.
   *
   * False for keys that are documented as comments instead: local-test-only
   * values, and `NODE_ENV`, which the runtime sets.
   */
  readonly inEnvExample: boolean;
}

export const ONEDECORE_ENV_CONTRACT: readonly EnvKeyContract[] = [
  // ---------------------------------------------------------------- core ---
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    scope: "public",
    sensitivity: "public",
    lifecycle: "required",
    subsystem: "core",
    purpose:
      "The Supabase project every client targets. Validated against the managed ONEDECORE host in production; a loopback stack is accepted only outside production.",
    inEnvExample: true,
  },
  {
    name: "SUPABASE_URL",
    scope: "server",
    sensitivity: "public",
    lifecycle: "optional",
    subsystem: "core",
    purpose:
      "Server-side alias for the same target, accepted for hosts that set it. Subject to the identical validation.",
    inEnvExample: true,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    scope: "public",
    sensitivity: "public",
    lifecycle: "required",
    subsystem: "core",
    purpose: "Browser Supabase key. RLS applies to everything it can reach.",
    inEnvExample: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "required",
    subsystem: "core",
    purpose:
      "Bypasses RLS entirely. Server-only, refused if it looks like a publishable key, and usable only against a validated target.",
    inEnvExample: true,
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    scope: "public",
    sensitivity: "public",
    lifecycle: "optional",
    subsystem: "core",
    purpose: "Absolute base URL used when building links for outbound messages.",
    inEnvExample: true,
  },
  {
    name: "NEXT_PUBLIC_ONEDECORE_PHONE_E164",
    scope: "public",
    sensitivity: "public",
    lifecycle: "optional",
    subsystem: "core",
    purpose:
      "The public voice line behind the Call Now action. Separate from the WhatsApp key even when the number matches, so publishing a landline for calls cannot silently redirect chat. Public by design — it is printed on the site.",
    inEnvExample: true,
  },
  {
    name: "NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164",
    scope: "public",
    sensitivity: "public",
    lifecycle: "optional",
    subsystem: "core",
    purpose:
      "The public WhatsApp number offered as a fallback when online enquiry is unavailable. Public by design — it is printed on the site.",
    inEnvExample: true,
  },
  {
    name: "NODE_ENV",
    scope: "server",
    sensitivity: "config",
    lifecycle: "optional",
    subsystem: "core",
    purpose:
      "Set by the runtime, not by an operator. Production tightens the Supabase target rule and forbids local-test intake.",
    inEnvExample: false,
  },
  {
    name: "ONEDECORE_TRUST_PROXY",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "core",
    purpose:
      "Trust X-Forwarded-For. Only safe behind a proxy that OVERWRITES the header; enabling it otherwise lets a caller choose their own client IP.",
    inEnvExample: true,
  },

  // ---------------------------------------------------------------- lead ---
  {
    name: "ONEDECORE_LEAD_INTAKE_MODE",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "lead",
    purpose:
      "disabled | local-test | enabled. The ONLY authority on whether the public form submits. Defaults to disabled.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_LEAD_HASH_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "required",
    subsystem: "lead",
    purpose:
      "Fingerprints phone numbers and network identifiers for de-duplication. At least 32 characters. Never shared with another domain.",
    inEnvExample: true,
  },

  // ----------------------------------------------------------- quotation ---
  {
    name: "QUOTATION_CAPABILITY_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "required",
    subsystem: "quotation",
    purpose:
      "Signs the capability tokens that let a customer open and accept a quotation without an account. At least 32 bytes.",
    inEnvExample: true,
  },

  // ------------------------------------------------------------ commerce ---
  {
    name: "ONEDECORE_SHOP_PUBLIC_ENABLED",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "commerce",
    purpose: "Serves the public shop. Fails closed; currently OFF.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "commerce",
    purpose:
      "Proves a public commerce request came from this runtime. Required only once the shop is enabled.",
    inEnvExample: true,
  },

  // ------------------------------------------------------------- landing ---
  {
    name: "ONEDECORE_LANDING_LAB_PUBLIC_ENABLED",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "landing",
    purpose: "Serves /lp/<slug> publicly. Fails closed; currently OFF.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_LANDING_LAB_HMAC_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "landing",
    purpose:
      "Signs the publication context that decides campaign attribution. Its own secret — it must never be the lead hash secret. Missing means no attribution, not a broken enquiry.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_LANDING_LAB_HMAC_TEST_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "local-test-only",
    subsystem: "landing",
    purpose:
      "Lets local fixtures sign a publication context. Ignored entirely when NODE_ENV is production.",
    inEnvExample: false,
  },

  // ------------------------------------------------------------ whatsapp ---
  {
    name: "ONEDECORE_WHATSAPP_WEBHOOK_MODE",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "Inbound webhook mode. Fails closed; currently disabled.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_WHATSAPP_OUTBOUND_MODE",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "Outbound send mode. Fails closed; currently disabled.",
    inEnvExample: true,
  },
  {
    name: "META_WHATSAPP_APP_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "Verifies the X-Hub signature on inbound Meta webhooks.",
    inEnvExample: true,
  },
  {
    name: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "Answers Meta's webhook verification handshake.",
    inEnvExample: true,
  },
  {
    name: "META_WHATSAPP_ACCESS_TOKEN",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "Graph API credential for outbound sends.",
    inEnvExample: true,
  },
  {
    name: "META_WHATSAPP_PHONE_NUMBER_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "whatsapp",
    purpose: "The Meta phone number id messages are sent from.",
    inEnvExample: true,
  },
  {
    name: "META_WHATSAPP_GRAPH_API_VERSION",
    scope: "server",
    sensitivity: "config",
    lifecycle: "optional",
    subsystem: "whatsapp",
    purpose: "Pins the Graph API version. A safe default applies when unset.",
    inEnvExample: true,
  },

  // ------------------------------------------------------------ campaign ---
  {
    name: "ONEDECORE_CAMPAIGN_EXECUTION_MODE",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose:
      "Execution mode. sandbox and live both remain fail-closed until a certified live-provider activation path exists — this alone does not reach a provider.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose:
      "Second of the two gates guarding live provider traffic. Both must be satisfied AND the transport must be implemented; today it is not.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_CAMPAIGN_SANDBOX_TRANSPORT_ENABLED",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose: "Permits sandbox provider transport. Default OFF.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose:
      "Signs run/target execution context. Its own secret; must not be reused from Landing Lab.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose: "Authenticates the internal dispatch worker endpoint.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_PROVIDER_DATA_SHARING_ENABLED",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "campaign",
    purpose:
      "Permits sharing CRM identifiers with ad providers. Default OFF; a privacy decision, not a performance one.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO",
    scope: "server",
    sensitivity: "config",
    lifecycle: "local-test-only",
    subsystem: "campaign",
    purpose: "Forces a dispatcher outcome in local tests.",
    inEnvExample: false,
  },

  // ------------------------------------------------------------ meta-ads ---
  {
    name: "ONEDECORE_META_ADS_ACCOUNT_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "meta-ads",
    purpose: "Meta ad account. Unused while live transport stays closed.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_META_ADS_ACCESS_TOKEN",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "meta-ads",
    purpose:
      "Meta Marketing API access token. Unused while live provider transport remains closed.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_META_ADS_GRAPH_VERSION",
    scope: "server",
    sensitivity: "config",
    lifecycle: "optional",
    subsystem: "meta-ads",
    purpose: "Pins the Marketing API version; defaults when unset.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_META_ADS_PAGE_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "meta-ads",
    purpose:
      "The Meta page the ads belong to. Needed to create or read creative on that page.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_META_ADS_DATASET_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "meta-ads",
    purpose: "Conversions dataset. Falls back to the pixel id when unset.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_META_ADS_PIXEL_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "meta-ads",
    purpose:
      "Legacy pixel identifier. Used only as a fallback when no conversions dataset id is set.",
    inEnvExample: true,
  },

  // ---------------------------------------------------------- google-ads ---
  {
    name: "ONEDECORE_GOOGLE_ADS_CUSTOMER_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose: "Google Ads customer. Unused while live transport stays closed.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose: "Manager account used to authenticate against the customer.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_DEVELOPER_TOKEN",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose:
      "Google Ads API developer token. Required by every call the adapter would make, once live transport exists.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_CLIENT_ID",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose:
      "OAuth client id for the Google Ads API. Without the full OAuth trio no upload is attempted.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_CLIENT_SECRET",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose:
      "OAuth client secret paired with the client id. Absent means the Google adapter stays unconfigured.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_REFRESH_TOKEN",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose:
      "OAuth refresh token granting offline access, so uploads need no interactive sign-in.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_GOOGLE_ADS_CONVERSION_ACTION",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "google-ads",
    purpose: "Conversion action resource name for uploads.",
    inEnvExample: true,
  },

  // --------------------------------------------------------------- kriti ---
  {
    name: "ONEDECORE_KRITI_MODE",
    scope: "server",
    sensitivity: "config",
    lifecycle: "activation-gated",
    subsystem: "kriti",
    purpose: "Assistant provider mode. Fails closed; currently disabled.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_KRITI_GROQ_API_KEY",
    scope: "server",
    sensitivity: "secret",
    lifecycle: "activation-gated",
    subsystem: "kriti",
    purpose: "Groq credential, required only once Kriti is enabled.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_KRITI_GROQ_MODEL",
    scope: "server",
    sensitivity: "config",
    lifecycle: "optional",
    subsystem: "kriti",
    purpose: "Overrides the default model identifier.",
    inEnvExample: true,
  },
  {
    name: "ONEDECORE_KRITI_TIMEOUT_MS",
    scope: "server",
    sensitivity: "config",
    lifecycle: "optional",
    subsystem: "kriti",
    purpose: "Per-request provider timeout in milliseconds.",
    inEnvExample: true,
  },
];

export const ONEDECORE_ENV_KEYS: readonly string[] = ONEDECORE_ENV_CONTRACT.map(
  (entry) => entry.name
);

export function findEnvKeyContract(name: string): EnvKeyContract | undefined {
  return ONEDECORE_ENV_CONTRACT.find((entry) => entry.name === name);
}
