"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
  focalObjectPosition,
  type PortfolioRoomCode,
} from "../portfolio-rooms";
import { PublicPortfolioImage } from "../types";

export interface PortfolioGalleryProps {
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
  projectTitle: string;
}

type GalleryFilter = "all" | PortfolioRoomCode;

/**
 * The project gallery, filterable by room.
 *
 * ONLY THE ROOMS THIS PROJECT ACTUALLY HAS
 *
 * The filter row is built from the photographs present, not from the four
 * possible rooms. Offering "Bedroom" on a kitchen-only project gives the
 * visitor a control that leads to an empty result — a dead end they had no way
 * to predict. A project with photographs of one room shows no filters at all,
 * because a single-option filter is not a choice.
 *
 * The cover is always in "All" and is filtered like any other photograph: a
 * cover is usually unclassified, so it usually disappears when a room is
 * selected, which is correct — it represents the home, not a room.
 *
 * NATURAL RATIO HERE
 *
 * The 4:5 crop belongs to cards and grids, where one shape makes a legible
 * layout. This is the place the photographs are finally shown as they were
 * taken, so only the focal point travels — it costs nothing when the image is
 * uncropped and matters if the surrounding CSS ever does crop it.
 */
export function PortfolioGallery({
  cover,
  gallery,
  projectTitle,
}: PortfolioGalleryProps) {
  const allImages = useMemo(() => [cover, ...gallery], [cover, gallery]);

  const availableRooms = useMemo(
    () =>
      PORTFOLIO_ROOM_CODES.filter((room) =>
        allImages.some((img) => img.roomCode === room)
      ),
    [allImages]
  );

  const [filter, setFilter] = useState<GalleryFilter>("all");

  const visible = useMemo(
    () =>
      filter === "all"
        ? allImages
        : allImages.filter((img) => img.roomCode === filter),
    [allImages, filter]
  );

  // One room is not a choice; two or more is.
  const showFilters = availableRooms.length > 1;

  return (
    <section
      id="portfolio-gallery-section"
      aria-label="Project photo gallery"
      className="od-gallery"
    >
      <h2>Project Gallery</h2>

      {showFilters ? (
        <div
          className="od-gallery__filters"
          role="group"
          aria-label="Filter gallery by room"
          data-od-gallery-filters=""
        >
          <button
            type="button"
            className="od-gallery__filter"
            data-active={filter === "all" ? "" : undefined}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {availableRooms.map((room) => (
            <button
              key={room}
              type="button"
              className="od-gallery__filter"
              data-active={filter === room ? "" : undefined}
              data-od-gallery-filter={room}
              aria-pressed={filter === room}
              onClick={() => setFilter(room)}
            >
              {PORTFOLIO_ROOM_LABELS[room]}
            </button>
          ))}
        </div>
      ) : null}

      <div id="portfolio-gallery-grid" className="od-gallery__grid">
        {visible.map((img, index) => (
          <figure
            key={`${img.url}-${index}`}
            id={`portfolio-gallery-item-${index}`}
            className="od-figure"
            data-od-room={img.roomCode ?? undefined}
          >
            <div className="od-figure__media">
              <Image
                src={img.url}
                alt={img.altText || `${projectTitle} photo ${index + 1}`}
                width={img.width}
                height={img.height}
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                style={{
                  objectPosition: focalObjectPosition(img.focalX, img.focalY),
                }}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
            {img.caption ? <figcaption>{img.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
