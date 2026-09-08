"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_ROOM_LABELS,
  focalObjectPosition,
  type PortfolioRoomCode,
} from "../portfolio-rooms.ts";
import type { PublicPortfolioRoomPhoto } from "../types.ts";

/**
 * A room view: real photographs, each still owned by a real project.
 *
 * WHAT THIS IS NOT
 *
 * It is not a grid of project cards. A visitor who picked "Bedroom" wants to
 * look at bedrooms, and the only honest way to show them bedrooms — without
 * splitting one delivered home into fake room-level "projects" — is to show the
 * photographs themselves.
 *
 * EVERY IMAGE STILL LEADS SOMEWHERE
 *
 * A gallery whose images go nowhere is a mood board. Each photograph names its
 * parent project and offers the way through to it, both from the tile and from
 * the lightbox.
 *
 * THE FOCAL POINT DOES THE CROPPING
 *
 * Tiles are 4:5. The owner uploads one original and marks the point of
 * interest; `object-position` honours it, so a subject that sits left of centre
 * survives the crop without anyone re-exporting the file. An unadjusted
 * photograph is 50/50, which is what the browser would have done anyway.
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
        <Link href="/portfolio" className="od-btn-ghost">
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
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="od-room-gallery__image"
                style={{
                  objectPosition: focalObjectPosition(
                    photo.image.focalX,
                    photo.image.focalY
                  ),
                }}
                loading="lazy"
              />
              <span className="od-room-gallery__meta">
                <span className="od-room-gallery__project">
                  {photo.projectTitle}
                </span>
                {photo.projectLocationLabel ? (
                  <span className="od-room-gallery__where">
                    {photo.projectLocationLabel}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && photos[openIndex] ? (
        <PortfolioLightbox
          photo={photos[openIndex]!}
          roomLabel={roomLabel}
          onClose={close}
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
 * package would be a larger surface for the same behaviour.
 */
function PortfolioLightbox({
  photo,
  roomLabel,
  onClose,
}: {
  readonly photo: PublicPortfolioRoomPhoto;
  readonly roomLabel: string;
  readonly onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

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
        aria-label={`${photo.projectTitle} — ${roomLabel}`}
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
          Natural ratio here, not a crop. The tile was 4:5 because a grid needs
          one shape; the lightbox is where the photograph is finally shown as it
          was taken.
        */}
        <Image
          src={photo.image.url}
          alt={photo.image.altText}
          width={photo.image.width}
          height={photo.image.height}
          sizes="(max-width: 900px) 92vw, 76vw"
          className="od-lightbox__image"
        />

        <div className="od-lightbox__foot">
          <p className="od-lightbox__title">{photo.projectTitle}</p>
          <p className="od-lightbox__room">{roomLabel}</p>
          {photo.image.caption ? (
            <p className="od-lightbox__caption">{photo.image.caption}</p>
          ) : null}
          <Link
            href={`/portfolio/${photo.projectSlug}`}
            className="od-btn-primary od-lightbox__cta"
          >
            View Full Project
          </Link>
        </div>
      </div>
    </div>
  );
}
