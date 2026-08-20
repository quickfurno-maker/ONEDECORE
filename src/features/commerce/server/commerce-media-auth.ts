export function evaluateCommerceMediaUploadAuth(canManage: boolean): { allowed: boolean } {
  return { allowed: canManage };
}
