"use client";

import Image from "next/image";
import {
  ARTWORK_PROVENANCE_NOTE,
  CM_SECTION_IDS,
  CM_SERVICE_MODULES,
  SERVICES_SECTION_COPY,
  type CmServiceId,
} from "./content";
import { useLead } from "./LeadContext";
import { Reveal } from "../shared/Reveal";

export function ServicesSection() {
  const { setService, openPlanner } = useLead();

  return (
    <section
      id={CM_SECTION_IDS.services}
      className="cm-section cm-services"
      aria-labelledby="cm-services-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head">
          <p className="dc-eyebrow">{SERVICES_SECTION_COPY.overline}</p>
          <h2 id="cm-services-title" className="cm-h2">
            {SERVICES_SECTION_COPY.heading}
          </h2>
          <p className="dc-lede">{SERVICES_SECTION_COPY.introduction}</p>
        </Reveal>

        <ul className="cm-services__list">
          {CM_SERVICE_MODULES.map((service, index) => (
            <Reveal as="li" key={service.id} order={index} className="cm-service">
              <div className="cm-service__media">
                <Image
                  src={service.asset.path}
                  alt={service.asset.alt}
                  width={service.asset.width}
                  height={service.asset.height}
                  loading="lazy"
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 38vw"
                  style={{ objectPosition: service.asset.focalPoint }}
                />
              </div>
              <div className="cm-service__body">
                <span className="dc-ordinal">{service.ordinal}</span>
                <h3 className="cm-service__title">{service.title}</h3>
                <p className="cm-service__desc">{service.description}</p>
                <dl className="cm-service__meta">
                  <div>
                    <dt>Includes</dt>
                    <dd>{service.includes}</dd>
                  </div>
                  <div>
                    <dt>For</dt>
                    <dd>{service.forWhom}</dd>
                  </div>
                  <div>
                    <dt>Value</dt>
                    <dd>{service.value}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="dc-btn dc-btn--ghost"
                  onClick={() => {
                    setService(service.id as CmServiceId);
                    openPlanner(1);
                  }}
                >
                  Plan this service
                </button>
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="dc-provenance">{ARTWORK_PROVENANCE_NOTE}</p>
      </div>
    </section>
  );
}
