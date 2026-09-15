/**
 * WM-2 — WhatsApp template components: variables, preview, send support and
 * Studio drafts. Pure and migration-independent, safe in the browser.
 *
 * THE DATABASE IS THE AUTHORITY.
 *
 * Every rule here has a twin in
 * `20260913140000_whatsapp_template_studio_utility_send.sql`:
 *
 *   extractWhatsappTemplateVariables     private.whatsapp_template_variable_keys
 *   whatsappTemplateStaffSendProblem     private.whatsapp_template_staff_send_problem
 *   whatsappTemplateParametersProblem    private.whatsapp_template_parameters_problem
 *   renderWhatsappTemplatePreview        private.whatsapp_render_template_preview
 *
 * The TypeScript copies exist so the composer can explain a problem before a
 * round trip. They never decide anything: a send the UI would allow is still
 * refused by the RPC if the database disagrees, and the WM-2 suite compares the
 * two on the same fixtures.
 *
 * NO TEXT SUBSTITUTION REACHES META.
 *
 * `renderWhatsappTemplatePreview` produces what staff read in the thread and in
 * the picker. The provider payload is `type: "template"` with parameters, built
 * in SQL by `private.whatsapp_build_template_send_components`.
 */

export const WHATSAPP_TEMPLATE_HEADER_VARIABLE_MAX_LENGTH = 60;
export const WHATSAPP_TEMPLATE_BODY_VARIABLE_MAX_LENGTH = 1024;
export const WHATSAPP_TEMPLATE_PARAMETERS_MAX_BYTES = 4096;

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]{1,64})\s*\}\}/g;

export type WhatsappTemplateVariableComponent = "header" | "body";

export interface WhatsappTemplateVariable {
  readonly component: WhatsappTemplateVariableComponent;
  readonly key: string;
  readonly maxLength: number;
}

/** `{ header: { "1": "Asha" }, body: { "1": "Asha", "2": "Monday" } }` */
export type WhatsappTemplateParameters = {
  readonly header?: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, string>>;
};

type ComponentRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ComponentRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function componentList(components: unknown): readonly ComponentRecord[] {
  return Array.isArray(components) ? components.filter(isRecord) : [];
}

