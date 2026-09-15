import type { Metadata } from "next";
import Link from "next/link";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import { FlowDraftForm, FlowProviderActions } from "@/features/whatsapp/components/flows/FlowForms";
import { isUuid, WHATSAPP_ADMIN_FLOWS_PATH } from "@/features/whatsapp/contracts/control-plane";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import {
  getWhatsappFlowForCurrentUser,
  getWhatsappFlowProviderMode,
  listWhatsappFlowsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-flow-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Forms / Flows | ONEDECORE",
};

/**
 * WM-6 Forms / Flows. whatsapp.flows.read to open; whatsapp.flows.manage to
 * draft and to request official Meta create / upload / publish / deprecate /
 * sync (Super Admin, Sales Manager). A Flow's status on this page is only ever
 * what Meta reported.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: string): "positive" | "warning" | "negative" | undefined {
  if (status === "PUBLISHED") return "positive";
  if (status === "BLOCKED" || status === "DEPRECATED") return "negative";
  if (status === "THROTTLED" || status === "unknown") return "warning";
  return undefined;
}

interface WhatsappFlowsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappFlowsPage({ searchParams }: WhatsappFlowsPageProps) {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.flows.read"]) {
    return (
      <ControlPlaneDenied title="You do not have Forms / Flows access" detail="WhatsApp Flows are limited to Super Admins and Sales Managers." />
    );
  }
  const { permissions } = access;
  const canManage = permissions["whatsapp.flows.manage"];
  const params = await searchParams;
  const selectedRaw = first(params.flow);
  const selectedId = isUuid(selectedRaw) ? selectedRaw : null;
  const creating = first(params.new) === "1";

  const [flows, selected] = await Promise.all([
    listWhatsappFlowsForCurrentUser(),
    selectedId ? getWhatsappFlowForCurrentUser(selectedId) : Promise.resolve(null),
  ]);
  const providerMode = getWhatsappFlowProviderMode();

  return (
    <ControlPlaneShell
      active="flows"
      title="Forms / Flows"
      lede="Official WhatsApp Flows that collect requirement, budget, locality and feedback inside the chat. Answers arrive as evidence linked to the conversation's lead."
      permissions={permissions}
    >
      <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="whatsapp-flows-list">
          <div className="od-cp__toolbar">
            <h2 id="whatsapp-flows-list" className="od-cp__panel-title" style={{ margin: 0 }}>
              Flows · {flows.length}
            </h2>
            {canManage ? (
              <Link className="od-cp__btn od-cp__btn--quiet" href={`${WHATSAPP_ADMIN_FLOWS_PATH}?new=1`}>
                New Flow
              </Link>
            ) : null}
          </div>
          {flows.length === 0 ? (
            <p className="od-cp__empty">No Flow yet.</p>
          ) : (
            <ul className="od-cp__list">
              {flows.map((flow) => (
                <li key={flow.id}>
                  <Link
                    className="od-cp__list-item"
                    href={`${WHATSAPP_ADMIN_FLOWS_PATH}?flow=${flow.id}`}
                    aria-current={flow.id === selected?.id ? "true" : undefined}
                  >
                    <span className="od-cp__list-row">
                      <span className="od-cp__name">{flow.name}</span>
                      <span className="od-cp__badge" data-tone={statusTone(flow.providerStatus)}>
                        {flow.providerStatus === "local_draft" ? "local draft" : flow.providerStatus}
                      </span>
                    </span>
                    <span className="od-cp__sub">
                      {flow.purpose.replace(/_/g, " ")} · {flow.responseCount} responses
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="od-cp">
          {creating && canManage ? (
            <section className="od-cp__panel" aria-labelledby="whatsapp-flow-new">
              <h2 id="whatsapp-flow-new" className="od-cp__panel-title">
                New Flow (local draft)
              </h2>
              <FlowDraftForm flow={null} />
            </section>
          ) : selectedId && !selected ? (
            <p className="od-cp__notice" data-tone="negative">
              That Flow does not exist.
            </p>
          ) : selected ? (
            <>
              <section className="od-cp__panel" aria-labelledby="whatsapp-flow-detail">
                <h2 id="whatsapp-flow-detail" className="od-cp__panel-title">
                  {selected.name}
                </h2>
                <dl className="od-cp__dl">
                  <dt>At Meta</dt>
                  <dd>
                    {selected.providerFlowId ? (
                      <>
                        {selected.providerStatus}
                        {selected.providerStatusRaw && selected.providerStatusRaw !== selected.providerStatus ? ` (raw: ${selected.providerStatusRaw})` : ""} · Flow id{" "}
                        {selected.providerFlowId}
                      </>
                    ) : (
                      "Not created at Meta"
                    )}
                  </dd>
                  <dt>Last provider answer</dt>
                  <dd>{formatWhen(selected.providerSyncedAt)}</dd>
                  <dt>Validation</dt>
                  <dd>{selected.validationErrorCount === 0 ? "No errors reported" : `${selected.validationErrorCount} error(s) reported by Meta`}</dd>
                  <dt>Mapped answers</dt>
                  <dd>
                    {Object.entries(selected.fieldMappings)
                      .map(([key, target]) => `${key} → ${target.replace(/_/g, " ")}`)
                      .join(" · ") || "None"}
                  </dd>
                </dl>
                {selected.validationErrors.length > 0 ? (
                  <pre className="od-cp__hint" style={{ whiteSpace: "pre-wrap", marginBlockStart: 10 }}>
                    {JSON.stringify(selected.validationErrors, null, 2)}
                  </pre>
                ) : null}
                {canManage ? <FlowProviderActions flow={selected} providerMode={providerMode} /> : null}
              </section>

              <section className="od-cp__panel" aria-labelledby="whatsapp-flow-responses">
                <h2 id="whatsapp-flow-responses" className="od-cp__panel-title">
                  Recent responses
                </h2>
                {selected.responses.length === 0 ? (
                  <p className="od-cp__empty">No completed responses yet.</p>
                ) : (
                  <table className="od-cp__table">
                    <thead>
                      <tr>
                        <th scope="col">Received</th>
                        <th scope="col">Answers</th>
                        <th scope="col">CRM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.responses.map((response) => (
                        <tr key={response.id}>
                          <td>{formatWhen(response.receivedAt)}</td>
                          <td>
                            {Object.entries(response.fields)
                              .map(([field, value]) => `${field.replace(/_/g, " ")}: ${value}`)
                              .join(" · ") || "—"}
                            {response.unmappedKeyCount > 0 ? <span className="od-cp__sub">{response.unmappedKeyCount} unmapped answer(s) not stored</span> : null}
                          </td>
                          <td>
                            {response.crmApplyOutcome.replace(/_/g, " ")}
                            {response.crmAppliedFields.length > 0 ? ` (${response.crmAppliedFields.join(", ")})` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {canManage && (selected.providerStatus === "local_draft" || selected.providerStatus === "DRAFT") ? (
                <section className="od-cp__panel" aria-labelledby="whatsapp-flow-edit">
                  <h2 id="whatsapp-flow-edit" className="od-cp__panel-title">
                    Edit draft
                  </h2>
                  <FlowDraftForm key={selected.updatedAt ?? selected.id} flow={selected} />
                </section>
              ) : null}
            </>
          ) : (
            <section className="od-cp__panel">
              <p className="od-cp__empty">Choose a Flow{canManage ? " or create one" : ""}.</p>
            </section>
          )}
        </div>
      </div>
    </ControlPlaneShell>
  );
}
