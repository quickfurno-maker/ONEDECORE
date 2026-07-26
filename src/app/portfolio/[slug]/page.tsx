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
    <main id="project-detail-main" className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
      {/* JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      {/* Breadcrumb Navigation */}
      <nav id="detail-breadcrumb" aria-label="Breadcrumb" className="text-xs text-neutral-500 dark:text-neutral-400">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-neutral-900 dark:hover:text-white">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/portfolio" className="hover:text-neutral-900 dark:hover:text-white">
              Portfolio
            </Link>
          </li>
          <li>/</li>
          <li className="font-semibold text-neutral-900 dark:text-white truncate max-w-xs">
            {project.title}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {project.services.map((svc) => (
            <span
              key={svc.serviceCode}
              className="rounded-md bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {svc.serviceLabel}
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
          {project.title}
        </h1>
        <p className="text-xl text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {project.summary}
        </p>

        {/* Project Metadata Specs */}
        <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
          {project.locationLabel && (
            <div>
              <span className="font-medium text-neutral-900 dark:text-white">Location:</span>{" "}
              {project.locationLabel}
            </div>
          )}
          {project.propertyType && (
            <div>
              <span className="font-medium text-neutral-900 dark:text-white">Property Type:</span>{" "}
              {project.propertyType}
            </div>
          )}
          {project.completionYear && (
            <div>
              <span className="font-medium text-neutral-900 dark:text-white">Completed:</span>{" "}
              {project.completionYear}
            </div>
          )}
        </div>
      </header>

      {/* Main Description */}
      {project.description && (
        <section id="project-description-section" className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-4">
            Project Overview
          </h2>
          <div className="text-neutral-700 dark:text-neutral-300 whitespace-pre-line leading-relaxed">
            {project.description}
          </div>
        </section>
      )}

      {/* Gallery */}
      <PortfolioGallery
        cover={project.cover}
        gallery={project.gallery}
        projectTitle={project.title}
      />
    </main>
  );
}
