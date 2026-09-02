import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalaryStatementDetailView } from "@/features/staff-salary/components/SalaryStatementDetailView";
import { loadSalaryStatement } from "@/features/staff-salary/server/salary-actions";
import { requireSalaryAccess } from "@/features/staff-salary/server/salary-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salary Statement | ONEDECORE",
  description: "Monthly salary statement detail and payment ledger.",
};

export default async function SalaryStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireSalaryAccess(`/admin/salary/${id}`);

  // Visibility is enforced in the database: a staff member requesting another
  // employee's statement id is refused there, not merely hidden here.
  const statement = await loadSalaryStatement(id);

  if (!statement) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">Salary statement</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {context.canManageSalary
            ? "Review, amend and settle this statement."
            : "Read-only view of your statement and payments."}
        </p>
      </header>
      <SalaryStatementDetailView
        statement={statement}
        canManage={context.canManageSalary}
      />
    </div>
  );
}
