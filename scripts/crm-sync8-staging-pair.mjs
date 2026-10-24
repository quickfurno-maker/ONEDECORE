/**
 * Sanitized staging mobile/backend pairing guard.
 * Compares metadata ONLY, never reads keys, grants, live records or JWTs.
 * Passing this is not a deployment or independent certification.
 */
export function evaluateStagingPair(meta) {
  const issues=[];
  if (!meta || typeof meta!=='object' || !meta.backend || !meta.mobile) {
    return {status:'HOLD', issues:['Backend/mobile staging manifests are required']};
  }
  const {backend:b,mobile:m}=meta;
  const sha=/^[0-9a-f]{40}$/i;
  if(!sha.test(b.commit??'') || !sha.test(m.expectedBackendCommit??'') ||
     b.commit!==m.expectedBackendCommit) issues.push('Backend release commit must be pinned and identical');
  let validOrigin=false;
  try {
    const u=new URL(b.crmOrigin);
    validOrigin=u.protocol==='https:' && u.hostname.includes('staging') &&
      !u.username && !u.password && !u.search && !u.hash && u.pathname==='/' &&
      b.crmOrigin===m.crmOrigin;
  }catch { validOrigin=false; }
  if(!validOrigin) issues.push('Staging CRM origin mismatch or not HTTPS staging');
  if(typeof b.supabaseRef!=='string' || !/^[a-z0-9]{20}$/.test(b.supabaseRef) ||
    b.supabaseRef==='lpurlfmpvriyvpkujvyl' || b.supabaseRef!==m.supabaseRef) {
    issues.push('Staging Supabase reference is invalid, production or mismatched');
  }
  if(m.androidPackage!=='com.onedecore.owner.staging' || m.easProfile!=='crm-staging-apk' ||
    m.otaUpdatesEnabled!==false) issues.push('UAT APK must use isolated package/profile and OTA disabled');
  if(b.dataClass!=='synthetic-only') issues.push('Protected staging data must be synthetic-only');
  if(b.providerOutboundDisabled!==true) issues.push('Outbound provider quarantine requires independent verification');
  return {status:'HOLD', issues, metadataConsistent:issues.length===0};
}
