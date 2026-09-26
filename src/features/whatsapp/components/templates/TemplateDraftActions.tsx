"use client";

import { useActionState } from "react";
import { INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE } from "../../contracts/template-studio.ts";
import { archiveWhatsappTemplateDraftAction } from "../../server/whatsapp-template-actions.ts";

export function TemplateArchiveForm({
  draftId,
  lockVersion,
}: {
  readonly draftId: string;
  readonly lockVersion: number;
}) {
  const [state, action, pending] = useActionState(
    archiveWhatsappTemplateDraftAction,
    INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE
  );

  return (
    <form action={action} className="od-tpl__inline-form">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="lockVersion" value={String(lockVersion)} />
      <button
        type="submit"
        className="od-tpl__btn od-tpl__btn--quiet"
        disabled={pending}
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
      {state.message ? (
        <span
          className={
            state.success
              ? "od-tpl__msg od-tpl__msg--ok"
              : "od-tpl__msg od-tpl__msg--err"
          }
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
