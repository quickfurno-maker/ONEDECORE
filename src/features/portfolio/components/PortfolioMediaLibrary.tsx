"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
  focalObjectPosition,
  isPortfolioRoomCode,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms";
import type {
  LibraryMediaItem,
  LibraryMediaPage,
} from "../server/portfolio-library-repository";
import {
  deleteLibraryMediaAction,
  reorderLibraryMediaAction,
  setLibraryPublicationAction,
  setLibraryRoomCategoryAction,
  updateLibraryMediaAction,
} from "../server/portfolio-library-actions";
import { PortfolioLibraryUploader } from "./PortfolioLibraryUploader";
import type { LibraryPublicationFilter, LibraryRoomFilter } from "../domain/portfolio-library";
import "./portfolio-media-library.css";

/**
 * The Media Library grid.
 *
 * WHAT IT DELIBERATELY DOES NOT SHOW
 *
 * No project title, locality, client or completion year. A standalone image
 * has none of those, and a column of em-dashes would suggest the data is
 * missing rather than inapplicable. No raw uuids as labels, no bucket paths, no
 * JSON. The owner is managing photographs, not rows.
 *
 * SELECTION IS SCOPED TO WHAT IS ON SCREEN, AND SAYS SO
 *
 * The button is "Select visible", not "Select all". With a page size of 48 and
 * a library of 500, an unqualified "Select all" followed by "Delete" would be
 * the single most destructive misunderstanding available here.
 *
 * REORDER REQUIRES ONE ROOM AND THE WHOLE ROOM
 *
 * Ordering is only meaningful as a total order. The RPC refuses a partial set,
 * so the button only appears once a single room is selected and the server has
 * returned that room complete — see `loadAll` in the repository.
 */

type Mode = "browse" | "reorder";

