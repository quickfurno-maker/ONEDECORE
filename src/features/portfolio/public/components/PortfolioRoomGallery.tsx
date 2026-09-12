"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_PROJECTS_HREF,
  PORTFOLIO_ROOM_LABELS,
  focalObjectPosition,
  type PortfolioRoomCode,
} from "../portfolio-rooms.ts";
import type { PublicPortfolioRoomPhoto } from "../types.ts";

/**
 * The thumbnail's share of the viewport, matching the grid it sits in.
 *
 * Three columns on a phone, four on a tablet, five on a desktop — so the
 * browser is told 33vw / 25vw / 20vw and downloads a thumbnail-sized
 * derivative. This was 50/33/25vw when the tiles were half a phone wide, and
 * leaving it there would have had every phone fetch an image roughly twice the
 * width it renders at, twelve times over.
 */
const ROOM_THUMBNAIL_SIZES =
  "(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw";

/**
 * A room view: a dense grid of photographs, and nothing else.
 *
 * WHAT THIS IS NOT
 *
 * It is not a grid of project cards. A visitor who picked "Bedroom" wants to
 * look at bedrooms, and the only honest way to show them bedrooms — without
 * splitting one delivered home into fake room-level "projects" — is to show the
 * photographs themselves.
 *
 * THE CLOSED TILE IS THE PHOTOGRAPH, FULL STOP
 *
 * No title, no locality, no room label, no gradient, no call to action. Two
 * reasons, and the second is the load-bearing one.
 *
 * The first is that this is a gallery: a visitor scanning twelve tiles is
 * reading pictures, and a caption strip on each one is furniture between them
 * and the work.
 *
 * The second is that the captions could not be honest. Half of these
 * photographs are room-library uploads with no project at all, so a metadata
 * band could only render on some tiles — and a grid where some pictures carry a
 * name and some do not invites the reading that the unnamed ones are somehow
 * lesser, or still loading. Removing it from every tile makes the two sources
 * indistinguishable, which is what they should be here: they are equally real
 * photographs of equally real work.
 *
 * The project, where there is one, is named in the lightbox. That is the moment
 * a visitor has asked about one specific picture, and it is the right moment to
 * answer.
 *
 * `photo.project === null` remains the discriminator; it now decides only what
 * the opened view offers, never what the grid shows.
 *
 * THE FOCAL POINT DOES THE CROPPING
 *
 * Tiles are square. The owner uploads one original and marks the point of
 * interest; `object-position` honours it, so a subject that sits left of centre
 * survives the crop without anyone re-exporting the file. An unadjusted
 * photograph is 50/50, which is what the browser would have done anyway. The
 * square is a display crop only — the file is untouched and the lightbox shows
 * it at its natural ratio.
 */
