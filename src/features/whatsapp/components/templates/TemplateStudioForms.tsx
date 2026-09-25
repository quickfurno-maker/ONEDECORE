"use client";

"use client";

import { useActionState, useMemo, useState } from "react";
import {
  buildWhatsappTemplateStudioSubmission,
  countWhatsappTemplateBodyPlaceholders,
  WHATSAPP_TEMPLATE_STUDIO_CATEGORIES,
  WHATSAPP_TEMPLATE_STUDIO_LANGUAGES,
} from "../../contracts/template-components.ts";
import { INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE } from "../../contracts/template-studio.ts";
import {
  submitWhatsappTemplateAction,
  syncWhatsappTemplatesAction,
} from "../../server/whatsapp-template-actions.ts";

/**
 * Template Studio controls. Rendered only for whatsapp.templates.manage, and
 * every action re-checks that permission on the server.
 *
 * `available` is false when the provider mode is disabled: the controls stay
 * visible, disabled, with the reason beside them, so an administrator can see
 * what the Studio does and why it is not doing it here.
 */

function ActionMessage({ success, message }: { readonly success: boolean; readonly message: string }) {
  if (!message) return null;
  return (
    <p className={`od-tpl__msg ${success ? "od-tpl__msg--ok" : "od-tpl__msg--err"}`} role={success ? "status" : "alert"}>
      {message}
    </p>
  );
}

export function TemplateSyncForm({
  available,
  templateId = null,
  label = "Sync from WhatsApp",
}: {
  readonly available: boolean;
  readonly templateId?: string | null;
  readonly label?: string;
}) {
  const [state, action, pending] = useActionState(syncWhatsappTemplatesAction, INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE);
  return (
    <form action={action} className="od-tpl__inline-form">
      {templateId ? <input type="hidden" name="templateId" value={templateId} /> : null}
      <button
        type="submit"
        className={templateId ? "od-tpl__btn od-tpl__btn--quiet" : "od-tpl__btn od-tpl__btn--primary"}
        disabled={!available || pending}
        title={available ? undefined : "Template management is turned off in this environment."}
      >
        {pending ? (templateId ? "Refreshing…" : "Syncing…") : label}
      </button>
      <ActionMessage success={state.success} message={state.message} />
    </form>
  );
}

