"use client";

import { useActionState, useMemo, useState } from "react";
import {
  buildWhatsappTemplateStudioSubmission,
  countWhatsappTemplateBodyPlaceholders,
  WHATSAPP_TEMPLATE_BUTTON_TYPES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_STUDIO_CATEGORIES,
  WHATSAPP_TEMPLATE_STUDIO_LANGUAGES,
  type WhatsappTemplateEditorSeed,
  type WhatsappTemplateStudioButtonDraft,
} from "../../contracts/template-components.ts";
import { INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE } from "../../contracts/template-studio.ts";
import type { WhatsappTemplateLibraryPreset } from "../../contracts/template-library.ts";
import {
  saveWhatsappTemplateDraftAction,
  submitWhatsappTemplateAction,
  syncWhatsappTemplatesAction,
} from "../../server/whatsapp-template-actions.ts";

function ActionMessage({ success, message }: { readonly success: boolean; readonly message: string }) {
  if (!message) return null;
  return (
    <p className={`od-tpl__msg ${success ? "od-tpl__msg--ok" : "od-tpl__msg--err"}`} role={success ? "status" : "alert"}>
      {message}
    </p>
  );
}

export function TemplateSyncForm({ available, templateId = null, label = "Sync from WhatsApp" }: {
  readonly available: boolean;
  readonly templateId?: string | null;
  readonly label?: string;
}) {
  const [state, action, pending] = useActionState(syncWhatsappTemplatesAction, INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE);
  return (
    <form action={action} className="od-tpl__inline-form">
      {templateId ? <input type="hidden" name="templateId" value={templateId} /> : null}
      <button type="submit" className={templateId ? "od-tpl__btn od-tpl__btn--quiet" : "od-tpl__btn od-tpl__btn--primary"} disabled={!available || pending} title={available ? undefined : "Template management is turned off in this environment."}>
        {pending ? (templateId ? "Refreshing…" : "Syncing…") : label}
      </button>
      <ActionMessage success={state.success} message={state.message} />
    </form>
  );
}

export interface TemplateEditorDraftMeta {
  readonly id: string;
  readonly lockVersion: number;
  readonly workflowStatus: string;
  readonly sourcePresetId: string | null;
}

function presetSeed(preset: WhatsappTemplateLibraryPreset | null | undefined): WhatsappTemplateEditorSeed | null {
  if (!preset) return null;
  return {
    name: preset.name,
    language: "en",
    category: preset.category,
    headerType: preset.headerText ? "TEXT" : "NONE",
    headerText: preset.headerText ?? "",
    headerMediaHandle: "",
    bodyText: preset.bodyText,
    footerText: preset.footerText ?? "",
    bodyExamples: preset.bodyExamples ?? [],
    headerExample: "",
    buttons: [],
  };
}

function newButton(): WhatsappTemplateStudioButtonDraft {
  return { type: "QUICK_REPLY", text: "", url: "", phoneNumber: "", flowId: "", navigateScreen: "" };
}

function describeHeader(type: string): string {
  if (type === "IMAGE") return "Image header";
  if (type === "VIDEO") return "Video header";
  if (type === "DOCUMENT") return "Document header";
  if (type === "LOCATION") return "Location header";
  return "";
}

