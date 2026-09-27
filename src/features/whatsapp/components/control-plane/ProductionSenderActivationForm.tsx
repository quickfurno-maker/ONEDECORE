"use client";

import { useActionState } from "react";
import {
  INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE,
} from "../../contracts/control-plane.ts";
import { activateWhatsappProductionSenderAction } from "../../server/whatsapp-production-activation-actions.ts";

export function ProductionSenderActivationForm({
  canActivate,
  readyForVerification,
}: {
  readonly canActivate: boolean;
  readonly readyForVerification: boolean;
}) {
  const [state, action, pending] = useActionState(
    activateWhatsappProductionSenderAction,
    INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE
  );

  if (!canActivate) {
    return (
      <p className="od-cp__hint">
        Only a Super Admin can verify and switch the production sender.
      </p>
    );
  }

  return (
    <form action={action} className="od-cp__stack">
      <label className="od-cp__check">
        <input
          type="checkbox"
          name="confirmProductionSender"
          disabled={pending || !readyForVerification}
        />
        <span>
          I confirm the configured WABA and Phone Number ID are the real ONEDECORE
          production number, not Meta&apos;s test number.
        </span>
      </label>
      <button
        type="submit"
        className="od-cp__btn od-cp__btn--primary"
        disabled={pending || !readyForVerification}
      >
        {pending ? "Verifying with Meta…" : "Verify & lock production sender"}
      </button>
      {!readyForVerification ? (
        <p className="od-cp__hint">
          Configure the Meta WABA ID, Phone Number ID and system-user access token
          before running the cutover.
        </p>
      ) : null}
      {state.message ? (
        <p
          className="od-cp__notice"
          data-tone={state.success ? "positive" : "negative"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
