#!/usr/bin/env node
// INT-9B: disposable SQL-only concurrency lab. NEVER invokes provider or remote Supabase.
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = "supabase_db_OneDecoreInt9Cert";
assert.equal(process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE, "disabled", "outbound must be disabled");
assert.equal(process.env.ONEDECORE_WHATSAPP_WEBHOOK_MODE, "disabled", "webhook must be disabled");
assert.match(readFileSync(resolve(root,"supabase/config.toml"),"utf8"),/project_id = "OneDecoreInt9Cert"/, "requires dedicated local project");
const containers = spawnSync("docker", ["ps", "--format","{{.Names}}"], { encoding:"utf8" });
assert.equal(containers.status,0,containers.stderr);
assert.ok(containers.stdout.split(/\r?\n/).includes(DB), "disposable INT9 DB must be running");
const args = ["exec", "-i", DB, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U","postgres","-d","postgres","-At"];
function sqlSync(sql, expectFailure=false) {
  const p=spawnSync("docker",args,{input:sql,encoding:"utf8",timeout:90000,maxBuffer:12*1024*1024});
  if (expectFailure) {assert.notEqual(p.status,0,"expected SQL role authorization denial");return (p.stderr||"");}
  assert.equal(p.status,0,"SQL failed: "+(p.stderr||"").slice(-1500));
  return p.stdout.trim();
}
function sqlAsync(sql) {
  return new Promise((res,rej)=>{
    const p=spawn("docker",args,{stdio:["pipe","pipe","pipe"]});
    let out="",err="";
    p.stdout.setEncoding("utf8");p.stdout.on("data",x=>out+=x);
    p.stderr.setEncoding("utf8");p.stderr.on("data",x=>err+=x);
    p.on("error",rej);
    p.on("close",code=>code===0?res(out.trim()):rej(new Error("SQL async failed "+code+": "+err.slice(-1500))));
    p.stdin.end(sql);
  });
}
const fixture=readFileSync(resolve(root,"supabase/tests/database/66_whatsapp_campaign_execution_test.sql"),"utf8");
const marker="set local role service_role;\nselect set_config('test.claim1'";
const normalized=fixture.replace(/\r\n/g,"\n");
const pivot=normalized.indexOf(marker);
assert.ok(pivot>10000,"fixture boundary missing: refuse synthetic harness");
const seed="SET search_path TO extensions, public;\n"+normalized.slice(0,pivot)+"\ncommit;\n";
const result={lab:"disposable-SQL-only",providerCalls:0,checks:[],at:new Date().toISOString()};
function check(name,ok,extra={}) { assert.ok(ok,name); result.checks.push({name,pass:true,...extra}); console.log("PASS "+name); }
sqlSync(seed);
check("pgTAP-66 synthetic test contact/campaign fixture persisted",true);
const claimSQL=(worker,sleep=0)=>`BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT 'INT9_CLAIM=' || public.claim_whatsapp_campaign_dispatch_jobs('${worker}',1)::text;
SELECT pg_sleep(${sleep});
COMMIT;`;
const [A,B]=await Promise.all([sqlAsync(claimSQL("int9-worker-A",3)),sqlAsync(claimSQL("int9-worker-B",2))]);
function parse(out){const line=out.split(/\r?\n/).find(x=>x.startsWith("INT9_CLAIM="));assert.ok(line,"claim return missing");return JSON.parse(line.slice("INT9_CLAIM=".length));}
const a=parse(A),b=parse(B);
check("simultaneous workers each claim one eligible job",a.length===1&&b.length===1);
check("two concurrent claims have distinct jobs, recipients and tokens",a[0].job_id!==b[0].job_id&&a[0].recipient_id!==b[0].recipient_id&&a[0].claim_token!==b[0].claim_token);
const snapshot=JSON.parse(sqlSync("SELECT jsonb_agg(jsonb_build_object('id',id,'state',state,'attempts',attempt_count,'worker',claimed_by) ORDER BY id) FROM public.whatsapp_campaign_dispatch_jobs WHERE claimed_by LIKE 'int9-worker-%';"));
check("exactly two claimed rows and attempts equal one",snapshot.length===2&&snapshot.every(x=>x.state==="claimed"&&x.attempts===1));
const empty=parse(sqlSync("BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true); SELECT 'INT9_CLAIM=' || public.claim_whatsapp_campaign_dispatch_jobs('int9-worker-C',10)::text; COMMIT;"));
check("no duplicate assignment while both leases active",empty.length===0);
const denial=sqlSync("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT public.claim_whatsapp_campaign_dispatch_jobs('forged',10); COMMIT;",true);
check("authenticated role cannot claim worker jobs",/denied|permission|service_role|role/i.test(denial));
sqlSync("UPDATE public.whatsapp_campaign_dispatch_jobs SET claimed_at=clock_timestamp()-interval '10 minutes', claim_expires_at=clock_timestamp()-interval '5 minutes' WHERE claimed_by LIKE 'int9-worker-%';");
const reclaims=parse(sqlSync("BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true); SELECT 'INT9_CLAIM='|| public.claim_whatsapp_campaign_dispatch_jobs('int9-reclaimer',5)::text; COMMIT;"));
check("pre-provider expired claims reclaimed exactly twice",reclaims.length===2&&new Set(reclaims.map(x=>x.job_id)).size===2);
check("reclaims minted different tokens and attempts 2",reclaims.every(x=>x.attempt===2&&!([a,b].flat().some(old=>old.claim_token===x.claim_token))));
const oldToken=a[0],nowToken=reclaims.find(x=>x.job_id===oldToken.job_id);
const escaped=sqlSync(`BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true); SELECT public.mark_whatsapp_campaign_provider_request_started('${oldToken.job_id}'::uuid,'${oldToken.claim_token}'::uuid); COMMIT;`,true);
check("stale claim token denied",/NOT_CLAIMED|claimed|expired|token/i.test(escaped));
sqlSync(`BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true); SELECT public.mark_whatsapp_campaign_provider_request_started('${nowToken.job_id}'::uuid,'${nowToken.claim_token}'::uuid); COMMIT;`);
sqlSync(`UPDATE public.whatsapp_campaign_dispatch_jobs SET claimed_at=clock_timestamp()-interval '10 minutes', claim_expires_at=clock_timestamp()-interval '5 minutes' WHERE id='${nowToken.job_id}'::uuid;`);
const after=parse(sqlSync("BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true); SELECT 'INT9_CLAIM=' || public.claim_whatsapp_campaign_dispatch_jobs('int9-after-provider-start',10)::text; COMMIT;"));
const reconcile=sqlSync(`SELECT state FROM public.whatsapp_campaign_dispatch_jobs WHERE id='${nowToken.job_id}'::uuid;`);
check("post-provider-start expired claim quarantined as needs_reconcile",reconcile==="needs_reconcile"&&!after.some(x=>x.job_id===nowToken.job_id));
const counts=sqlSync("SELECT jsonb_build_object('provider_messages',(SELECT count(*) FROM public.whatsapp_messages WHERE provider_message_id LIKE 'wamid.INT9%'),'claimed',(SELECT count(*) FROM public.whatsapp_campaign_dispatch_jobs WHERE state='claimed' AND claimed_by LIKE 'int9-%'),'needs_reconcile',(SELECT count(*) FROM public.whatsapp_campaign_dispatch_jobs WHERE state='needs_reconcile'))::text;");
const cnt=JSON.parse(counts);
check("zero simulated provider messages and one ambiguous quarantine",cnt.provider_messages===0&&cnt.needs_reconcile>=1);
result.summary={checks:result.checks.length,pass:result.checks.length,workerA:a.length,workerB:b.length,reclaims:reclaims.length,providerMessages:cnt.provider_messages};
const dir=resolve(root,".artifacts/int9");
mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,"worker-contention.json"),JSON.stringify(result,null,2)+"\n");
console.log("INT9B_TWO_WORKER_SQL_PASS "+result.checks.length+"/"+result.checks.length+"; zero provider calls");
