-- ONEDECORE Phase 2E3B Deterministic Local Test Fixtures Seed Script

TRUNCATE TABLE public.portfolio_media_sources, public.portfolio_media, public.portfolio_project_services, public.portfolio_projects CASCADE;

-- Insert dummy admin user into auth.users for FK integrity
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@onedecore.in',
  'dummy_hash',
  NOW(),
  NOW(),
  NOW(),
  '{}',
  '{}',
  false
) ON CONFLICT (id) DO NOTHING;

-- 1. Featured Published Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, description, status, is_featured, published_at,
  created_at, updated_at, created_by, updated_by, location_label, property_type, completion_year, sort_order
) VALUES (
  '10000000-0000-4000-a000-000000000001',
  'published-featured-villa',
  'Published Featured Villa',
  'Complete home interior project for a luxury villa in Bandra.',
  'Detailed overview of the Bandra villa complete interior transformation.',
  'published',
  true,
  NOW(),
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Bandra, Mumbai',
  '4 BHK Villa',
  2026,
  1
);

INSERT INTO public.portfolio_project_services (project_id, service_code)
VALUES ('10000000-0000-4000-a000-000000000001', 'complete_home_interiors');

INSERT INTO public.portfolio_media (
  id, project_id, media_role, status, public_object_path, width_px, height_px,
  file_size_bytes, mime_type, alt_text, caption, sort_order, created_at, updated_at, created_by, updated_by
) VALUES (
  '10000000-0000-4000-b000-000000000001',
  '10000000-0000-4000-a000-000000000001',
  'cover',
  'ready',
  '10000000-0000-4000-a000-000000000001/10000000-0000-4000-b000-000000000001/cover-1600.webp',
  1600,
  1000,
  50000,
  'image/webp',
  'Bandra Villa Living Room',
  'Spacious living room',
  1,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- Gallery items for p1
INSERT INTO public.portfolio_media (
  id, project_id, media_role, status, public_object_path, width_px, height_px,
  file_size_bytes, mime_type, alt_text, sort_order, created_at, updated_at, created_by, updated_by
) VALUES
(
  '10000000-0000-4000-c000-000000000001',
  '10000000-0000-4000-a000-000000000001',
  'gallery', 'ready',
  '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000001/gallery-1200.webp',
  1200, 800, 40000, 'image/webp', 'Master Bedroom View', 1, '2026-07-01 10:00:00+00', '2026-07-01 10:00:00+00',
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
),
(
  '10000000-0000-4000-c000-000000000002',
  '10000000-0000-4000-a000-000000000001',
  'gallery', 'ready',
  '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000002/gallery-1200.webp',
  1200, 800, 40000, 'image/webp', 'Dining Area View', 2, '2026-07-01 11:00:00+00', '2026-07-01 11:00:00+00',
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
),
(
  '10000000-0000-4000-c000-000000000003',
  '10000000-0000-4000-a000-000000000001',
  'gallery', 'ready',
  '10000000-0000-4000-a000-000000000001/10000000-0000-4000-c000-000000000003/gallery-1200.webp',
  1200, 800, 40000, 'image/webp', 'Balcony View', 3, '2026-07-01 12:00:00+00', '2026-07-01 12:00:00+00',
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
);

-- 2. Non-featured Published Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, is_featured, published_at,
  created_at, updated_at, created_by, updated_by, location_label, property_type, completion_year, sort_order
) VALUES (
  '20000000-0000-4000-a000-000000000002',
  'published-regular-kitchen',
  'Published Modular Kitchen',
  'Sleek german modular kitchen transformation in Worli.',
  'published',
  false,
  NOW(),
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Worli, Mumbai',
  '3 BHK Apartment',
  2026,
  2
);

INSERT INTO public.portfolio_project_services (project_id, service_code)
VALUES ('20000000-0000-4000-a000-000000000002', 'modular_kitchens');

