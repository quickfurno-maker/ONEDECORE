import Link from "next/link";
import { CONCEPT_REVIEW_NOTICE } from "../content/concepts";

interface ReviewBannerProps {
  readonly conceptLetter: "A" | "B" | "C";
  readonly conceptName: string;
}

/** Makes it unmistakable that a concept route is not the live ONEDECORE site. */
export function ReviewBanner({ conceptLetter, conceptName }: ReviewBannerProps) {
  return (
    <div className="dc-review">
      <div className="dc-container dc-review__inner">
        <span className="dc-review__tag">Concept {conceptLetter}</span>
        <span>
          {conceptName} — {CONCEPT_REVIEW_NOTICE}
        </span>
        <Link href="/design-concepts" className="dc-review__link">
          Back to all concepts
        </Link>
      </div>
    </div>
  );
}
