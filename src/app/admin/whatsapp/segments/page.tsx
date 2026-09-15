import type { Metadata } from "next";
import Link from "next/link";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import { SegmentEditorForm } from "@/features/whatsapp/components/control-plane/SegmentEditorForm";
import { isUuid, WHATSAPP_ADMIN_SEGMENTS_PATH } from "@/features/whatsapp/contracts/control-plane";
import { describeWhatsappSegmentRule, ruleGroupToDrafts } from "@/features/whatsapp/contracts/segment-rules";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import {
  getWhatsappSegmentForCurrentUser,
  listWhatsappSegmentsForCurrentUser,
  previewWhatsappSegmentForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-segments-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Segments | ONEDECORE",
};

/**
 * WM-3 Segments. Requires whatsapp.segments.read (Super Admin, Sales Manager);
 * create and edit need whatsapp.segments.manage. A preview is a set of counts
 * computed in SQL, so a segment can be sized without exposing its contacts.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface WhatsappSegmentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappSegmentsPage({ searchParams }: WhatsappSegmentsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.segments.read"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Segments access"
        detail="WhatsApp audience segments are limited to Super Admins and Sales Managers."
      />
    );
  }

  const { permissions } = access;
  const canManage = permissions["whatsapp.segments.manage"];
  const params = await searchParams;
  const selectedRaw = first(params.segment);
  const selectedId = isUuid(selectedRaw) ? selectedRaw : null;
  const creating = canManage && first(params.new) === "1" && !selectedId;
  const justSaved = first(params.saved) === "1";

  const [segments, selected] = await Promise.all([
    listWhatsappSegmentsForCurrentUser(),
    selectedId ? getWhatsappSegmentForCurrentUser(selectedId) : Promise.resolve(null),
  ]);
  const preview = selected?.isActive ? await previewWhatsappSegmentForCurrentUser(selected.id) : null;

  return (
    <ControlPlaneShell
      active="segments"
      title="Segments"
      lede="Saved audiences built from CRM lead fields. A preview counts who matches and how many are actually reachable: active, with an active WhatsApp number and MARKETING consent."
      permissions={permissions}
    >
      <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="whatsapp-segments-list">
          <div className="od-cp__toolbar">
            <h2 id="whatsapp-segments-list" className="od-cp__panel-title" style={{ margin: 0 }}>
              Saved segments · {segments.length}
            </h2>
            {canManage ? (
              <Link className="od-cp__btn od-cp__btn--primary od-cp__btn--quiet" href={`${WHATSAPP_ADMIN_SEGMENTS_PATH}?new=1`}>
                New segment
              </Link>
            ) : null}
          </div>
          {segments.length === 0 ? (
            <p className="od-cp__empty">
              {canManage ? "No segments yet. Create one to size an audience." : "No segments have been created yet."}
            </p>
          ) : (
            <ul className="od-cp__list">
              {segments.map((segment) => (
                <li key={segment.id}>
                  <Link
                    className="od-cp__list-item"
                    href={`${WHATSAPP_ADMIN_SEGMENTS_PATH}?segment=${segment.id}`}
                    aria-current={segment.id === selected?.id ? "true" : undefined}
                  >
                    <span className="od-cp__list-row">
                      <span className="od-cp__name">{segment.name}</span>
                      <span className="od-cp__badge" data-tone={segment.isActive ? "positive" : undefined}>
                        {segment.isActive ? "Active" : "Inactive"}
                      </span>
                    </span>
                    <span className="od-cp__sub">
                      {segment.ruleGroup
                        ? `${segment.ruleGroup.rules.length} rule${segment.ruleGroup.rules.length === 1 ? "" : "s"}`
                        : "Rules not recognised"}{" "}
                      · updated {formatWhen(segment.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="od-cp">
          {creating ? (
            <section className="od-cp__panel" aria-labelledby="whatsapp-segment-create">
              <h2 id="whatsapp-segment-create" className="od-cp__panel-title">
                New segment
              </h2>
              <SegmentEditorForm rules={ruleGroupToDrafts(null)} />
            </section>
          ) : selectedId && !selected ? (
            <p className="od-cp__notice" data-tone="negative">
              That segment does not exist or is not visible to you.
            </p>
          ) : selected ? (
            <>
              {justSaved ? (
                <p className="od-cp__notice" data-tone="positive" role="status">
                  Segment saved.
                </p>
              ) : null}
              <section className="od-cp__panel" aria-labelledby="whatsapp-segment-preview">
                <h2 id="whatsapp-segment-preview" className="od-cp__panel-title">
                  {selected.name}
                </h2>
                {selected.description ? <p className="od-cp__hint">{selected.description}</p> : null}
                {selected.ruleGroup ? (
                  <ul className="od-cp__chips" style={{ margin: "10px 0 16px", padding: 0, listStyle: "none" }}>
                    {selected.ruleGroup.rules.map((rule, index) => (
                      <li key={index} className="od-cp__badge">
                        {describeWhatsappSegmentRule(rule)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="od-cp__notice" data-tone="negative">
                    These rules use a field or condition this workspace does not recognise.
                  </p>
                )}
                {preview === null ? (
                  <p className="od-cp__notice">Inactive segments are not previewed. Reactivate it to size the audience.</p>
                ) : preview.kind === "ready" ? (
                  <div className="od-cp__stats" data-testid="whatsapp-segment-preview-counts">
                    <div className="od-cp__stat" data-tone="positive">
                      <span className="od-cp__stat-value">{preview.preview.eligible.toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">Reachable for marketing</span>
                    </div>
                    <div className="od-cp__stat">
                      <span className="od-cp__stat-value">{preview.preview.totalMatched.toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">Matched</span>
                    </div>
                    <div className="od-cp__stat">
                      <span className="od-cp__stat-value">{preview.preview.noMarketingConsent.toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">No MARKETING consent</span>
                    </div>
                    <div className="od-cp__stat">
                      <span className="od-cp__stat-value">{preview.preview.missingWhatsapp.toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">No active WhatsApp</span>
                    </div>
                    <div className="od-cp__stat">
                      <span className="od-cp__stat-value">{preview.preview.doNotContact.toLocaleString("en-IN")}</span>
                      <span className="od-cp__stat-label">Do not contact</span>
                    </div>
                  </div>
                ) : preview.kind === "inactive" ? (
                  <p className="od-cp__notice">This segment is inactive, so it is not previewed.</p>
                ) : (
                  <p className="od-cp__notice" data-tone="negative">
                    The preview could not be calculated. Try again shortly.
                  </p>
                )}
                <p className="od-cp__hint" style={{ marginBlockStart: 12 }}>
                  Counts are a snapshot. Campaigns re-check consent, opt-outs, caps and quiet hours for every recipient at
                  send time.
                </p>
              </section>

              {canManage ? (
                <section className="od-cp__panel" aria-labelledby="whatsapp-segment-edit">
                  <h2 id="whatsapp-segment-edit" className="od-cp__panel-title">
                    Edit segment
                  </h2>
                  <SegmentEditorForm
                    key={`${selected.id}:${selected.updatedAt}`}
                    segmentId={selected.id}
                    name={selected.name}
                    description={selected.description ?? ""}
                    active={selected.isActive}
                    rules={ruleGroupToDrafts(selected.ruleGroup)}
                  />
                </section>
              ) : null}
            </>
          ) : (
            <section className="od-cp__panel">
              <p className="od-cp__empty">Choose a segment to preview its audience{canManage ? " or edit it" : ""}.</p>
            </section>
          )}
        </div>
      </div>
    </ControlPlaneShell>
  );
}
