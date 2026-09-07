import type { Metadata } from "next";
import {
  canPublishWarrantyPolicy,
  WARRANTY_CATEGORIES,
  WARRANTY_DRAFT_NOTICE,
  WARRANTY_MARKETING_CLAIM_LABEL,
  WARRANTY_NOT_EFFECTIVE_STATEMENT,
  WARRANTY_POLICY_SECTIONS,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

/**
 * Public marketing HTML must not be cacheable for a year by a shared cache.
 *
 * Next.js requires this to be a literal: a route segment config is read by
 * static analysis rather than by running the module, so an imported constant is
 * rejected outright. The decision therefore lives in
 * `PUBLIC_HTML_REVALIDATE_SECONDS` and a test asserts every public page's
 * literal still equals it. See `src/config/public-cache.ts`.
 */
export const revalidate = 300;

/**
 * Warranty is published on its OWN gate, not the global legal one.
 *
 * `LEGAL_PUBLICATION_MODE` is `published`, which is what makes Privacy, Terms,
 * Data Rights and Communication Consent indexable. Warranty is not part of that
 * set: its category periods are pending, its policy scope is awaiting owner
 * approval and no claims contact is recorded, so `canPublishWarrantyPolicy()`
 * is `false`.
 *
 * The page stays reachable — a human following the footer link still sees the
 * draft architecture and the notice saying it is not effective — but a document
 * that says "not yet effective" must not be offered to a search engine as the
 * canonical statement of ONEDECORE's warranty. So it is `noindex, nofollow`,
 * carries no canonical, and is absent from the sitemap until the gate turns.
 */
export const metadata: Metadata = buildLegalPageMetadata({
  title: "Warranty",
  description:
    "Draft warranty architecture. Detailed category coverage is not yet effective.",
  path: "/warranty",
  published: canPublishWarrantyPolicy(),
});

const WARRANTY_PAGE_SECTIONS = [
  ...WARRANTY_POLICY_SECTIONS,
  { id: "category-table", title: "Category table (pending periods)" },
];

export default function WarrantyPage() {
  return (
    <LegalPageShell
      title="Warranty"
      description={`${WARRANTY_DRAFT_NOTICE} Marketing reference: ${WARRANTY_MARKETING_CLAIM_LABEL}.`}
      sections={WARRANTY_PAGE_SECTIONS}
    >
      {WARRANTY_POLICY_SECTIONS.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}

      <LegalSection
        id="category-table"
        title="Category table (pending periods)"
      >
        <p>{WARRANTY_NOT_EFFECTIVE_STATEMENT}</p>
        <p>
          All owner-approved periods are currently null. No Warranty schema is
          emitted.
        </p>
        <div className="od-legal-table-wrap">
          <table className="od-legal-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Owner-approved period</th>
                <th scope="col">Status</th>
                <th scope="col">Coverage note</th>
              </tr>
            </thead>
            <tbody>
              {WARRANTY_CATEGORIES.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{row.ownerApprovedPeriod ?? "—"}</td>
                  <td>{row.status}</td>
                  <td>{row.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}
