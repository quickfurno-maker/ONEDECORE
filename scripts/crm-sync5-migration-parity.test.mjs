import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const expected=fs.readdirSync(path.join(root,'supabase/migrations'))
  .filter(f=>f.endsWith('.sql')).map(f=>f.split('_')[0]).sort();
function run(versions){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'onedecore-migration-'));
  try {
    const file=path.join(tmp,'versions.txt');
    if(versions!==null) fs.writeFileSync(file,versions.join('\n')+'\n');
    return spawnSync(process.execPath,['scripts/crm-sync5-migration-parity.mjs',file],{
      cwd:root,encoding:'utf8',timeout:6000
    });
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
}
test('exact local migration fixture passes comparator (not real staging)',()=>{
  const r=run(expected);
  assert.equal(r.status,0);
  assert.match(r.stdout,/PASS: exact migration version parity/);
});
test('missing migration is a failure',()=>{
  const r=run(expected.slice(0,-1));
  assert.equal(r.status,1);
  assert.match(r.stdout,/Pending migrations: 1/);
});
test('unexpected extra migration is a failure',()=>{
  const r=run([...expected,'20990101000000']);
  assert.equal(r.status,1);
  assert.match(r.stdout,/Unknown installed versions: 1/);
});
test('missing managed DB export fails closed',()=>{
  const r=run(null);
  assert.equal(r.status,2);
  assert.match(r.stderr,/STAGING MIGRATION TRUTH HOLD/);
});
