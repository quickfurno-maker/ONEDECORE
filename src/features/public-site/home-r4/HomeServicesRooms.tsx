"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  PM_ROOM_CATEGORIES,
  PM_ROOMS_COPY,
  PM_SECTION_IDS,
  PM_SERVICES,
  PM_SERVICES_COPY,
  type PmRoomId,
  type PmServiceId,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { useRovingTabs } from "./useRovingTabs";

/** Combined services selector and compact room explorer in one major section. */
export function HomeServicesRooms() {
  const baseId = useId();
  const panelId = `${baseId}-rooms-panel`;
  const { setService, openPlanner, addAreaToPlanAndOpen } = usePlan();
  const [activeService, setActiveService] = useState(PM_SERVICES[0]!.id);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRoom = PM_ROOM_CATEGORIES[activeRoomIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_ROOM_CATEGORIES.length,
    activeRoomIndex,
    setActiveRoomIndex
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startService = (id: string) => {
    setService(id as PmServiceId);
    openPlanner(2);
  };

  const addArea = () => {
    const service =
      activeRoom.id === "kitchen" || activeRoom.id === "bedroom-storage"
        ? (activeRoom.serviceId as PmServiceId)
        : undefined;
    addAreaToPlanAndOpen({
      service,
      rooms: activeRoom.rooms as readonly PmRoomId[],
    });
    setConfirmId(activeRoom.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setConfirmId((current) => (current === activeRoom.id ? null : current));
      timerRef.current = null;
    }, 2400);
  };

  return (
    <section
      id={PM_SECTION_IDS.services}
      className="pm-section pm-services pm-services-rooms"
      aria-labelledby="pm-services-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_SERVICES_COPY.eyebrow}</p>
          <h2 id="pm-services-title" className="pm-h2">
            {PM_SERVICES_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_SERVICES_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-services__layout" order={1}>
          <div className="pm-services__media" aria-hidden="true">
            {PM_SERVICES.map((service) => (
              <figure
                key={service.id}
                className="pm-services__frame"
                data-active={activeService === service.id ? "" : undefined}
              >
                <Image
                  src={service.asset.path}
                  alt=""
                  width={service.asset.width}
                  height={service.asset.height}
                  loading="lazy"
                  sizes="(max-width: 1023px) 100vw, 52vw"
                  style={{ objectPosition: service.asset.focalPoint }}
                />
              </figure>
            ))}
            <span className="pm-services__mediaEdge" />
          </div>

          <ul className="pm-services__list">
            {PM_SERVICES.map((service, index) => {
              const isActive = activeService === service.id;
              return (
                <li
                  key={service.id}
                  className="pm-service"
                  data-active={isActive ? "" : undefined}
                  style={{ "--pm-line": index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="pm-service__trigger"
                    aria-expanded={isActive}
                    onClick={() => setActiveService(service.id)}
                    onMouseEnter={() => setActiveService(service.id)}
                    onFocus={() => setActiveService(service.id)}
                  >
                    <span className="pm-service__top">
                      <span className="pm-ordinal">{service.ordinal}</span>
                      <span className="pm-service__title">{service.title}</span>
                    </span>
                  </button>

                  <div
                    className="pm-service__detail"
                    hidden={!isActive}
                    data-active={isActive ? "" : undefined}
                  >
                      <figure className="pm-service__mobileMedia">
                        <Image
                          src={service.asset.path}
                          alt={service.asset.alt}
                          width={service.asset.width}
                          height={service.asset.height}
                          loading="lazy"
                          sizes="100vw"
                          style={{
                            objectPosition: service.asset.mobileFocalPoint,
                          }}
                        />
                      </figure>

                      <p className="pm-service__value">{service.value}</p>

                      <div className="pm-service__includes">
                        <p className="pm-service__includesLabel">Includes</p>
                        <ul>
                          {service.includes.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        className="dc-btn dc-btn--primary pm-service__cta pm-btn--sheen"
                        data-conversion-action="service-start-plan"
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => startService(service.id)}
                      >
                        {service.cta}
                      </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal className="pm-rooms__compact" order={2}>
          <div className="pm-rooms__compactHead">
            <p className="pm-eyebrow">{PM_ROOMS_COPY.eyebrow}</p>
            <h3 className="pm-h3">{PM_ROOMS_COPY.heading}</h3>
            <p className="pm-body">{PM_ROOMS_COPY.lede}</p>
            <p className="pm-rooms__note">{PM_ROOMS_COPY.compactNote}</p>
          </div>

          <div className="pm-rooms__shell">
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
                  aria-selected={index === activeRoomIndex}
                  aria-controls={panelId}
                  tabIndex={index === activeRoomIndex ? 0 : -1}
                  className="pm-rooms__tab"
                  data-active={index === activeRoomIndex ? "" : undefined}
                  onClick={() => activate(index)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowLeft" ||
                      event.key === "Home" ||
                      event.key === "End" ||
                      event.key === "ArrowDown" ||
                      event.key === "ArrowUp"
                    ) {
                      event.stopPropagation();
                      onTabListKeyDown(event);
                    }
                  }}
                >
                  {room.title}
                </button>
              ))}
            </div>

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${activeRoom.id}`}
              className="pm-rooms__panel"
            >
              <figure className="pm-rooms__media">
                <Image
                  src={activeRoom.asset.path}
                  alt={activeRoom.asset.alt}
                  width={activeRoom.asset.width}
                  height={activeRoom.asset.height}
                  loading="lazy"
                  sizes="(max-width: 1023px) 100vw, 42vw"
                  style={{ objectPosition: activeRoom.asset.focalPoint }}
                />
              </figure>
              <div className="pm-rooms__copy">
                <h4 className="pm-h3">{activeRoom.title}</h4>
                <p className="pm-body">
                  <strong>Goal. </strong>
                  {activeRoom.goal}
                </p>
                <ul className="pm-rooms__priorities">
                  {activeRoom.priorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="dc-btn dc-btn--ghost pm-btn--sheen"
                  data-conversion-action="room-add"
                  onClick={addArea}
                >
                  {PM_ROOMS_COPY.addLabel}
                </button>
                <p className="pm-rooms__live" aria-live="polite">
                  {confirmId === activeRoom.id ? PM_ROOMS_COPY.addedLabel : ""}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <noscript>
          <div className="pm-noscript">
            <p>{PM_ROOMS_COPY.compactNote}</p>
            {PM_SERVICES.map((service) => (
              <article key={service.id}>
                <h3>{service.title}</h3>
                <p>{service.value}</p>
                <ul>
                  {service.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
            {PM_ROOM_CATEGORIES.map((room) => (
              <article key={room.id}>
                <h3>{room.title}</h3>
                <p>{room.goal}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
