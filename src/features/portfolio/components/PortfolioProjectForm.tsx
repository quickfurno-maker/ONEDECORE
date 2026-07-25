"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PORTFOLIO_SERVICE_CODES,
  PORTFOLIO_SERVICE_LABELS,
  type PortfolioServiceCode,
} from "../domain/portfolio-service";
import {
  type PortfolioFormState,
  INITIAL_PORTFOLIO_FORM_STATE,
} from "../server/portfolio-form-state";

export interface PortfolioProjectFormValues {
  title?: string;
  slug?: string;
  summary?: string;
  description?: string | null;
  locationLabel?: string | null;
  propertyType?: string | null;
  completionYear?: number | null;
  services?: PortfolioServiceCode[];
  isFeatured?: boolean;
}

export interface PortfolioProjectFormProps {
  action: (
    previousState: PortfolioFormState,
    formData: FormData
  ) => Promise<PortfolioFormState>;
  submitLabel: string;
  initialValues?: PortfolioProjectFormValues;
}

export function PortfolioProjectForm({
  action,
  submitLabel,
  initialValues,
}: PortfolioProjectFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_PORTFOLIO_FORM_STATE
  );

  useEffect(() => {
    if (
      state.redirectTo &&
      state.redirectTo.startsWith("/admin/portfolio/")
    ) {
      router.replace(state.redirectTo);
    }
  }, [router, state.redirectTo]);

  const assignedServices = initialValues?.services || ["complete_home_interiors"];

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[#E5E0DA] bg-white p-6 shadow-sm space-y-4"
    >
      {/* Form-level Feedback Message */}
      {state.message && (
        <div
          aria-live="polite"
          className={`rounded border p-3 text-xs font-medium ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      )}

      {/* Project Title */}
      <div>
        <label
          className="block text-xs font-semibold text-[#1A1A1A]"
          htmlFor="title"
        >
          Project Title *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={120}
          defaultValue={initialValues?.title || ""}
          placeholder="e.g. Marvela Penthouse — Modern Luxury Interior"
          className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
        />
        {state.fieldErrors.title && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.title.join(" ")}
          </p>
        )}
      </div>

      {/* Slug */}
      <div>
        <label
          className="block text-xs font-semibold text-[#1A1A1A]"
          htmlFor="slug"
        >
          URL Slug * (Lowercase letters, numbers, single hyphens)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
          defaultValue={initialValues?.slug || ""}
          placeholder="marvela-penthouse-modern-luxury"
          className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
        />
        {state.fieldErrors.slug && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.slug.join(" ")}
          </p>
        )}
      </div>

      {/* Summary */}
      <div>
        <label
          className="block text-xs font-semibold text-[#1A1A1A]"
          htmlFor="summary"
        >
          Summary * (20 to 320 characters)
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          minLength={20}
          maxLength={320}
          rows={3}
          defaultValue={initialValues?.summary || ""}
          placeholder="A short overview of the design concept, key materials, and architectural features."
          className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
        />
        {state.fieldErrors.summary && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.summary.join(" ")}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          className="block text-xs font-semibold text-[#1A1A1A]"
          htmlFor="description"
        >
          Detailed Description (Optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={initialValues?.description || ""}
          placeholder="Comprehensive description of space planning, custom cabinetry, lighting, and finishes."
          className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
        />
      </div>

      {/* Location, Property Type, Completion Year */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            className="block text-xs font-semibold text-[#1A1A1A]"
            htmlFor="locationLabel"
          >
            Location Label
          </label>
          <input
            id="locationLabel"
            name="locationLabel"
            type="text"
            defaultValue={initialValues?.locationLabel || ""}
            placeholder="e.g. Koregaon Park, Pune"
            className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
          />
        </div>

        <div>
          <label
            className="block text-xs font-semibold text-[#1A1A1A]"
            htmlFor="propertyType"
          >
            Property Type
          </label>
          <input
            id="propertyType"
            name="propertyType"
            type="text"
            defaultValue={initialValues?.propertyType || ""}
            placeholder="e.g. 4 BHK Penthouse"
            className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
          />
        </div>

        <div>
          <label
            className="block text-xs font-semibold text-[#1A1A1A]"
            htmlFor="completionYear"
          >
            Completion Year
          </label>
          <input
            id="completionYear"
            name="completionYear"
            type="number"
            min={2015}
            max={2030}
            defaultValue={initialValues?.completionYear || ""}
            placeholder="2026"
            className="mt-1 block w-full rounded border border-[#E5E0DA] p-2 text-sm text-[#1A1A1A]"
          />
        </div>
      </div>

      {/* Services Checkboxes */}
      <div>
        <label className="block text-xs font-semibold text-[#1A1A1A]">
          Assign ONEDECORE Services * (Select 1 to 3 services)
        </label>
        <div className="mt-2 space-y-2">
          {PORTFOLIO_SERVICE_CODES.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 text-xs text-stone-700"
            >
              <input
                type="checkbox"
                name="services"
                value={code}
                defaultChecked={assignedServices.includes(code)}
                className="rounded border-[#E5E0DA] text-[#1A1A1A]"
              />
              {PORTFOLIO_SERVICE_LABELS[code]}
            </label>
          ))}
        </div>
        {state.fieldErrors.services && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.services.join(" ")}
          </p>
        )}
      </div>

      {/* Is Featured checkbox (for edit mode) */}
      {initialValues !== undefined && (
        <div className="flex items-center gap-2 pt-2">
          <input
            id="isFeatured"
            name="isFeatured"
            type="checkbox"
            value="true"
            defaultChecked={initialValues?.isFeatured || false}
            className="rounded border-[#E5E0DA] text-[#1A1A1A]"
          />
          <label
            className="text-xs font-medium text-[#1A1A1A]"
            htmlFor="isFeatured"
          >
            Mark project as Featured on Showcase Homepage
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E5E0DA]">
        <Link
          href="/admin/portfolio"
          className="rounded border border-[#E5E0DA] bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[#1A1A1A] px-4 py-2 text-xs font-medium text-white hover:bg-[#333333] disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
