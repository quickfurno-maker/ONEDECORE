"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms";
import {
  LIBRARY_UPLOAD_CONCURRENCY,
  defaultLibraryAltText,
} from "../domain/portfolio-library";
/*
 * From the pure domain, NOT from the pipeline: that module imports `sharp`, and
 * a client component reaching through it puts a native binary in the browser
 * bundle. The build catches it, but only after the import looks reasonable.
 */
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "../domain/portfolio-media";

/**
 * Bulk room upload: choose the room once, then drop fifty files.
 *
 * WHY A BOUNDED QUEUE AND NOT ONE BIG REQUEST
 *
 * Fifty images in a single multipart body is one request that either works or
 * does not. There is no per-file progress to show, one corrupt file fails the
 * other forty-nine, "retry" means re-uploading everything that already
 * succeeded, and the server holds several hundred megabytes while sharp works
 * through them.
 *
 * So each file is its own request, three at a time. Three saturates a normal
 * domestic uplink while keeping at most three full-resolution buffers in server
 * memory, and it makes every status in the queue below a real fact about one
 * file rather than a share of an aggregate.
 *
 * WHY THE QUEUE SURVIVES FAILURE
 *
 * A batch of twenty can genuinely end as eighteen uploaded, one duplicate and
 * one failed. That is not an error state — it is the answer — and the panel
 * reports it as three counts rather than as a single red message. Retry
 * re-sends only what failed.
 */

type ItemStatus = "queued" | "uploading" | "processing" | "uploaded" | "duplicate" | "failed";

interface QueueItem {
  readonly key: string;
  readonly file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
  previewUrl: string;
}

const STATUS_LABEL: Readonly<Record<ItemStatus, string>> = {
  queued: "Queued",
  uploading: "Uploading",
  processing: "Processing",
  uploaded: "Uploaded",
  duplicate: "Duplicate",
  failed: "Failed",
};

