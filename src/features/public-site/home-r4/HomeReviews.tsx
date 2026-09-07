"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { PM_REVIEWS, PM_SECTION_IDS } from "./content";
import { usePlan } from "./PlanContext";
import {
  canShowAggregateReviewSummary,
  canShowVerifiedExcerpts,
  HOME_REVIEW_MODE,
  HOME_REVIEW_SOURCE_URL,
  HOME_REVIEW_SUMMARY,
  HOME_VERIFIED_REVIEWS,
} from "./reviews";
import { Reveal } from "@/features/public-site/motion/Reveal";

function DecorativeStars({ rating }: { readonly rating: number }) {
  return (
    <span className="pm-reviews__stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, rating - index));
        return (
          <span
            key={index}
            className="pm-reviews__star"
            style={{ "--pm-star-fill": fill } as CSSProperties}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
              <path
                d="M12 2.5l2.76 5.59 6.17.9-4.46 4.35 1.05 6.14L12 16.9l-5.52 2.58 1.05-6.14-4.46-4.35 6.17-.9L12 2.5z"
                fill="currentColor"
              />
            </svg>
          </span>
        );
      })}
    </span>
  );
}

function VerifiedExcerpts() {
  if (!canShowVerifiedExcerpts(HOME_REVIEW_MODE, HOME_VERIFIED_REVIEWS)) {
    return null;
  }

  return (
    <ul className="pm-reviews__excerpts">
      {HOME_VERIFIED_REVIEWS.slice(0, 3).map((review) => (
        <li key={review.id}>
          <blockquote>
            <p>{review.quote}</p>
            <footer>
              <cite>{review.reviewerName}</cite>
              {review.locality ? <span> · {review.locality}</span> : null}
              <a
                href={review.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {review.sourceName}
              </a>
            </footer>
          </blockquote>
        </li>
      ))}
    </ul>
  );
}

/**
 * Aggregate client review signals — no unverified excerpts, and no aggregate
 * either until there is a source to cite.
 *
 * `canShowAggregateReviewSummary()` is false while the rating, the review count
 * and the satisfaction figure are unevidenced and `HOME_REVIEW_SOURCE_URL` is
 * null. In that state the score, the decorative star field and the two stat
 * cells are not rendered at all: a five-star graphic reads as a platform rating
 * that does not exist, and softening the number would not make it sourced.
 *
 * The section itself stays. It carries the process rail and both conversion
 * CTAs, and its heading changes with the copy rather than the markup.
 */
export function HomeReviews() {
  const { openPlanner } = usePlan();
  const { rating, count, satisfactionPercent } = HOME_REVIEW_SUMMARY;
  const showAggregate = canShowAggregateReviewSummary();

  return (
    <section
      id={PM_SECTION_IDS.reviews}
      className="pm-section pm-reviews"
      aria-labelledby="pm-reviews-title"
      data-review-mode={HOME_REVIEW_MODE}
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_REVIEWS.eyebrow}</p>
          <h2 id="pm-reviews-title" className="pm-h2">
            {PM_REVIEWS.heading}
          </h2>
          <p className="pm-lede">{PM_REVIEWS.body}</p>
        </Reveal>

        {showAggregate ? (
        <Reveal className="pm-reviews__aggregate" order={1}>
          <div
            className="pm-reviews__ratingBlock"
            aria-label={PM_REVIEWS.starLabel}
          >
            <p className="pm-reviews__rating" aria-hidden="true">
              <span className="pm-reviews__ratingValue">{rating}</span>
              <span className="pm-reviews__ratingScale">/5</span>
            </p>
            <p className="pm-reviews__ratingCaption" aria-hidden="true">
              {PM_REVIEWS.ratingCaption}
            </p>
          </div>

          <div className="pm-reviews__starField" aria-hidden="true">
            <span className="pm-reviews__starMask">
              <DecorativeStars rating={rating} />
            </span>
          </div>

          <ul className="pm-reviews__stats">
            <li className="pm-reviews__stat" data-order="1">
              <span className="pm-reviews__statValue">{count}+</span>
              <span className="pm-reviews__statLabel">
                {PM_REVIEWS.reviewsCaption}
              </span>
            </li>
            <li className="pm-reviews__stat" data-order="2">
              <span className="pm-reviews__statValue">{satisfactionPercent}%</span>
              <span className="pm-reviews__statLabel">
                {PM_REVIEWS.satisfactionCaption}
              </span>
            </li>
          </ul>
        </Reveal>
        ) : null}

        <Reveal className="pm-reviews__rail" order={2}>
          <p className="pm-reviews__railLabel">{PM_REVIEWS.railLabel}</p>
          <div className="pm-reviews__railLine" aria-hidden="true" />
          <ul className="pm-reviews__railList">
            {PM_REVIEWS.railItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>

        <VerifiedExcerpts />

        <Reveal className="pm-reviews__actions" order={3}>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
            data-conversion-action="reviews-start-plan"
            onClick={() => openPlanner()}
          >
            {PM_REVIEWS.primaryCta}
          </button>
          <Link
            href={PM_REVIEWS.secondaryHref}
            className="dc-btn dc-btn--ghost pm-btn--lg"
            data-conversion-action="portfolio-view"
          >
            {PM_REVIEWS.secondaryCta}
          </Link>
          {HOME_REVIEW_SOURCE_URL ? (
            <a
              href={HOME_REVIEW_SOURCE_URL}
              className="pm-textlink pm-reviews__source"
              rel="noopener noreferrer"
              target="_blank"
            >
              Read verified reviews
            </a>
          ) : null}
        </Reveal>

        <noscript>
          <div className="pm-noscript">
            {showAggregate ? (
              <p>
                {rating}/5 {PM_REVIEWS.ratingCaption} · {count}+{" "}
                {PM_REVIEWS.reviewsCaption} · {satisfactionPercent}%{" "}
                {PM_REVIEWS.satisfactionCaption}
              </p>
            ) : null}
            <ul>
              {PM_REVIEWS.railItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </noscript>
      </div>
    </section>
  );
}
