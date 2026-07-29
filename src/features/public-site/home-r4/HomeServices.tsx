"use client";

import Image from "next/image";
import { useState } from "react";
import {
  PM_SECTION_IDS,
  PM_SERVICES,
  PM_SERVICES_COPY,
  PM_SERVICE_CTA,
  type PmServiceId,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

/**
 * Service selector: desktop list + media panel; mobile progressive disclosure
 * for Includes / Best For (one open at a time).
 */
export function HomeServices() {
  const { setService, openPlanner } = usePlan();
  const [active, setActive] = useState(PM_SERVICES[0]!.id);
  const [detailOpen, setDetailOpen] = useState<string | null>(null);

  const start = (id: string) => {
    setService(id as PmServiceId);
    openPlanner(2);
  };

  return (
    <section
      id={PM_SECTION_IDS.services}
      className="pm-section pm-services"
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
                data-active={active === service.id ? "" : undefined}
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
              const open = detailOpen === service.id;
              return (
                <li
                  key={service.id}
                  className="pm-service"
                  data-active={active === service.id ? "" : undefined}
                  data-detail-open={open ? "" : undefined}
                  style={{ "--pm-line": index } as React.CSSProperties}
                  onMouseEnter={() => setActive(service.id)}
                  onFocus={() => setActive(service.id)}
                >
                  <div className="pm-service__top">
                    <span className="pm-ordinal">{service.ordinal}</span>
                    <h3 className="pm-service__title">{service.title}</h3>
                  </div>

                  <figure className="pm-service__mobileMedia">
                    <Image
                      src={service.asset.path}
                      alt={service.asset.alt}
                      width={service.asset.width}
                      height={service.asset.height}
                      loading="lazy"
                      sizes="100vw"
                      style={{ objectPosition: service.asset.mobileFocalPoint }}
                    />
                  </figure>

                  <p className="pm-service__value">{service.value}</p>

                  <button
                    type="button"
                    className="pm-service__detailToggle"
                    aria-expanded={open}
                    onClick={() =>
                      setDetailOpen((current) =>
                        current === service.id ? null : service.id
                      )
                    }
                  >
                    {open ? "Hide details" : "Includes and best for"}
                  </button>

                  <dl className="pm-service__meta" data-open={open ? "" : undefined}>
                    <div>
                      <dt>Includes</dt>
                      <dd>{service.includes}</dd>
                    </div>
                    <div>
                      <dt>Best for</dt>
                      <dd>{service.bestFor}</dd>
                    </div>
                  </dl>

                  <noscript>
                    <dl className="pm-service__meta pm-service__meta--noscript">
                      <div>
                        <dt>Includes</dt>
                        <dd>{service.includes}</dd>
                      </div>
                      <div>
                        <dt>Best for</dt>
                        <dd>{service.bestFor}</dd>
                      </div>
                    </dl>
                  </noscript>

                  <button
                    type="button"
                    className="dc-btn dc-btn--ghost pm-service__cta"
                    data-conversion-action="service-start-plan"
                    onClick={() => start(service.id)}
                  >
                    {PM_SERVICE_CTA}
                  </button>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