export function TemplateCreateForm({ available }: { readonly available: boolean }) {
  const [state, action, pending] = useActionState(submitWhatsappTemplateAction, INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE);
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [examples, setExamples] = useState<Record<number, string>>({});
  const exampleCount = Math.min(countWhatsappTemplateBodyPlaceholders(bodyText), 20);
  const headerHasVariable = countWhatsappTemplateBodyPlaceholders(headerText) > 0;
  const [clientError, setClientError] = useState<{ field: string; message: string } | null>(null);
  const previewBody = useMemo(
    () =>
      (bodyText || "Your template message will preview here.").replace(
        /{{([1-9][0-9]*)}}/g,
        (_, raw: string) => examples[Number(raw)]?.trim() || `{{${raw}}}`
      ),
    [bodyText, examples]
  );

  /* Validated in the browser for a fast answer, then again on the server. */
  const submit = (formData: FormData) => {
    const examples: string[] = [];
    for (let index = 1; index <= exampleCount; index += 1) {
      examples.push(String(formData.get(`bodyExample${index}`) ?? ""));
    }
    const draft = buildWhatsappTemplateStudioSubmission({
      name: String(formData.get("name") ?? ""),
      language: String(formData.get("language") ?? ""),
      category: String(formData.get("category") ?? ""),
      headerText: String(formData.get("headerText") ?? ""),
      bodyText: String(formData.get("bodyText") ?? ""),
      footerText: String(formData.get("footerText") ?? ""),
      bodyExamples: examples,
      headerExample: String(formData.get("headerExample") ?? ""),
    });
    if (!draft.ok) {
      setClientError({ field: draft.field, message: draft.message });
      return;
    }
    setClientError(null);
    formData.set("idempotencyKey", crypto.randomUUID());
    return action(formData);
  };

  const fieldError = clientError?.message ?? (state.success ? "" : state.message);

  return (
    <div className="od-growth__builder">
      <form action={submit} className="od-tpl__create" aria-label="Create and submit a WhatsApp template">
      <div className="od-tpl__grid">
        <label className="od-tpl__field">
          <span>Name</span>
          <input name="name" required maxLength={128} pattern="[a-z0-9_]+" placeholder="site_visit_confirmation" disabled={!available || pending} />
        </label>
        <label className="od-tpl__field">
          <span>Language</span>
          <select name="language" defaultValue="en" disabled={!available || pending}>
            {WHATSAPP_TEMPLATE_STUDIO_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="od-tpl__field">
          <span>Category</span>
          <select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value)}
            disabled={!available || pending}
          >
            {WHATSAPP_TEMPLATE_STUDIO_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="od-tpl__hint">
        {category === "UTILITY"
          ? "Use Utility for enquiry updates, appointments, site visits, quotations and service communication."
          : "Use Marketing only for promotions or nurture campaigns with valid marketing consent."}
      </p>

      <label className="od-tpl__field">
        <span>Header text (optional, max 60, one {"{{1}}"} at most)</span>
        <input
          name="headerText"
          maxLength={60}
          value={headerText}
          onChange={(event) => setHeaderText(event.currentTarget.value)}
          disabled={!available || pending}
        />
      </label>
      {headerHasVariable ? (
        <label className="od-tpl__field">
          <span>Header example value</span>
          <input name="headerExample" maxLength={60} required disabled={!available || pending} />
        </label>
      ) : null}

      <label className="od-tpl__field">
        <span>Body (max 1024, numbered variables {"{{1}}"}, {"{{2}}"}…)</span>
        <textarea
          name="bodyText"
          required
          maxLength={1024}
          rows={4}
          value={bodyText}
          onChange={(event) => setBodyText(event.currentTarget.value)}
          disabled={!available || pending}
        />
      </label>

      {exampleCount > 0 ? (
        <div className="od-tpl__grid">
          {Array.from({ length: exampleCount }, (_, index) => (
            <label className="od-tpl__field" key={index}>
              <span>Example for {`{{${index + 1}}}`}</span>
              <input
                name={`bodyExample${index + 1}`}
                required
                maxLength={200}
                disabled={!available || pending}
                onChange={(event) =>
                  setExamples((current) => ({
                    ...current,
                    [index + 1]: event.currentTarget.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}

      <label className="od-tpl__field">
        <span>Footer (optional, max 60, no variables)</span>
        <input
          name="footerText"
          maxLength={60}
          value={footerText}
          onChange={(event) => setFooterText(event.currentTarget.value)}
          placeholder="ONEDECORE • Spaces for a better you"
          disabled={!available || pending}
        />
      </label>

      <p className="od-tpl__hint">
        Submitting creates the template on WhatsApp for review. It is not sendable until WhatsApp approves it and a
        sync records that approval. Marketing templates are never offered in the inbox.
      </p>

      <div className="od-tpl__inline-form">
        <button type="submit" className="od-tpl__btn od-tpl__btn--primary" disabled={!available || pending}>
          {pending ? "Submitting…" : "Submit to Meta for review"}
        </button>
        {fieldError ? (
          <p className="od-tpl__msg od-tpl__msg--err" role="alert">
            {fieldError}
          </p>
        ) : null}
        {state.success ? <ActionMessage success message={state.message} /> : null}
      </div>
      </form>

      <aside className="od-growth__preview-sticky" aria-label="Template preview">
        <div className="od-growth__phone">
          <div className="od-growth__phone-bar">ONEDECORE</div>
          <div className="od-growth__bubble">
            {headerText ? <div className="od-growth__bubble-header">{headerText}</div> : null}
            <div>{previewBody}</div>
            {footerText ? <div className="od-growth__bubble-footer">{footerText}</div> : null}
          </div>
        </div>
        <p className="od-tpl__hint" style={{ marginTop: 10 }}>
          Live preview is illustrative. Meta remains the source of truth for approved rendering and category.
        </p>
      </aside>
    </div>
  );
}