const ACCEPTED = ACCEPTED_UPLOAD_MIME_TYPES.join(",");

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PortfolioLibraryUploader({
  defaultRoom,
  onClose,
}: {
  readonly defaultRoom: PortfolioRoomCode;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<PortfolioRoomCode>(defaultRoom);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /*
   * Object URLs are a manual resource. Without this the panel leaks one blob
   * per file for the lifetime of the page, which on a fifty-image batch is
   * every one of those images still held in memory after they are uploaded.
   */
  useEffect(() => {
    return () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const next: QueueItem[] = [];
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED.split(",").includes(file.type)) {
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          status: "failed",
          progress: 0,
          error: "Only JPEG, PNG and WebP are accepted.",
          previewUrl: "",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          status: "failed",
          progress: 0,
          error: "Larger than the 20 MB limit.",
          previewUrl: "",
        });
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        status: "queued",
        progress: 0,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setItems((current) => [...current, ...next]);
  }, []);

  const update = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }, []);

  /**
   * One file, one request.
   *
   * XMLHttpRequest rather than fetch purely for `upload.onprogress`: fetch still
   * cannot report request-body progress in any shipping browser, and a bulk
   * uploader without per-file progress is a spinner with extra steps.
   */
  const uploadOne = useCallback(
    (item: QueueItem, roomCode: PortfolioRoomCode) =>
      new Promise<void>((resolve) => {
        const body = new FormData();
        body.append("file", item.file);
        body.append("roomCategoryCode", roomCode);
        body.append("altText", defaultLibraryAltText(roomCode));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/portfolio/media/library");

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const pct = Math.round((event.loaded / event.total) * 100);
          /*
           * 100% uploaded is not 100% done: the server still has to sanitise,
           * derive two sizes and write three objects. Saying "Processing"
           * there is the difference between a bar that stalls at the end and
           * one that explains itself.
           */
          update(item.key, {
            status: pct >= 100 ? "processing" : "uploading",
            progress: pct,
          });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            update(item.key, { status: "uploaded", progress: 100 });
            resolve();
            return;
          }
          let code = "";
          let message = "";
          try {
            const parsed = JSON.parse(xhr.responseText) as { code?: string; error?: string };
            code = parsed.code ?? "";
            message = parsed.error ?? "";
          } catch {
            /* A non-JSON body means the request never reached the route. */
          }
          if (xhr.status === 409 || code === "DUPLICATE_IMAGE") {
            update(item.key, {
              status: "duplicate",
              progress: 100,
              error: message || "Already in the library.",
            });
          } else {
            update(item.key, {
              status: "failed",
              progress: 0,
              error: message || `Upload failed (${xhr.status}).`,
            });
          }
          resolve();
        };

        xhr.onerror = () => {
          update(item.key, {
            status: "failed",
            progress: 0,
            error: "Network error. Check your connection and retry.",
          });
          resolve();
        };

        update(item.key, { status: "uploading", progress: 0, error: undefined });
        xhr.send(body);
      }),
    [update]
  );

  /**
   * The bounded worker pool.
   *
   * A shared cursor over the pending list with N workers pulling from it, not
   * N fixed slices: a slice would leave two workers idle while the third
   * finished a 19MB file, and the whole point of the bound is throughput.
   */
  const run = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      setRunning(true);

      const snapshot = new Map(items.map((item) => [item.key, item]));
      const pending = keys
        .map((key) => snapshot.get(key))
        .filter((item): item is QueueItem => Boolean(item));

      let cursor = 0;
      const worker = async () => {
        while (cursor < pending.length) {
          const item = pending[cursor++];
          if (!item) break;
          await uploadOne(item, room);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(LIBRARY_UPLOAD_CONCURRENCY, pending.length) }, worker)
      );

      setRunning(false);
      // Uploads land unpublished, so nothing public changed — but the admin
      // grid behind this panel is now out of date.
      router.refresh();
    },
    [items, room, uploadOne, router]
  );

  const queued = items.filter((item) => item.status === "queued");
  const failed = items.filter((item) => item.status === "failed");
  const uploaded = items.filter((item) => item.status === "uploaded");
  const duplicates = items.filter((item) => item.status === "duplicate");

  return (
    <div className="od-lib-uploader" role="dialog" aria-modal="true" aria-label="Upload images">
      <div className="od-lib-uploader__panel">
        <header className="od-lib-uploader__head">
          <h2>Upload Images</h2>
          <button type="button" onClick={onClose} aria-label="Close upload panel">
            ×
          </button>
        </header>

        <div className="od-lib-uploader__body">
          {/* STEP 1 — the room, chosen once for the whole batch. */}
          <fieldset className="od-lib-uploader__step">
            <legend>Choose Room</legend>
            <div className="od-lib-uploader__rooms">
              {PORTFOLIO_ROOM_CODES.map((code) => (
                <label key={code} className="od-lib-uploader__room">
                  <input
                    type="radio"
                    name="library-room"
                    value={code}
                    checked={room === code}
                    disabled={running}
                    onChange={() => setRoom(code)}
                  />
                  <span>{PORTFOLIO_ROOM_LABELS[code]}</span>
                </label>
              ))}
            </div>
            <p className="od-lib-uploader__hint">
              Every image in this batch is filed under {PORTFOLIO_ROOM_LABELS[room]}. You can move
              images to another room afterwards.
            </p>
          </fieldset>

          {/* STEP 2 — the files. */}
          <div
            className={
              dragging ? "od-lib-uploader__drop od-lib-uploader__drop--over" : "od-lib-uploader__drop"
            }
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <p className="od-lib-uploader__dropTitle">Drop images here</p>
            <p className="od-lib-uploader__dropOr">or</p>
            <button
              type="button"
              className="od-btn-ghost"
              onClick={() => inputRef.current?.click()}
              disabled={running}
            >
              choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="od-visually-hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                // Reset so choosing the same file twice still fires a change.
                event.target.value = "";
              }}
            />
            <p className="od-lib-uploader__hint">JPEG, PNG or WebP. Up to 20 MB each.</p>
          </div>

          {/* STEP 3 — the queue. */}
          {items.length > 0 ? (
            <>
              <div className="od-lib-uploader__summary" role="status">
                <span>{items.length} selected</span>
                {uploaded.length > 0 ? <span>{uploaded.length} uploaded</span> : null}
                {duplicates.length > 0 ? <span>{duplicates.length} duplicate</span> : null}
                {failed.length > 0 ? <span>{failed.length} failed</span> : null}
              </div>

              <ul className="od-lib-uploader__queue">
                {items.map((item) => (
                  <li key={item.key} className="od-lib-uploader__item" data-status={item.status}>
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="od-lib-uploader__thumb" />
                    ) : (
                      <span className="od-lib-uploader__thumb od-lib-uploader__thumb--none" />
                    )}
                    <div className="od-lib-uploader__meta">
                      <p className="od-lib-uploader__name" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="od-lib-uploader__sub">
                        {formatSize(item.file.size)} · {PORTFOLIO_ROOM_LABELS[room]}
                      </p>
                      {item.error ? (
                        <p className="od-lib-uploader__error">{item.error}</p>
                      ) : null}
                      {item.status === "uploading" || item.status === "processing" ? (
                        <progress
                          className="od-lib-uploader__progress"
                          max={100}
                          value={item.progress}
                          aria-label={`${item.file.name} upload progress`}
                        />
                      ) : null}
                    </div>
                    <span className="od-lib-uploader__status">{STATUS_LABEL[item.status]}</span>
                    {item.status === "queued" && !running ? (
                      <button
                        type="button"
                        className="od-lib-uploader__remove"
                        onClick={() => {
                          URL.revokeObjectURL(item.previewUrl);
                          setItems((current) => current.filter((x) => x.key !== item.key));
                        }}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <footer className="od-lib-uploader__foot">
          <button type="button" className="od-btn-ghost" onClick={onClose} disabled={running}>
            Close
          </button>
          {failed.length > 0 && !running ? (
            <>
              <button
                type="button"
                className="od-btn-ghost"
                onClick={() => {
                  for (const item of failed) URL.revokeObjectURL(item.previewUrl);
                  setItems((current) => current.filter((item) => item.status !== "failed"));
                }}
              >
                Remove failed
              </button>
              <button
                type="button"
                className="od-btn-ghost"
                onClick={() => {
                  const keys = failed.map((item) => item.key);
                  // Back to queued first, so the retry is visible immediately.
                  setItems((current) =>
                    current.map((item) =>
                      keys.includes(item.key)
                        ? { ...item, status: "queued" as const, error: undefined, progress: 0 }
                        : item
                    )
                  );
                  void run(keys);
                }}
              >
                Retry failed
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="od-btn-primary"
            disabled={running || queued.length === 0}
            onClick={() => void run(queued.map((item) => item.key))}
          >
            {running
              ? "Uploading…"
              : `Upload ${queued.length} ${queued.length === 1 ? "image" : "images"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
