"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  computePortfolioReadiness,
  readinessSummaryLines,
} from "../domain/portfolio-readiness";
import {
  FOCAL_DEFAULT,
  PORTFOLIO_ASPECT_RATIOS,
  PORTFOLIO_ROOM_LABELS,
  PORTFOLIO_ROOM_SELECT_OPTIONS,
  focalObjectPosition,
  isPortfolioRoomCode,
  normaliseFocalValue,
} from "../public/portfolio-rooms";
import {
  reorderProjectMediaAction,
  setMediaRoomCategoryAction,
  setProjectCoverAction,
  updateMediaDetailsAction,
} from "../server/portfolio-media-actions";

export interface PortfolioMediaItem {
  id: string;
  project_id: string;
  public_object_path: string | null;
  media_role: string;
  status: string;
  alt_text: string;
  caption: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | null;
  sort_order: number;
  room_category_code: string | null;
  focal_x: number;
  focal_y: number;
}

interface PortfolioMediaManagerProps {
  projectId: string;
  isPublished: boolean;
  mediaItems: PortfolioMediaItem[];
}

/**
 * The formats the server can actually decode.
 *
 * Taken from the pipeline's own allowlist, not guessed. HEIC is deliberately
 * ABSENT: `sharp` in this deployment does not decode it, and an iPhone photo
 * shared straight from Photos is very often HEIC — so the owner is told that
 * plainly, up front, rather than discovering it as a failed upload with an
 * opaque message. Pretending to accept it would be worse than refusing it.
 */
const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";
const ACCEPTED_HINT = "JPG, PNG or WebP. HEIC (iPhone) is not supported yet — export as JPEG first.";

type QueueState = "queued" | "uploading" | "done" | "error";

interface QueueEntry {
  readonly key: string;
  readonly file: File;
  readonly previewUrl: string;
  state: QueueState;
  error?: string;
}

