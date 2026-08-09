import type { ReportingManagerOption } from "../server/staff-queries.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

interface ReportingManagerPickerProps {
  readonly managers: readonly ReportingManagerOption[];
  readonly name?: string;
  readonly defaultValue?: string | null;
  readonly required?: boolean;
  readonly disabled?: boolean;
}

export function ReportingManagerPicker({
  managers,
  name = "reportingManagerId",
  defaultValue = "",
  required = false,
  disabled = false,
}: ReportingManagerPickerProps) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-neutral-200">
        Reporting manager
        {required ? <span className="text-amber-400"> *</span> : null}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        disabled={disabled}
        className={fieldClassName}
      >
        <option value="">Select manager</option>
        {managers.map((manager) => (
          <option key={manager.staffId} value={manager.staffId}>
            {manager.displayName} ({manager.employeeCode})
          </option>
        ))}
      </select>
    </div>
  );
}
