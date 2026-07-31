interface CrmErrorBannerProps {
  readonly message: string;
}

export function CrmErrorBanner({ message }: CrmErrorBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
    >
      {message}
    </div>
  );
}
