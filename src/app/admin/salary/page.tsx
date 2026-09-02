import type { Metadata } from "next";
import { SalaryStatementList } from "@/features/staff-salary/components/SalaryStatementList";
import { listSalaryStatements } from "@/features/staff-salary/server/salary-actions";
import { requireSalaryAccess } from "@/features/staff-salary/server/salary-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salary | ONEDECORE",
  description: "Salary statements and payment history.",
};

export default async function SalaryPage() {
  const context = await requireSalaryAccess("/admin/salary");

  // A non-manager is scoped to themselves by the RPC regardless of arguments.
  const statements = await listSalaryStatements({ limit: 100 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">
          {context.canManageSalary ? "Salary" : "My salary"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {context.canManageSalary
            ? "Monthly statements built from approved attendance, with an explicit payment ledger."
            : "Your monthly salary statements and payment history. These are read-only."}
        </p>
      </header>
      <SalaryStatementList
        statements={statements}
        showEmployee={context.canManageSalary}
      />
    </div>
  );
}
