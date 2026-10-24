import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFunctionPermissions } from './crm-sync7-permission-review.mjs';
const routine={
 schema_name:'private',function_name:'list_crm_whatsapp_lead_signals_impl',security_definer:true,
 anonymous_function_execute:false, authenticated_function_execute:true,
 anonymous_schema_usage:false,authenticated_schema_usage:true
};
test('authenticated-callable security definer requires independent review',()=>{
 const result=reviewFunctionPermissions([routine]);
 assert.equal(result.verdict,'HOLD_FOR_REVIEW');
 assert.equal(result.issues[0].kind,'authenticated_callable_definer');
});
test('anonymous-callable definer is not automatically approved',()=>{
 const result=reviewFunctionPermissions([{...routine,schema_name:'public',anonymous_schema_usage:true,anonymous_function_execute:true}]);
 assert.equal(result.issues[0].kind,'anon_callable_definer');
});
test('granted function in inaccessible schema differs from public invocation',()=>{
 const result=reviewFunctionPermissions([{...routine,anonymous_function_execute:true}]);
 assert.ok(result.issues.some(x=>x.kind==='grant_with_inaccessible_schema'));
 assert.ok(result.issues.some(x=>x.kind==='authenticated_callable_definer'));
});
test('a non-definer function is not flagged but still cannot certify DB',()=>{
 const result=reviewFunctionPermissions([{...routine,security_definer:false}]);
 assert.equal(result.issues.length,0);
 assert.equal(result.verdict,'HOLD_FOR_REVIEW');
});
test('bad and missing data never pass',()=>{
 assert.throws(()=>reviewFunctionPermissions([{}]),/Invalid metadata/);
 assert.throws(()=>reviewFunctionPermissions({}),/must be an array/);
});
