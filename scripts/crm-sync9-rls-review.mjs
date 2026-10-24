#!/usr/bin/env node
/**
 * Evaluate sanitized, read-only CRM table RLS metadata exported from a reviewed
 * STAGING database. Never executes SQL or certifies deployment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tables = {
  leads: /crm_can_view_lead/i,
  whatsapp_conversations: /whatsapp_inbox_can_view_conversation/i,
  whatsapp_messages: /whatsapp_inbox_can_view_conversation/i,
};
const forbiddenRole = new Set(['anon','public']);
export function evaluateRlsSnapshot(rows) {
  if (!Array.isArray(rows)) throw Error('Expected a sanitized array of table-policy metadata');
  const failures = [], review = [];
  for (const [table, requiredPredicate] of Object.entries(tables)) {
    const data = rows.filter(x => x && x.schema_name === 'public' && x.table_name === table);
    if (data.length !== 1) {
      failures.push(table + ': expected exactly one table snapshot');
      continue;
    }
    const entry = data[0];
    if (entry.rls_enabled !== true) failures.push(table + ': RLS disabled');
    if (!Array.isArray(entry.policies)) {
      failures.push(table + ': policies missing or invalid');
      continue;
    }
    const reads = entry.policies.filter(p => p && typeof p === 'object' &&
      ['r','*','SELECT'].includes(p.cmd));
    if (reads.length === 0) failures.push(table + ': no scoped read policy present');
    for (const p of reads) {
      if (!Array.isArray(p.roles) || p.roles.some(x => forbiddenRole.has(String(x).toLowerCase()))) {
        failures.push(table + ': anonymous/public SELECT grant found or role metadata missing');
      }
      if (p.predicate === true || /^\s*true\s*$/i.test(String(p.predicate ?? ''))) {
        failures.push(table + ': unconditional SELECT policy');
      }
    }
    if (!reads.some(p => requiredPredicate.test(String(p.predicate ?? '')))) {
      failures.push(table + ': expected scoped permission helper missing from read policy');
    }
    if (entry.forced_rls !== true) review.push(table + ': FORCE RLS not enabled; owner and bypass roles require separate audit');
  }
  return { status:'HOLD_FOR_INDEPENDENT_DBA', failures, review, sampledTables:rows.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('STAGING RLS HOLD: missing sanitized staging evidence JSON'); process.exit(2); }
  try {
    const r = evaluateRlsSnapshot(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = 2; // Cannot become a live production/staging certificate.
  } catch (e) { console.error('STAGING RLS HOLD:',e.message); process.exitCode=2; }
}
