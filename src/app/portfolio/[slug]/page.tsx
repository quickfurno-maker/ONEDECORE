import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProjectBySlug } from "@/features/portfolio/public/public-portfolio-cache";
import { isValidPortfolioSlug } from "@/features/portfolio/public/public-request-validation";
import { PortfolioGallery } from "@/features/portfolio/public/components/PortfolioGallery";
import { SITE_CONFIG, canonicalPortfolioUrl } from "@/config/site";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Rejects malformed slugs before querying so traversal and grammar violations
 * never reach Supabase.
 */
async function loadPublishedProject(slugPromise: Promise<{ slug: string }>) {
  const { slug } = await slugPromise;

  if (!isValidPortfolioSlug(slug)) {
    notFound();
  }

  const project = await getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return project;
}

export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
  const project = await loadPublishedProject(params);

  const title = project.seoTitle || `${project.title} — ${SITE_CONFIG.name}`;
  const description = project.seoDescription || project.summary;
  const canonicalUrl = canonicalPortfolioUrl(project.slug);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_CONFIG.name,
      locale: SITE_CONFIG.locale,
      type: "article",
      images: [
        {
          url: project.cover.url,
          width: project.cover.width,
          height: project.cover.height,
          alt: project.cover.altText,
        },
      ],
    },
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const project = await loadPublishedProject(params);

  const canonicalUrl = canonicalPortfolioUrl(project.slug);

  // Construct structured data graph
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonicalUrl,
        "url": canonicalUrl,
        "name": project.title,
        "description": project.summary,
        "isPartOf": {
          "@type": "WebSite",
          "name": SITE_CONFIG.name,
          "url": SITE_CONFIG.url,
        },
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": SITE_CONFIG.url,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Portfolio",
            "item": `${SITE_CONFIG.url}/portfolio`,
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": project.title,
            "item": canonicalUrl,
          },
        ],
      },
      {
        "@type": "CreativeWork",
        "@id": `${canonicalUrl}#creativework`,
        "name": project.title,
        "description": project.summary,
        "datePublished": project.publishedAt,
        "publisher": {
          "@type": "Organization",
          "name": SITE_CONFIG.name,
          "url": SITE_CONFIG.url,
        },
        "image": [
          {
            "@type": "ImageObject",
            "url": project.cover.url,
            "width": project.cover.width,
            "height": project.cover.height,
            "caption": project.cover.caption || project.cover.altText,
          },
          ...project.gallery.map((img) => ({
            "@type": "ImageObject",
            "url": img.url,
            "width": img.width,
            "height": img.height,
            "caption": img.caption || img.altText,
          })),
        ],
      },
    ],
  };

  return (
    <main id="project-detail-main" className="od-portfolio-main od-portfolio-main--detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      <nav id="detail-breadcrumb" aria-label="Breadcrumb" className="od-breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/portfolio">Portfolio</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate max-w-xs">
            {project.title}
          </li>
        </ol>
      </nav>

      <header className="od-detail-header od-detail-section">
        <div className="od-card__services">
          {project.services.map((svc) => (
            <span key={svc.serviceCode} className="od-chip">
              {svc.serviceLabel}
            </span>
          ))}
        </div>
        <h1 className="od-detail-title">{project.title}</h1>
        <p className="od-detail-summary">{project.summary}</p>

        <div className="od-detail-meta">
          {project.locationLabel ? (
            <div>
              <strong>Location:</strong> {project.locationLabel}
            </div>
          ) : null}
          {project.propertyType ? (
            <div>
              <strong>Property Type:</strong> {project.propertyType}
            </div>
          ) : null}
          {project.completionYear ? (
            <div>
              <strong>Completed:</strong> {project.completionYear}
            </div>
          ) : null}
        </div>
      </header>

      <p className="od-detail-cta">
        <Link href="/#consultation" className="od-btn-primary">
          Get Free Consultation
        </Link>
      </p>

      {project.description ? (
        <section
          id="project-description-section"
          className="od-prose od-detail-section"
        >
          <h2>Project Overview</h2>
          <div className="whitespace-pre-line">{project.description}</div>
        </section>
      ) : null}

      <div className="od-detail-gallery-wrap">
        <PortfolioGallery
          cover={project.cover}
          gallery={project.gallery}
          projectTitle={project.title}
        />
      </div>
    </main>
  );
}
