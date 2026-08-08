"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KritiAssistPanel } from "./KritiAssistPanel.tsx";
import type { KritiRequest } from "../contracts/context.ts";
import type { KritiResult } from "../contracts/result.ts";
import type { KritiTaskType } from "../contracts/task-types.ts";
import { INBOX_KRITI_ALLOWED_TASKS } from "../integrations/kriti-inbox-integration.ts";
import { createKritiInboxInsertDraftHandler } from "../integrations/kriti-inbox-integration.ts";
import {
  getInboxKritiAvailabilityAction,
  recordKritiHumanUseAction,
  runInboxKritiTaskAction,
} from "../server/kriti-actions.ts";
import type { KritiProviderMode } from "../contracts/provider.ts";

interface InboxKritiAssistProps {
  readonly conversationId: string;
  readonly canRead: boolean;
  readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function InboxKritiAssist({
  conversationId,
  canRead,
  textareaRef,
}: InboxKritiAssistProps) {
  const [providerMode, setProviderMode] = useState<KritiProviderMode>("disabled");
  const [allowedTasks, setAllowedTasks] = useState<readonly KritiTaskType[]>(
    INBOX_KRITI_ALLOWED_TASKS
  );
  const lastRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canRead) return;
    void getInboxKritiAvailabilityAction(conversationId).then((availability) => {
      setProviderMode(availability.providerMode as KritiProviderMode);
      setAllowedTasks(
        availability.tasks
          .filter((entry) => entry.status === "available")
          .map((entry) => entry.taskType)
      );
    });
  }, [canRead, conversationId]);

  const runTask = useCallback(
    async (request: KritiRequest): Promise<KritiResult> => {
      const result = await runInboxKritiTaskAction({
        conversationId,
        taskType: request.taskType,
      });
      lastRequestIdRef.current = result.requestId;
      return result;
    },
    [conversationId]
  );

  const buildRequest = useCallback(
    (taskType: KritiTaskType): KritiRequest => ({
      requestId: crypto.randomUUID(),
      taskType,
      requestedAt: new Date().toISOString(),
      context: {
        taskType,
        trustedPolicy: {
          brandName: "ONEDECORE",
          assistanceScope: "staff_assist_only",
          prohibitedActions: [],
        },
        authorizedBusiness: {
          leadReference: null,
          conversationReference: conversationId,
          quotationReference: null,
          projectReference: null,
          staffRole: "staff",
          staffDisplayName: null,
        },
        untrustedCustomer: { messages: [], notes: [] },
        supplementalFacts: [],
      },
    }),
    [conversationId]
  );

  const insertHandler = useMemo(
    () => createKritiInboxInsertDraftHandler({ textareaRef }),
    [textareaRef]
  );

  const recordHumanUse = useCallback(async (action: "copy" | "insert_draft" | "dismiss" | "retry") => {
    const requestId = lastRequestIdRef.current;
    if (!requestId) return;
    await recordKritiHumanUseAction({ requestId, action });
  }, []);

  if (!canRead) {
    return null;
  }

  return (
    <KritiAssistPanel
      providerMode={providerMode}
      allowedTasks={allowedTasks}
      buildRequest={buildRequest}
      runTask={runTask}
      insertDraftLabel="Insert into composer"
      callbacks={{
        onCopy: async (text) => {
          void text;
          await recordHumanUse("copy");
        },
        onInsertDraft: async (draft) => {
          insertHandler(draft);
          await recordHumanUse("insert_draft");
        },
        onDismiss: async () => {
          await recordHumanUse("dismiss");
        },
      }}
    />
  );
}
