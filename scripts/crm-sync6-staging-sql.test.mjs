import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(import.meta.dirname, 'sql/crm_sync6_staging_readonly_audit.sql');
const sql = fs.readFileSync(file,'utf8');
test('staging DBA evidence file contains only SELECT statements',()=>{
  const uncommented = sql.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n');
  const statements = uncommented.split(';').map(x=>x.trim()).filter(Boolean);
  assert.equal(statements.length,4);
  statements.forEach(statement => assert.match(statement,/^SELECT\s/i));
  assert.doesNotMatch(uncommented,/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY)\b/i);
});
test('privilege inspection includes caller execution and schema visibility',()=>{
  assert.match(sql,/has_schema_privilege\('anon'/);
  assert.match(sql,/has_function_privilege\('authenticated'/);
  assert.match(sql,/pg_policies/);
  assert.match(sql,/supabase_migrations\.schema_migrations/);
});
