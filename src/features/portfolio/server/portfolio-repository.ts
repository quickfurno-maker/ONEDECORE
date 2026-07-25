import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.generated";

export type PortfolioProjectRow = Tables<"portfolio_projects">;
export type PortfolioMediaRow = Tables<"portfolio_media">;
export type PortfolioServiceRow = Tables<"portfolio_project_services">;

export interface PublishedProjectDetail {
  project: PortfolioProjectRow;
  services: PortfolioServiceRow[];
  media: PortfolioMediaRow[];
}

/**
 * Server repository for portfolio data operations.
 */
export async function getPublishedProjects(): Promise<PortfolioProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) {
    return [];
  }

  return data ?? [];
}

/**
 * Retrieves a single published portfolio project detail by unique slug.
 */
export async function getPublishedProjectBySlug(
  slug: string
): Promise<PublishedProjectDetail | null> {
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (projectError || !project) {
    return null;
  }

  const { data: services } = await supabase
    .from("portfolio_project_services")
    .select("*")
    .eq("project_id", project.id);

  const { data: media } = await supabase
    .from("portfolio_media")
    .select("*")
    .eq("project_id", project.id)
    .eq("status", "ready")
    .order("sort_order", { ascending: true });

  return {
    project,
    services: services ?? [],
    media: media ?? [],
  };
}

/**
 * Retrieves all portfolio projects for authorized staff (including drafts and archived).
 */
export async function getStaffProjects(): Promise<PortfolioProjectRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data ?? [];
}
