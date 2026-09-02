import type { ReportingManagerOption } from "../server/staff-queries.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const invalidFieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-red-500 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400";

interface ReportingManagerPickerProps {
  readonly managers: readonly ReportingManagerOption[];
  readonly name?: string;
  readonly defaultValue?: string | null;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** Inline field error; also drives aria-invalid / aria-describedby. */
  readonly error?: string;
}

export function ReportingManagerPicker({
  managers,
  name = "reportingManagerId",
  defaultValue = "",
  required = false,
  disabled = false,
  error,
}: ReportingManagerPickerProps) {
  const errorId = `${name}-error`;

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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={error ? invalidFieldClassName : fieldClassName}
      >
        <option value="">Select manager</option>
        {managers.map((manager) => (
          <option key={manager.staffId} value={manager.staffId}>
            {manager.displayName} ({manager.employeeCode})
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
