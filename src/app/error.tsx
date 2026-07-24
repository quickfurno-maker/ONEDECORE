"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-2xl font-bold text-stone-900">Application Error</h2>
      <p className="text-stone-600 mt-2">An unexpected system error occurred.</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
