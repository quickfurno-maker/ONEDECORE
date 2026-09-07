import type { Metadata } from "next";
import {
  DATA_RIGHTS_CONTENT,
  DATA_RIGHTS_REQUEST_TEMPLATE_INTRO,
  getDataRightsRequestTemplateText,
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

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Data Rights",
  description:
    "Draft data-rights information and a local request template. Nothing is submitted from this page.",
  path: "/data-rights",
});

export default function DataRightsPage() {
  const template = getDataRightsRequestTemplateText();

  return (
    <LegalPageShell
      title="Data Rights"
      description="Draft rights guidance for future DPDP-ready operations. No request is sent from this page."
      sections={[
        ...DATA_RIGHTS_CONTENT,
        { id: "request-template", title: "Local request template" },
      ]}
    >
      {DATA_RIGHTS_CONTENT.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}

      <LegalSection id="request-template" title="Local request template">
        <p>{DATA_RIGHTS_REQUEST_TEMPLATE_INTRO}</p>
        <p>
          Copy or download this template locally. Nothing is transmitted. No
          ticket is created. Contact routes remain pending owner input.
        </p>
        <pre className="od-legal-template">{template}</pre>
      </LegalSection>
    </LegalPageShell>
  );
}
