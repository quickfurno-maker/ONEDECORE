import Link from "next/link";
import {
  ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY,
  type WhatsappTemplateLibraryPreset,
} from "../../contracts/template-library";

function presetHref(id: string): string {
  return `/admin/whatsapp/templates?preset=${encodeURIComponent(id)}#whatsapp-template-create`;
}

function LibraryCard({ preset }: { readonly preset: WhatsappTemplateLibraryPreset }) {
  return (
    <article className="od-growth__template-card">
      <div>
        <div className="od-growth__template-meta">
          <span className="od-tpl__badge">{preset.category}</span>
          <span className="od-tpl__badge">{preset.bodyExamples.length} variable{preset.bodyExamples.length === 1 ? "" : "s"}</span>
        </div>
        <h3 className="od-tpl__name" style={{ marginTop: 8 }}>{preset.title}</h3>
        <p className="od-tpl__body">{preset.bodyText}</p>
        <p className="od-tpl__hint">{preset.useCase}</p>
      </div>
      <div>
        <Link className="od-tpl__btn od-tpl__btn--quiet" href={presetHref(preset.id)}>
          Prepare draft
        </Link>
      </div>
    </article>
  );
}

export function TemplateLibrary() {
  const utility = ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY.filter((preset) => preset.category === "UTILITY");
  const marketing = ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY.filter((preset) => preset.category === "MARKETING");

  return (
    <section className="od-tpl__panel" aria-labelledby="onedecore-template-library">
      <div className="od-cp__toolbar">
        <div>
          <p className="od-growth__eyebrow">ONEDECORE-ready starters</p>
          <h2 id="onedecore-template-library" className="od-tpl__panel-title" style={{ margin: 0 }}>
            Template Library
          </h2>
          <p className="od-tpl__hint">
            Prepare approved-copy candidates now. Meta submission remains a separate final activation step.
          </p>
        </div>
        <span className="od-tpl__badge">
          {ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY.length} presets
        </span>
      </div>

      <details open>
        <summary className="od-growth__library-summary">Utility · {utility.length}</summary>
        <div className="od-growth__template-grid" style={{ marginTop: 10 }}>
          {utility.map((preset) => <LibraryCard key={preset.id} preset={preset} />)}
        </div>
      </details>

      <details>
        <summary className="od-growth__library-summary">Marketing · {marketing.length}</summary>
        <div className="od-growth__template-grid" style={{ marginTop: 10 }}>
          {marketing.map((preset) => <LibraryCard key={preset.id} preset={preset} />)}
        </div>
      </details>
    </section>
  );
}
