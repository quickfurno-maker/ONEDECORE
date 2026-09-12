"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPageAction } from "../server/landing-actions.ts";
import {
  DEFAULT_LANDING_TEMPLATE_ID,
  LANDING_TEMPLATES,
  getLandingTemplate,
} from "../domain/landing-templates.ts";
import "./landing-builder.css";

/**
 * Create a campaign page from a template.
 *
 * WHY A TEMPLATE AND NOT THE OLD SEED.
 *
 * Every new page used to be stamped with `buildSampleLandingBlocks()` — the
 * unit-test fixture. That put two Gurgaon project slugs into a Pune business's
 * page, and set the enquiry section's helper text to "Prebuild preview only —
 * submissions are disabled." Both were invisible in an admin that showed the
 * blocks as raw JSON, and both would have published.
 *
 * Templates are the real answer: they are written for campaigns, contain no
 * figures, no testimonials and no project slugs, and each one produces a page
 * that passes the contract unchanged.
 *
 * WHY THE SLUG IS DERIVED BUT NOT LOCKED.
 *
 * The slug is the campaign URL, so it has to be typeable and stable. It is
 * suggested from the title — lowercased, punctuation stripped — because the
 * contract requires lowercase-and-hyphens and an author typing a title with
 * capitals would otherwise fail validation without being told why. They can
 * still override it.
 */

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 81);
}

export function CreateLandingPageForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_LANDING_TEMPLATE_ID);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const template = getLandingTemplate(templateId) ?? LANDING_TEMPLATES[0]!;
  const blocks = template.buildBlocks();
  const effectiveSlug = slugTouched ? slug : toSlug(title);

  return (
    <form
      className="od-lb__panel"
      style={{ padding: 16 }}
      action={async (formData) => {
        const result = await createLandingPageAction(formData);
        setMessage(result.message);
        if (result.success && result.data?.pageId) {
          router.push(`/admin/landing-pages/${result.data.pageId}`);
        }
      }}
    >
      <h2 className="od-lb__panel-title" style={{ marginBlockEnd: 12 }}>
        New campaign page
      </h2>

      <div className="od-lb__field">
        <label className="od-lb__label" htmlFor="lp-template">
          <span>Start from</span>
        </label>
        <select
          id="lp-template"
          className="od-lb__select"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
        >
          {LANDING_TEMPLATES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="od-lb__hint">
          {template.description} You can change everything afterwards.
        </p>
      </div>

      <div className="od-lb__field">
        <label className="od-lb__label" htmlFor="lp-title">
          <span>Page title *</span>
        </label>
        <input
          id="lp-title"
          name="title"
          required
          className="od-lb__input"
          value={title}
          placeholder={template.suggestedTitle}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="od-lb__hint">
          Internal name, and the browser tab title on the live page.
        </p>
      </div>

      <div className="od-lb__field">
        <label className="od-lb__label" htmlFor="lp-slug">
          <span>Web address *</span>
        </label>
        <input
          id="lp-slug"
          name="slug"
          required
          className="od-lb__input"
          value={effectiveSlug}
          placeholder="2bhk-interiors-pune"
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(toSlug(event.target.value));
          }}
        />
        <p className="od-lb__hint">
          onedecore.in/lp/<strong>{effectiveSlug || "your-page"}</strong> — this
          is the link you put in the ad. Lowercase letters, numbers and hyphens.
        </p>
      </div>

      <input type="hidden" name="versionLabel" value="Draft v1" />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <button
        className="od-lb__btn od-lb__btn--primary"
        disabled={title.trim().length === 0 || effectiveSlug.length < 2}
      >
        Create page
      </button>

      {message ? (
        <p className="od-lb__notice" style={{ marginBlockStart: 10 }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
