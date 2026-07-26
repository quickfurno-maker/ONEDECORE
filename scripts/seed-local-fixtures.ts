import { execSync } from "node:child_process";

export function executeSql(sql: string) {
  const sanitized = sql.replace(/"/g, '\\"').replace(/\n/g, " ");
  const cmd = `npx supabase db query "${sanitized}"`;
  execSync(cmd, { stdio: "ignore" });
}

export function seedFixtures() {
  console.log("[SeedFixtures] Resetting tables...");
  executeSql(
    "TRUNCATE TABLE public.portfolio_media_sources, public.portfolio_media, public.portfolio_project_services, public.portfolio_projects CASCADE;"
  );

  console.log("[SeedFixtures] Inserting Featured Villa...");
  executeSql(`
    INSERT INTO public.portfolio_projects (
      id, slug, title, summary, description, status, is_featured, published_at,
      created_at, updated_at, created_by, updated_by, location_label, property_type, completion_year, sort_order
    ) VALUES (
      '10000000-0000-4000-a000-000000000001',
      'published-featured-villa',
      'Published Featured Villa',
      'Complete home interior project for a luxury villa in Bandra.',
      'Detailed overview of the Bandra villa complete interior transformation.',
      'published', true, NOW(), NOW(), NOW(),
      '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
      'Bandra, Mumbai', '4 BHK Villa', 2026, 1
    );
  `);

  executeSql(`
    INSERT INTO public.portfolio_project_services (project_id, service_code)
    VALUES ('10000000-0000-4000-a000-000000000001', 'complete_home_interiors');
  `);

  executeSql(`
    INSERT INTO public.portfolio_media (
      id, project_id, media_role, status, public_object_path, width_px, height_px,
      alt_text, caption, sort_order, created_at, updated_at, created_by, updated_by
    ) VALUES (
      '10000000-0000-4000-b000-000000000001',
      '10000000-0000-4000-a000-000000000001',
      'cover', 'ready',
      '10000000-0000-4000-a000-000000000001/10000000-0000-4000-b000-000000000001/cover-1600.webp',
      1600, 1000, 'Bandra Villa Living Room', 'Spacious living room', 1, NOW(), NOW(),
      '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
    );
  `);

  // Gallery items for p1
  executeSql(`
    INSERT INTO public.portfolio_media (
      id, project_id, media_role, status, public_object_path, width_px, height_px,
      alt_text, sort_order, created_at, updated_at, created_by, updated_by
    ) VALUES
    ('10000000-0000-4000-c000-000000000001', '10000000-0000-4000-a000-000000000001', 'gallery', 'ready', '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000001/gallery-1200.webp', 1200, 800, 'Master Bedroom View', 1, '2026-07-01 10:00:00+00', '2026-07-01 10:00:00+00', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
    ('10000000-0000-4000-c000-000000000002', '10000000-0000-4000-a000-000000000001', 'gallery', 'ready', '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000002/gallery-1200.webp', 1200, 800, 'Dining Area View', 2, '2026-07-01 11:00:00+00', '2026-07-01 11:00:00+00', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
    ('10000000-0000-4000-c000-000000000003', '10000000-0000-4000-a000-000000000001', 'gallery', 'ready', '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000003/gallery-1200.webp', 1200, 800, 'Balcony View', 3, '2026-07-01 12:00:00+00', '2026-07-01 12:00:00+00', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);

  console.log("[SeedFixtures] Inserting Non-featured Kitchen...");
  executeSql(`
    INSERT INTO public.portfolio_projects (
      id, slug, title, summary, status, is_featured, published_at,
      created_at, updated_at, created_by, updated_by, location_label, property_type, completion_year, sort_order
    ) VALUES (
      '20000000-0000-4000-a000-000000000002', 'published-regular-kitchen', 'Published Modular Kitchen',
      'Sleek german modular kitchen transformation in Worli.', 'published', false, NOW(), NOW(), NOW(),
      '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Worli, Mumbai', '3 BHK Apartment', 2026, 2
    );
  `);

  executeSql(`
    INSERT INTO public.portfolio_project_services (project_id, service_code)
    VALUES ('20000000-0000-4000-a000-000000000002', 'modular_kitchens');
  `);

  executeSql(`
    INSERT INTO public.portfolio_media (
      id, project_id, media_role, status, public_object_path, width_px, height_px,
      alt_text, sort_order, created_at, updated_at, created_by, updated_by
    ) VALUES (
      '20000000-0000-4000-b000-000000000002', '20000000-0000-4000-a000-000000000002', 'cover', 'ready',
      '20000000-0000-4000-a000-000000000002/20000000-0000-4000-b000-000000000002/cover-1600.webp',
      1600, 1000, 'Worli Modular Kitchen', 1, NOW(), NOW(),
      '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
    );
  `);

  console.log("[SeedFixtures] Inserting Draft and Archived...");
  executeSql(`
    INSERT INTO public.portfolio_projects (id, slug, title, summary, status, is_featured, created_at, updated_at, created_by, updated_by)
    VALUES ('30000000-0000-4000-a000-000000000003', 'draft-penthouse-design', 'Draft Penthouse Design', 'Work in progress penthouse concept.', 'draft', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);

  executeSql(`
    INSERT INTO public.portfolio_projects (id, slug, title, summary, status, is_featured, created_at, updated_at, created_by, updated_by)
    VALUES ('40000000-0000-4000-a000-000000000004', 'archived-legacy-project', 'Archived Legacy Project', 'Old archive project.', 'archived', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);

  console.log("[SeedFixtures] Inserting Malformed projects...");
  executeSql(`
    INSERT INTO public.portfolio_projects (id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by)
    VALUES ('50000000-0000-4000-a000-000000000005', 'malformed-no-service', 'Malformed No Service', 'Missing service mapping.', 'published', NOW(), false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);
  executeSql(`
    INSERT INTO public.portfolio_media (id, project_id, media_role, status, public_object_path, width_px, height_px, alt_text, sort_order, created_at, updated_at, created_by, updated_by)
    VALUES ('50000000-0000-4000-b000-000000000005', '50000000-0000-4000-a000-000000000005', 'cover', 'ready', '50000000-0000-4000-a000-000000000005/50000000-0000-4000-b000-000000000005/cover-1600.webp', 1600, 1000, 'Malformed Cover', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);

  executeSql(`
    INSERT INTO public.portfolio_projects (id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by)
    VALUES ('60000000-0000-4000-a000-000000000006', 'malformed-no-cover', 'Malformed No Cover', 'Missing cover image.', 'published', NOW(), false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
  `);
  executeSql(`
    INSERT INTO public.portfolio_project_services (project_id, service_code)
    VALUES ('60000000-0000-4000-a000-000000000006', 'custom_wardrobes');
  `);

  console.log("[SeedFixtures] Inserting 12 additional published projects...");
  const serviceCodes = ["complete_home_interiors", "modular_kitchens", "custom_wardrobes"];
  for (let i = 1; i <= 12; i++) {
    const num = i.toString().padStart(2, "0");
    const pId = `70000000-0000-4000-a000-${num.padStart(12, "0")}`;
    const mId = `70000000-0000-4000-b000-${num.padStart(12, "0")}`;
    const sCode = serviceCodes[(i - 1) % serviceCodes.length];

    executeSql(`
      INSERT INTO public.portfolio_projects (id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by, sort_order)
      VALUES ('${pId}', 'published-project-${num}', 'Published Project ${num}', 'Interior project ${num} summary.', 'published', NOW() - INTERVAL '${i} hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', ${10 + i});
    `);

    executeSql(`
      INSERT INTO public.portfolio_project_services (project_id, service_code)
      VALUES ('${pId}', '${sCode}');
    `);

    executeSql(`
      INSERT INTO public.portfolio_media (id, project_id, media_role, status, public_object_path, width_px, height_px, alt_text, sort_order, created_at, updated_at, created_by, updated_by)
      VALUES ('${mId}', '${pId}', 'cover', 'ready', '${pId}/${mId}/cover-1600.webp', 1600, 1000, 'Cover ${num}', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
    `);
  }

  console.log("[SeedFixtures] Successfully seeded all local test fixtures!");
}

if (process.argv[1]?.includes("seed-local-fixtures")) {
  try {
    seedFixtures();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
