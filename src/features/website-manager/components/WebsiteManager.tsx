"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  MAX_ENABLED_BANNERS,
  BANNER_RECOMMENDED_HEIGHT,
  BANNER_RECOMMENDED_WIDTH,
  describeBannerRatio,
  validateBannerLink,
  type BannerDraft,
  type BannerLinkType,
} from "../banner-model";
import {
  HOMEPAGE_SECTION_REGISTRY,
  getHomepageSection,
  type HomepageSectionKey,
} from "../homepage-registry";
import type { WebsiteDraft, DraftSection } from "../server/website-queries";
import {
  publishWebsiteDraft,
  saveWebsiteDraft,
  uploadBannerImage,
} from "../server/website-actions";
import "./website-manager.css";

/**
 * The Website Manager.
 *
 * DRAFT STATE LIVES HERE, LIVE STATE LIVES IN THE DATABASE
 *
 * Every control in this component edits local state. Nothing reaches the
 * homepage until Publish, and nothing is persisted until Save Draft — which is
 * why dragging a section does not fire a request and why the unsaved-changes
 * marker is meaningful rather than decorative.
 *
 * WHY THERE IS NO DRAG LIBRARY
 *
 * The repository has no drag dependency and this feature is not worth adding
 * one for. Reordering is Move Up / Move Down buttons: they work with a
 * keyboard, they work with a screen reader, they work with a thumb on a 390px
 * phone, and they are the fallback a drag implementation would have needed
 * anyway. A list of sixteen items does not need a drag surface; it needs to be
 * reorderable by someone standing in a site office on their phone.
 */

interface Props {
  readonly draft: WebsiteDraft;
  readonly publicOrigin: string;
}

type Tab = "sections" | "banners";

interface Toast {
  readonly tone: "ok" | "error" | "warn";
  readonly text: string;
}

function bannerPublicUrl(origin: string, path: string | null): string | null {
  if (!path) return null;
  return `${origin}/storage/v1/object/public/website-banners/${path}`;
}

