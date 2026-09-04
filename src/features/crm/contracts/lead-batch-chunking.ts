/**
 * Chunking for batched lead-id reads.
 *
 * Pure, and deliberately in `contracts/` rather than beside the queries that use
 * it: a `.in(...)` list long enough to break a PostgREST URL is a correctness
 * bug, so the splitting rule deserves direct tests that do not need a Supabase
 * client in scope.
 */

/** Keeps `.in(...)` lists well inside PostgREST's practical URL limit. */
export const CRM_LEAD_ID_CHUNK_SIZE = 200;

export function chunkLeadIds(
  leadIds: readonly string[],
  size: number = CRM_LEAD_ID_CHUNK_SIZE
): readonly (readonly string[])[] {
  if (leadIds.length === 0) {
    return [];
  }
  if (leadIds.length <= size) {
    return [leadIds];
  }
  const chunks: string[][] = [];
  for (let index = 0; index < leadIds.length; index += size) {
    chunks.push([...leadIds.slice(index, index + size)]);
  }
  return chunks;
}
