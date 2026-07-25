import { describe, it } from "node:test";
import assert from "node:assert/strict";

const LOCAL_SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function isLocalSupabaseRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: LOCAL_ANON_KEY },
    });
    return res.status === 200 || res.status === 401;
  } catch {
    return false;
  }
}

describe("Portfolio RPC Real PostgREST Integration Tests", () => {
  it("POST /rest/v1/rpc/set_portfolio_project_status_impl returns 404 (Private helper is unexposed)", async () => {
    if (!(await isLocalSupabaseRunning())) {
      console.log("Skipping local PostgREST HTTP test (Supabase local stack not running)");
      return;
    }

    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/rpc/set_portfolio_project_status_impl`, {
      method: "POST",
      headers: {
        apikey: LOCAL_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requested_project_id: "00000000-0000-0000-0000-000000000000",
        requested_status: "published",
      }),
    });

    assert.equal(res.status, 404, "Private helper set_portfolio_project_status_impl must return HTTP 404 from PostgREST");
  });

  it("Anonymous call to POST /rest/v1/rpc/set_portfolio_project_status is denied", async () => {
    if (!(await isLocalSupabaseRunning())) return;

    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/rpc/set_portfolio_project_status`, {
      method: "POST",
      headers: {
        apikey: LOCAL_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requested_project_id: "00000000-0000-0000-0000-000000000000",
        requested_status: "published",
      }),
    });

    assert.ok(res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404, `Anonymous RPC call must be denied, got status ${res.status}`);
  });

  it("Direct authenticated PATCH of status on /rest/v1/portfolio_projects is denied", async () => {
    if (!(await isLocalSupabaseRunning())) return;

    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/portfolio_projects?id=eq.00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: {
        apikey: LOCAL_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "published",
      }),
    });

    assert.ok(res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404, `Direct column PATCH on status must be denied, got status ${res.status}`);
  });
});
