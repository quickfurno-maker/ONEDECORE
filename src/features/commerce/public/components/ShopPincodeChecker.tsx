"use client";

import { useActionState } from "react";
import { checkShopPincode, type PincodeCheckState } from "../pincode-action.ts";

const INITIAL: PincodeCheckState = { status: "idle" };

export function ShopPincodeChecker() {
  const [state, action, pending] = useActionState(checkShopPincode, INITIAL);

  return (
    <form className="od-shop-pincode" action={action}>
      <label htmlFor="shop-pincode">Check delivery for your pincode</label>
      <div className="od-shop-pincode__row">
        <input
          id="shop-pincode"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="6-digit pincode"
          aria-describedby="shop-pincode-help"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Checking" : "Check"}
        </button>
      </div>
      <p id="shop-pincode-help" className="od-shop-note">
        Serviceability only. Ordering is not enabled yet.
      </p>
      {state.status === "invalid" ? (
        <p role="status">Enter a 6-digit Indian pincode.</p>
      ) : null}
      {state.status === "error" ? (
        <p role="status">We could not check this pincode right now.</p>
      ) : null}
      {state.status === "ok" && state.result.serviceable ? (
        <p role="status">
          Deliverable. Estimated {state.result.etaMinDays}–{state.result.etaMaxDays} days
          {state.result.assemblyInstallNote ? `. ${state.result.assemblyInstallNote}` : "."}
        </p>
      ) : null}
      {state.status === "ok" && !state.result.serviceable ? (
        <p role="status">This pincode is not in the current service list.</p>
      ) : null}
    </form>
  );
}
