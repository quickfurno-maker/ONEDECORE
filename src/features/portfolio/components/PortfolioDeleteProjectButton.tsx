"use client";

import { useState, useTransition } from "react";
import { deleteProjectAction } from "../server/portfolio-cms-actions";

interface PortfolioDeleteProjectButtonProps {
  projectId: string;
  projectTitle: string;
  isPublished: boolean;
}

export function PortfolioDeleteProjectButton({
  projectId,
  projectTitle,
  isPublished,
}: PortfolioDeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPublished) {
    return (
      <p className="text-xs text-stone-500 italic">
        Published projects cannot be deleted directly. Return project to draft first.
      </p>
    );
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteProjectAction(projectId);
      if (res?.error) {
        setError(res.error);
        setConfirmOpen(false);
      }
    });
  }

  return (
    <div className="mt-8 border-t border-red-100 pt-6">
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
        >
          Delete Project
        </button>
      ) : (
        <div className="rounded-md border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Are you sure you want to delete &quot;{projectTitle}&quot;?
          </p>
          <p className="mt-1 text-xs text-red-700">
            This action will permanently remove all associated media files and database records.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="rounded bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
              className="rounded border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
