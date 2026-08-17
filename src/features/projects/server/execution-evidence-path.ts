export function isSignableExecutionEvidencePath(projectId: string, objectPath: string): boolean {
  const trimmed = objectPath.trim();
  if (!trimmed) return false;
  if (trimmed.includes("..")) return false;
  const prefix = `projects/${projectId}/execution/evidence/`;
  return trimmed.startsWith(prefix) && trimmed.length > prefix.length;
}