INSERT INTO public.portfolio_media (
  id, project_id, media_role, status, public_object_path, width_px, height_px,
  file_size_bytes, mime_type, alt_text, sort_order, created_at, updated_at, created_by, updated_by
) VALUES (
  '20000000-0000-4000-b000-000000000002',
  '20000000-0000-4000-a000-000000000002',
  'cover',
  'ready',
  '20000000-0000-4000-a000-000000000002/20000000-0000-4000-b000-000000000002/cover-1600.webp',
  1600,
  1000,
  50000,
  'image/webp',
  'Worli Modular Kitchen',
  1,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- 3. Draft Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, is_featured, created_at, updated_at, created_by, updated_by
) VALUES (
  '30000000-0000-4000-a000-000000000003',
  'draft-penthouse-design',
  'Draft Penthouse Design',
  'Work in progress penthouse design concept.',
  'draft',
  false,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- 4. Archived Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, is_featured, created_at, updated_at, created_by, updated_by
) VALUES (
  '40000000-0000-4000-a000-000000000004',
  'archived-legacy-project',
  'Archived Legacy Project',
  'Old archive project.',
  'archived',
  false,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- 5. Missing-service Malformed Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by
) VALUES (
  '50000000-0000-4000-a000-000000000005',
  'malformed-no-service',
  'Malformed No Service',
  'Project missing service mapping.',
  'published',
  NOW(),
  false,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

INSERT INTO public.portfolio_media (
  id, project_id, media_role, status, public_object_path, width_px, height_px,
  file_size_bytes, mime_type, alt_text, sort_order, created_at, updated_at, created_by, updated_by
) VALUES (
  '50000000-0000-4000-b000-000000000005',
  '50000000-0000-4000-a000-000000000005',
  'cover',
  'ready',
  '50000000-0000-4000-a000-000000000005/50000000-0000-4000-b000-000000000005/cover-1600.webp',
  1600,
  1000,
  50000,
  'image/webp',
  'Malformed Cover',
  1,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- 6. Missing-cover Malformed Project
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by
) VALUES (
  '60000000-0000-4000-a000-000000000006',
  'malformed-no-cover',
  'Malformed No Cover',
  'Project missing cover image.',
  'published',
  NOW(),
  false,
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

INSERT INTO public.portfolio_project_services (project_id, service_code)
VALUES ('60000000-0000-4000-a000-000000000006', 'custom_wardrobes');

-- 7. 12 Additional Displayable Published Projects (total 14 published projects)
INSERT INTO public.portfolio_projects (
  id, slug, title, summary, status, published_at, is_featured, created_at, updated_at, created_by, updated_by, sort_order
) VALUES
('70000000-0000-4000-a000-000000000001', 'published-project-01', 'Published Project 01', 'Interior project 01 summary description.', 'published', NOW() - INTERVAL '1 hour', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 11),
('70000000-0000-4000-a000-000000000002', 'published-project-02', 'Published Project 02', 'Interior project 02 summary description.', 'published', NOW() - INTERVAL '2 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 12),
('70000000-0000-4000-a000-000000000003', 'published-project-03', 'Published Project 03', 'Interior project 03 summary description.', 'published', NOW() - INTERVAL '3 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 13),
('70000000-0000-4000-a000-000000000004', 'published-project-04', 'Published Project 04', 'Interior project 04 summary description.', 'published', NOW() - INTERVAL '4 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 14),
('70000000-0000-4000-a000-000000000005', 'published-project-05', 'Published Project 05', 'Interior project 05 summary description.', 'published', NOW() - INTERVAL '5 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 15),
('70000000-0000-4000-a000-000000000006', 'published-project-06', 'Published Project 06', 'Interior project 06 summary description.', 'published', NOW() - INTERVAL '6 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 16),
('70000000-0000-4000-a000-000000000007', 'published-project-07', 'Published Project 07', 'Interior project 07 summary description.', 'published', NOW() - INTERVAL '7 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 17),
('70000000-0000-4000-a000-000000000008', 'published-project-08', 'Published Project 08', 'Interior project 08 summary description.', 'published', NOW() - INTERVAL '8 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 18),
('70000000-0000-4000-a000-000000000009', 'published-project-09', 'Published Project 09', 'Interior project 09 summary description.', 'published', NOW() - INTERVAL '9 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 19),
('70000000-0000-4000-a000-000000000010', 'published-project-10', 'Published Project 10', 'Interior project 10 summary description.', 'published', NOW() - INTERVAL '10 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 20),
('70000000-0000-4000-a000-000000000011', 'published-project-11', 'Published Project 11', 'Interior project 11 summary description.', 'published', NOW() - INTERVAL '11 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 21),
('70000000-0000-4000-a000-000000000012', 'published-project-12', 'Published Project 12', 'Interior project 12 summary description.', 'published', NOW() - INTERVAL '12 hours', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 22);

-- Services for 12 projects
INSERT INTO public.portfolio_project_services (project_id, service_code) VALUES
('70000000-0000-4000-a000-000000000001', 'complete_home_interiors'),
('70000000-0000-4000-a000-000000000002', 'modular_kitchens'),
('70000000-0000-4000-a000-000000000003', 'custom_wardrobes'),
('70000000-0000-4000-a000-000000000004', 'complete_home_interiors'),
('70000000-0000-4000-a000-000000000005', 'modular_kitchens'),
('70000000-0000-4000-a000-000000000006', 'custom_wardrobes'),
('70000000-0000-4000-a000-000000000007', 'complete_home_interiors'),
('70000000-0000-4000-a000-000000000008', 'modular_kitchens'),
('70000000-0000-4000-a000-000000000009', 'custom_wardrobes'),
('70000000-0000-4000-a000-000000000010', 'complete_home_interiors'),
('70000000-0000-4000-a000-000000000011', 'modular_kitchens'),
('70000000-0000-4000-a000-000000000012', 'custom_wardrobes');

-- Cover media for 12 projects
INSERT INTO public.portfolio_media (
  id, project_id, media_role, status, public_object_path, width_px, height_px,
  file_size_bytes, mime_type, alt_text, sort_order, created_at, updated_at, created_by, updated_by
) VALUES
('70000000-0000-4000-b000-000000000001', '70000000-0000-4000-a000-000000000001', 'cover', 'ready', '70000000-0000-4000-a000-000000000001/70000000-0000-4000-b000-000000000001/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 01', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000002', '70000000-0000-4000-a000-000000000002', 'cover', 'ready', '70000000-0000-4000-a000-000000000002/70000000-0000-4000-b000-000000000002/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 02', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000003', '70000000-0000-4000-a000-000000000003', 'cover', 'ready', '70000000-0000-4000-a000-000000000003/70000000-0000-4000-b000-000000000003/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 03', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000004', '70000000-0000-4000-a000-000000000004', 'cover', 'ready', '70000000-0000-4000-a000-000000000004/70000000-0000-4000-b000-000000000004/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 04', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000005', '70000000-0000-4000-a000-000000000005', 'cover', 'ready', '70000000-0000-4000-a000-000000000005/70000000-0000-4000-b000-000000000005/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 05', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000006', '70000000-0000-4000-a000-000000000006', 'cover', 'ready', '70000000-0000-4000-a000-000000000006/70000000-0000-4000-b000-000000000006/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 06', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000007', '70000000-0000-4000-a000-000000000007', 'cover', 'ready', '70000000-0000-4000-a000-000000000007/70000000-0000-4000-b000-000000000007/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 07', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000008', '70000000-0000-4000-a000-000000000008', 'cover', 'ready', '70000000-0000-4000-a000-000000000008/70000000-0000-4000-b000-000000000008/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 08', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000009', '70000000-0000-4000-a000-000000000009', 'cover', 'ready', '70000000-0000-4000-a000-000000000009/70000000-0000-4000-b000-000000000009/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 09', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000010', '70000000-0000-4000-a000-000000000010', 'cover', 'ready', '70000000-0000-4000-a000-000000000010/70000000-0000-4000-b000-000000000010/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 10', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000011', '70000000-0000-4000-a000-000000000011', 'cover', 'ready', '70000000-0000-4000-a000-000000000011/70000000-0000-4000-b000-000000000011/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 11', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'),
('70000000-0000-4000-b000-000000000012', '70000000-0000-4000-a000-000000000012', 'cover', 'ready', '70000000-0000-4000-a000-000000000012/70000000-0000-4000-b000-000000000012/cover-1600.webp', 1600, 1000, 50000, 'image/webp', 'Cover 12', 1, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
