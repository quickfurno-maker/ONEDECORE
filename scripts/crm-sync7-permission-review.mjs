#!/usr/bin/env node
/**
 * Advisory-only review of metadata exported from staging's read-only
 * CRM-SYNC-6 permissions query. Not an exploitability analysis.
 * Input excludes client data, secrets, JWTs and function bodies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function reviewFunctionPermissions(rows) {
 if(!Array.isArray(rows)) throw Error('Function-permission evidence must be an array');
 const issues=[];
 for(const [i, item] of rows.entries()){
  if(!item || typeof item!=='object' ||
    !['public','private'].includes(item.schema_name) ||
    typeof item.function_name!=='string' ||
    typeof item.security_definer!=='boolean' ||
    typeof item.anonymous_function_execute!=='boolean' ||
    typeof item.authenticated_function_execute!=='boolean' ||
    typeof item.anonymous_schema_usage!=='boolean' ||
    typeof item.authenticated_schema_usage!=='boolean'
  ) throw Error('Invalid metadata row '+i);
  if(item.security_definer && item.anonymous_function_execute && item.anonymous_schema_usage){
    issues.push({schema:item.schema_name,function:item.function_name,kind:'anon_callable_definer',level:'independent_review'});
  }else if(item.security_definer && item.anonymous_function_execute && !item.anonymous_schema_usage){
    issues.push({schema:item.schema_name,function:item.function_name,kind:'grant_with_inaccessible_schema',level:'verify_routine_exposure'});
  }
  // An authenticated execution grant can coexist with a denied anonymous schema.
  if(item.security_definer && item.authenticated_function_execute && item.authenticated_schema_usage){
    issues.push({schema:item.schema_name,function:item.function_name,kind:'authenticated_callable_definer',level:'independent_review'});
  }
 }
 return {reviewedRows:rows.length,issues,verdict:'HOLD_FOR_REVIEW'};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const p=process.argv[2];
 if(!p){console.error('DBA evidence JSON is missing; review cannot be certified');process.exit(2);}
 try{
  const parsed=JSON.parse(fs.readFileSync(p,'utf8'));
  const result=reviewFunctionPermissions(parsed);
  console.log(JSON.stringify(result,null,2));
  process.exitCode=2; // No automated AppSec permission approval.
 }catch(e){console.error('Invalid DBA evidence: '+e.message);process.exitCode=2;}
}
