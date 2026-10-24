import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRlsSnapshot} from './crm-sync9-rls-review.mjs';
const base=[
 {schema_name:'public',table_name:'leads',rls_enabled:true,forced_rls:false,policies:[{name:'lead',cmd:'r',permissive:true,roles:['authenticated'],predicate:'private.crm_can_view_lead(assigned_to)'}]},
 {schema_name:'public',table_name:'whatsapp_conversations',rls_enabled:true,forced_rls:false,policies:[{name:'convo',cmd:'r',permissive:true,roles:['authenticated'],predicate:'private.whatsapp_inbox_can_view_conversation(id)'}]},
 {schema_name:'public',table_name:'whatsapp_messages',rls_enabled:true,forced_rls:false,policies:[{name:'message',cmd:'r',permissive:true,roles:['authenticated'],predicate:'private.whatsapp_inbox_can_view_conversation(conversation_id)'}]},
];
test('scoped metadata does not certify staging',()=>{
 const r=evaluateRlsSnapshot(base);assert.equal(r.failures.length,0);
 assert.equal(r.status,'HOLD_FOR_INDEPENDENT_DBA');
});
test('rejects disabled RLS, anonymous unconditional read policy',()=>{
 const a=structuredClone(base);a[0].rls_enabled=false;
 a[0].policies.push({name:'bad',cmd:'r',permissive:true,roles:['anon'],predicate:'true'});
 const r=evaluateRlsSnapshot(a);
 assert.ok(r.failures.some(x=>x.includes('RLS disabled')));
 assert.ok(r.failures.some(x=>x.includes('anonymous')));
 assert.ok(r.failures.some(x=>x.includes('unconditional')));
});
test('rejects PostgreSQL empty polroles interpreted as PUBLIC',()=>{
 const a=structuredClone(base);a[0].policies.push({cmd:'*',permissive:true,roles:[],predicate:'true'});
 assert.ok(evaluateRlsSnapshot(a).failures.some(x=>x.includes('anonymous/public')));
});
test('detects broad second permissive policy OR-bypassing scoped policy',()=>{
 const a=structuredClone(base);
 a[0].policies.push({name:'broad',cmd:'r',permissive:true,roles:['authenticated'],predicate:'id IS NOT NULL'});
 assert.ok(evaluateRlsSnapshot(a).failures.some(x=>x.includes('permissive policy missing scoped')));
});
test('rejects missing scope, no policies and missing permissive metadata',()=>{
 const a=structuredClone(base);
 a[1].policies=[{cmd:'r',permissive:true,roles:['authenticated'],predicate:'id IS NOT NULL'}];
 a[2].policies=[];
 const r=evaluateRlsSnapshot(a);
 assert.ok(r.failures.some(x=>x.includes('permissive policy missing scoped')));
 assert.ok(r.failures.some(x=>x.includes('no scoped read policy')));
 const b=structuredClone(base);delete b[0].policies[0].permissive;
 assert.ok(evaluateRlsSnapshot(b).failures.some(x=>x.includes('missing permissive')));
});
test('restrictive-only, duplicate and invalid snapshots fail closed',()=>{
 const a=structuredClone(base);a[0].policies[0].permissive=false;
 assert.ok(evaluateRlsSnapshot(a).failures.some(x=>x.includes('no permissive scoped')));
 assert.ok(evaluateRlsSnapshot([base[0],base[0],base[1]]).failures.some(x=>x.includes('exactly one')));
 assert.throws(()=>evaluateRlsSnapshot({}),/sanitized array/);
});