function upper(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function isTextHeader(component: ComponentRecord): boolean {
  return upper(component.type) === "HEADER" && (component.format == null || upper(component.format) === "TEXT");
}

function placeholderKeys(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    const key = match[1]!;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Header variables first, then body, each in first-appearance order. */
export function extractWhatsappTemplateVariables(components: unknown): readonly WhatsappTemplateVariable[] {
  const header: WhatsappTemplateVariable[] = [];
  const body: WhatsappTemplateVariable[] = [];
  for (const component of componentList(components)) {
    if (typeof component.text !== "string") continue;
    if (isTextHeader(component)) {
      for (const key of placeholderKeys(component.text)) {
        if (!header.some((v) => v.key === key)) {
          header.push({ component: "header", key, maxLength: WHATSAPP_TEMPLATE_HEADER_VARIABLE_MAX_LENGTH });
        }
      }
    } else if (upper(component.type) === "BODY") {
      for (const key of placeholderKeys(component.text)) {
        if (!body.some((v) => v.key === key)) {
          body.push({ component: "body", key, maxLength: WHATSAPP_TEMPLATE_BODY_VARIABLE_MAX_LENGTH });
        }
      }
    }
  }
  return [...header, ...body];
}

export type WhatsappTemplateStaffSendProblem =
  | "components_invalid"
  | "body_missing"
  | "header_media_unsupported"
  | "footer_variables_unsupported"
  | "button_parameters_unsupported"
  | "component_unsupported"
  | "parameter_format_mismatch"
  | "parameter_positions_not_sequential"
  | "header_variables_unsupported";

/**
 * Why staff cannot send this template one-to-one in WM-2, or null when they
 * can. Only text variables in a TEXT header and the body are supported; media
 * headers and parameterised buttons fail closed.
 */
export function whatsappTemplateStaffSendProblem(
  components: unknown,
  parameterFormat: string | null | undefined
): WhatsappTemplateStaffSendProblem | null {
  if (!Array.isArray(components)) return "components_invalid";
  let bodyCount = 0;

  for (const component of components) {
    if (!isRecord(component)) return "components_invalid";
    const type = upper(component.type);
    if (type === "BODY") {
      if (typeof component.text !== "string" || component.text === "") return "body_missing";
      bodyCount += 1;
    } else if (type === "HEADER") {
      if (component.format != null && upper(component.format) !== "TEXT") return "header_media_unsupported";
    } else if (type === "FOOTER") {
      if (typeof component.text === "string" && component.text.includes("{{")) return "footer_variables_unsupported";
    } else if (type === "BUTTONS") {
      if (!Array.isArray(component.buttons)) return "components_invalid";
      for (const button of component.buttons) {
        const buttonType = isRecord(button) ? upper(button.type) : "";
        if (!["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(buttonType)) return "button_parameters_unsupported";
        if (buttonType === "URL" && isRecord(button) && typeof button.url === "string" && button.url.includes("{{")) {
          return "button_parameters_unsupported";
        }
      }
    } else {
      return "component_unsupported";
    }
  }

  if (bodyCount !== 1) return "body_missing";

  const variables = extractWhatsappTemplateVariables(components);
  if (upper(parameterFormat) === "NAMED") {
    if (variables.some((v) => !/^[a-z_][a-z0-9_]*$/.test(v.key))) return "parameter_format_mismatch";
  } else {
    if (variables.some((v) => !/^[1-9][0-9]{0,2}$/.test(v.key))) return "parameter_format_mismatch";
    for (const component of ["header", "body"] as const) {
      const numbers = variables.filter((v) => v.component === component).map((v) => Number(v.key));
      if (numbers.length > 0 && Math.max(...numbers) !== numbers.length) return "parameter_positions_not_sequential";
    }
  }

  if (variables.filter((v) => v.component === "header").length > 1) return "header_variables_unsupported";
  return null;
}

export type WhatsappTemplateParametersProblem =
  | "parameters_not_object"
  | "parameters_too_large"
  | "parameters_unexpected_component"
  | "parameters_component_not_object"
  | "parameters_unexpected_key"
  | "parameters_missing"
  | "parameters_invalid";

/** Fail closed on any missing, blank, over-long, multi-line or unexpected value. */
export function whatsappTemplateParametersProblem(
  components: unknown,
  parameters: unknown
): WhatsappTemplateParametersProblem | null {
  if (!isRecord(parameters)) return "parameters_not_object";
  if (new TextEncoder().encode(JSON.stringify(parameters)).length > WHATSAPP_TEMPLATE_PARAMETERS_MAX_BYTES) {
    return "parameters_too_large";
  }
  if (Object.keys(parameters).some((key) => key !== "header" && key !== "body")) {
    return "parameters_unexpected_component";
  }

  const variables = extractWhatsappTemplateVariables(components);
  for (const component of ["header", "body"] as const) {
    const values = parameters[component];
    if (values === undefined) continue;
    if (!isRecord(values)) return "parameters_component_not_object";
    for (const key of Object.keys(values)) {
      if (!variables.some((v) => v.component === component && v.key === key)) return "parameters_unexpected_key";
    }
  }

  for (const variable of variables) {
    const values = parameters[variable.component];
    const value = isRecord(values) ? values[variable.key] : undefined;
    if (typeof value !== "string" || value.trim().length === 0) return "parameters_missing";
    if (value.length > variable.maxLength || /[\n\t]/.test(value) || / {5,}/.test(value)) {
      return "parameters_invalid";
    }
  }
  return null;
}

/** Single-pass substitution: a value containing "{{2}}" is not substituted again. */
export function renderWhatsappTemplateText(
  text: string,
  values: Readonly<Record<string, string>> | undefined
): string {
  return text.replace(PLACEHOLDER, (token, key: string) => {
    const value = values?.[key];
    return typeof value === "string" ? value : token;
  });
}

export function renderWhatsappTemplatePreview(
  components: unknown,
  parameters: WhatsappTemplateParameters
): string {
  const list = componentList(components);
  const header = list.find(isTextHeader);
  const body = list.find((c) => upper(c.type) === "BODY");
  const footer = list.find((c) => upper(c.type) === "FOOTER");
  return [
    typeof header?.text === "string" ? renderWhatsappTemplateText(header.text, parameters.header) : null,
    typeof body?.text === "string" ? renderWhatsappTemplateText(body.text, parameters.body) : null,
    typeof footer?.text === "string" ? footer.text : null,
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");
}

export interface WhatsappTemplateTextParts {
  readonly header: string | null;
  readonly body: string | null;
  readonly footer: string | null;
  readonly buttons: readonly string[];
}

const PART_MAX = 1100;

function bounded(value: unknown, max = PART_MAX): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Bounded display text for a registry row or the picker. Never the raw JSON. */
export function readWhatsappTemplateTextParts(components: unknown): WhatsappTemplateTextParts {
  const list = componentList(components);
  const header = list.find(isTextHeader);
  const mediaHeader = list.find((c) => upper(c.type) === "HEADER" && !isTextHeader(c));
  const body = list.find((c) => upper(c.type) === "BODY");
  const footer = list.find((c) => upper(c.type) === "FOOTER");
  const buttons = list.find((c) => upper(c.type) === "BUTTONS");
  return {
    header: bounded(header?.text, 80) ?? (mediaHeader ? `[${upper(mediaHeader.format) || "MEDIA"} header]` : null),
    body: bounded(body?.text),
    footer: bounded(footer?.text, 80),
    buttons: Array.isArray(buttons?.buttons)
      ? buttons.buttons
          .filter(isRecord)
          .slice(0, 10)
          .map((b) => bounded(b.text, 40))
          .filter((t): t is string => t !== null)
      : [],
  };
}

/* ------------------------------------------------------------------ Studio */

export const WHATSAPP_TEMPLATE_STUDIO_CATEGORIES = ["UTILITY", "MARKETING"] as const;
export type WhatsappTemplateStudioCategory = (typeof WHATSAPP_TEMPLATE_STUDIO_CATEGORIES)[number];

export const WHATSAPP_TEMPLATE_STUDIO_LANGUAGES = ["en", "en_US", "en_GB", "hi", "mr"] as const;

export interface WhatsappTemplateStudioDraft {
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly headerText: string;
  readonly bodyText: string;
  readonly footerText: string;
  /** Example value per body placeholder, in order: examples[0] is {{1}}. */
  readonly bodyExamples: readonly string[];
  readonly headerExample: string;
}

export interface WhatsappTemplateStudioSubmission {
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateStudioCategory;
  readonly parameterFormat: "POSITIONAL";
  readonly components: readonly Record<string, unknown>[];
}

export type WhatsappTemplateStudioDraftResult =
  | { readonly ok: true; readonly submission: WhatsappTemplateStudioSubmission }
  | { readonly ok: false; readonly field: string; readonly message: string };

/**
 * Turn a Studio form into an official Meta create-template body. POSITIONAL
 * placeholders only, with the examples Meta requires for review. The SQL
 * `whatsapp_template_submission_problem` re-validates the structure.
 */
export function buildWhatsappTemplateStudioSubmission(
  draft: WhatsappTemplateStudioDraft
): WhatsappTemplateStudioDraftResult {
  const fail = (field: string, message: string) => ({ ok: false, field, message }) as const;
  const name = draft.name.trim();
  const language = draft.language.trim();
  const category = draft.category.trim().toUpperCase();
  const headerText = draft.headerText.trim();
  const bodyText = draft.bodyText.trim();
  const footerText = draft.footerText.trim();

  if (!/^[a-z0-9_]{1,128}$/.test(name)) {
    return fail("name", "Use lowercase letters, numbers and underscores only (max 128).");
  }
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)) {
    return fail("language", "Choose a supported language code.");
  }
  if (!(WHATSAPP_TEMPLATE_STUDIO_CATEGORIES as readonly string[]).includes(category)) {
    return fail("category", "Only UTILITY and MARKETING templates can be created here.");
  }
  if (bodyText.length < 1 || bodyText.length > 1024) {
    return fail("bodyText", "Body text is required (max 1024 characters).");
  }
  if (headerText.length > 60) return fail("headerText", "Header text is at most 60 characters.");
  if (footerText.length > 60) return fail("footerText", "Footer text is at most 60 characters.");
  if (footerText.includes("{{")) return fail("footerText", "The footer cannot contain variables.");

  const bodyKeys = placeholderKeys(bodyText);
  const headerKeys = placeholderKeys(headerText);
  for (const [field, keys] of [
    ["bodyText", bodyKeys],
    ["headerText", headerKeys],
  ] as const) {
    if (keys.some((key) => !/^[1-9][0-9]{0,2}$/.test(key))) {
      return fail(field, "Use numbered placeholders such as {{1}}, {{2}}.");
    }
    const numbers = keys.map(Number);
    if (numbers.length > 0 && Math.max(...numbers) !== numbers.length) {
      return fail(field, "Placeholders must be numbered 1, 2, 3… without gaps.");
    }
  }
  if (headerKeys.length > 1) return fail("headerText", "A header can contain at most one variable.");

  const examples = draft.bodyExamples.map((value) => value.trim());
  const orderedBody = [...bodyKeys].sort((a, b) => Number(a) - Number(b));
  if (orderedBody.some((_, index) => !examples[index])) {
    return fail("bodyExamples", "Meta requires an example value for every body variable.");
  }
  if (headerKeys.length === 1 && !draft.headerExample.trim()) {
    return fail("headerExample", "Meta requires an example value for the header variable.");
  }

  const components: Record<string, unknown>[] = [];
  if (headerText) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: headerText,
      ...(headerKeys.length === 1 ? { example: { header_text: [draft.headerExample.trim()] } } : {}),
    });
  }
  components.push({
    type: "BODY",
    text: bodyText,
    ...(orderedBody.length > 0 ? { example: { body_text: [examples.slice(0, orderedBody.length)] } } : {}),
  });
  if (footerText) components.push({ type: "FOOTER", text: footerText });

  return {
    ok: true,
    submission: {
      name,
      language,
      category: category as WhatsappTemplateStudioCategory,
      parameterFormat: "POSITIONAL",
      components,
    },
  };
}

/** Numbered body placeholders in a draft, for rendering one example input each. */
export function countWhatsappTemplateBodyPlaceholders(bodyText: string): number {
  return placeholderKeys(bodyText).length;
}
