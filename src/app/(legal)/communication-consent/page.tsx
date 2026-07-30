import type { Metadata } from "next";
import {
  COMMUNICATION_CONSENT_CONTENT,
  CONSENT_VERSIONS,
  marketingConsentIsOptional,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Communication Consent",
  description:
    "Draft consent architecture separating service, WhatsApp, marketing, AI disclosure and media reuse.",
  path: "/communication-consent",
});

export default function CommunicationConsentPage() {
  const marketingOptional = marketingConsentIsOptional();

  return (
    <LegalPageShell
      title="Communication Consent"
      description="Draft purpose-specific consent copies. Marketing remains optional and unchecked by default. Not effective until published."
      sections={[
        ...COMMUNICATION_CONSENT_CONTENT,
        { id: "consent-versions", title: "Consent version registry" },
      ]}
    >
      {COMMUNICATION_CONSENT_CONTENT.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}

      <LegalSection id="consent-versions" title="Consent version registry">
        <p>
          Marketing optional / default unchecked:{" "}
          {marketingOptional ? "yes" : "no"}. Privacy/Terms acceptance is not
          marketing consent. Channel consents are not bundled.
        </p>
        <div className="od-legal-table-wrap">
          <table className="od-legal-table">
            <thead>
              <tr>
                <th scope="col">Purpose</th>
                <th scope="col">Version</th>
                <th scope="col">Required</th>
                <th scope="col">Default checked</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {CONSENT_VERSIONS.map((entry) => (
                <tr key={entry.purposeCode}>
                  <td>{entry.purposeCode}</td>
                  <td>{entry.version}</td>
                  <td>{entry.required ? "yes" : "no"}</td>
                  <td>{entry.defaultChecked ? "yes" : "no"}</td>
                  <td>{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}
