/**
 * Restore a LOCAL super admin login after `db:reset`.
 *
 * THE DEFECT THIS EXISTS FOR
 *
 * `supabase db reset` drops and recreates the whole database, `auth.users`
 * included. Roles and permissions come back because migrations seed them;
 * USERS do not, because nothing seeds them. So every reset silently removes the
 * only way to log into the local admin, and the symptom is indistinguishable
 * from a wrong password: the login POST returns 303 to `?error=invalid` with no
 * `Set-Cookie`, exactly as it would for a bad credential.
 *
 * Before this script the only supported path back was
 * `scripts/phase-5c1-owner-qa.mjs`, which seeds six fixture identities and then
 * runs an RLS proof suite and REST probes. That is a QA runner, not a way to get
 * your own login back.
 *
 * WHAT IT DOES
 *
 * The same three steps the Phase 5C1 fixture does, and nothing else:
 *
 *   1. create (or update) the auth user through the Supabase Admin API
 *   2. activate the `profiles` row the auth trigger created
 *   3. assign the `super_admin` role
 *
 * It does not touch RLS, does not add a bypass, and creates no identity the
 * ordinary login flow would not accept. The account it produces logs in through
 * `/auth/login` like any other Super Admin, and every permission it holds comes
 * from the role grants the migrations already define.
 *
 * WHY IT CANNOT REACH PRODUCTION
 *
 * It reads the Supabase URL from `supabase status` — the local stack's own
 * report — and passes it through `assertLocalSupabaseUrl`, the same guard the
 * Phase 5C1 scripts use. A hostname that is not loopback aborts before any
 * client is constructed. There is no flag to override that, and the service-role
 * key it uses is the local stack's, printed by `supabase status`, never read
 * from `.env`.
 *
 * CREDENTIALS
 *
 * From the environment only:
 *
 *   ONEDECORE_LOCAL_ADMIN_EMAIL
 *   ONEDECORE_LOCAL_ADMIN_PASSWORD
 *
 * Nothing is defaulted, nothing is written to disk, and neither value is ever
 * printed — not on success, not in an error. Use a LOCAL-ONLY password: this
 * account exists in a throwaway database and has no relationship to the managed
 * project.
 *
 * Idempotent: run it as often as you reset.
 *
 *   ONEDECORE_LOCAL_ADMIN_EMAIL=you@example.test \
 *   ONEDECORE_LOCAL_ADMIN_PASSWORD='local-only' \
 *   npm run dev:ensure-superadmin
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalSupabaseUrl } from "./phase-5c1-qa-guards.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The role this script grants. Everything else follows from its grants. */
const ROLE_CODE = "super_admin";

/** Permissions the admin shell and the Website Manager actually require. */
const REQUIRED_PERMISSIONS = ["admin.access", "website.manage"];

function fail(message) {
  console.error(`\n[dev:ensure-superadmin] ${message}\n`);
  process.exit(1);
}

function readCredentials() {
  const email = (process.env.ONEDECORE_LOCAL_ADMIN_EMAIL ?? "").trim();
  const password = process.env.ONEDECORE_LOCAL_ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    fail(
      [
        "Set both of these in your shell and run again:",
        "",
        "  ONEDECORE_LOCAL_ADMIN_EMAIL      the address you will type on /auth/login",
        "  ONEDECORE_LOCAL_ADMIN_PASSWORD   a LOCAL-ONLY password",
        "",
        "Neither is read from .env and neither is written anywhere.",
        "Do not reuse a production password: this database is disposable.",
      ].join("\n")
    );
  }

  // The admin portal tests the identifier's shape before any credential, so an
  // address that cannot pass that test would provision an account nobody could
  // log into.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`ONEDECORE_LOCAL_ADMIN_EMAIL is not an email address: ${email}`);
  }
  if (password.length < 8) {
    fail("ONEDECORE_LOCAL_ADMIN_PASSWORD must be at least 8 characters.");
  }
  return { email, password };
}

