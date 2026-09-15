"use client";

import { useActionState } from "react";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import { saveWhatsappClickDestinationAction } from "../../server/whatsapp-settings-actions.ts";
import { ControlPlaneActionMessage } from "./ControlPlaneActionMessage.tsx";

/** WM-5 tracked-link destination editor (Super Admin). The database and the redirect route both re-validate the URL. */
export function ClickDestinationForm({
  destination,
}: {
  readonly destination: { readonly id: string; readonly label: string; readonly destinationUrl: string; readonly isActive: boolean } | null;
}) {
  const [state, action, pending] = useActionState(saveWhatsappClickDestinationAction, INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE);
  return (
    <form action={action} className="od-cp__stack" data-testid={destination ? `whatsapp-click-destination-${destination.id}` : "whatsapp-click-destination-new"}>
      {destination ? <input type="hidden" name="destinationId" value={destination.id} /> : null}
      <div className="od-cp__grid">
        <label className="od-cp__field">
          <span>Label</span>
          <input name="label" defaultValue={destination?.label ?? ""} minLength={2} maxLength={80} required />
        </label>
        <label className="od-cp__field">
          <span>https destination</span>
          <input name="destinationUrl" type="url" defaultValue={destination?.destinationUrl ?? ""} maxLength={2048} pattern="https://.*" required />
        </label>
        {destination ? (
          <label className="od-cp__check">
            <input type="checkbox" name="isActive" value="off" defaultChecked={!destination.isActive} />
            <span>Inactive (queued sends using it are skipped)</span>
          </label>
        ) : null}
      </div>
      <div>
        <button type="submit" className="od-cp__btn od-cp__btn--quiet" disabled={pending}>
          {pending ? "Saving…" : destination ? "Save" : "Add destination"}
        </button>
      </div>
      <ControlPlaneActionMessage state={state} />
    </form>
  );
}
