import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRlsSnapshot } from './crm-sync9-rls-review.mjs';

const base=[
  {schema_name:'public',table_name:'leads',rls_enabled:true,forced_rls:false,policies:[{name:'leads_select_crm_scoped',cmd:'r',roles:['authenticated'],predicate:'(deleted_at IS NULL AND private.crm_can_view_lead(assigned_to))'}]},
  {schema_name:'public',table_name:'whatsapp_conversations',rls_enabled:true,forced_rls:false,policies:[{name:'conversations_select_scoped',cmd:'r',roles:['authenticated'],predicate:'private.whatsapp_inbox_can_view_conversation(id)'}]},
  {schema_name:'public',table_name:'whatsapp_messages',rls_enabled:true,forced_rls:false,policies:[{name:'messages_select_scoped',cmd:'r',roles:['authenticated'],predicate:'private.whatsapp_inbox_can_view_conversation(conversation_id)'}]},
];
test('correct source-like RLS policies still require independent DBA review',()=>{
 const r=evaluateRlsSnapshot(base);
 assert.equal(r.failures.length,0);
 assert.equal(r.status,'HOLD_FOR_INDEPENDENT_DBA');
 assert.ok(r.review.length===3);
});
test('detects disabled RLS and unconditional anonymous access',()=>{
 const r=structuredClone(base);
 r[0].rls_enabled=false;
 r[0].policies.push({cmd:'r',roles:['anon'],predicate:'true'});
 const result=evaluateRlsSnapshot(r);
 assert.ok(result.failures.some(x=>/RLS disabled/.test(x)));
 assert.ok(result.failures.some(x=>/anonymous/.test(x)));
 assert.ok(result.failures.some(x=>/unconditional/.test(x)));
});
test('detects missing permission guards and no policies',()=>{
 const r=structuredClone(base);
 r[1].policies=[{cmd:'r',roles:['authenticated'],predicate:'id IS NOT NULL'}];
 r[2].policies=[];
 const result=evaluateRlsSnapshot(r);
 assert.ok(result.failures.some(x=>/helper missing/.test(x)));
 assert.ok(result.failures.some(x=>/no scoped read policy/.test(x)));
});
test('missing, duplicate and malformed evidence fails closed',()=>{
 const result=evaluateRlsSnapshot([base[0],base[0],base[1]]);
 assert.ok(result.failures.some(x=>/exactly one/.test(x)));
 assert.throws(()=>evaluateRlsSnapshot({}),/sanitized array/);
});
