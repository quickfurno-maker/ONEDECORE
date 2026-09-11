/**
 * Load the owner's six approved banner creatives into LOCAL Supabase.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * The six homepage banners are CMS content, not repository content. They live
 * in the `website-banners` storage bucket with their paths in
 * `website_homepage_banners`, and the only sanctioned way to put them there in
 * production is an authenticated Website Manager session.
 *
 * That leaves local visual QA in a bind: with empty slots the rail renders
 * `Banner 1`...`Banner 6` placeholder frames, so a screenshot of the homepage
 * shows the one thing the launch brief says must never ship. This script fills
 * the LOCAL database so QA photographs the real page.
 *
 * WHAT IT IS NOT
 *
 * It is not a deployment path and it is not a way around the admin. It refuses
 * to run against anything but a local Supabase URL, it writes nothing to the
 * repository, and it takes the images from a folder the caller names rather
 * than from `public/` — because committing banner artwork into the source tree
 * is exactly the "replace dynamic banners with source-code constants" move the
 * brief forbids.
 *
 * Usage:
 *   node scripts/dev-load-launch-banners.mjs "<path to 02-slider-banners>"
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assertLocalSupabaseUrl } from "./phase-5c1-qa-guards.mjs";

/**
 * The six slots, in the order the asset map fixes them.
 *
 * `alt` is required by the database once an image exists, and it must describe
 * the artwork rather than name a campaign — these creatives carry their own
 * headline text, so the alt repeats it for anyone who cannot see it.
 */
const BANNERS = [
  {
    file: "01-complete-home-interiors.webp",
    name: "Complete Home Interiors",
    alt: "Complete Home Interiors — design, manufacturing and installation by one team.",
  },
  {
    file: "02-modular-kitchens.webp",
    name: "Modular Kitchens",
    alt: "Modular Kitchens — storage, workflow and finishes planned around how you cook.",
  },
  {
    file: "03-custom-wardrobes.webp",
    name: "Custom Wardrobes",
    alt: "Custom Wardrobes — made-to-fit storage planned around your room.",
  },
  {
    file: "04-free-design-consultation.webp",
    name: "Free Design Consultation",
    alt: "Free Design Consultation — share your plan and get expert guidance, layouts and budget direction.",
  },
  {
    file: "05-false-ceiling-lighting.webp",
    name: "False Ceiling & Lighting",
    alt: "False Ceiling and Lighting — ceiling design and layered lighting planned together.",
  },
  {
    file: "06-civil-work-renovation.webp",
    name: "Civil Work & Renovation",
    alt: "Civil Work and Renovation — layout changes, ceilings, electrical and civil work managed together.",
  },
];

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: node scripts/dev-load-launch-banners.mjs <path to 02-slider-banners>");
  process.exit(1);
}

const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    shell: true,
  })
);

// The guard, before anything is read or written.
assertLocalSupabaseUrl(status.API_URL, "Supabase API URL");

const apiUrl = status.API_URL.replace(/\/$/, "");
const serviceKey = status.SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("Local Supabase did not report a service role key.");

const psql = (sql) =>
  execFileSync(
    "docker",
    ["exec", "supabase_db_OneDecore", "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", sql],
    { encoding: "utf8" }
  ).trim();

/** Upload one creative, replacing whatever is at that path. */
async function upload(path, bytes) {
  const response = await fetch(`${apiUrl}/storage/v1/object/website-banners/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "image/webp",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`Upload failed for ${path}: ${response.status} ${await response.text()}`);
  }
}

const escape = (value) => value.replace(/'/g, "''");

let index = 0;
for (const banner of BANNERS) {
  const source = join(sourceDir, banner.file);
  if (!existsSync(source)) throw new Error(`Missing creative: ${source}`);
  const bytes = readFileSync(source);

  /*
   * A stable storage path per slot. Re-running the script overwrites in place
   * rather than accumulating orphans, which is what an editor replacing a
   * creative through the admin would also produce.
   */
  const storagePath = `launch/${banner.file}`;
  await upload(storagePath, bytes);

  /*
   * Applied to BOTH the published version (what the homepage renders) and the
   * draft (what the admin opens), matched by sort_order so the numbered order
   * in the asset map is the order on the rail.
   */
  psql(`
    update public.website_homepage_banners b
       set desktop_image_path = '${escape(storagePath)}',
           mobile_image_path  = null,
           internal_name      = '${escape(banner.name)}',
           alt_text           = '${escape(banner.alt)}',
           is_enabled         = true,
           updated_at         = now()
      from public.website_homepage_versions v
     where v.id = b.version_id
       and v.state in ('published', 'draft')
       and b.sort_order = ${index};
  `);

  console.log(`slot ${index + 1}: ${banner.file} -> ${storagePath}`);
  index += 1;
}

const check = psql(`
  select v.state || ' ' || count(*) filter (where b.desktop_image_path is not null)
    from public.website_homepage_versions v
    join public.website_homepage_banners b on b.version_id = v.id
   where v.state in ('published', 'draft')
   group by v.state order by v.state;
`);
console.log("\nbanners with artwork:\n" + check);
