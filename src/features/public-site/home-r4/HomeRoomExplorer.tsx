"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  PM_ROOM_CATEGORIES,
  PM_ROOMS_COPY,
  PM_SECTION_IDS,
  type PmRoomId,
  type PmServiceId,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { useRovingTabs } from "./useRovingTabs";

export function HomeRoomExplorer() {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const { addAreaToPlanAndOpen } = usePlan();
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = PM_ROOM_CATEGORIES[activeIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_ROOM_CATEGORIES.length,
    activeIndex,
    setActiveIndex
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const addArea = () => {
    const service =
      active.id === "kitchen" || active.id === "bedroom-storage"
        ? (active.serviceId as PmServiceId)
        : undefined;
    addAreaToPlanAndOpen({
      service,
      rooms: active.rooms as readonly PmRoomId[],
    });
    setConfirmId(active.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setConfirmId((current) => (current === active.id ? null : current));
      timerRef.current = null;
    }, 2400);
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
            onKeyDown={onTabListKeyDown}
          >
            {PM_ROOM_CATEGORIES.map((room, index) => (
              <button
                key={room.id}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                id={`${baseId}-tab-${room.id}`}
                aria-selected={index === activeIndex}
                aria-controls={panelId}
                tabIndex={index === activeIndex ? 0 : -1}
                className="pm-rooms__tab"
                data-active={index === activeIndex ? "" : undefined}
                onClick={() => activate(index)}
              >
                {room.title}
              </button>
            ))}
          </div>

          <div
            id={panelId}
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
                data-conversion-action="room-add"
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

        <noscript>
          <div className="pm-noscript">
            <p>{PM_ROOMS_COPY.inspirationNote}</p>
            {PM_ROOM_CATEGORIES.map((room) => (
              <article key={room.id}>
                <h3>{room.title}</h3>
                <p>
                  <strong>Goal. </strong>
                  {room.goal}
                </p>
                <ul>
                  {room.priorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>Relevant service: {room.serviceLabel}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
