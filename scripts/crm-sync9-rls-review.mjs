#!/usr/bin/env node
/** Metadata-only PostgreSQL RLS drift review. NEVER certifies release. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const scopes = {
  leads: /crm_can_view_lead\s*\(/i,
  whatsapp_conversations: /whatsapp_inbox_can_view_conversation\s*\(/i,
  whatsapp_messages: /whatsapp_inbox_can_view_conversation\s*\(/i,
};
const publicRoles = new Set(['anon', 'public']);
export function evaluateRlsSnapshot(rows) {
  if (!Array.isArray(rows)) throw Error('Expected a sanitized array of table-policy metadata');
  const failures = [], review = [];
  for(const [table, scope] of Object.entries(scopes)){
    const entries=rows.filter(x=>x && x.schema_name==='public' && x.table_name===table);
    if(entries.length!==1){failures.push(table+': expected exactly one table snapshot');continue;}
    const entry=entries[0];
    if(entry.rls_enabled!==true) failures.push(table+': RLS disabled');
    if(!Array.isArray(entry.policies)){failures.push(table+': policies missing or invalid');continue;}
    const reads=entry.policies.filter(p=>p && typeof p==='object' && ['r','*','SELECT','ALL'].includes(p.cmd));
    if(reads.length===0) failures.push(table+': no scoped read policy present');
    let scopedPermissive=0;
    for(const [i,p] of reads.entries()){
      const prefix=table+': SELECT/ALL policy '+(p.name??i);
      // PostgreSQL polroles={} means PUBLIC. Never treat [] as no access.
      if(!Array.isArray(p.roles)||p.roles.length===0 ||
         p.roles.some(x=>publicRoles.has(String(x).toLowerCase())))
        failures.push(prefix+': anonymous/public SELECT policy or roles missing');
      if(typeof p.permissive!=='boolean'){
        failures.push(prefix+': missing permissive/restrictive policy metadata');
        continue;
      }
      if(p.predicate===true||/^(?:true|\(true\))$/i.test(String(p.predicate??'').trim()))
        failures.push(prefix+': unconditional SELECT policy');
      const scoped=scope.test(String(p.predicate??''));
      // Permissive policies OR together; one broad grant defeats a scoped one.
      if(p.permissive){
        if(scoped) scopedPermissive++;
        else failures.push(prefix+': permissive policy missing scoped permission helper');
      }else if(!scoped) review.push(prefix+': restrictive policy needs independent authorization proof');
    }
    if(scopedPermissive===0) failures.push(table+': no permissive scoped SELECT policy present');
    if(entry.forced_rls!==true) review.push(table+': FORCE RLS not enabled; review owner and bypass roles');
  }
  return {status:'HOLD_FOR_INDEPENDENT_DBA',failures,review,sampledTables:rows.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2]){console.error('STAGING RLS HOLD: missing sanitized staging evidence JSON');process.exit(2);}
  try{
    const r=evaluateRlsSnapshot(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
    console.log(JSON.stringify(r,null,2));
    process.exitCode=2;
  }catch(e){console.error('STAGING RLS HOLD:',e.message);process.exitCode=2;}
}