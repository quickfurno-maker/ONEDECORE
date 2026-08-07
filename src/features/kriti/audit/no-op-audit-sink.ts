import type { KritiAuditEvent, KritiAuditSink } from "../contracts/audit.ts";

export function createNoOpKritiAuditSink(): KritiAuditSink {
  const events: KritiAuditEvent[] = [];
  return {
    async record(event: KritiAuditEvent): Promise<void> {
      events.push(event);
    },
    // test-only introspection without persistence
    getEvents(): readonly KritiAuditEvent[] {
      return events;
    },
  } as KritiAuditSink & { getEvents(): readonly KritiAuditEvent[] };
}
