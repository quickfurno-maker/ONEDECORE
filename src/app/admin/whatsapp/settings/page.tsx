import type { Metadata } from "next";
import { ControlPlaneDenied, ControlPlaneShell } from "@/features/whatsapp/components/control-plane/ControlPlaneShell";
import { ClickDestinationForm } from "@/features/whatsapp/components/control-plane/ClickDestinationForm";
import { SendPolicyForm } from "@/features/whatsapp/components/control-plane/SendPolicyForm";
import {
  describeWhatsappFrequencyRule,
  WHATSAPP_MARKETING_DEFAULT_TIMEZONE,
} from "@/features/whatsapp/contracts/send-policy";
import { listWhatsappClickDestinationsForCurrentUser } from "@/features/whatsapp/server/whatsapp-campaign-queries";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import { getWhatsappMarketingReadiness } from "@/features/whatsapp/server/whatsapp-readiness";
import {
  getWhatsappSendPolicyForCurrentUser,
  listWhatsappSendPolicyVersionsForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-settings-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Settings & Compliance | ONEDECORE",
};

/**
 * WM-3 Settings & Compliance. Super Admins and Sales Managers read
 * (whatsapp.settings.read); only a Super Admin publishes a new version
 * (whatsapp.settings.manage, and the RPC also requires the role).
 *
 * Unconfigured or unreadable reads as blocked. Nothing here invents a cap or a
 * quiet-hours window.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : DATE.format(date);
}

export default async function WhatsappSettingsPage() {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.settings.read"]) {
    return (
      <ControlPlaneDenied
        title="You do not have Settings access"
        detail="WhatsApp marketing send policy is visible to Super Admins and Sales Managers, and changed only by a Super Admin."
      />
    );
  }

  const { permissions } = access;
  const canManage = permissions["whatsapp.settings.manage"];
  const [read, versions, destinations] = await Promise.all([
    getWhatsappSendPolicyForCurrentUser(),
    listWhatsappSendPolicyVersionsForCurrentUser(),
    listWhatsappClickDestinationsForCurrentUser(),
  ]);
  const readiness = getWhatsappMarketingReadiness();
  const policy = read.kind === "configured" ? read.policy : null;
  const executing = policy?.executionEnabled === true;

  return (
    <ControlPlaneShell
      active="settings"
      title="Settings & Compliance"
      lede="How often a contact may receive marketing, when marketing is quiet, and whether approved campaigns may execute at all. Each change publishes a new, permanent version."
      permissions={permissions}
    >
      <section className="od-cp__panel od-cp__gate" aria-label="Campaign execution gate">
        <div>
          <p className="od-cp__name" style={{ margin: 0 }}>
            <span className="od-cp__dot" data-tone={executing ? "positive" : "negative"} aria-hidden="true" />
            {executing ? "Campaign execution is on" : "Campaign execution is blocked"}
          </p>
          <p className="od-cp__hint" style={{ marginBlockStart: 4 }}>
            {read.kind === "not_configured"
              ? "No send policy has been published, so no WhatsApp marketing can be sent."
              : read.kind === "unreadable"
                ? "The current policy could not be read, so it is treated as blocked."
                : executing
                  ? "Approved campaigns may send, within the caps and quiet hours below."
                  : "A Super Admin must turn the gate on before any approved campaign sends."}
          </p>
        </div>
        {policy ? <span className="od-cp__badge">Version {policy.version}</span> : null}
      </section>

      <div className="od-cp__columns">
        <section className="od-cp__panel" aria-labelledby="whatsapp-policy-current">
          <h2 id="whatsapp-policy-current" className="od-cp__panel-title">
            Current policy
          </h2>
          {policy ? (
            <dl className="od-cp__dl">
              <dt>Frequency</dt>
              <dd>
                {policy.frequencyRules.map((rule, index) => (
                  <span key={index} style={{ display: "block" }}>
                    {describeWhatsappFrequencyRule(rule)}
                  </span>
                ))}
              </dd>
              <dt>Quiet hours</dt>
              <dd>
                {policy.startLocal}–{policy.endLocal} ({policy.timezone})
              </dd>
              <dt>In effect since</dt>
              <dd>{formatWhen(policy.effectiveFrom)}</dd>
            </dl>
          ) : (
            <p className="od-cp__empty">Not configured.</p>
          )}

          {versions.length > 0 ? (
            <>
              <hr className="od-cp__divider" style={{ margin: "16px 0" }} />
              <h3 className="od-cp__panel-title">Version history</h3>
              <table className="od-cp__table">
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Execution</th>
                    <th scope="col">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.version}>
                      <td>v{version.version}</td>
                      <td>
                        <span className="od-cp__badge" data-tone={version.executionEnabled ? "positive" : undefined}>
                          {version.executionEnabled ? "On" : "Blocked"}
                        </span>
                      </td>
                      <td>
                        <span className="od-cp__sub" style={{ marginBlockStart: 0 }}>
                          {formatWhen(version.effectiveFrom)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>

        <section className="od-cp__panel" aria-labelledby="whatsapp-policy-edit">
          <h2 id="whatsapp-policy-edit" className="od-cp__panel-title">
            {canManage ? "Publish a new version" : "Changes"}
          </h2>
          {canManage ? (
            <SendPolicyForm
              key={policy?.id ?? "unconfigured"}
              frequencyRules={policy?.frequencyRules ?? []}
              startLocal={policy?.startLocal ?? ""}
              endLocal={policy?.endLocal ?? ""}
              timezone={policy?.timezone ?? WHATSAPP_MARKETING_DEFAULT_TIMEZONE}
              executionEnabled={policy?.executionEnabled ?? false}
            />
          ) : (
            <p className="od-cp__hint">Only a Super Admin can change the send policy. You can see every version here.</p>
          )}
        </section>
      </div>

      <section className="od-cp__panel" aria-labelledby="whatsapp-readiness">
        <h2 id="whatsapp-readiness" className="od-cp__panel-title">
          Environment readiness
        </h2>
        <table className="od-cp__table" data-testid="whatsapp-readiness">
          <thead>
            <tr>
              <th scope="col">Surface</th>
              <th scope="col">Mode</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {readiness.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  <span className="od-cp__badge" data-tone={row.mode === "enabled" ? "positive" : row.mode === "local-test" ? "warning" : undefined}>
                    {row.mode}
                  </span>
                </td>
                <td>
                  <span className="od-cp__sub" style={{ marginBlockStart: 0 }}>
                    {row.note}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="od-cp__hint" style={{ marginBlockStart: 10 }}>
          Configuration truth only; no credential value is ever shown.
        </p>
      </section>

      <section className="od-cp__panel" aria-labelledby="whatsapp-click-destinations">
        <h2 id="whatsapp-click-destinations" className="od-cp__panel-title">
          Tracked-link destinations
        </h2>
        <p className="od-cp__hint">
          Campaign and automation URL buttons point here through opaque per-recipient tokens. The link carries no customer data.
        </p>
        {destinations.length === 0 ? <p className="od-cp__empty">No destination configured.</p> : null}
        {canManage ? (
          <div className="od-cp__stack" style={{ marginBlockStart: 12 }}>
            {destinations.map((destination) => (
              <ClickDestinationForm key={destination.id} destination={destination} />
            ))}
            <ClickDestinationForm destination={null} />
          </div>
        ) : (
          <ul className="od-cp__hint" style={{ margin: 0, paddingInlineStart: 18 }}>
            {destinations.map((destination) => (
              <li key={destination.id}>
                {destination.label} · {destination.destinationUrl} {destination.isActive ? "" : "(inactive)"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="od-cp__panel" aria-labelledby="whatsapp-compliance-rules">
        <h2 id="whatsapp-compliance-rules" className="od-cp__panel-title">
          Compliance rules always enforced
        </h2>
        <ul className="od-cp__hint" style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>Marketing requires the contact&apos;s own MARKETING consent. Service-conversation consent never grants it.</li>
          <li>
            A customer message that is exactly STOP, UNSUBSCRIBE, OPT OUT or similar records a marketing opt-out
            automatically.
          </li>
          <li>Staff can record an opt-out, but no staff control can grant marketing consent.</li>
          <li>Meta&apos;s &ldquo;Stop promotions&rdquo; button on a marketing template records the same opt-out.</li>
          <li>Frequency caps count every campaign and automation send to a contact, including sends still in flight.</li>
        </ul>
      </section>
    </ControlPlaneShell>
  );
}
