import type { LeaveTypeSummary } from "../server/leave-actions.ts";

interface LeaveTypeAdminProps {
  readonly leaveTypes: readonly LeaveTypeSummary[];
}

export function LeaveTypeAdmin({ leaveTypes }: LeaveTypeAdminProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
      <h2 className="text-lg font-semibold text-neutral-50">Leave types</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Leave type catalogue is database-managed. Active launch types are selected per OD-9;
        this view is read-only until dedicated type mutation RPCs are exposed.
      </p>
      {leaveTypes.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No leave types configured.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-900/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-neutral-300">Code</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-300">Name</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-300">Half day</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-300">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
              {leaveTypes.map((type) => (
                <tr key={type.id}>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-300">{type.code}</td>
                  <td className="px-4 py-3 text-neutral-100">{type.displayName}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {type.allowsHalfDay ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {type.isActive ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
