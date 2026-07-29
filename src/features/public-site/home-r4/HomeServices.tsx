"use client";

import Image from "next/image";
import { useState } from "react";
import {
  PM_SECTION_IDS,
  PM_SERVICES,
  PM_SERVICES_COPY,
  type PmServiceId,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

/**
 * Service selector: a list drives one large crossfading media panel.
 * Hover and focus preview a service; activating one seeds the plan and opens
 * the shared planner at the property step.
 */
export function HomeServices() {
  const { setService, openPlanner } = usePlan();
  const [active, setActive] = useState(PM_SERVICES[0]!.id);

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
            {PM_SERVICES.map((service, index) => (
              <li
                key={service.id}
                className="pm-service"
                data-active={active === service.id ? "" : undefined}
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

                <dl className="pm-service__meta">
                  <div>
                    <dt>Includes</dt>
                    <dd>
                      <ul className="pm-service__includesInline">
                        {service.includes.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="dc-btn dc-btn--ghost pm-service__cta"
                  data-conversion-action="service-start-plan"
                  onClick={() => start(service.id)}
                >
                  {service.cta}
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
