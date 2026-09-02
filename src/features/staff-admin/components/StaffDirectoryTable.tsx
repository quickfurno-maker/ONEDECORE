import Link from "next/link";
import type { StaffListItem } from "../contracts/dto.ts";
import { StaffAccessStateBadge, StaffStatusBadge } from "./StaffStatusBadge.tsx";

interface StaffDirectoryTableProps {
  readonly items: readonly StaffListItem[];
}

function formatRoleLabel(roleCode: StaffListItem["roleCode"]): string {
  return roleCode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StaffDirectoryTable({ items }: StaffDirectoryTableProps) {
  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10 text-sm text-neutral-400">
        No staff members are visible in your current scope.
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-900/80">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Employee
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Role
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Manager
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Employment
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              App access
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
          {items.map((item) => (
            <tr key={item.staffId} className="hover:bg-neutral-900/50">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/staff/${item.staffId}`}
                  className="font-medium text-neutral-50 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  {item.displayName}
                </Link>
                <p className="mt-0.5 text-xs text-neutral-500">{item.employeeCode}</p>
                <p className="text-xs text-neutral-400">{item.designation}</p>
              </td>
              <td className="px-4 py-3 text-neutral-300">{formatRoleLabel(item.roleCode)}</td>
              <td className="px-4 py-3 text-neutral-400">{item.managerName ?? "—"}</td>
              <td className="px-4 py-3">
                <StaffStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3">
                <StaffAccessStateBadge accessState={item.accessState} />
              </td>
              <td className="px-4 py-3 text-neutral-400">{item.joiningDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
