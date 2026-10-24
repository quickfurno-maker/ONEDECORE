import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.resolve(import.meta.dirname,'sql/crm_sync9_staging_rls_snapshot.sql'),'utf8');
test('staging RLS snapshot SQL is a single SELECT and never changes data',()=>{
 const uncommented=sql.split(/\r?\n/).filter(x=>!x.trimStart().startsWith('--')).join('\n');
 const statements=uncommented.split(';').filter(x=>x.trim());
 assert.equal(statements.length,1);
 assert.match(statements[0],/^\s*SELECT\s/i);
 assert.doesNotMatch(uncommented,/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|DO|COPY)\b/i);
});
test('snapshot reads RLS metadata and not customer rows or secrets',()=>{
 assert.match(sql,/pg_policy/);
 assert.match(sql,/pg_get_expr/);
 assert.match(sql,/relrowsecurity/);
 assert.match(sql,/whatsapp_messages/);
 assert.doesNotMatch(sql,/\bFROM\s+(leads|whatsapp_messages|whatsapp_conversations)\b/i);
});
