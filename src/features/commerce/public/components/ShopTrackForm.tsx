"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyOrderTracking, type TrackOrderState } from "../../server/tracking-actions.ts";

const INITIAL: TrackOrderState = { status: "idle" };

export function ShopTrackForm() {
  const searchParams = useSearchParams();
  const presetOrder = searchParams.get("order") ?? "";
  const [state, action, pending] = useActionState(verifyOrderTracking, INITIAL);

  return (
    <form action={action} className="od-shop-form odc-track">
      <fieldset>
        <legend>Track your order</legend>
        <label htmlFor="orderReference">Order reference</label>
        <input
          id="orderReference"
          name="orderReference"
          defaultValue={presetOrder}
          required
          maxLength={32}
          placeholder="OD-O-2026-000001"
          autoComplete="off"
        />
        <label htmlFor="mobile">Mobile number</label>
        <input id="mobile" name="mobile" required inputMode="tel" maxLength={20} autoComplete="tel" />
        <p className="od-shop-note odc-track__note">
          We match the details you provided at checkout. Order details stay hidden until they
          verify.
        </p>
      </fieldset>
      {state.status === "mismatch" || state.status === "error" ? (
        <p className="od-shop__error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "invalid" ? (
        <p className="od-shop__error" role="alert">
          Enter a valid order reference and mobile number.
        </p>
      ) : null}
      <button type="submit" className="od-shop-btn od-shop-btn--gold" disabled={pending} aria-busy={pending}>
        Verify and view order
      </button>
    </form>
  );
}
