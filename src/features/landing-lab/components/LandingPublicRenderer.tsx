import type { LandingBlock } from "../contracts/blocks.ts";
import { LiveLandingLeadForm } from "../components/LiveLandingLeadForm.tsx";
import type { SignedPublicationContext } from "../contracts/publication-context.ts";

interface LandingPublicRendererProps {
  readonly blocks: readonly LandingBlock[];
  readonly signedContext: SignedPublicationContext;
  readonly campaignExecutionContext?: unknown;
}

function PublicBlock({
  block,
  signedContext,
  campaignExecutionContext,
}: {
  readonly block: LandingBlock;
  readonly signedContext: SignedPublicationContext;
  readonly campaignExecutionContext?: unknown;
}) {
  switch (block.type) {
    case "hero":
      return (
        <section className="space-y-3">
          <h1 className="font-serif text-4xl text-neutral-50">{block.headline}</h1>
          {block.subheadline ? <p className="text-neutral-300">{block.subheadline}</p> : null}
          <p className="text-amber-200">{block.primaryCtaLabel}</p>
        </section>
      );
    case "trust_proof":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {block.items.map((item) => (
              <li key={`${block.blockId}-${item.label}`} className="rounded border border-neutral-800 p-3">
                <span className="block text-xs uppercase text-neutral-500">{item.label}</span>
                <span className="text-neutral-100">{item.value}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "service_highlights":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <ul className="mt-3 space-y-3">
            {block.items.map((item) => (
              <li key={`${block.blockId}-${item.title}`}>
                <h3 className="font-medium text-neutral-100">{item.title}</h3>
                <p className="text-sm text-neutral-400">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "process":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <ol className="mt-3 space-y-3">
            {block.steps.map((step, index) => (
              <li key={`${block.blockId}-${step.title}`}>
                <p className="text-xs uppercase text-neutral-500">Step {index + 1}</p>
                <h3 className="font-medium text-neutral-100">{step.title}</h3>
                <p className="text-sm text-neutral-400">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      );
    case "portfolio_preview":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <p className="mt-2 text-sm text-neutral-400">{block.projectSlugs.join(", ")}</p>
          {block.ctaLabel ? <p className="mt-2 text-amber-200">{block.ctaLabel}</p> : null}
        </section>
      );
    case "testimonials":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <ul className="mt-3 space-y-3">
            {block.items.map((item) => (
              <li key={`${block.blockId}-${item.author}`} className="rounded border border-neutral-800 p-3">
                <p className="text-neutral-200">{item.quote}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {item.author}
                  {item.role ? ` · ${item.role}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "faq":
      return (
        <section>
          <h2 className="text-lg font-medium text-neutral-100">{block.title}</h2>
          <dl className="mt-3 space-y-3">
            {block.items.map((item) => (
              <div key={`${block.blockId}-${item.question}`}>
                <dt className="font-medium text-neutral-100">{item.question}</dt>
                <dd className="text-sm text-neutral-400">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case "offer_cta":
      return (
        <section className="rounded border border-amber-500/30 p-4">
          <h2 className="text-lg font-medium text-neutral-100">{block.headline}</h2>
          <p className="mt-2 text-sm text-neutral-300">{block.body}</p>
          <p className="mt-2 text-amber-200">{block.ctaLabel}</p>
        </section>
      );
    case "lead_form_placeholder":
      return (
        <LiveLandingLeadForm
          block={block}
          signedContext={signedContext}
          campaignExecutionContext={campaignExecutionContext}
        />
      );
    case "footer":
      return (
        <footer className="border-t border-neutral-800 pt-4 text-sm text-neutral-500">
          <p>{block.legalLine}</p>
          {block.contactEmail ? <p>{block.contactEmail}</p> : null}
          {block.contactPhone ? <p>{block.contactPhone}</p> : null}
        </footer>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function LandingPublicRenderer({
  blocks,
  signedContext,
  campaignExecutionContext,
}: LandingPublicRendererProps) {
  return (
    <div className="space-y-10">
      {blocks.map((block) => (
        <PublicBlock
          key={block.blockId}
          block={block}
          signedContext={signedContext}
          campaignExecutionContext={campaignExecutionContext}
        />
      ))}
    </div>
  );
}
