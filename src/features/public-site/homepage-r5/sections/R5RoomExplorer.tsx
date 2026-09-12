"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { R5_ROOMS, R5_ROOMS_COPY, REFERENCE_IMAGERY_NOTE } from "../content";

/**
 * Room Explorer — a real tablist, not four buttons that swap a div.
 *
 * WHY THE ARIA PATTERN IS WORTH THE CODE
 *
 * This is the one section where a visitor is expected to poke at something, so
 * it has to work for a visitor who is not using a mouse. The APG tab pattern
 * gives that for free once it is implemented honestly: arrow keys move between
 * rooms, Home and End jump to the ends, only the selected tab is in the tab
 * order, and the panel is labelled by the tab that opened it.
 *
 * `useRef` on the tab nodes exists so focus FOLLOWS selection. Without it, an
 * arrow key changes the panel while focus stays behind on the old tab, and the
 * next arrow press does something the user did not predict.
 *
 * WHY THIS IS A CLIENT COMPONENT AND ITS NEIGHBOURS ARE NOT
 *
 * Selection is genuine state. It is also the whole of the state — the copy, the
 * images and the priorities are all props baked at build time, so the island is
 * small and the rest of the homepage stays server-rendered.
 *
 * IT IS A GATEWAY NOW, NOT A CUL-DE-SAC
 *
 * The section used to end where it began: a visitor could read three priorities
 * for a kitchen and had nowhere to go with that. Every room now carries the
 * link to its real gallery, and the rail carries the way to the case studies.
 *
 * "VIEW ALL PROJECTS" IS OUTSIDE THE TABLIST, DELIBERATELY
 *
 * It sits in the same rail and reads as the fourth control, but it is a link to
 * another page — not a fourth room. Putting a link inside `role="tablist"`
 * would make it a child the pattern does not allow, and the arrow keys would
 * either skip it or "select" a tab that navigates away. So the tablist keeps
 * its three tabs and its roving tabindex, and the link is a sibling with its
 * own tab stop: one rail to look at, two correct semantics underneath.
 */
export function R5RoomExplorer() {
  const [activeId, setActiveId] = useState(R5_ROOMS[0]!.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const activeIndex = R5_ROOMS.findIndex((room) => room.id === activeId);
  const room = R5_ROOMS[activeIndex] ?? R5_ROOMS[0]!;

  const select = (index: number) => {
    const next = R5_ROOMS[((index % R5_ROOMS.length) + R5_ROOMS.length) % R5_ROOMS.length]!;
    setActiveId(next.id);
    // Focus follows selection, or the next arrow press moves from the wrong place.
    tabRefs.current[R5_ROOMS.indexOf(next)]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select(index - 1);
        break;
      case "Home":
        event.preventDefault();
        select(0);
        break;
      case "End":
        event.preventDefault();
        select(R5_ROOMS.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <section className="r5-section r5-section--tinted" aria-labelledby="r5-rooms-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_ROOMS_COPY.eyebrow}</p>
          <h2 id="r5-rooms-title" className="r5-heading">
            {R5_ROOMS_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_ROOMS_COPY.supporting}</p>
        </header>

        <div className="r5-rooms-rail">
          <ul className="r5-tabs" role="tablist" aria-label="Choose a room">
            {R5_ROOMS.map((option, index) => {
            const selected = option.id === activeId;
              return (
                <li key={option.id} role="presentation">
                  <button
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${option.id}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel-${option.id}`}
                    /*
                     * Roving tabindex: one stop for the whole group, so Tab
                     * moves PAST the room picker rather than through each room.
                     */
                    tabIndex={selected ? 0 : -1}
                    className="r5-tab"
                    onClick={() => setActiveId(option.id)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <Link
            href={R5_ROOMS_COPY.allProjectsHref}
            className="r5-rooms-rail__all"
            data-conversion-action="rooms-all-projects"
          >
            {R5_ROOMS_COPY.allProjectsLabel}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-${room.id}`}
          aria-labelledby={`${baseId}-tab-${room.id}`}
          className="r5-panel"
          /*
           * Keyed by room so React remounts the subtree on change, which is what
           * restarts the crossfade. Without the key the nodes are reused and the
           * animation only ever plays once.
           */
          key={room.id}
        >
          <div className="r5-fade">
            {room.image ? (
              /*
               * The picture is a shortcut to the gallery, and nothing more.
               *
               * `aria-hidden` with `tabIndex={-1}` because the visible
               * "View <Room> Portfolio" link below already carries the same
               * destination under a real name. Without that, a screen reader
               * would meet the same link twice in a row — once named after the
               * alt text of a reference photograph — and a keyboard user would
               * tab through a duplicate. This is pointer sugar over a link that
               * is announced properly once.
               */
              <Link
                href={room.portfolioHref}
                className="r5-panel__media"
                aria-hidden="true"
                tabIndex={-1}
                data-conversion-action={`rooms-media-${room.id}`}
              >
                <Image
                  src={room.image}
                  alt={room.imageAlt}
                  width={880}
                  height={605}
                  sizes="(min-width: 860px) 55vw, 92vw"
                  loading="lazy"
                  quality={75}
                />
              </Link>
            ) : (
              /*
               * No approved bedroom photograph exists. Borrowing the wardrobe
               * image and captioning it "Bedroom" would be precisely the false
               * representation the provenance model forbids.
               */
              <p className="r5-panel__placeholder">Visual coming soon</p>
            )}
          </div>

          <div className="r5-fade">
            <h3 className="r5-panel__title">{room.title}</h3>
            <ul className="r5-priorities">
              {room.priorities.map((priority) => (
                <li key={priority} className="r5-priority">
                  {priority}
                </li>
              ))}
            </ul>
            {/*
              A text link, not another gold button. This section hands a visitor
              over to the photography; a second full-size CTA here would compete
              with the one pinned to the bottom of the screen, which is the
              action that actually converts.
            */}
            <Link
              href={room.portfolioHref}
              className="r5-panel__portfolio"
              data-conversion-action={`rooms-portfolio-${room.id}`}
            >
              {room.portfolioLabel}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>

        {room.image ? <p className="r5-note">{REFERENCE_IMAGERY_NOTE}</p> : null}
      </div>
    </section>
  );
}
