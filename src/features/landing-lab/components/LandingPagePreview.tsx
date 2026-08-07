"use client";

import type { LandingBlock } from "../contracts/blocks.ts";
import { LeadFormBlockPreview } from "./LeadFormBlockPreview.tsx";

interface LandingPagePreviewProps {
  readonly blocks: readonly LandingBlock[];
}

function renderBlock(block: LandingBlock) {
  switch (block.type) {
    case "hero":
      return (
        <section key={block.blockId} className="space-y-2 rounded-md border border-neutral-800 p-4">
          <h3 className="text-xl font-semibold text-neutral-50">{block.headline}</h3>
          {block.subheadline ? <p className="text-sm text-neutral-300">{block.subheadline}</p> : null}
          <p className="text-sm text-amber-200">{block.primaryCtaLabel}</p>
        </section>
      );
    case "trust_proof":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {block.items.map((item) => (
              <li key={`${block.blockId}-${item.label}`} className="text-sm text-neutral-300">
                <span className="block text-neutral-500">{item.label}</span>
                {item.value}
              </li>
            ))}
          </ul>
        </section>
      );
    case "service_highlights":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          <ul className="mt-2 space-y-2">
            {block.items.map((item) => (
              <li key={`${block.blockId}-${item.title}`}>
                <p className="text-sm font-medium text-neutral-200">{item.title}</p>
                <p className="text-sm text-neutral-400">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "process":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          <ol className="mt-2 space-y-2">
            {block.steps.map((step) => (
              <li key={`${block.blockId}-${step.title}`} className="text-sm text-neutral-300">
                <span className="font-medium text-neutral-200">{step.title}</span> — {step.description}
              </li>
            ))}
          </ol>
        </section>
      );
    case "portfolio_preview":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Projects: {block.projectSlugs.join(", ")}
          </p>
        </section>
      );
    case "testimonials":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          {block.items.map((item) => (
            <blockquote key={`${block.blockId}-${item.author}`} className="mt-2 text-sm text-neutral-300">
              “{item.quote}” — {item.author}
            </blockquote>
          ))}
        </section>
      );
    case "faq":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-100">{block.title}</h3>
          <dl className="mt-2 space-y-2">
            {block.items.map((item) => (
              <div key={`${block.blockId}-${item.question}`}>
                <dt className="text-sm font-medium text-neutral-200">{item.question}</dt>
                <dd className="text-sm text-neutral-400">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case "offer_cta":
      return (
        <section key={block.blockId} className="rounded-md border border-neutral-800 p-4">
          <h3 className="text-base font-medium text-neutral-100">{block.headline}</h3>
          <p className="mt-1 text-sm text-neutral-300">{block.body}</p>
          <p className="mt-2 text-sm text-amber-200">{block.ctaLabel}</p>
        </section>
      );
    case "lead_form_placeholder":
      return <LeadFormBlockPreview key={block.blockId} block={block} />;
    case "footer":
      return (
        <footer key={block.blockId} className="rounded-md border border-neutral-800 p-4 text-sm text-neutral-400">
          <p>{block.legalLine}</p>
          {block.contactEmail ? <p>{block.contactEmail}</p> : null}
          {block.contactPhone ? <p>{block.contactPhone}</p> : null}
        </footer>
      );
    default:
      return null;
  }
}

export function LandingPagePreview({ blocks }: LandingPagePreviewProps) {
  return (
    <div className="space-y-3" data-testid="landing-page-preview">
      <h2 className="text-sm font-medium text-neutral-100">Preview</h2>
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        {blocks.map((block) => renderBlock(block))}
      </div>
    </div>
  );
}
