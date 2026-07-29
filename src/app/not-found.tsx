import Link from "next/link";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";

export default function NotFound() {
  return (
    <PublicDarkShell showChrome={false}>
      <main className="od-state">
        <div className="od-state__inner">
          <h1>404 — Page Not Found</h1>
          <p>The requested page or resource could not be found.</p>
          <div className="od-state__actions">
            <Link href="/" className="od-btn-primary">
              Return Home
            </Link>
            <Link href="/portfolio" className="od-btn-ghost">
              View Portfolio
            </Link>
          </div>
        </div>
      </main>
    </PublicDarkShell>
  );
}
