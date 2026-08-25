/**
 * Legal page UI — draft-review / owner-approved chrome vs clean published surfaces.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";
import {
  LEGAL_DRAFT_BANNER,
  LEGAL_DPDP_READINESS_STATEMENT,
  LEGAL_OWNER_APPROVED_BANNER,
  LEGAL_PUBLICATION_MODE,
  LEGAL_ROUTE_PATHS,
  getMissingLegalPublicationFields,
  isLegalDraftMode,
  isLegalOwnerApprovedMode,
  isLegalPublishedMode,
} from "@/features/legal";
import "./legal-pages.css";

export interface LegalSectionLike {
  readonly id: string;
  readonly title: string;
}

interface LegalPageShellProps {
  readonly title: string;
  readonly description: string;
  readonly sections: readonly LegalSectionLike[];
  readonly children: ReactNode;
  readonly documentVersion?: string;
  readonly effectiveDateLabel?: string;
}

export function LegalDraftBanner() {
  return (
    <aside className="od-legal-banner" role="status">
      <p className="od-legal-banner__title">{LEGAL_DRAFT_BANNER}</p>
      <p className="od-legal-banner__lede">{LEGAL_DPDP_READINESS_STATEMENT}</p>
    </aside>
  );
}

export function LegalOwnerApprovedBanner() {
  return (
    <aside className="od-legal-banner" role="status">
      <p className="od-legal-banner__title">{LEGAL_OWNER_APPROVED_BANNER}</p>
      <p className="od-legal-banner__lede">
        Counsel status remains not reviewed. This notice is not yet the effective
        published policy.
      </p>
    </aside>
  );
}

export function LegalOwnerReviewPanel() {
  const missing = getMissingLegalPublicationFields();

  return (
    <section className="od-legal-owner-panel" aria-labelledby="legal-owner-blockers">
      <h2 id="legal-owner-blockers">Publication blockers</h2>
      <p>
        These owner and counsel inputs remain unresolved. Draft routes are
        reviewable but are not effective policy. This panel is draft-review only
        and is not shown in owner-approved or published mode.
      </p>
      {missing.length === 0 ? (
        <p>
          Core identity publication fields are recorded. Remaining activation
          gates are tracked in the lead-intake activation runbook.
        </p>
      ) : (
        <ul>
          {missing.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LegalTableOfContents({
  sections,
}: {
  readonly sections: readonly LegalSectionLike[];
}) {
  return (
    <nav className="od-legal-toc" aria-label="On this page">
      <h2 className="od-legal-toc__title">On this page</h2>
      <ol>
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function LegalDraftFooterNote() {
  return (
    <>
      Legal drafts for review only — not effective policy.{" "}
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
      {" · "}
      <Link href="/warranty">Warranty</Link>
      {" · "}
      <Link href="/data-rights">Data rights</Link>
      {" · "}
      <Link href="/communication-consent">Consent</Link>
    </>
  );
}

function LegalOwnerApprovedFooterNote() {
  return (
    <>
      Owner-approved — not yet effective.{" "}
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
      {" · "}
      <Link href="/data-rights">Data rights</Link>
      {" · "}
      <Link href="/communication-consent">Consent</Link>
    </>
  );
}

function LegalPublishedFooterNote() {
  return (
    <>
      <Link href="/privacy">Privacy</Link>
      {" · "}
      <Link href="/terms">Terms</Link>
      {" · "}
      <Link href="/data-rights">Data rights</Link>
      {" · "}
      <Link href="/communication-consent">Consent</Link>
    </>
  );
}

export function LegalPageShell({
  title,
  description,
  sections,
  children,
  documentVersion,
  effectiveDateLabel,
}: LegalPageShellProps) {
  const draft = isLegalDraftMode();
  const ownerApproved = isLegalOwnerApprovedMode();
  const published = isLegalPublishedMode();

  const footerNote = published
    ? <LegalPublishedFooterNote />
    : ownerApproved
      ? <LegalOwnerApprovedFooterNote />
      : <LegalDraftFooterNote />;

  const kicker = published
    ? "ONEDECORE"
    : ownerApproved
      ? "ONEDECORE · Owner approved (not effective)"
      : "ONEDECORE · Draft review";

  return (
    <PublicDarkShell navCurrent="none" footerNote={footerNote}>
      <article
        className="od-legal-page"
        data-legal-publication-mode={LEGAL_PUBLICATION_MODE}
      >
        {draft ? <LegalDraftBanner /> : null}
        {ownerApproved ? <LegalOwnerApprovedBanner /> : null}
        <header className="od-legal-header">
          <p className="od-legal-kicker">{kicker}</p>
          <h1>{title}</h1>
          {documentVersion ? (
            <p className="od-legal-meta">Version: {documentVersion}</p>
          ) : null}
          {effectiveDateLabel ? (
            <p className="od-legal-meta">Effective date: {effectiveDateLabel}</p>
          ) : null}
          <p className="od-legal-lede">{description}</p>
        </header>
        <LegalTableOfContents sections={sections} />
        <div className="od-legal-body">{children}</div>
        {draft ? <LegalOwnerReviewPanel /> : null}
        <nav
          className="od-legal-sibling-nav"
          aria-label={
            published ? "Other legal pages" : "Other legal review pages"
          }
        >
          <ul>
            {LEGAL_ROUTE_PATHS.map((path) => (
              <li key={path}>
                <Link href={path}>{path}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </PublicDarkShell>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="od-legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalParagraphs({ lines }: { readonly lines: readonly string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line.slice(0, 48) + String(line.length)}>{line}</p>
      ))}
    </>
  );
}