export function WebsiteManager({ draft, publicOrigin }: Props) {
  const [tab, setTab] = useState<Tab>("sections");
  const [sections, setSections] = useState<DraftSection[]>([...draft.sections]);
  const [banners, setBanners] = useState<BannerDraft[]>([...draft.banners]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [pending, startTransition] = useTransition();

  const mark = useCallback(() => setDirty(true), []);

  const enabledCount = banners.filter((b) => b.enabled).length;

  /* ---------------------------------------------------------- sections */

  const moveSection = useCallback(
    (index: number, delta: number) => {
      setSections((current) => {
        const next = [...current];
        const target = index + delta;
        if (target < 0 || target >= next.length) return current;
        // The pins are structural: the hero cannot leave position 0 and the
        // consultation block cannot leave the end. The buttons are hidden for
        // those rows, and this is what makes that true if they are not.
        const moving = next[index]!;
        const displaced = next[target]!;
        if (getHomepageSection(moving.key).pin || getHomepageSection(displaced.key).pin) {
          return current;
        }
        next[index] = displaced;
        next[target] = moving;
        return next;
      });
      mark();
    },
    [mark]
  );

  const toggleSection = useCallback(
    (key: HomepageSectionKey) => {
      setSections((current) =>
        current.map((section) =>
          section.key === key && getHomepageSection(key).canHide
            ? { ...section, visible: !section.visible }
            : section
        )
      );
      mark();
    },
    [mark]
  );

  const restoreDefaults = useCallback(() => {
    setSections(
      [...HOMEPAGE_SECTION_REGISTRY]
        .sort((a, b) => a.defaultOrder - b.defaultOrder)
        .map((entry) => ({ key: entry.key, visible: true }))
    );
    mark();
    // Draft only. It does not publish, which is the whole reason it is safe to
    // offer as a single click.
    setToast({ tone: "warn", text: "Default order restored in the draft. Save or publish to keep it." });
  }, [mark]);

  /* ----------------------------------------------------------- banners */

  const addBanner = useCallback(() => {
    const id = crypto.randomUUID();
    setBanners((current) => [
      ...current,
      {
        bannerId: id,
        internalName: `Banner ${current.length + 1}`,
        image: null,
        mobileImage: null,
        alt: null,
        linkType: "none",
        linkValue: null,
        newTab: false,
        enabled: true,
        order: current.length,
      },
    ]);
    setEditing(id);
    mark();
  }, [mark]);

  const updateBanner = useCallback(
    (id: string, patch: Partial<BannerDraft>) => {
      setBanners((current) =>
        current.map((banner) => (banner.bannerId === id ? { ...banner, ...patch } : banner))
      );
      mark();
    },
    [mark]
  );

  const duplicateBanner = useCallback(
    (id: string) => {
      setBanners((current) => {
        const index = current.findIndex((b) => b.bannerId === id);
        if (index === -1) return current;
        const source = current[index]!;
        const copy: BannerDraft = {
          ...source,
          bannerId: crypto.randomUUID(),
          internalName: `${source.internalName} copy`,
          // A duplicate starts disabled. Copying a live campaign and having two
          // of it appear on the homepage is never what "duplicate" meant.
          enabled: false,
          order: index + 1,
        };
        const next = [...current];
        next.splice(index + 1, 0, copy);
        return next;
      });
      mark();
    },
    [mark]
  );

  const removeBanner = useCallback(
    (id: string) => {
      setBanners((current) => current.filter((b) => b.bannerId !== id));
      if (editing === id) setEditing(null);
      mark();
      // Draft only: the live homepage is untouched until Publish, and the image
      // file is left in storage because a published version still points at it.
      setToast({ tone: "warn", text: "Removed from the draft. The live homepage still shows it until you publish." });
    },
    [editing, mark]
  );

  const moveBanner = useCallback(
    (index: number, delta: number) => {
      setBanners((current) => {
        const target = index + delta;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      });
      mark();
    },
    [mark]
  );

  /* --------------------------------------------------------- persistence */

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await saveWebsiteDraft({
        expectedVersionId: draft.draftVersionId,
        sections: sections.map((s) => ({ key: s.key, visible: s.visible })),
        banners: banners.map((b, index) => ({ ...b, order: index })),
      });
      if (result.success) {
        setDirty(false);
        setToast({ tone: "ok", text: result.message ?? "Draft saved." });
      } else {
        setToast({ tone: "error", text: result.error ?? "Could not save." });
      }
    });
  }, [banners, draft.draftVersionId, sections]);

  const publish = useCallback(() => {
    startTransition(async () => {
      // Save first, always. Publishing what is on screen rather than what was
      // last saved is the only behaviour that matches what the button says.
      const saved = await saveWebsiteDraft({
        expectedVersionId: draft.draftVersionId,
        sections: sections.map((s) => ({ key: s.key, visible: s.visible })),
        banners: banners.map((b, index) => ({ ...b, order: index })),
      });
      if (!saved.success) {
        setToast({ tone: "error", text: saved.error ?? "Could not save before publishing." });
        return;
      }
      const result = await publishWebsiteDraft(draft.draftVersionId);
      setConfirmPublish(false);
      if (result.success) {
        setDirty(false);
        setToast({
          tone: result.warning ? "warn" : "ok",
          text: result.warning ?? result.message ?? "Published.",
        });
      } else {
        setToast({ tone: "error", text: result.error ?? "Could not publish." });
      }
    });
  }, [banners, draft.draftVersionId, sections]);

  /* ------------------------------------------------------------ summary */

  /*
   * The summary answers "what will change on the LIVE site".
   *
   * So it diffs against the PUBLISHED version, not against the draft as it was
   * loaded. Diffing against the loaded draft was the obvious implementation and
   * it was quietly useless: the editor saves, the page reloads, the draft now
   * equals what was loaded, and the dialog cheerfully reports no changes about
   * to go live.
   */
  const summary = useMemo(() => {
    const live = new Map(draft.publishedBanners.map((b) => [b.bannerId, b]));
    const now = new Map(banners.map((b) => [b.bannerId, b]));
    const comparable = (b: BannerDraft) =>
      JSON.stringify({
        internalName: b.internalName,
        image: b.image,
        mobileImage: b.mobileImage,
        alt: b.alt,
        linkType: b.linkType,
        linkValue: b.linkValue,
        newTab: b.newTab,
        enabled: b.enabled,
      });

    const added = banners.filter((b) => !live.has(b.bannerId)).length;
    const removed = draft.publishedBanners.filter((b) => !now.has(b.bannerId)).length;
    const changed = banners.filter((b) => {
      const before = live.get(b.bannerId);
      return before !== undefined && comparable(before) !== comparable(b);
    }).length;

    const liveOrder = draft.publishedSections.map((s) => s.key).join("|");
    const nextOrder = sections.map((s) => s.key).join("|");
    const hidden = sections.filter((s) => !s.visible).length;
    const liveHidden = draft.publishedSections.filter((s) => !s.visible).length;
    const bannerOrderChanged =
      draft.publishedBanners.map((b) => b.bannerId).join("|") !==
      banners.map((b) => b.bannerId).join("|");

    return {
      added,
      removed,
      changed,
      reordered: liveOrder !== nextOrder,
      bannerOrderChanged,
      hidden,
      visibilityChanged: hidden !== liveHidden,
    };
  }, [banners, draft.publishedBanners, draft.publishedSections, sections]);

  const editingBanner = banners.find((b) => b.bannerId === editing) ?? null;

  return (
    <div className="od-wm">
      <header className="od-wm__head">
        <div>
          <h1 className="od-wm__title">Website Manager</h1>
          <p className="od-wm__sub">Control homepage sections and promotional banners.</p>
        </div>
        <div className="od-wm__status">
          <span className={dirty ? "od-wm__chip od-wm__chip--dirty" : "od-wm__chip"}>
            {dirty ? "Unsaved changes" : "Draft saved"}
          </span>
          <span className="od-wm__meta">
            Live: v{draft.publishedVersionNumber ?? "—"}
            {draft.publishedAt
              ? ` · ${new Date(draft.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
            {draft.publishedBy ? ` · by ${draft.publishedBy}` : ""}
          </span>
          <span className="od-wm__meta">Draft: v{draft.draftVersionNumber}</span>
        </div>
        <div className="od-wm__actions">
          <a className="od-wm__btn" href="/admin/website/preview" target="_blank" rel="noopener">
            Preview Homepage
          </a>
          <button type="button" className="od-wm__btn" onClick={save} disabled={pending}>
            {pending ? "Working…" : "Save Draft"}
          </button>
          <button
            type="button"
            className="od-wm__btn od-wm__btn--primary"
            onClick={() => setConfirmPublish(true)}
            disabled={pending}
          >
            Publish Changes
          </button>
        </div>
      </header>

      {toast ? (
        <p className={`od-wm__toast od-wm__toast--${toast.tone}`} role="status">
          {toast.text}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      ) : null}

      <nav className="od-wm__tabs" aria-label="Website Manager sections">
        <button
          type="button"
          className={tab === "sections" ? "od-wm__tab od-wm__tab--on" : "od-wm__tab"}
          aria-current={tab === "sections"}
          onClick={() => setTab("sections")}
        >
          Homepage Sections
        </button>
        <button
          type="button"
          className={tab === "banners" ? "od-wm__tab od-wm__tab--on" : "od-wm__tab"}
          aria-current={tab === "banners"}
          onClick={() => setTab("banners")}
        >
          Banners <span className="od-wm__count">{banners.length}</span>
        </button>
      </nav>

      {tab === "sections" ? (
        <SectionsTab
          sections={sections}
          onMove={moveSection}
          onToggle={toggleSection}
          onRestore={restoreDefaults}
        />
      ) : (
        <BannersTab
          banners={banners}
          enabledCount={enabledCount}
          publicOrigin={publicOrigin}
          onAdd={addBanner}
          onEdit={setEditing}
          onDuplicate={duplicateBanner}
          onRemove={removeBanner}
          onMove={moveBanner}
          onUpdate={updateBanner}
        />
      )}

      {editingBanner ? (
        <BannerEditor
          banner={editingBanner}
          publicOrigin={publicOrigin}
          onClose={() => setEditing(null)}
          onChange={(patch) => updateBanner(editingBanner.bannerId, patch)}
          onRemove={() => removeBanner(editingBanner.bannerId)}
        />
      ) : null}

      {confirmPublish ? (
        <PublishDialog
          summary={summary}
          draft={draft}
          pending={pending}
          onCancel={() => setConfirmPublish(false)}
          onConfirm={publish}
        />
      ) : null}
    </div>
  );
}

/* ========================================================================== */
/* Sections                                                                   */
/* ========================================================================== */

function SectionsTab({
  sections,
  onMove,
  onToggle,
  onRestore,
}: {
  readonly sections: readonly DraftSection[];
  readonly onMove: (index: number, delta: number) => void;
  readonly onToggle: (key: HomepageSectionKey) => void;
  readonly onRestore: () => void;
}) {
  return (
    <section className="od-wm__panel" aria-label="Homepage sections">
      <div className="od-wm__panelHead">
        <p className="od-wm__hint">
          The order here is the order on the homepage. Hidden sections are not sent to
          visitors at all.
        </p>
        <button type="button" className="od-wm__btn od-wm__btn--quiet" onClick={onRestore}>
          Restore Default Order
        </button>
      </div>

      <ol className="od-wm__list">
        {sections.map((section, index) => {
          const meta = getHomepageSection(section.key);
          const pinned = meta.pin !== null;
          return (
            <li key={section.key} className="od-wm__row">
              <span className="od-wm__rowIndex">{index + 1}</span>
              <div className="od-wm__rowMain">
                <span className="od-wm__rowTitle">
                  {meta.label}
                  {pinned ? (
                    <span className="od-wm__badge od-wm__badge--lock">
                      {meta.pin === "first" ? "Always first" : "Always last"}
                    </span>
                  ) : null}
                  <span
                    className={
                      section.visible
                        ? "od-wm__badge od-wm__badge--on"
                        : "od-wm__badge od-wm__badge--off"
                    }
                  >
                    {section.visible ? "Visible" : "Hidden"}
                  </span>
                </span>
                <span className="od-wm__rowDesc">{meta.description}</span>
              </div>
              <div className="od-wm__rowActions">
                <button
                  type="button"
                  className="od-wm__icon"
                  onClick={() => onMove(index, -1)}
                  disabled={pinned || index === 0}
                  aria-label={`Move ${meta.label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="od-wm__icon"
                  onClick={() => onMove(index, 1)}
                  disabled={pinned || index === sections.length - 1}
                  aria-label={`Move ${meta.label} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="od-wm__btn od-wm__btn--quiet"
                  onClick={() => onToggle(section.key)}
                  disabled={!meta.canHide}
                  aria-label={`${section.visible ? "Hide" : "Show"} ${meta.label}`}
                >
                  {section.visible ? "Hide" : "Show"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ========================================================================== */
/* Banners                                                                    */
/* ========================================================================== */

function BannersTab({
  banners,
  enabledCount,
  publicOrigin,
  onAdd,
  onEdit,
  onDuplicate,
  onRemove,
  onMove,
  onUpdate,
}: {
  readonly banners: readonly BannerDraft[];
  readonly enabledCount: number;
  readonly publicOrigin: string;
  readonly onAdd: () => void;
  readonly onEdit: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onMove: (index: number, delta: number) => void;
  readonly onUpdate: (id: string, patch: Partial<BannerDraft>) => void;
}) {
  return (
    <section className="od-wm__panel" aria-label="Promotional banners">
      <div className="od-wm__panelHead">
        <p className="od-wm__hint">
          {enabledCount} of {MAX_ENABLED_BANNERS} enabled. Banners with no image show as an
          empty frame on the homepage.
        </p>
        <button type="button" className="od-wm__btn od-wm__btn--primary" onClick={onAdd}>
          + Add Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="od-wm__empty">
          <p className="od-wm__emptyTitle">No banners yet</p>
          <p className="od-wm__emptyBody">
            The banner rail will not appear on the homepage until you add one.
          </p>
          <button type="button" className="od-wm__btn od-wm__btn--primary" onClick={onAdd}>
            + Add Banner
          </button>
        </div>
      ) : (
        <ol className="od-wm__list">
          {banners.map((banner, index) => {
            const url = bannerPublicUrl(publicOrigin, banner.image);
            return (
              <li key={banner.bannerId} className="od-wm__row od-wm__row--banner">
                <span className="od-wm__rowIndex">{index + 1}</span>
                <span className="od-wm__thumb">
                  {url ? (
                    <Image src={url} alt="" width={40} height={64} unoptimized />
                  ) : (
                    <span className="od-wm__thumbEmpty">No image</span>
                  )}
                </span>
                <div className="od-wm__rowMain">
                  <span className="od-wm__rowTitle">
                    {banner.internalName}
                    <span
                      className={
                        banner.enabled
                          ? "od-wm__badge od-wm__badge--on"
                          : "od-wm__badge od-wm__badge--off"
                      }
                    >
                      {banner.enabled ? "Enabled" : "Hidden"}
                    </span>
                  </span>
                  <span className="od-wm__rowDesc">
                    {describeLink(banner)} · {banner.image ? "Image set" : "No image"}
                  </span>
                </div>
                <div className="od-wm__rowActions">
                  <button
                    type="button"
                    className="od-wm__icon"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${banner.internalName} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="od-wm__icon"
                    onClick={() => onMove(index, 1)}
                    disabled={index === banners.length - 1}
                    aria-label={`Move ${banner.internalName} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="od-wm__btn od-wm__btn--quiet"
                    onClick={() => onUpdate(banner.bannerId, { enabled: !banner.enabled })}
                  >
                    {banner.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="od-wm__btn od-wm__btn--quiet"
                    onClick={() => onEdit(banner.bannerId)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="od-wm__btn od-wm__btn--quiet"
                    onClick={() => onDuplicate(banner.bannerId)}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="od-wm__btn od-wm__btn--danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove "${banner.internalName}" from the draft? The live homepage keeps it until you publish.`
                        )
                      ) {
                        onRemove(banner.bannerId);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function describeLink(banner: BannerDraft): string {
  switch (banner.linkType) {
    case "internal":
      return `Links to ${banner.linkValue}`;
    case "external":
      return `Links out to ${banner.linkValue}${banner.newTab ? " (new tab)" : ""}`;
    case "consultation":
      return "Opens the consultation form";
    default:
      return "Not clickable";
  }
}

/* ========================================================================== */
/* Banner editor                                                              */
/* ========================================================================== */

/**
 * Internal pages worth suggesting.
 *
 * A short hand-written list, not a route crawler. `/interiors` is deliberately
 * absent: production 308s it to `/`, and offering a link that immediately
 * redirects teaches the owner that the tool does not know its own site.
 */
const INTERNAL_SUGGESTIONS = [
  { path: "/", label: "Homepage" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/shop", label: "Shop" },
  { path: "/#contact", label: "Consultation section" },
];

function BannerEditor({
  banner,
  publicOrigin,
  onClose,
  onChange,
  onRemove,
}: {
  readonly banner: BannerDraft;
  readonly publicOrigin: string;
  readonly onClose: () => void;
  readonly onChange: (patch: Partial<BannerDraft>) => void;
  readonly onRemove: () => void;
}) {
  const [uploading, setUploading] = useState<"primary" | "mobile" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ratioNote, setRatioNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mobileRef = useRef<HTMLInputElement | null>(null);

  const linkCheck = validateBannerLink(banner.linkType, banner.linkValue);

  const upload = useCallback(
    async (file: File, slot: "primary" | "mobile") => {
      setUploading(slot);
      setUploadError(null);
      setRatioNote(null);
      const data = new FormData();
      data.set("file", file);
      data.set("bannerId", banner.bannerId);
      const result = await uploadBannerImage(data);
      setUploading(null);
      if (!result.success || !result.path) {
        setUploadError(result.error ?? "Upload failed.");
        return;
      }
      if (result.width && result.height) {
        const advice = describeBannerRatio(result.width, result.height);
        if (advice.offRatio) setRatioNote(advice.message ?? null);
      }
      onChange(slot === "primary" ? { image: result.path } : { mobileImage: result.path });
    },
    [banner.bannerId, onChange]
  );

  const primaryUrl = bannerPublicUrl(publicOrigin, banner.image);
  const mobileUrl = bannerPublicUrl(publicOrigin, banner.mobileImage);

  return (
    <div className="od-wm__drawer" role="dialog" aria-label={`Edit ${banner.internalName}`}>
      <div className="od-wm__drawerHead">
        <h2>Edit banner</h2>
        <button type="button" className="od-wm__icon" onClick={onClose} aria-label="Close editor">
          ×
        </button>
      </div>

      <div className="od-wm__drawerBody">
        <label className="od-wm__field">
          <span className="od-wm__label">Internal name</span>
          <input
            className="od-wm__input"
            value={banner.internalName}
            maxLength={80}
            onChange={(e) => onChange({ internalName: e.target.value })}
          />
          <span className="od-wm__help">Only you see this. It never appears on the website.</span>
        </label>

        <div className="od-wm__field">
          <span className="od-wm__label">Banner image</span>
          <span className="od-wm__help">
            Portrait 5:8 — about {BANNER_RECOMMENDED_WIDTH}×{BANNER_RECOMMENDED_HEIGHT}. JPEG,
            PNG or WebP.
          </span>
          {primaryUrl ? (
            <div className="od-wm__preview">
              <Image src={primaryUrl} alt="" width={100} height={160} unoptimized />
              <div className="od-wm__previewActions">
                <button
                  type="button"
                  className="od-wm__btn od-wm__btn--quiet"
                  onClick={() => fileRef.current?.click()}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="od-wm__btn od-wm__btn--danger"
                  onClick={() => onChange({ image: null, mobileImage: null, alt: null })}
                >
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="od-wm__btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
            >
              {uploading === "primary" ? "Uploading…" : "Upload image"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "primary");
              e.target.value = "";
            }}
          />
          {ratioNote ? <p className="od-wm__warn">{ratioNote}</p> : null}
          {uploadError ? <p className="od-wm__error">{uploadError}</p> : null}
        </div>

        {banner.image ? (
          <div className="od-wm__field">
            <span className="od-wm__label">Mobile image (optional)</span>
            <span className="od-wm__help">
              Leave empty to use the same image on phones.
            </span>
            {mobileUrl ? (
              <div className="od-wm__preview">
                <Image src={mobileUrl} alt="" width={80} height={128} unoptimized />
                <button
                  type="button"
                  className="od-wm__btn od-wm__btn--danger"
                  onClick={() => onChange({ mobileImage: null })}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="od-wm__btn od-wm__btn--quiet"
                onClick={() => mobileRef.current?.click()}
                disabled={uploading !== null}
              >
                {uploading === "mobile" ? "Uploading…" : "Upload mobile image"}
              </button>
            )}
            <input
              ref={mobileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "mobile");
                e.target.value = "";
              }}
            />
          </div>
        ) : null}

        {banner.image ? (
          <label className="od-wm__field">
            <span className="od-wm__label">Alt text</span>
            <input
              className="od-wm__input"
              value={banner.alt ?? ""}
              maxLength={200}
              onChange={(e) => onChange({ alt: e.target.value })}
            />
            <span className="od-wm__help">
              What the banner says, for someone who cannot see it. Required once there is an
              image.
            </span>
            {!banner.alt ? <p className="od-wm__error">Alt text is required.</p> : null}
          </label>
        ) : null}

        <div className="od-wm__field">
          <span className="od-wm__label">When someone taps this banner</span>
          {(
            [
              ["none", "Nothing — it is not clickable"],
              ["internal", "Go to a page on this website"],
              ["external", "Go to another website"],
              ["consultation", "Open the consultation form"],
            ] as ReadonlyArray<[BannerLinkType, string]>
          ).map(([value, label]) => (
            <label key={value} className="od-wm__radio">
              <input
                type="radio"
                name={`link-${banner.bannerId}`}
                checked={banner.linkType === value}
                onChange={() =>
                  onChange({
                    linkType: value,
                    linkValue: value === "internal" || value === "external" ? banner.linkValue : null,
                    newTab: value === "external" ? banner.newTab : false,
                  })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {banner.linkType === "internal" ? (
          <label className="od-wm__field">
            <span className="od-wm__label">Page</span>
            <input
              className="od-wm__input"
              value={banner.linkValue ?? ""}
              placeholder="/portfolio"
              onChange={(e) => onChange({ linkValue: e.target.value })}
            />
            <span className="od-wm__suggestions">
              {INTERNAL_SUGGESTIONS.map((s) => (
                <button
                  key={s.path}
                  type="button"
                  className="od-wm__chipBtn"
                  onClick={() => onChange({ linkValue: s.path })}
                >
                  {s.label}
                </button>
              ))}
            </span>
            {!linkCheck.valid ? <p className="od-wm__error">{linkCheck.error}</p> : null}
          </label>
        ) : null}

        {banner.linkType === "external" ? (
          <>
            <label className="od-wm__field">
              <span className="od-wm__label">Web address</span>
              <input
                className="od-wm__input"
                value={banner.linkValue ?? ""}
                placeholder="https://example.com/offer"
                onChange={(e) => onChange({ linkValue: e.target.value })}
              />
              <span className="od-wm__help">Must start with https://</span>
              {!linkCheck.valid ? <p className="od-wm__error">{linkCheck.error}</p> : null}
            </label>
            <label className="od-wm__check">
              <input
                type="checkbox"
                checked={banner.newTab}
                onChange={(e) => onChange({ newTab: e.target.checked })}
              />
              <span>Open in a new tab</span>
            </label>
          </>
        ) : null}

        <label className="od-wm__check">
          <input
            type="checkbox"
            checked={banner.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span>Show this banner on the homepage</span>
        </label>
      </div>

      <div className="od-wm__drawerFoot">
        <button
          type="button"
          className="od-wm__btn od-wm__btn--danger"
          onClick={() => {
            if (window.confirm(`Remove "${banner.internalName}" from the draft?`)) onRemove();
          }}
        >
          Remove banner
        </button>
        <button type="button" className="od-wm__btn od-wm__btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Publish                                                                    */
/* ========================================================================== */

function PublishDialog({
  summary,
  draft,
  pending,
  onCancel,
  onConfirm,
}: {
  readonly summary: {
    added: number;
    removed: number;
    changed: number;
    reordered: boolean;
    bannerOrderChanged: boolean;
    hidden: number;
    visibilityChanged: boolean;
  };
  readonly draft: WebsiteDraft;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="od-wm__modal" role="dialog" aria-label="Publish changes">
      <div className="od-wm__modalBox">
        <h2>Publish to the live homepage?</h2>
        <ul className="od-wm__summary">
          <li>{summary.reordered ? "Sections reordered" : "Section order unchanged"}</li>
          <li>
            {summary.hidden === 0
              ? "All sections visible"
              : `${summary.hidden} section${summary.hidden === 1 ? "" : "s"} hidden`}
            {summary.visibilityChanged ? " (changed)" : ""}
          </li>
          <li>{summary.added} banner{summary.added === 1 ? "" : "s"} added</li>
          <li>{summary.removed} banner{summary.removed === 1 ? "" : "s"} removed</li>
          <li>{summary.changed} banner{summary.changed === 1 ? "" : "s"} changed</li>
          <li>{summary.bannerOrderChanged ? "Banner order changed" : "Banner order unchanged"}</li>
          <li>
            Draft v{draft.draftVersionNumber} becomes live, replacing v
            {draft.publishedVersionNumber ?? "—"}
          </li>
        </ul>
        <p className="od-wm__hint">
          This goes live immediately. The version you are replacing is kept and nothing is
          deleted.
        </p>
        <div className="od-wm__modalActions">
          <button type="button" className="od-wm__btn" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="od-wm__btn od-wm__btn--primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Publishing…" : "Publish now"}
          </button>
        </div>
      </div>
    </div>
  );
}