export function PortfolioMediaLibrary({
  data,
  room,
  publication,
  canReorder,
}: {
  readonly data: LibraryMediaPage;
  readonly room: LibraryRoomFilter;
  readonly publication: LibraryPublicationFilter;
  /** True when one room is selected and the whole room was loaded. */
  readonly canReorder: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryMediaItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>("browse");
  const [order, setOrder] = useState<readonly LibraryMediaItem[]>(data.items);

  const items = mode === "reorder" ? order : data.items;
  const selectedIds = useMemo(() => [...selected], [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runAction = useCallback(
    (action: () => Promise<{ success: boolean; message?: string; error?: string; warning?: string }>) => {
      startTransition(async () => {
        const result = await action();
        setNotice(
          result.success
            ? { kind: "ok", text: result.warning ?? result.message ?? "Saved." }
            : { kind: "error", text: result.error ?? "Something went wrong." }
        );
        if (result.success) {
          setSelected(new Set());
          setConfirmDelete(false);
          router.refresh();
        }
      });
    },
    [router]
  );

  const move = useCallback((index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const roomTabs: readonly { id: LibraryRoomFilter | "unpublished"; label: string; count: number }[] = [
    { id: "all", label: "All", count: data.counts.all },
    ...PORTFOLIO_ROOM_CODES.map((code) => ({
      id: code as LibraryRoomFilter,
      label: PORTFOLIO_ROOM_LABELS[code],
      count: data.counts[code],
    })),
    { id: "unpublished", label: "Unpublished", count: data.counts.unpublished },
  ];

  const hrefFor = (tab: LibraryRoomFilter | "unpublished") =>
    tab === "unpublished"
      ? "/admin/portfolio/media?publication=unpublished"
      : tab === "all"
        ? "/admin/portfolio/media"
        : `/admin/portfolio/media?room=${tab}`;

  const currentTab: LibraryRoomFilter | "unpublished" =
    publication === "unpublished" && room === "all" ? "unpublished" : room;

  return (
    <div className="od-lib">
      <header className="od-lib__head">
        <div>
          <h1 className="od-lib__title">Portfolio Media Library</h1>
          <p className="od-lib__sub">
            Upload and manage room photography without creating a project.
          </p>
        </div>
        <button
          type="button"
          className="od-btn-primary"
          onClick={() => setUploaderOpen(true)}
        >
          + Upload Images
        </button>
      </header>

      <div className="od-lib__filters" role="tablist" aria-label="Filter by room">
        {roomTabs.map((tab) => (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            role="tab"
            aria-selected={currentTab === tab.id}
            className={currentTab === tab.id ? "od-lib__chip od-lib__chip--on" : "od-lib__chip"}
          >
            {tab.label}
            <span className="od-lib__chipCount">{tab.count}</span>
          </Link>
        ))}
      </div>

      {notice ? (
        <p
          className={notice.kind === "ok" ? "od-lib__notice" : "od-lib__notice od-lib__notice--bad"}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="od-lib__empty">
          <h2>No images here yet</h2>
          <p>
            {room === "all"
              ? "Upload room photography to build the public Living Room, Bedroom and Kitchen galleries."
              : `Upload ${PORTFOLIO_ROOM_LABELS[room as PortfolioRoomCode]} photography to fill this gallery.`}
          </p>
        </div>
      ) : (
        <>
          <div className="od-lib__bar">
            {mode === "browse" ? (
              <>
                <button
                  type="button"
                  className="od-lib__link"
                  onClick={() => setSelected(new Set(items.map((item) => item.id)))}
                >
                  Select visible
                </button>
                {selected.size > 0 ? (
                  <button type="button" className="od-lib__link" onClick={() => setSelected(new Set())}>
                    Clear selection
                  </button>
                ) : null}
                <span className="od-lib__count">
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : `${items.length} of ${data.total} shown`}
                </span>

                {canReorder ? (
                  <button
                    type="button"
                    className="od-lib__link"
                    onClick={() => {
                      setOrder(data.items);
                      setSelected(new Set());
                      setMode("reorder");
                    }}
                  >
                    Reorder
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <span className="od-lib__count">
                  Drag order with the arrows, then save. This sets the order visitors see.
                </span>
                <button
                  type="button"
                  className="od-lib__link"
                  onClick={() => {
                    setOrder(data.items);
                    setMode("browse");
                  }}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="od-btn-primary od-lib__save"
                  disabled={pending}
                  onClick={() =>
                    runAction(async () => {
                      const result = await reorderLibraryMediaAction(
                        room as string,
                        order.map((item) => item.id)
                      );
                      if (result.success) setMode("browse");
                      return result;
                    })
                  }
                >
                  Save order
                </button>
              </>
            )}
          </div>

          {mode === "browse" && selected.size > 0 ? (
            <div className="od-lib__actions" role="group" aria-label="Bulk actions">
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction(() => setLibraryPublicationAction(selectedIds, true))}
              >
                Publish
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction(() => setLibraryPublicationAction(selectedIds, false))}
              >
                Unpublish
              </button>
              <label className="od-lib__move">
                Change Category
                <select
                  disabled={pending}
                  defaultValue=""
                  onChange={(event) => {
                    const value = event.target.value;
                    event.target.value = "";
                    if (!isPortfolioRoomCode(value)) return;
                    runAction(() => setLibraryRoomCategoryAction(selectedIds, value));
                  }}
                >
                  <option value="">Move to…</option>
                  {PORTFOLIO_ROOM_CODES.map((code) => (
                    <option key={code} value={code}>
                      {PORTFOLIO_ROOM_LABELS[code]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="od-lib__danger"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </div>
          ) : null}

          <ul className="od-lib__grid">
            {items.map((item, index) => (
              <li key={item.id} className="od-lib__card" data-published={item.published}>
                <div className="od-lib__media">
                  {item.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbUrl}
                      alt={item.altText}
                      loading="lazy"
                      decoding="async"
                      className="od-lib__img"
                      style={{ objectPosition: focalObjectPosition(item.focalX, item.focalY) }}
                    />
                  ) : (
                    <span className="od-lib__imgMissing">Processing</span>
                  )}

                  {mode === "browse" ? (
                    <label className="od-lib__pick">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Select ${item.altText}`}
                      />
                    </label>
                  ) : null}

                  <span className="od-lib__badge">{PORTFOLIO_ROOM_LABELS[item.roomCode]}</span>
                  <span
                    className={
                      item.published ? "od-lib__state od-lib__state--on" : "od-lib__state"
                    }
                  >
                    {item.published ? "Published" : "Unpublished"}
                  </span>
                </div>

                <div className="od-lib__foot">
                  {mode === "reorder" ? (
                    <div className="od-lib__reorder">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || pending}
                        aria-label="Move earlier"
                      >
                        ↑
                      </button>
                      <span>{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1 || pending}
                        aria-label="Move later"
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="od-lib__edit" onClick={() => setEditing(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="od-lib__edit"
                        disabled={pending}
                        onClick={() =>
                          runAction(() =>
                            setLibraryPublicationAction([item.id], !item.published)
                          )
                        }
                      >
                        {item.published ? "Unpublish" : "Publish"}
                      </button>
                      {item.caption ? <span className="od-lib__dot" title="Has caption" /> : null}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {data.hasNextPage || data.page > 1 ? (
            <nav className="od-lib__pager" aria-label="Pages">
              {data.page > 1 ? (
                <Link href={pageHref(room, publication, data.page - 1)}>Previous</Link>
              ) : null}
              <span>
                Page {data.page} · {data.total} images
              </span>
              {data.hasNextPage ? (
                <Link href={pageHref(room, publication, data.page + 1)}>Next</Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}

      {confirmDelete ? (
        <ConfirmDelete
          count={selected.size}
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => runAction(() => deleteLibraryMediaAction(selectedIds))}
        />
      ) : null}

      {editing ? (
        <EditPanel
          item={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(values) =>
            runAction(async () => {
              const result = await updateLibraryMediaAction(editing.id, values);
              if (result.success) setEditing(null);
              return result;
            })
          }
        />
      ) : null}

      {uploaderOpen ? (
        <PortfolioLibraryUploader
          defaultRoom={isPortfolioRoomCode(room) ? room : "kitchen"}
          onClose={() => setUploaderOpen(false)}
        />
      ) : null}
    </div>
  );
}

function pageHref(
  room: LibraryRoomFilter,
  publication: LibraryPublicationFilter,
  page: number
): string {
  const params = new URLSearchParams();
  if (room !== "all") params.set("room", room);
  if (publication !== "all") params.set("publication", publication);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/portfolio/media?${query}` : "/admin/portfolio/media";
}

/**
 * Deletion says what it removes and how many, in words.
 *
 * "Are you sure?" is not a confirmation, it is a speed bump. The number and the
 * consequence are both in the question because this is the one action on the
 * screen that cannot be undone from the screen.
 */
function ConfirmDelete({
  count,
  pending,
  onCancel,
  onConfirm,
}: {
  readonly count: number;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="od-lib-modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
      <div className="od-lib-modal__panel">
        <h2>Delete {count} {count === 1 ? "image" : "images"}?</h2>
        <p>
          This permanently removes portfolio media and stored derivatives. Published images
          disappear from the public room galleries immediately.
        </p>
        <div className="od-lib-modal__actions">
          <button type="button" className="od-btn-ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="od-lib__danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : `Delete ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-image edit: alt text, caption and focal point.
 *
 * The focal control is two range inputs over a live preview rather than a
 * click-target, because a range is keyboard-operable by default and this is the
 * only place the value can be set. The preview crops to 4:5 — the shape the
 * public tile uses — so what the owner adjusts is what a visitor will see.
 */
function EditPanel({
  item,
  pending,
  onClose,
  onSave,
}: {
  readonly item: LibraryMediaItem;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onSave: (values: {
    altText: string;
    caption: string | null;
    focalX: number;
    focalY: number;
  }) => void;
}) {
  const [altText, setAltText] = useState(item.altText);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [focalX, setFocalX] = useState(item.focalX);
  const [focalY, setFocalY] = useState(item.focalY);

  return (
    <div className="od-lib-modal" role="dialog" aria-modal="true" aria-label="Edit image">
      <div className="od-lib-modal__panel od-lib-modal__panel--wide">
        <h2>Edit image</h2>

        <div className="od-lib-edit">
          <div className="od-lib-edit__preview">
            {item.fullUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.fullUrl}
                alt={altText}
                style={{ objectPosition: focalObjectPosition(focalX, focalY) }}
              />
            ) : null}
            <p className="od-lib-edit__hint">Preview uses the public 4:5 crop.</p>
          </div>

          <div className="od-lib-edit__fields">
            <label>
              Alt text
              <textarea
                value={altText}
                rows={3}
                maxLength={180}
                onChange={(event) => setAltText(event.target.value)}
              />
              <small>{altText.trim().length}/180 — describe what the photograph shows.</small>
            </label>

            <label>
              Caption <span className="od-lib-edit__optional">optional</span>
              <input
                type="text"
                value={caption}
                maxLength={500}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>

            <label>
              Focal point — horizontal {focalX}%
              <input
                type="range"
                min={0}
                max={100}
                value={focalX}
                onChange={(event) => setFocalX(Number(event.target.value))}
              />
            </label>

            <label>
              Focal point — vertical {focalY}%
              <input
                type="range"
                min={0}
                max={100}
                value={focalY}
                onChange={(event) => setFocalY(Number(event.target.value))}
              />
            </label>

            <button
              type="button"
              className="od-lib__link"
              onClick={() => {
                setFocalX(50);
                setFocalY(50);
              }}
            >
              Reset to centre
            </button>
          </div>
        </div>

        <div className="od-lib-modal__actions">
          <button type="button" className="od-btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="od-btn-primary"
            disabled={pending || altText.trim().length < 5}
            onClick={() =>
              onSave({
                altText,
                caption: caption.trim().length > 0 ? caption.trim() : null,
                focalX,
                focalY,
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
