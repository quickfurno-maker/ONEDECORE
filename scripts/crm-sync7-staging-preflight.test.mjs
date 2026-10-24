import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStagingEnvironment } from './crm-sync7-staging-preflight.mjs';

const good={
 ONEDECORE_ENV:'staging',
 ONEDECORE_STAGING_SUPABASE_REF:'abcdefghijklmnopqrst',
 ONEDECORE_STAGING_CRM_ORIGIN:'https://crm-staging.example.invalid/',
 SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co/',
 ONEDECORE_STAGING_DB_ROLE:'onedecore_stage_api',
 ONEDECORE_STAGING_DEPLOY_SHA:'0123456789abcdef0123456789abcdef01234567',
 WHATSAPP_OUTBOUND_ENABLED:'false',META_WEBHOOK_ENABLED:'false',
 CAMPAIGNS_ENABLED:'false',PAYMENTS_ENABLED:'false',
 ONEDECORE_STAGING_DATA_CLASS:'synthetic-only',
 ONEDECORE_STAGING_DEPLOY_APPROVED:'true',
 ONEDECORE_STAGING_DB_REVIEW_APPROVED:'true',
};
test('approved, synthetic staging-only inputs pass without any deployment',()=>{
 assert.equal(validateStagingEnvironment(good).ready,true);
});
test('rejects production Supabase even if staging backend host is valid',()=>{
 const v=validateStagingEnvironment({...good,ONEDECORE_STAGING_SUPABASE_REF:'lpurlfmpvriyvpkujvyl',SUPABASE_URL:'https://lpurlfmpvriyvpkujvyl.supabase.co/'});
 assert.equal(v.ready,false);assert.ok(v.problems.some(x=>/production Supabase/.test(x)));
});
test('rejects a production CRM endpoint',()=>{
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_CRM_ORIGIN:'https://onedecore.in/'}).ready,false);
});
test('rejects enabling ANY outbound provider',()=>{
 for(const key of ['WHATSAPP_OUTBOUND_ENABLED','META_WEBHOOK_ENABLED','CAMPAIGNS_ENABLED','PAYMENTS_ENABLED']){
  assert.equal(validateStagingEnvironment({...good,[key]:'true'}).ready,false,key);
 }
});
test('requires independent stage approval and synthetic-only data',()=>{
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_DEPLOY_APPROVED:'false'}).ready,false);
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_DB_REVIEW_APPROVED:'false'}).ready,false);
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_DATA_CLASS:'production-snapshot'}).ready,false);
});
test('refuses privileged and unreviewed DB roles',()=>{
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_DB_ROLE:'service_role'}).ready,false);
});
test('requires a reviewed exact 40-digit SHA',()=>{
 assert.equal(validateStagingEnvironment({...good,ONEDECORE_STAGING_DEPLOY_SHA:'main'}).ready,false);
});
