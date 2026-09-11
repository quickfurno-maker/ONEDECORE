"use client";

import Image from "next/image";
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
                   * Roving tabindex: one stop for the whole group, so Tab moves
                   * PAST the room picker rather than through four items.
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
              <div className="r5-panel__media">
                <Image
                  src={room.image}
                  alt={room.imageAlt}
                  width={880}
                  height={605}
                  sizes="(min-width: 860px) 55vw, 92vw"
                  loading="lazy"
                  quality={75}
                />
              </div>
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
          </div>
        </div>

        {room.image ? <p className="r5-note">{REFERENCE_IMAGERY_NOTE}</p> : null}
      </div>
    </section>
  );
}
