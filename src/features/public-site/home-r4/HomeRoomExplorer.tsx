"use client";

import Image from "next/image";
import { useId, useState } from "react";
import {
  PM_ROOM_CATEGORIES,
  PM_ROOMS_COPY,
  PM_SECTION_IDS,
  type PmRoomId,
  type PmServiceId,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

export function HomeRoomExplorer() {
  const baseId = useId();
  const { addRoom, setService, openPlanner, getNextIncompleteStep } = usePlan();
  const [activeId, setActiveId] = useState<(typeof PM_ROOM_CATEGORIES)[number]["id"]>(
    PM_ROOM_CATEGORIES[0]!.id
  );
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const active =
    PM_ROOM_CATEGORIES.find((room) => room.id === activeId) ??
    PM_ROOM_CATEGORIES[0]!;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = PM_ROOM_CATEGORIES.findIndex((room) => room.id === activeId);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = PM_ROOM_CATEGORIES[(index + 1) % PM_ROOM_CATEGORIES.length]!;
      setActiveId(next.id);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        PM_ROOM_CATEGORIES[
          (index - 1 + PM_ROOM_CATEGORIES.length) % PM_ROOM_CATEGORIES.length
        ]!;
      setActiveId(next.id);
    }
  };

  const addArea = () => {
    if (active.id === "kitchen" || active.id === "bedroom-storage") {
      setService(active.serviceId as PmServiceId);
    }
    for (const room of active.rooms) {
      addRoom(room as PmRoomId);
    }
    setConfirmId(active.id);
    openPlanner(getNextIncompleteStep());
    window.setTimeout(() => setConfirmId((current) => (current === active.id ? null : current)), 2400);
  };

  return (
    <section
      id={PM_SECTION_IDS.rooms}
      className="pm-section pm-rooms"
      aria-labelledby="pm-rooms-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_ROOMS_COPY.eyebrow}</p>
          <h2 id="pm-rooms-title" className="pm-h2">
            {PM_ROOMS_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_ROOMS_COPY.lede}</p>
          <p className="pm-rooms__note">{PM_ROOMS_COPY.inspirationNote}</p>
        </Reveal>

        <Reveal className="pm-rooms__shell" order={1}>
          <div
            className="pm-rooms__tabs"
            role="tablist"
            aria-label="Room categories"
            onKeyDown={onKeyDown}
          >
            {PM_ROOM_CATEGORIES.map((room) => (
              <button
                key={room.id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${room.id}`}
                aria-selected={room.id === active.id}
                aria-controls={`${baseId}-panel-${room.id}`}
                tabIndex={room.id === active.id ? 0 : -1}
                className="pm-rooms__tab"
                data-active={room.id === active.id ? "" : undefined}
                onClick={() => setActiveId(room.id)}
              >
                {room.title}
              </button>
            ))}
          </div>

          <div
            key={active.id}
            id={`${baseId}-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active.id}`}
            className="pm-rooms__panel"
          >
            <figure className="pm-rooms__media">
              <Image
                src={active.asset.path}
                alt={active.asset.alt}
                width={active.asset.width}
                height={active.asset.height}
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 52vw"
                style={{ objectPosition: active.asset.focalPoint }}
              />
            </figure>
            <div className="pm-rooms__copy">
              <h3 className="pm-h3">{active.title}</h3>
              <p className="pm-body">
                <strong>Goal. </strong>
                {active.goal}
              </p>
              <p className="pm-rooms__priorityLabel">Planning priorities</p>
              <ul className="pm-rooms__priorities">
                {active.priorities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="pm-rooms__service">
                Relevant service: <strong>{active.serviceLabel}</strong>
              </p>
              <button
                type="button"
                className="dc-btn dc-btn--primary pm-btn--sheen"
                onClick={addArea}
              >
                {PM_ROOMS_COPY.addLabel}
              </button>
              <p className="pm-rooms__live" aria-live="polite">
                {confirmId === active.id ? PM_ROOMS_COPY.addedLabel : ""}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
