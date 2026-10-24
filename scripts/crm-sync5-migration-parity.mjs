/**
 * Read-only migration-truth comparator. Input is an exported newline list of
 * migration VERSION strings from an explicitly selected managed DB. No DB
 * connection, auth token, SQL mutation or network access.
 * Node >=24. Use only for approved staging, not as a staging substitute.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const list = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f=>f.endsWith('.sql'));
const migrationVersion = name => name.split('_')[0];
const expected = list.map(migrationVersion).sort();
const issues = [];
if (expected.length !== new Set(expected).size) issues.push('Duplicated local migration versions');
if (expected.some(v => !/^\d{14}$/.test(v))) issues.push('Invalid local migration version');
console.log('Source migrations:', expected.length, 'latest:', expected.at(-1));
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('STAGING MIGRATION TRUTH HOLD: supply the approved staging migration-version export');
  process.exit(2);
}
const raw = fs.readFileSync(file,'utf8').trim();
const installed = raw ? raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).sort() : [];
if (installed.some(v=>!/^\d{14}$/.test(v))) issues.push('Invalid staging version input');
if (installed.length !== new Set(installed).size) issues.push('Duplicate staging applied versions');
const a = new Set(expected), b = new Set(installed);
const pending = expected.filter(x=>!b.has(x));
const extra = installed.filter(x=>!a.has(x));
console.log('Staging applied versions:', installed.length, 'latest:', installed.at(-1) ?? 'none');
console.log('Pending migrations:',pending.length);
console.log('Unknown installed versions:',extra.length);
if (pending.length) console.log('Pending versions:', pending.slice(0,30).join(','));
if (extra.length) console.log('Unknown versions:', extra.slice(0,30).join(','));
if (issues.length || pending.length || extra.length) {
  issues.forEach(x=>console.error('ERROR:',x));
  process.exit(1);
}
console.log('PASS: exact migration version parity. This does NOT certify ACL, RLS, schema checksums, backups, or rollback.');
