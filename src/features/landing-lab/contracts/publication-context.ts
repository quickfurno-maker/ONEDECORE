/**
 * Phase 9 migration-independent — signed publication context contracts.
 */

export interface PublicationContext {
  readonly publicationReference: string;
  readonly pageReference: string;
  readonly pageVersionNumber: number;
  readonly experimentReference: string | null;
  readonly variantKey: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
}

export interface SignedPublicationContext {
  readonly context: PublicationContext;
  readonly signature: string;
}
