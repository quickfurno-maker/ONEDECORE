#!/usr/bin/env node
// INT-10D read-only governance certification. Disposable local DB only, no Meta calls.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
assert.match(readFileSync("supabase/config.toml", "utf8"), /project_id = "OneDecoreInt10Cert"/);
assert.equal(process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE, "disabled");
assert.equal(process.env.ONEDECORE_WHATSAPP_WEBHOOK_MODE, "disabled");
const worker = [
  "materialize_due_whatsapp_campaign_runs",
  "claim_whatsapp_campaign_dispatch_jobs",
  "mark_whatsapp_campaign_provider_request_started",
  "complete_whatsapp_campaign_dispatch_success",
  "complete_whatsapp_campaign_dispatch_failure",
  "resolve_whatsapp_campaign_dispatch_reconcile",
  "claim_whatsapp_campaign_test_sends",
  "mark_whatsapp_campaign_test_send_started",
  "complete_whatsapp_campaign_test_send"
];
const staff=[
  "save_whatsapp_campaign_spec",
  "list_whatsapp_campaign_template_options",
  "preview_whatsapp_campaign_audience",
  "create_whatsapp_campaign_run",
  "start_whatsapp_campaign_run",
  "pause_whatsapp_campaign_run",
  "resume_whatsapp_campaign_run",
  "cancel_whatsapp_campaign_run",
  "get_whatsapp_campaign_run_breakdown",
  "resolve_whatsapp_campaign_reconcile",
  "list_whatsapp_campaign_test_destinations",
  "create_whatsapp_campaign_test_send"
];
const tables=[
  "whatsapp_campaign_specs","whatsapp_campaign_runs","whatsapp_campaign_recipients",
  "whatsapp_campaign_dispatch_jobs","whatsapp_campaign_dispatch_events",
  "whatsapp_message_campaign_attributions","whatsapp_campaign_test_sends"
];
const quoted = a => "ARRAY[" + a.map(x => "'" + x + "'").join(",") + "]::text[]";
const sql = `
with funcs as (
  select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
), worker as (select * from funcs where proname = any(${quoted(worker)})),
staff as (select * from funcs where proname = any(${quoted(staff)})),
tab as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(${quoted(tables)})
),checks as (
  select jsonb_build_object(
    'workerRpcs',(select count(*) from worker),
    'workerServiceOnly',(select count(*) from worker where prosecdef and 'search_path=""'=any(proconfig) and
      has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')
      and not has_function_privilege('authenticated',oid,'EXECUTE')),
    'staffRpcs',(select count(*) from staff),
    'staffNoAnon',(select count(*) from staff where prosecdef and 'search_path=""'=any(proconfig)
      and has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')),
    'tables',(select count(*) from tab),
    'tablesForcedRls',(select count(*) from tab where relrowsecurity and relforcerowsecurity),
    'staffDirectWrites',(select count(*) from tab where has_table_privilege('authenticated',oid,'INSERT')
       or has_table_privilege('authenticated',oid,'UPDATE') or has_table_privilege('authenticated',oid,'DELETE')),
    'anonReadTables',(select count(*) from tab where has_table_privilege('anon',oid,'SELECT')),
    'marketingExecutionEnabled',(select coalesce(bool_or(execution_enabled),false) from public.whatsapp_marketing_send_policies)
  ) as result
)
select result::text from checks;`;
const proc=spawnSync("docker",["exec","-i","supabase_db_OneDecoreInt10Cert",
 "psql","-X","-At","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],
 {input:sql,encoding:"utf8",timeout:60000});
assert.equal(proc.status,0,(proc.stderr||"").slice(-900));
const report=JSON.parse(proc.stdout.trim());
assert.equal(report.workerRpcs,worker.length);
assert.equal(report.workerServiceOnly,worker.length);
assert.equal(report.staffRpcs,staff.length);
assert.equal(report.staffNoAnon,staff.length);
assert.equal(report.tables,tables.length);
assert.equal(report.tablesForcedRls,tables.length);
assert.equal(report.staffDirectWrites,0);
assert.equal(report.anonReadTables,0);
assert.equal(report.marketingExecutionEnabled,false);
mkdirSync(".artifacts/int10",{recursive:true});
writeFileSync(".artifacts/int10/governance-audit.json",JSON.stringify({at:new Date().toISOString(),status:"PASS",...report},null,2)+"\n");
console.log("INT10_D_DISPOSABLE_GOVERNANCE_PASS "+JSON.stringify(report));