export function PortfolioMediaManager({
  projectId,
  isPublished,
  mediaItems,
}: PortfolioMediaManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [altPrefix, setAltPrefix] = useState("");
  const [uploadRoom, setUploadRoom] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[] | null>(null);
  const dragId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publicSupabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

  const readiness = useMemo(
    () => computePortfolioReadiness(mediaItems),
    [mediaItems]
  );

  /*
   * The rendered order is local while a drag is in flight and server-owned
   * otherwise. Holding it only during the drag means a save that fails leaves
   * the grid showing what the database actually holds, rather than an order
   * that exists nowhere.
   */
  const orderedItems = useMemo(() => {
    if (!order) return mediaItems;
    const byId = new Map(mediaItems.map((m) => [m.id, m]));
    const out = order.map((id) => byId.get(id)).filter(Boolean) as PortfolioMediaItem[];
    // Anything the local order does not know about (a fresh upload) goes last.
    for (const item of mediaItems) {
      if (!order.includes(item.id)) out.push(item);
    }
    return out;
  }, [mediaItems, order]);

  const publicUrl = useCallback(
    (path: string | null) =>
      path
        ? `${publicSupabaseUrl}/storage/v1/object/public/portfolio-public/${path}`
        : null,
    [publicSupabaseUrl]
  );

  /* ---------------------------------------------------------------- upload */

  const enqueue = useCallback((files: FileList | File[]) => {
    const entries: QueueEntry[] = [];
    for (const file of Array.from(files)) {
      entries.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        state: "queued",
      });
    }
    setQueue((prev) => [...prev, ...entries]);
  }, []);

  /**
   * Uploads the queue one file at a time.
   *
   * SEQUENTIAL, NOT PARALLEL: each upload decodes, sanitises and re-encodes a
   * 20 MiB image on the server, and firing fifteen of those at once is how a
   * single-process deployment falls over. One at a time also makes the progress
   * honest — the count moving is a file that actually finished.
   *
   * RETRY SKIPS WHAT ALREADY SUCCEEDED. Only `queued` and `error` entries are
   * attempted, so a retry after one failure in fifteen re-sends one file rather
   * than fourteen duplicates the server would then refuse.
   */
  const runQueue = useCallback(async () => {
    const altBase = altPrefix.trim();
    if (!altBase || altBase.length < 3) {
      setError("Describe the photographs first — alt text is required.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setNotice(null);

    let succeeded = 0;
    let failed = 0;

    // Snapshot: the queue is mutated as we go, so iterate a stable list.
    const pending = queue.filter(
      (entry) => entry.state === "queued" || entry.state === "error"
    );

    for (const [index, entry] of pending.entries()) {
      setQueue((prev) =>
        prev.map((q) =>
          q.key === entry.key ? { ...q, state: "uploading", error: undefined } : q
        )
      );

      try {
        const body = new FormData();
        body.append("projectId", projectId);
        // Every upload is a gallery image. The cover is chosen afterwards from
        // the grid, which is the only place the owner can see the options.
        body.append("mediaRole", "gallery");
        body.append(
          "altText",
          pending.length > 1 ? `${altBase} (${index + 1})` : altBase
        );
        if (uploadRoom) body.append("roomCategoryCode", uploadRoom);
        body.append("file", entry.file);

        const res = await fetch("/api/admin/portfolio/media", {
          method: "POST",
          body,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.error) {
          failed += 1;
          const message =
            data.code === "DUPLICATE_IMAGE"
              ? "Already in this project."
              : data.code === "UNSUPPORTED_IMAGE_FORMAT"
                ? "Unsupported format — export as JPEG, PNG or WebP."
                : data.error || `Upload failed (${res.status}).`;
          setQueue((prev) =>
            prev.map((q) =>
              q.key === entry.key ? { ...q, state: "error", error: message } : q
            )
          );
        } else {
          succeeded += 1;
          setQueue((prev) =>
            prev.map((q) =>
              q.key === entry.key ? { ...q, state: "done", error: undefined } : q
            )
          );
        }
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error ? err.message : "Network error during upload.";
        setQueue((prev) =>
          prev.map((q) =>
            q.key === entry.key ? { ...q, state: "error", error: message } : q
          )
        );
      }
    }

    setIsUploading(false);
    setNotice(
      `${succeeded} uploaded${failed > 0 ? `, ${failed} failed — retry re-sends only those` : ""}.`
    );
    router.refresh();
  }, [altPrefix, projectId, queue, router, uploadRoom]);

  const clearFinished = useCallback(() => {
    setQueue((prev) => {
      for (const entry of prev) {
        if (entry.state === "done") URL.revokeObjectURL(entry.previewUrl);
      }
      return prev.filter((entry) => entry.state !== "done");
    });
  }, []);

  /* ------------------------------------------------------------- selection */

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = (
    fn: () => Promise<{ success: boolean; message?: string; error?: string }>
  ) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        setNotice(result.message ?? "Saved.");
        router.refresh();
      } else {
        setError(result.error ?? "Action failed.");
      }
    });
  };

  const bulkTag = (room: string) => {
    const ids = [...selected];
    if (ids.length === 0) {
      setError("Select photographs first.");
      return;
    }
    runAction(async () => {
      const result = await setMediaRoomCategoryAction(
        projectId,
        ids,
        room === "" ? null : room
      );
      if (result.success) setSelected(new Set());
      return result;
    });
  };

  /* ------------------------------------------------------------- reorder */

  const onDrop = (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;

    const current = orderedItems.map((m) => m.id);
    const from = current.indexOf(sourceId);
    const to = current.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    runAction(async () => {
      const result = await reorderProjectMediaAction(projectId, next);
      // The server owns the order again once it has accepted it.
      if (result.success) setOrder(null);
      return result;
    });
  };

  return (
    <section className="mt-8 space-y-6" data-od-media-manager="">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">Project photos</h2>
        <p className="text-xs text-stone-500">{ACCEPTED_HINT}</p>
      </header>

      {/* ------------------------------------------------ readiness status */}
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-[#E5E0DA] bg-[#FAF8F5] px-3 py-2 text-xs text-stone-700"
        data-od-readiness=""
        role="status"
      >
        {readinessSummaryLines(readiness).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      {readiness.blockers.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-stone-600">
          {readiness.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}

      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* ---------------------------------------------------------- upload */}
      <div
        className={`rounded border-2 border-dashed p-4 ${
          dragActive ? "border-[#1A1A1A] bg-[#FAF8F5]" : "border-[#E5E0DA]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files);
        }}
        data-od-dropzone=""
      >
        <p className="text-xs text-stone-600">
          Drag photographs here, or choose files. Several at once is fine.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <input
            ref={fileInputRef}
            id="portfolio-file-input"
            type="file"
            accept={ACCEPTED_MIME}
            multiple
            className="text-xs"
            onChange={(e) => {
              if (e.target.files?.length) enqueue(e.target.files);
              e.target.value = "";
            }}
          />

          <label className="text-xs text-stone-700">
            <span className="block font-semibold">Describe these photos *</span>
            <input
              type="text"
              value={altPrefix}
              onChange={(e) => setAltPrefix(e.target.value)}
              placeholder="e.g. Modular kitchen in walnut and stone"
              className="mt-1 w-72 rounded border border-[#E5E0DA] px-2 py-1"
            />
          </label>

          <label className="text-xs text-stone-700">
            <span className="block font-semibold">Room for this batch</span>
            <select
              value={uploadRoom}
              onChange={(e) => setUploadRoom(e.target.value)}
              className="mt-1 rounded border border-[#E5E0DA] px-2 py-1"
              data-od-upload-room=""
            >
              {PORTFOLIO_ROOM_SELECT_OPTIONS.map((option) => (
                <option key={option.value || "unclassified"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="rounded bg-[#1A1A1A] px-3 py-1.5 text-xs text-white disabled:opacity-50"
            onClick={() => void runQueue()}
            disabled={isUploading || queue.length === 0}
          >
            {isUploading ? "Uploading…" : `Upload ${queue.length || ""}`.trim()}
          </button>

          {queue.some((q) => q.state === "done") && (
            <button
              type="button"
              className="rounded border border-[#E5E0DA] px-3 py-1.5 text-xs"
              onClick={clearFinished}
            >
              Clear finished
            </button>
          )}
        </div>

        {queue.length > 0 && (
          <ul
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
            data-od-upload-queue=""
          >
            {queue.map((entry) => (
              <li key={entry.key} className="text-[11px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob: preview has no loader */}
                <img
                  src={entry.previewUrl}
                  alt=""
                  className="h-24 w-full rounded object-cover"
                />
                <p className="mt-1 truncate" title={entry.file.name}>
                  {entry.file.name}
                </p>
                <p
                  className={
                    entry.state === "error"
                      ? "text-red-600"
                      : entry.state === "done"
                        ? "text-green-700"
                        : "text-stone-500"
                  }
                  data-od-queue-state={entry.state}
                >
                  {entry.state === "error"
                    ? entry.error
                    : entry.state === "done"
                      ? "Uploaded"
                      : entry.state === "uploading"
                        ? "Uploading…"
                        : "Queued"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* -------------------------------------------------- bulk selection */}
      {mediaItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-stone-600">
            {selected.size} selected
          </span>
          <span className="text-stone-400">Set room:</span>
          {PORTFOLIO_ROOM_SELECT_OPTIONS.map((option) => (
            <button
              key={option.value || "unclassified"}
              type="button"
              className="rounded border border-[#E5E0DA] px-2 py-1 disabled:opacity-40"
              disabled={selected.size === 0 || isPending}
              onClick={() => bulkTag(option.value)}
              data-od-bulk-room={option.value || "unclassified"}
            >
              {option.label}
            </button>
          ))}
          {selected.size > 0 && (
            <button
              type="button"
              className="text-stone-500 underline"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ photo grid */}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" data-od-media-grid="">
        {orderedItems.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            projectId={projectId}
            isPublished={isPublished}
            isSelected={selected.has(item.id)}
            isPending={isPending}
            url={publicUrl(item.public_object_path)}
            onToggleSelected={() => toggleSelected(item.id)}
            onDragStart={() => {
              dragId.current = item.id;
            }}
            onDropOn={() => onDrop(item.id)}
            onAction={runAction}
          />
        ))}
      </ul>

      {mediaItems.length === 0 && (
        <p className="text-xs text-stone-500">
          No photographs yet. Everything above stays disabled until there are
          some.
        </p>
      )}
    </section>
  );
}

/* ========================================================================== */
/* One photograph                                                              */
/* ========================================================================== */

function MediaCard({
  item,
  projectId,
  isPublished,
  isSelected,
  isPending,
  url,
  onToggleSelected,
  onDragStart,
  onDropOn,
  onAction,
}: {
  item: PortfolioMediaItem;
  projectId: string;
  isPublished: boolean;
  isSelected: boolean;
  isPending: boolean;
  url: string | null;
  onToggleSelected: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
  onAction: (
    fn: () => Promise<{ success: boolean; message?: string; error?: string }>
  ) => void;
}) {
  const [altText, setAltText] = useState(item.alt_text);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [focalX, setFocalX] = useState(item.focal_x ?? FOCAL_DEFAULT);
  const [focalY, setFocalY] = useState(item.focal_y ?? FOCAL_DEFAULT);
  const [showFocus, setShowFocus] = useState(false);

  const roomLabel = isPortfolioRoomCode(item.room_category_code)
    ? PORTFOLIO_ROOM_LABELS[item.room_category_code]
    : "Unclassified";

  const position = focalObjectPosition(focalX, focalY);

  /** Click the image to say what matters in it. */
  const pickFocus = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFocalX(normaliseFocalValue(((event.clientX - rect.left) / rect.width) * 100));
    setFocalY(normaliseFocalValue(((event.clientY - rect.top) / rect.height) * 100));
  };

  return (
    <li className="rounded border border-[#E5E0DA] p-3" data-od-media-card={item.id}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelected}
          aria-label={`Select ${item.alt_text}`}
          className="mt-1"
        />

        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropOn}
          className="w-28 shrink-0 cursor-grab"
          title="Drag to reorder"
        >
          {url ? (
            <Image
              src={url}
              alt={item.alt_text}
              width={item.width_px ?? 400}
              height={item.height_px ?? 500}
              className="h-32 w-28 rounded object-cover"
              style={{ objectPosition: position }}
            />
          ) : (
            <div className="flex h-32 w-28 items-center justify-center rounded bg-stone-100 text-[11px] text-stone-500">
              {item.status}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <p className="flex flex-wrap gap-x-2 text-stone-600">
            <span data-od-media-status={item.status}>{item.status}</span>
            <span data-od-media-role={item.media_role}>{item.media_role}</span>
            <span data-od-media-room={item.room_category_code ?? "unclassified"}>
              {roomLabel}
            </span>
            <span>#{item.sort_order}</span>
            <span>
              focus {focalX}/{focalY}
            </span>
          </p>

          <label className="block">
            <span className="text-stone-500">Alt text *</span>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="mt-0.5 w-full rounded border border-[#E5E0DA] px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-stone-500">Caption</span>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Optional. Only what is actually known."
              className="mt-0.5 w-full rounded border border-[#E5E0DA] px-2 py-1"
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="rounded bg-[#1A1A1A] px-2 py-1 text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() =>
                onAction(() =>
                  updateMediaDetailsAction(projectId, item.id, {
                    altText,
                    caption: caption || null,
                    focalX,
                    focalY,
                  })
                )
              }
            >
              Save
            </button>

            <button
              type="button"
              className="rounded border border-[#E5E0DA] px-2 py-1"
              onClick={() => setShowFocus((v) => !v)}
              data-od-focus-toggle=""
            >
              {showFocus ? "Hide focus" : "Adjust focus"}
            </button>

            {item.media_role !== "cover" && (
              <button
                type="button"
                className="rounded border border-[#E5E0DA] px-2 py-1 disabled:opacity-40"
                disabled={isPending || item.status !== "ready"}
                title={
                  item.status !== "ready"
                    ? "Only a processed photograph can be the cover"
                    : undefined
                }
                onClick={() =>
                  onAction(() => setProjectCoverAction(projectId, item.id))
                }
                data-od-set-cover=""
              >
                Set as Project Cover
              </button>
            )}
          </div>

          {isPublished && item.media_role === "cover" && (
            <p className="text-stone-500">
              This project is published — return it to draft to replace the
              cover.
            </p>
          )}
        </div>
      </div>

      {/* -------------------------------------------------- focal editor */}
      {showFocus && url && (
        <div className="mt-3 space-y-2" data-od-focus-editor="">
          <p className="text-[11px] text-stone-500">
            Click the picture where the subject is. The three previews are the
            shapes this photograph is actually shown in.
          </p>

          <div
            className="relative w-full max-w-sm cursor-crosshair"
            onClick={pickFocus}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- direct storage URL, no loader needed for the editor */}
            <img src={url} alt="" className="w-full rounded" />
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/60"
              style={{ left: `${focalX}%`, top: `${focalY}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {(
              [
                ["Project card 4:5", PORTFOLIO_ASPECT_RATIOS.card],
                ["Mobile 9:16", PORTFOLIO_ASPECT_RATIOS.mobileFeature],
                ["Hero 16:9", PORTFOLIO_ASPECT_RATIOS.hero],
              ] as const
            ).map(([label, ratio]) => (
              <figure key={label} className="text-[11px] text-stone-600">
                <div
                  className="w-28 overflow-hidden rounded bg-stone-100"
                  style={{ aspectRatio: ratio }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview mirrors the public crop exactly */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: position }}
                  />
                </div>
                <figcaption className="mt-1">{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