export function TemplateCreateForm({ available, preset, seed, draftMeta, duplicateMode = false }: {
  readonly available: boolean;
  readonly preset?: WhatsappTemplateLibraryPreset | null;
  readonly seed?: WhatsappTemplateEditorSeed | null;
  readonly draftMeta?: TemplateEditorDraftMeta | null;
  readonly duplicateMode?: boolean;
}) {
  const initial = seed ?? presetSeed(preset);
  const initialName = duplicateMode && initial?.name ? `${initial.name}_copy`.slice(0, 128) : initial?.name ?? "";
  const [saveState, saveAction, savePending] = useActionState(saveWhatsappTemplateDraftAction, INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE);
  const [submitState, submitAction, submitPending] = useActionState(submitWhatsappTemplateAction, INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE);
  const [bodyText, setBodyText] = useState(initial?.bodyText ?? "");
  const [headerType, setHeaderType] = useState(initial?.headerType ?? "NONE");
  const [headerText, setHeaderText] = useState(initial?.headerText ?? "");
  const [headerMediaHandle, setHeaderMediaHandle] = useState(initial?.headerMediaHandle ?? "");
  const [footerText, setFooterText] = useState(initial?.footerText ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? preset?.category ?? "UTILITY");
  const [language, setLanguage] = useState(initial?.language ?? "en");
  const [buttons, setButtons] = useState<WhatsappTemplateStudioButtonDraft[]>([...(initial?.buttons ?? [])]);
  const [examples, setExamples] = useState<Record<number, string>>(Object.fromEntries((initial?.bodyExamples ?? preset?.bodyExamples ?? []).map((value, index) => [index + 1, value])));
  const [headerExample, setHeaderExample] = useState(initial?.headerExample ?? "");
  const [clientError, setClientError] = useState<{ field: string; message: string } | null>(null);
  const exampleCount = Math.min(countWhatsappTemplateBodyPlaceholders(bodyText), 20);
  const headerHasVariable = headerType === "TEXT" && countWhatsappTemplateBodyPlaceholders(headerText) > 0;
  const pending = savePending || submitPending;
  const effectiveDraftId = saveState.draftId ?? draftMeta?.id ?? "";
  const effectiveLockVersion = saveState.lockVersion ?? draftMeta?.lockVersion ?? null;
  const sourcePresetId = draftMeta?.sourcePresetId ?? preset?.id ?? "";
  const previewBody = useMemo(() => (bodyText || "Your template message will preview here.").replace(/{{([1-9][0-9]*)}}/g, (_, raw: string) => examples[Number(raw)]?.trim() || `{{${raw}}}`), [bodyText, examples]);

  const submit = (formData: FormData) => {
    const operation = String(formData.get("studioOperation") ?? "save");
    const bodyExamples: string[] = [];
    for (let index = 1; index <= exampleCount; index += 1) bodyExamples.push(String(formData.get(`bodyExample${index}`) ?? ""));
    const draft = buildWhatsappTemplateStudioSubmission({
      name: String(formData.get("name") ?? ""),
      language: String(formData.get("language") ?? ""),
      category: String(formData.get("category") ?? ""),
      headerType: String(formData.get("headerType") ?? "NONE"),
      headerText: String(formData.get("headerText") ?? ""),
      headerMediaHandle: String(formData.get("headerMediaHandle") ?? ""),
      bodyText: String(formData.get("bodyText") ?? ""),
      footerText: String(formData.get("footerText") ?? ""),
      bodyExamples,
      headerExample: String(formData.get("headerExample") ?? ""),
      buttons: buttons.map((button) => ({ ...button })),
    }, { providerReady: operation === "provider_submit" });
    if (!draft.ok) {
      setClientError({ field: draft.field, message: draft.message });
      return;
    }
    setClientError(null);
    formData.set("buttonCount", String(buttons.length));
    buttons.forEach((button, index) => {
      const position = index + 1;
      formData.set(`buttonType${position}`, button.type);
      formData.set(`buttonText${position}`, button.text);
      formData.set(`buttonUrl${position}`, button.url ?? "");
      formData.set(`buttonPhone${position}`, button.phoneNumber ?? "");
      formData.set(`buttonFlowId${position}`, button.flowId ?? "");
      formData.set(`buttonScreen${position}`, button.navigateScreen ?? "");
    });
    if (operation === "provider_submit") {
      formData.set("idempotencyKey", crypto.randomUUID());
      return submitAction(formData);
    }
    formData.set("workflowStatus", operation === "review" ? "locally_reviewed" : "local_draft");
    return saveAction(formData);
  };

  const activeState = submitState.message ? submitState : saveState;
  const fieldError = clientError?.message ?? (activeState.success ? "" : activeState.message);
  const updateButton = (index: number, patch: Partial<WhatsappTemplateStudioButtonDraft>) => setButtons((current) => current.map((button, position) => position === index ? { ...button, ...patch } : button));

  return (
    <div className="od-growth__builder">
      <form action={submit} className="od-tpl__create" aria-label="Prepare a WhatsApp template">
        {effectiveDraftId ? <input type="hidden" name="draftId" value={effectiveDraftId} /> : null}
        {effectiveLockVersion ? <input type="hidden" name="lockVersion" value={String(effectiveLockVersion)} /> : null}
        {sourcePresetId ? <input type="hidden" name="sourcePresetId" value={sourcePresetId} /> : null}
        <div className="od-tpl__state-strip">
          <span className="od-tpl__badge" data-tone="positive">ONEDECORE Draft</span>
          <span className="od-tpl__raw">{draftMeta ? draftMeta.workflowStatus === "locally_reviewed" ? "Locally reviewed · not Meta approved" : "Saved locally · not submitted to Meta" : "Local preparation works even while the provider is off."}</span>
        </div>
        <div className="od-tpl__grid">
          <label className="od-tpl__field"><span>Name</span><input name="name" required maxLength={128} pattern="[a-z0-9_]+" placeholder="site_visit_confirmation" defaultValue={initialName} disabled={pending} /></label>
          <label className="od-tpl__field"><span>Language</span><select name="language" value={language} onChange={(event) => setLanguage(event.currentTarget.value)} disabled={pending}>{WHATSAPP_TEMPLATE_STUDIO_LANGUAGES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
          <label className="od-tpl__field"><span>Category</span><select name="category" value={category} onChange={(event) => setCategory(event.currentTarget.value)} disabled={pending}>{WHATSAPP_TEMPLATE_STUDIO_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <p className="od-tpl__hint">{category === "UTILITY" ? "Utility is for enquiry updates, appointments, site visits, quotations and service communication." : "Marketing is for nurture or promotions and still requires explicit MARKETING WhatsApp consent before any campaign can send."}</p>

        <fieldset className="od-tpl__fieldset">
          <legend>Header</legend>
          <div className="od-tpl__grid">
            <label className="od-tpl__field"><span>Header type</span><select name="headerType" value={headerType} onChange={(event) => { const next = event.currentTarget.value; setHeaderType(next as typeof headerType); if (next !== "TEXT") setHeaderText(""); }} disabled={pending}>{WHATSAPP_TEMPLATE_HEADER_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            {headerType === "TEXT" ? <label className="od-tpl__field od-tpl__field--wide"><span>Header text · max 60 · one {"{{1}}"} at most</span><input name="headerText" maxLength={60} value={headerText} onChange={(event) => setHeaderText(event.currentTarget.value)} disabled={pending} /></label> : <input type="hidden" name="headerText" value="" />}
          </div>
          {headerHasVariable ? <label className="od-tpl__field"><span>Header example value</span><input name="headerExample" maxLength={60} required value={headerExample} onChange={(event) => setHeaderExample(event.currentTarget.value)} disabled={pending} /></label> : <input type="hidden" name="headerExample" value="" />}
          {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) ? <label className="od-tpl__field"><span>Meta sample upload handle · optional while local, required for provider submission</span><input name="headerMediaHandle" maxLength={2048} value={headerMediaHandle} onChange={(event) => setHeaderMediaHandle(event.currentTarget.value)} placeholder="Add later after Meta media upload is available" disabled={pending} /></label> : <input type="hidden" name="headerMediaHandle" value="" />}
          {headerType === "LOCATION" ? <p className="od-tpl__hint">Location headers are structural; actual location values are supplied by the governed send/campaign path later.</p> : null}
        </fieldset>

        <label className="od-tpl__field"><span>Body · max 1024 · numbered variables {"{{1}}"}, {"{{2}}"}…</span><textarea name="bodyText" required maxLength={1024} rows={5} value={bodyText} onChange={(event) => setBodyText(event.currentTarget.value)} disabled={pending} /></label>
        {exampleCount > 0 ? <div className="od-tpl__grid">{Array.from({ length: exampleCount }, (_, index) => <label className="od-tpl__field" key={index}><span>Example for {`{{${index + 1}}}`}</span><input name={`bodyExample${index + 1}`} required maxLength={200} value={examples[index + 1] ?? ""} disabled={pending} onChange={(event) => setExamples((current) => ({ ...current, [index + 1]: event.currentTarget.value }))} /></label>)}</div> : null}
        <label className="od-tpl__field"><span>Footer · optional · max 60 · no variables</span><input name="footerText" maxLength={60} value={footerText} onChange={(event) => setFooterText(event.currentTarget.value)} placeholder="ONEDECORE • Spaces for a better you" disabled={pending} /></label>

        <fieldset className="od-tpl__fieldset">
          <legend>Buttons</legend>
          <div className="od-tpl__button-stack">{buttons.map((button, index) => <div className="od-tpl__button-card" key={index}>
            <div className="od-tpl__grid">
              <label className="od-tpl__field"><span>Button {index + 1} type</span><select value={button.type} onChange={(event) => updateButton(index, { type: event.currentTarget.value })} disabled={pending}>{WHATSAPP_TEMPLATE_BUTTON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className="od-tpl__field"><span>Button text</span><input maxLength={25} value={button.text} onChange={(event) => updateButton(index, { text: event.currentTarget.value })} disabled={pending} /></label>
            </div>
            {button.type === "URL" ? <label className="od-tpl__field"><span>Static HTTPS URL</span><input value={button.url ?? ""} onChange={(event) => updateButton(index, { url: event.currentTarget.value })} placeholder="https://onedecore.in/" disabled={pending} /></label> : null}
            {button.type === "PHONE_NUMBER" ? <label className="od-tpl__field"><span>Phone number · E.164</span><input value={button.phoneNumber ?? ""} onChange={(event) => updateButton(index, { phoneNumber: event.currentTarget.value })} placeholder="+919876543210" disabled={pending} /></label> : null}
            {button.type === "FLOW" ? <div className="od-tpl__grid"><label className="od-tpl__field"><span>Flow ID</span><input maxLength={128} value={button.flowId ?? ""} onChange={(event) => updateButton(index, { flowId: event.currentTarget.value })} disabled={pending} /></label><label className="od-tpl__field"><span>Destination screen</span><input maxLength={128} value={button.navigateScreen ?? ""} onChange={(event) => updateButton(index, { navigateScreen: event.currentTarget.value })} disabled={pending} /></label></div> : null}
            <button type="button" className="od-tpl__btn od-tpl__btn--quiet" onClick={() => setButtons((current) => current.filter((_, position) => position !== index))} disabled={pending}>Remove button</button>
          </div>)}</div>
          <button type="button" className="od-tpl__btn od-tpl__btn--quiet" onClick={() => setButtons((current) => current.length >= 10 ? current : [...current, newButton()])} disabled={pending || buttons.length >= 10}>Add button</button>
          <p className="od-tpl__hint">Quick reply, static URL, phone and Flow buttons can be prepared locally. Final provider acceptance remains Meta’s decision.</p>
        </fieldset>

        <div className="od-tpl__workflow-actions">
          <button type="submit" name="studioOperation" value="save" className="od-tpl__btn od-tpl__btn--primary" disabled={pending}>{savePending ? "Saving…" : "Save ONEDECORE Draft"}</button>
          <button type="submit" name="studioOperation" value="review" className="od-tpl__btn" disabled={pending}>{savePending ? "Saving…" : "Mark Locally Reviewed"}</button>
          <button type="submit" name="studioOperation" value="provider_submit" className="od-tpl__btn" disabled={!available || pending} title={available ? "Submit this exact component shape to the configured provider." : "Provider submission is disabled. Save or review locally instead."}>{submitPending ? "Submitting…" : "Submit to Meta for review"}</button>
        </div>
        <p className="od-tpl__hint">Local review is an internal ONEDECORE workflow state only. It never means Meta approved, never makes a template sendable, and never creates marketing consent.</p>
        {fieldError ? <p className="od-tpl__msg od-tpl__msg--err" role="alert">{fieldError}</p> : null}
        {saveState.success ? <ActionMessage success message={saveState.message} /> : null}
        {submitState.success ? <ActionMessage success message={submitState.message} /> : null}
      </form>

      <aside className="od-growth__preview-sticky" aria-label="Template preview">
        <div className="od-growth__phone"><div className="od-growth__phone-bar">ONEDECORE</div><div className="od-growth__bubble">
          {headerType === "TEXT" && headerText ? <div className="od-growth__bubble-header">{headerText}</div> : headerType !== "NONE" ? <div className="od-growth__bubble-header od-tpl__media-preview">{describeHeader(headerType)}</div> : null}
          <div>{previewBody}</div>
          {footerText ? <div className="od-growth__bubble-footer">{footerText}</div> : null}
          {buttons.length > 0 ? <div className="od-tpl__preview-buttons">{buttons.map((button, index) => <span key={index}>{button.text || `Button ${index + 1}`}</span>)}</div> : null}
        </div></div>
        <p className="od-tpl__hint" style={{ marginTop: 10 }}>Live preview is illustrative. Meta remains the source of truth for approved rendering, category and provider status.</p>
      </aside>
    </div>
  );
}