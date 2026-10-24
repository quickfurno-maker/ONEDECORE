import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStagingPair } from './crm-sync8-staging-pair.mjs';
const source='989af54df0b24cf712b199fbd611b12add5e3a27';
const fixture={
 backend:{commit:source,crmOrigin:'https://crm-staging.example.invalid/',supabaseRef:'abcdefghijklmnopqrst',dataClass:'synthetic-only',providerOutboundDisabled:true},
 mobile:{expectedBackendCommit:source,crmOrigin:'https://crm-staging.example.invalid/',supabaseRef:'abcdefghijklmnopqrst',androidPackage:'com.onedecore.owner.staging',easProfile:'crm-staging-apk',otaUpdatesEnabled:false}
};
test('matching synthetic staging metadata is only preparation, never certification',()=>{
 const result=evaluateStagingPair(fixture);
 assert.equal(result.metadataConsistent,true);
 assert.equal(result.status,'HOLD');
});
test('rejects production project and CRM origin',()=>{
 const copy=structuredClone(fixture);
 copy.backend.supabaseRef='lpurlfmpvriyvpkujvyl';
 copy.mobile.supabaseRef='lpurlfmpvriyvpkujvyl';
 copy.backend.crmOrigin='https://onedecore.in/';
 copy.mobile.crmOrigin='https://onedecore.in/';
 assert.equal(evaluateStagingPair(copy).metadataConsistent,false);
});
test('rejects backend drift and update-enabled staging binary',()=>{
 const copy=structuredClone(fixture);
 copy.mobile.expectedBackendCommit='27521f031195a8b749bebeceae0ba22ad475b816';
 copy.mobile.otaUpdatesEnabled=true;
 assert.equal(evaluateStagingPair(copy).metadataConsistent,false);
});
test('refuses live WhatsApp provider and customer-data staging',()=>{
 const copy=structuredClone(fixture);
 copy.backend.providerOutboundDisabled=false;
 copy.backend.dataClass='production-copy';
 assert.equal(evaluateStagingPair(copy).metadataConsistent,false);
});
test('fails closed with missing paired evidence',()=>{
 assert.equal(evaluateStagingPair({}).status,'HOLD');
 assert.equal(evaluateStagingPair({}).metadataConsistent,undefined);
});
