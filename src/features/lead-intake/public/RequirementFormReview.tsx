"use client";

import { PremiumRequirementForm } from "./PremiumRequirementForm.tsx";
import {
  budgetRangesForProjectScope,
  LEAD_PROJECT_SCOPE_CODES,
  PROJECT_SCOPE_LABELS,
  SERVICE_BY_PROJECT_SCOPE,
} from "../project-scope.ts";

/**
 * Local review page for the requirement form.
 *
 * It mounts the REAL component in preview mode — the same file the homepage
 * renders, not a copy. Preview mode runs the full client validation and stops
 * short of the network, so the form can be exercised end to end without
 * creating a lead. Switch the homepage itself to see a live submission.
 *
 * The table below reads the same configuration object the dropdown reads, so it
 * cannot drift from what the form offers.
 */
export function RequirementFormReview() {
  return (
    <div className="od-req-review">
      <header className="od-req-review__head">
        <p className="od-req-review__kicker">Design review · localhost only</p>
        <h1 className="od-req-review__title">Client requirement form</h1>
        <p className="od-req-review__note">
          The real form component, rendered on its own in preview mode: client
          validation runs in full, and submitting stops before the network so no
          lead is created. The homepage mounts this same component in active
          mode.
        </p>
      </header>

      <div className="od-req-review__stage">
        <PremiumRequirementForm mode="preview" />
      </div>

      <section className="od-req-review__matrix">
        <h2>Scope, service and budget ladders</h2>
        <p className="od-req-review__note">
          Every row comes from the configuration the form, the server validator
          and the SQL all read, so this table cannot drift from what is enforced.
        </p>
        <div className="od-req-review__matrix-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Requirement</th>
                <th scope="col">Service code</th>
                <th scope="col">Budget options</th>
              </tr>
            </thead>
            <tbody>
              {LEAD_PROJECT_SCOPE_CODES.map((scope) => (
                <tr key={scope}>
                  <th scope="row">{PROJECT_SCOPE_LABELS[scope]}</th>
                  <td>
                    <code>{SERVICE_BY_PROJECT_SCOPE[scope]}</code>
                  </td>
                  <td>
                    {budgetRangesForProjectScope(scope)
                      .map((budget) => budget.label)
                      .join("  ·  ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
