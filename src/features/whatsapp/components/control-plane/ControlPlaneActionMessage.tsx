import type { WhatsappControlPlaneActionState } from "../../contracts/control-plane.ts";

export function ControlPlaneActionMessage({ state }: { readonly state: WhatsappControlPlaneActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`od-cp__msg ${state.success ? "od-cp__msg--ok" : "od-cp__msg--err"}`}
      role={state.success ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}
