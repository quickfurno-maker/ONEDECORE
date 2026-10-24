#!/usr/bin/env node
/**
 * CRM-SYNC-7 Next.js staging launch preflight (pure input validation).
 * NEVER starts a service, reads secrets' values in output, or connects to DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionRef = 'lpurlfmpvriyvpkujvyl';
export function validateStagingEnvironment(env) {
  const problems = [];
  const requireText = key => {
    const value = env[key]?.trim?.();
    if (!value || /^(?:replace|example|placeholder|todo|<)/i.test(value)) {
      problems.push('Missing approved ' + key);
      return null;
    }
    return value;
  };
  const prodRef = productionRef;
  const ref = requireText('ONEDECORE_STAGING_SUPABASE_REF');
  const api = requireText('ONEDECORE_STAGING_CRM_ORIGIN');
  const supabase = requireText('SUPABASE_URL');
  const dbRole = requireText('ONEDECORE_STAGING_DB_ROLE');
  const deploy = requireText('ONEDECORE_STAGING_DEPLOY_SHA');
  const liveWorkers = ['WHATSAPP_OUTBOUND_ENABLED','META_WEBHOOK_ENABLED','CAMPAIGNS_ENABLED','PAYMENTS_ENABLED'];
  if (env.ONEDECORE_ENV !== 'staging') problems.push('ONEDECORE_ENV must be staging');
  if (ref && (!/^[a-z0-9]{20}$/.test(ref) || ref === prodRef)) problems.push('Unapproved or production Supabase ref');
  if (dbRole && ['postgres','supabase_admin','service_role','anon','authenticated'].includes(dbRole)) {
    problems.push('Staging backend DB role must be a least-privilege reviewed role');
  }
  if (deploy && !/^[0-9a-f]{40}$/i.test(deploy)) problems.push('Staging deploy must be pinned to full reviewed Git SHA');
  const parseOrigin=(value,label)=>{
    if(!value) return null;
    try {
      const u=new URL(value);
      if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/') throw Error();
      return u.hostname.toLowerCase();
    } catch {problems.push('Invalid HTTPS-only '+label);return null;}
  };
  const domain=parseOrigin(api,'CRM staging origin');
  const sb=parseOrigin(supabase,'Supabase staging origin');
  if(domain && (!domain.includes('staging')||domain==='onedecore.in'||domain==='www.onedecore.in')) problems.push('CRM origin is not staging');
  if(sb && ref && sb!==ref+'.supabase.co') problems.push('Supabase origin does not match approved staging ref');
  for(const key of liveWorkers){
    if(env[key] !== 'false') problems.push('Provider must be quarantined with '+key+'=false');
  }
  if(env.ONEDECORE_STAGING_DATA_CLASS!=='synthetic-only') problems.push('Only synthetic staging data approved');
  if(env.ONEDECORE_STAGING_DEPLOY_APPROVED!=='true') problems.push('Staging deployment approval absent');
  if(env.ONEDECORE_STAGING_DB_REVIEW_APPROVED!=='true') problems.push('Independent DBA staging approval absent');
  return {ready:problems.length===0,problems};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=validateStagingEnvironment(process.env);
  if(!report.ready){
    console.error('STAGING DEPLOY HOLD: '+report.problems.length+' prerequisites missing');
    report.problems.forEach(x=>console.error(' - '+x));
    process.exitCode=2;
  }else{
    console.log('Staging input preflight PASS (NO DEPLOYMENT). Verify signatures, grants and actual provider quarantine at runtime.');
  }
}
