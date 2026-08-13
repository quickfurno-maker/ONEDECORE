import crypto from 'node:crypto';

/**
 * Derives a secure, cryptographically random or deterministic bearer capability token
 * using a server-side secret (HMAC-SHA256).
 *
 * Plaintext capability tokens are NEVER persisted in database tables, logs, or events.
 */
export function deriveQuotationCapabilityToken(
  versionId: string,
  grantId: string,
  nonce: string,
  customSecret?: string
): string {
  const secret = customSecret || process.env.QUOTATION_CAPABILITY_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('QUOTATION_CAPABILITY_SECRET_MISSING: Server capability secret is required in production.');
    }
    // Fail-safe deterministic key for local development and testing
    const fallbackSecret = 'onedecore-dev-capability-secret-32-bytes-minimum!!';
    const payload = `odq-capability-v1|${grantId}|${versionId}|${nonce}`;
    return crypto.createHmac('sha256', fallbackSecret).update(payload).digest('hex');
  }

  const payload = `odq-capability-v1|${grantId}|${versionId}|${nonce}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Hashes a plaintext bearer capability token using SHA-256.
 * Database tables store ONLY this SHA-256 digest (`capability_token_hash`).
 */
export function hashCapabilityToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
