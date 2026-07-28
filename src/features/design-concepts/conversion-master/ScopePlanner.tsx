"use client";

import { useMemo } from "react";
import {
  CM_PLANNER,
  CM_SCOPE,
  CM_SECTION_IDS,
  type CmPropertyId,
  type CmRoomId,
  type CmServiceId,
  type CmTimelineId,
} from "./content";
import { useLead } from "./LeadContext";

function labelOf(
  options: readonly { id: string; label: string }[],
  id: string | null
): string | null {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label ?? null;
}

export function ScopePlanner() {
  const lead = useLead();

  const summary = useMemo(() => {
    const service = labelOf(CM_PLANNER.services, lead.service);
    const property = labelOf(CM_PLANNER.properties, lead.property);
    const timeline = labelOf(CM_PLANNER.timelines, lead.timeline);
    const rooms =
      lead.rooms.length > 0
        ? lead.rooms
            .map((id) => labelOf(CM_SCOPE.rooms, id))
            .filter(Boolean)
            .join(", ")
        : null;

    if (!service && !property) return CM_SCOPE.emptySummary;

    const parts = [
      service ? `Service: ${service}` : null,
      property ? `Property: ${property}` : null,
      rooms ? `Rooms / areas: ${rooms}` : null,
      timeline ? `Timeline: ${timeline}` : null,
      lead.locality.trim() ? `Locality: ${lead.locality.trim()}` : null,
    ].filter(Boolean);

    return parts.join(". ") + ".";
  }, [
    lead.service,
    lead.property,
    lead.timeline,
    lead.rooms,
    lead.locality,
  ]);

  const toggleRoom = (id: CmRoomId) => {
    if (lead.rooms.includes(id)) {
      lead.setRooms(lead.rooms.filter((room) => room !== id));
    } else {
      lead.setRooms([...lead.rooms, id]);
    }
  };

  return (
    <section
      id={CM_SECTION_IDS.scope}
      className="cm-section cm-scope"
      aria-labelledby="cm-scope-title"
    >
      <div className="dc-container">
        <div className="cm-section__head">
          <p className="dc-eyebrow">{CM_SCOPE.overline}</p>
          <h2 id="cm-scope-title" className="cm-h2">
            {CM_SCOPE.heading}
          </h2>
          <p className="dc-lede">{CM_SCOPE.introduction}</p>
        </div>

        <div className="cm-scope__grid">
          <form
            className="cm-scope__form"
            onSubmit={(event) => {
              event.preventDefault();
              lead.openPlanner();
            }}
          >
            <fieldset className="cm-fieldset">
              <legend className="cm-legend">Service</legend>
              <div className="cm-options">
                {CM_PLANNER.services.map((option) => (
                  <label
                    key={option.id}
                    className="cm-option"
                    data-selected={lead.service === option.id ? "" : undefined}
                  >
                    <input
                      type="radio"
                      name="scope-service"
                      checked={lead.service === option.id}
                      onChange={() => lead.setService(option.id as CmServiceId)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="cm-fieldset">
              <legend className="cm-legend">Property type</legend>
              <div className="cm-options">
                {CM_PLANNER.properties.map((option) => (
                  <label
                    key={option.id}
                    className="cm-option"
                    data-selected={lead.property === option.id ? "" : undefined}
                  >
                    <input
                      type="radio"
                      name="scope-property"
                      checked={lead.property === option.id}
                      onChange={() =>
                        lead.setProperty(option.id as CmPropertyId)
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="cm-fieldset">
              <legend className="cm-legend">{CM_SCOPE.roomsLegend}</legend>
              <div className="cm-options cm-options--multi">
                {CM_SCOPE.rooms.map((room) => {
                  const selected = lead.rooms.includes(room.id);
                  return (
                    <label
                      key={room.id}
                      className="cm-option"
                      data-selected={selected ? "" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRoom(room.id)}
                      />
                      <span>{room.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="cm-fieldset">
              <legend className="cm-legend">Possession timeline</legend>
              <div className="cm-options">
                {CM_PLANNER.timelines.map((option) => (
                  <label
                    key={option.id}
                    className="cm-option"
                    data-selected={lead.timeline === option.id ? "" : undefined}
                  >
                    <input
                      type="radio"
                      name="scope-timeline"
                      checked={lead.timeline === option.id}
                      onChange={() =>
                        lead.setTimeline(option.id as CmTimelineId)
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="cm-field">
              <label htmlFor="cm-scope-locality">
                {CM_SCOPE.localityLabel}{" "}
                <span className="cm-opt">optional here</span>
              </label>
              <input
                id="cm-scope-locality"
                name="locality"
                type="text"
                autoComplete="address-level2"
                value={lead.locality}
                onChange={(event) =>
                  lead.setContact({ locality: event.target.value })
                }
              />
            </div>

            <p className="cm-scope__budgetNote">{CM_SCOPE.budgetNote}</p>

            <button type="submit" className="dc-btn dc-btn--primary">
              {CM_SCOPE.continueLabel}
            </button>
          </form>

          <aside className="cm-scope__summary" aria-live="polite">
            <h3 className="cm-h3">{CM_SCOPE.summaryHeading}</h3>
            <p className="dc-body">{summary}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
