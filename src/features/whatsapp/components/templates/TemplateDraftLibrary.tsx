import Link from "next/link";
import { editorSeedFromWhatsappTemplateComponents } from "../../contracts/template-components";
import type {
  WhatsappTemplateDraftItem,
  WhatsappTemplateDraftPage,
} from "../../contracts/template-drafts";

function hrefFor(action: "edit" | "duplicate", draftId: string): string {
  const params = new URLSearchParams();
  params.set(action === "edit" ? "draft" : "duplicate", draftId);
  return `/admin/whatsapp/templates?${params.toString()}#whatsapp-template-create`;
}

function draftStatusLabel(status: WhatsappTemplateDraftItem["workflowStatus"]): string {
  if (status === "locally_reviewed") return "Locally reviewed";
  if (status === "archived") return "Archived";
  return "Local draft";
}

export function TemplateDraftLibrary({
  page,
  canManage,
}: {
  readonly page: WhatsappTemplateDraftPage;
  readonly canManage: boolean;
}) {
  return (
    <section className="od-tpl__panel" aria-labelledby="onedecore-template-drafts">
      <div className="od-cp__toolbar">
        <div>
          <p className="od-growth__eyebrow">ONEDECORE workspace</p>
          <h2 id="onedecore-template-drafts" className="od-tpl__panel-title" style={{ margin: 0 }}>
            Local Drafts · {page.totalCount}
          </h2>
          <p className="od-tpl__hint">
            Editable ONEDECORE content. Local review is not Meta approval and never makes a template sendable.
          </p>
        </div>
        {canManage ? (
          <a className="od-tpl__btn od-tpl__btn--primary" href="#whatsapp-template-create">
            New draft
          </a>
        ) : null}
      </div>

      {page.items.length === 0 ? (
        <p className="od-tpl__empty">
          No ONEDECORE drafts match these filters. Start from the Template Library or create one below.
        </p>
      ) : (
        <div className="od-growth__template-grid">
          {page.items.map((draft) => {
            const seed = editorSeedFromWhatsappTemplateComponents({
              name: draft.name,
              language: draft.language,
              category: draft.category,
              components: draft.components,
            });
            const active = draft.workflowStatus !== "archived";
            return (
              <article className="od-growth__template-card" key={draft.id}>
                <div>
                  <div className="od-growth__template-meta">
                    <span
                      className="od-tpl__badge"
                      data-tone={draft.workflowStatus === "locally_reviewed" ? "positive" : undefined}
                    >
                      {draftStatusLabel(draft.workflowStatus)}
                    </span>
                    <span className="od-tpl__badge">{draft.category}</span>
                    <span className="od-tpl__badge">{draft.language}</span>
                  </div>
                  <h3 className="od-tpl__name" style={{ marginTop: 8 }}>{draft.name}</h3>
                  <p className="od-tpl__body">{seed.bodyText}</p>
                  <p className="od-tpl__hint">
                    Updated {new Date(draft.updatedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="od-tpl__inline-form">
                  {canManage && active ? (
                    <>
                      <Link className="od-tpl__btn od-tpl__btn--quiet" href={hrefFor("edit", draft.id)}>
                        Edit
                      </Link>
                      <Link className="od-tpl__btn od-tpl__btn--quiet" href={hrefFor("duplicate", draft.id)}>
                        Duplicate
                      </Link>
                    </>
                  ) : null}
                  <span
                    className="od-tpl__btn od-tpl__btn--quiet"
                    aria-disabled="true"
                    title="A local draft must be submitted, approved by Meta and synced before campaign use."
                  >
                    Use in Campaign · needs Meta approval
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