export function PortfolioRoomGallery({
  room,
  photos,
}: {
  readonly room: PortfolioRoomCode;
  readonly photos: readonly PublicPortfolioRoomPhoto[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const roomLabel = PORTFOLIO_ROOM_LABELS[room];

  const close = useCallback(() => setOpenIndex(null), []);

  /*
   * Wrap rather than clamp. Reaching the end of a room and being returned to
   * its start is the behaviour of every gallery a visitor has used; a dead
   * arrow at each end is a thing to discover instead.
   */
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null || photos.length === 0
          ? current
          : (current + delta + photos.length) % photos.length
      ),
    [photos.length]
  );

  if (photos.length === 0) {
    return (
      <div className="od-empty" id="portfolio-room-empty-state">
        <h3>{roomLabel} photography is on its way</h3>
        <p>
          Photographs are published here as each completed ONEDECORE home is
          shot and reviewed. In the meantime, the fastest way to see what we
          would do with your {roomLabel.toLowerCase()} is to talk to us about
          it.
        </p>
        {/*
          The projects listing by name. A bare `/portfolio` would now return
          the visitor to Kitchen — for someone standing in an empty Kitchen,
          to the page they are already on.
        */}
        <Link href={PORTFOLIO_PROJECTS_HREF} className="od-btn-ghost">
          View all projects
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul
        className="od-room-gallery"
        data-od-room-gallery={room}
        aria-label={`${roomLabel} photographs`}
      >
        {photos.map((photo, index) => (
          <li key={photo.mediaId} className="od-room-gallery__item">
            <button
              type="button"
              className="od-room-gallery__tile"
              onClick={() => setOpenIndex(index)}
              aria-haspopup="dialog"
            >
              <Image
                src={photo.image.url}
                alt={photo.image.altText}
                width={photo.image.width}
                height={photo.image.height}
                sizes={ROOM_THUMBNAIL_SIZES}
                className="od-room-gallery__image"
                style={{
                  objectPosition: focalObjectPosition(
                    photo.image.focalX,
                    photo.image.focalY
                  ),
                }}
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && photos[openIndex] ? (
        <PortfolioLightbox
          photo={photos[openIndex]!}
          roomLabel={roomLabel}
          position={{ index: openIndex, total: photos.length }}
          onClose={close}
          onStep={photos.length > 1 ? step : undefined}
        />
      ) : null}
    </>
  );
}

/**
 * A minimal lightbox — no dependency, because none is warranted.
 *
 * What a lightbox has to get right is not the animation: it is Escape, a real
 * focus trap, restoring focus to whatever opened it, and not letting the page
 * behind it scroll. That is a few dozen lines against the platform, and a
 * package would be a larger surface for the same behaviour. Previous/Next is
 * two more buttons and two more key cases, which is not a reason to take on a
 * carousel library either.
 *
 * WHY THE FOCUS EFFECT DOES NOT DEPEND ON `onStep`
 *
 * Stepping replaces the photograph inside a lightbox that stays open. If the
 * mount effect re-ran on every step it would re-snapshot `restoreTo` from
 * whatever is focused NOW — the Next button — and closing would then restore
 * focus into a dialog that no longer exists instead of to the tile the visitor
 * opened. The keyboard handler needs the current `onStep`, so it reads it from
 * a ref rather than by re-subscribing.
 */
function PortfolioLightbox({
  photo,
  roomLabel,
  position,
  onClose,
  onStep,
}: {
  readonly photo: PublicPortfolioRoomPhoto;
  readonly roomLabel: string;
  readonly position: { readonly index: number; readonly total: number };
  readonly onClose: () => void;
  readonly onStep?: (delta: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const stepRef = useRef(onStep);

  /*
   * Its own effect, not an assignment during render. Writing a ref while
   * rendering is a side effect in the render phase — it makes the component
   * impure and the React Compiler rejects it. `useRef(onStep)` already seeds
   * the first value, so this only tracks later ones.
   */
  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current
      ?.querySelector<HTMLElement>("button, [href]")
      ?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (!stepRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        stepRef.current(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="od-lightbox" data-od-lightbox="">
      <button
        type="button"
        className="od-lightbox__scrim"
        aria-label="Close image"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="od-lightbox__panel"
        role="dialog"
        aria-modal="true"
        aria-label={
          photo.project ? `${photo.project.title} — ${roomLabel}` : `${roomLabel} photograph`
        }
      >
        <button
          type="button"
          className="od-lightbox__close"
          onClick={onClose}
          aria-label="Close image"
        >
          ×
        </button>

        {/*
          Natural ratio here, not a crop. The tile was square because a grid
          needs one shape; the lightbox is where the photograph is finally shown
          as it was taken.
        */}
        <Image
          src={photo.image.url}
          alt={photo.image.altText}
          width={photo.image.width}
          height={photo.image.height}
          sizes="(max-width: 900px) 92vw, 76vw"
          className="od-lightbox__image"
        />

        {onStep ? (
          <>
            <button
              type="button"
              className="od-lightbox__nav od-lightbox__nav--prev"
              onClick={() => onStep(-1)}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              className="od-lightbox__nav od-lightbox__nav--next"
              onClick={() => onStep(1)}
              aria-label="Next image"
            >
              ›
            </button>
            {/*
              Spoken, not drawn. A visitor can see where they are in the strip;
              somebody on a screen reader is told, and the polite live region
              means each step is announced without interrupting.
            */}
            <p className="od-sr-only" aria-live="polite">
              Image {position.index + 1} of {position.total}
            </p>
          </>
        ) : null}

        <div className="od-lightbox__foot">
          {/*
            The room is always true and always shown. The project title and the
            way through to it exist only when there is a project — a library
            photograph gets the room and its caption, and nothing that implies a
            case study it is not part of.
          */}
          {photo.project ? (
            <p className="od-lightbox__title">{photo.project.title}</p>
          ) : null}
          <p className="od-lightbox__room">{roomLabel}</p>
          {photo.image.caption ? (
            <p className="od-lightbox__caption">{photo.image.caption}</p>
          ) : null}
          {photo.project ? (
            <Link
              href={`/portfolio/${photo.project.slug}`}
              className="od-btn-primary od-lightbox__cta"
            >
              View Full Project
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