function readLocalStatus() {
  let raw;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      cwd: root,
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("Local Supabase is not running. Start it with `npx supabase start`.");
  }

  let status;
  try {
    status = JSON.parse(raw);
  } catch {
    fail("Could not read `supabase status -o json`.");
  }

  // The guard, before anything is constructed. A non-loopback host stops here.
  assertLocalSupabaseUrl(status.API_URL, "Local Supabase API URL");

  if (!status.SERVICE_ROLE_KEY) {
    fail("Local Supabase reported no service role key.");
  }
  return status;
}

/** psql inside the local container: the same path the Phase 5C1 SQL fixture uses. */
function sql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_OneDecore",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      statement,
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
}

async function main() {
  const { email, password } = readCredentials();
  const status = readLocalStatus();

  console.log(`[dev:ensure-superadmin] target: ${status.API_URL} (local)`);

  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /*
   * Find the user by email rather than assuming a fixed uuid.
   *
   * The Phase 5C1 fixtures pin uuids because their SQL half references them.
   * This script has no such coupling, and pinning one would mean a second run
   * with a different email silently overwrote the first account.
   */
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) fail(`Could not list local users: ${listError.message}`);

  const existing = list.users.find(
    (user) => (user.email ?? "").toLowerCase() === email.toLowerCase()
  );

  let userId;
  let created = false;

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) fail(`Could not update the local user: ${error.message}`);
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      // Confirmed on creation: local mail is not delivered anywhere, and an
      // unconfirmed address cannot complete a password grant.
      email_confirm: true,
    });
    if (error) fail(`Could not create the local user: ${error.message}`);
    userId = data.user.id;
    created = true;
  }

  /*
   * The profile row is created by the auth trigger, but it starts `pending`.
   * `getClaims` refuses anything that is not `active`, so an account stopped
   * here would authenticate and then be bounced from /admin — which looks like
   * a permissions bug and is really a two-line fixture gap.
   */
  sql(
    `update public.profiles set status = 'active', display_name = coalesce(nullif(trim(display_name), ''), 'Local Super Admin') where id = '${userId}';`
  );

  sql(
    `insert into public.user_roles (user_id, role_id) select '${userId}', id from public.roles where code = '${ROLE_CODE}' on conflict do nothing;`
  );

  /* ---- prove it, rather than assume it ---- */

  const profileStatus = sql(
    `select status from public.profiles where id = '${userId}';`
  );
  const roles = sql(
    `select coalesce(string_agg(r.code, ','), '(none)') from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = '${userId}';`
  );

  const permissionReport = REQUIRED_PERMISSIONS.map((code) => {
    const held = sql(
      `select exists(
         select 1
           from public.user_roles ur
           join public.role_permissions rp on rp.role_id = ur.role_id
           join public.permissions p on p.id = rp.permission_id
          where ur.user_id = '${userId}' and p.code = '${code}' and p.is_active
       );`
    );
    return { code, held: held === "t" };
  });

  const missing = permissionReport.filter((entry) => !entry.held);

  console.log(`[dev:ensure-superadmin] user:     ${created ? "created" : "updated"}`);
  console.log(`[dev:ensure-superadmin] profile:  ${profileStatus}`);
  console.log(`[dev:ensure-superadmin] roles:    ${roles}`);
  for (const entry of permissionReport) {
    console.log(
      `[dev:ensure-superadmin] ${entry.code.padEnd(16)} ${entry.held ? "yes" : "NO"}`
    );
  }

  if (profileStatus !== "active") {
    fail(`Profile is '${profileStatus}', not 'active'. Login would be refused.`);
  }
  if (!roles.split(",").includes(ROLE_CODE)) {
    fail(`Role ${ROLE_CODE} was not assigned.`);
  }
  if (missing.length > 0) {
    fail(
      `Missing permission(s): ${missing.map((m) => m.code).join(", ")}. ` +
        "Check that the migrations granting them have been applied."
    );
  }

  console.log(
    "\n[dev:ensure-superadmin] Local super admin ready. Sign in at /auth/login (Super Admin portal).\n"
  );
}

await main();
