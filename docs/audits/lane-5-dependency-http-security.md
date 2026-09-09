# Lane 5 — dependency security, XLSX ingestion, CSP and HSTS

**Date:** 2026-09-09
**Branch:** `chore/dependency-http-security-csp`
**Starting main:** `acd3051a9b59bae2e868ec0516b89eaaf1f14124`
**Migrations:** 67, unchanged. No migration, no managed SQL, no deployment.

---

## 1. Dependency advisories

The repository's own truth document claimed *"7 npm advisories (4 high, 3
moderate); direct: sharp, exceljs, csv-parse"*. A fresh audit was run rather
than trusted; the totals matched, the composition did not, and two of the highs
were in packages the sentence never named.

### Before

| Audit | critical | high | moderate | total |
| :--- | ---: | ---: | ---: | ---: |
| full (`npm audit`) | 0 | 4 | 3 | 7 |
| production (`--omit=dev`) | 0 | 3 | 3 | 6 |

| Package | Severity | Prod path | Advisory |
| :--- | :--- | :--- | :--- |
| `sharp` 0.35.3 | high | direct | GHSA-rgj7-g3m4-5g8c (libheif) |
| `brace-expansion` 1.1.16 | high | exceljs → archiver → archiver-utils → glob → minimatch | GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 |
| `nanoid` 3.3.16 | high | next → postcss | GHSA-2v37-7h3g-55p8 |
| `js-yaml` 4.3.0 | high | eslint → @eslint/eslintrc — **dev only** | GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh |
| `csv-parse` 5.6.0 | moderate | direct | GHSA-8cw4-87c7-c6xx |
| `uuid` 8.3.2 | moderate | exceljs | GHSA-w5hq-g745-h8pq |
| `exceljs` 4.4.0 | moderate | direct — *inherited from uuid, no advisory of its own* | — |

`brace-expansion` and `nanoid` were checked with `npm ls --omit=dev` rather than
assumed dev-only from their hoisted position: both are genuinely reachable from
production dependencies. `js-yaml` is not.

### After

| Audit | critical | high | moderate | total |
| :--- | ---: | ---: | ---: | ---: |
| full | 0 | **0** | 3 | 3 |
| production | 0 | **0** | 3 | 3 |

### Changes

| Change | Kind | Why |
| :--- | :--- | :--- |
| `sharp` 0.35.3 → **0.35.4** | direct, patch | Fixes the libheif advisory. `isSemVerMajor: false`. All 17 image tests pass unchanged. |
| `brace-expansion` 1.1.16 → **1.1.18** | transitive | `npm audit fix`, no breaking change |
| `brace-expansion` (typescript-estree) 5.0.8 → **5.0.9** | transitive, dev | same |
| `nanoid` 3.3.16 → **3.3.18** | transitive | same |
| `js-yaml` → patched | transitive, dev | same |

`npm audit fix --force` was **not** used. Every lockfile change resolves from
`registry.npmjs.org`; no git, `file:`, tarball or forked dependency was
introduced. The 27 additional lockfile entries are `@img/sharp-*` platform
binaries and `@emnapi/runtime`, which move with sharp.

`csv-parse` was **not** upgraded. Its fix is 7.0.2 — two majors on from 5.6.0 —
and the finding is not reachable (below). `supabase` CLI stays pinned at 2.109.1
because Lane 4's type-generation reproducibility depends on it.

### Remaining advisories — 3, all moderate, none blocking

**`csv-parse` GHSA-8cw4-87c7-c6xx — NOT_REACHABLE.** The advisory says prototype
replacement is still reachable "via the columns path", and this importer does
parse attacker-supplied CSV with `columns: true`. That made it worth testing
rather than reasoning about. Fed the importer's exact option set (`bom`,
`columns: true`, `skip_empty_lines`, `relax_column_count: false`, `trim`), a
`__proto__` header column is **dropped from the record**, `Object.prototype` is
untouched, `constructor` becomes an ordinary own property, and dotted headers
are not expanded into a path. The probe is kept as a test, so a future bump or
an option change re-checks the finding instead of inheriting this conclusion.

**`uuid` GHSA-w5hq-g745-h8pq — NOT_REACHABLE.** The advisory is a missing buffer
bounds check in **v3/v5/v6 when `buf` is provided**. ExcelJS imports only `v4`,
in one file (`cf-rule-ext-xform.js`, conditional-formatting x14Id generation),
and passes no `buf`. That file is on the workbook **write** path; OneDecore only
reads. Not reachable twice over. A `uuid` major override was not forced: it
would be a breaking change to a dependency's internals to resolve a finding that
cannot fire.

**`exceljs`** carries no advisory of its own — npm lists it as vulnerable
*because* of uuid. npm's suggested "fix" is a downgrade to 3.4.0, which is a
breaking change backwards and does not apply.

No exception file was needed, because nothing high or critical remains. The
guard supports one; its shape is described below.

### Not an npm advisory, but recorded

`Workbook.xlsx.load` is a reachable resource-amplification surface regardless of
what the advisory database says. Section 2 is the mitigation.

---

## 2. XLSX ingestion

### The gap

`.xlsx` is a ZIP. The import path already bounded the upload at 5 MiB and the
parsed sheet at 1000 rows × 50 columns — but the row and column limits are
applied to a workbook ExcelJS has **already decompressed**. They bound the
result, not the work. A 5 MiB archive declaring gigabytes of content reached the
parser first and the limits second.

Bulk import is super-admin-only, which narrows who can reach the code. It does
not make the workbook trustworthy: the file usually came from a portal export,
an agency or a client.

### The gate

`src/features/crm/server/xlsx-archive-preflight.ts` — `assertSafeXlsxArchive`,
called from `extractXlsxHeadersAndRecords` **before** the loader. It reads the
ZIP central directory and decompresses nothing.

Rejected, all with `IMPORT_UNSAFE_ARCHIVE` / HTTP 422: non-ZIP; missing or
malformed end-of-central-directory; multi-disk; ZIP64 (locator or sentinel);
too many entries; oversized declared entry; oversized declared total; absurd
declared ratio; content declared from zero compressed bytes; encrypted entries;
absolute paths; `..` traversal; `xl/vbaProject.bin`; missing
`[Content_Types].xml` or `xl/workbook.xml`.

The caller gets one message that does not say which check fired; the reason goes
to `CrmError.details`, which stays on the server.

### Limits, and where they came from

Measured against workbooks written at the contract ceiling of 1000 × 50:

| Workbook | Entries | Total uncompressed | Largest entry | Worst entry ratio |
| :--- | ---: | ---: | ---: | ---: |
| realistic lead data | 16 | 3.69 MiB | 1.99 MiB | 19.8× |
| high-entropy cells | 16 | 3.49 MiB | 1.79 MiB | 11.9× |
| 200-character text cells | 16 | **12.25 MiB** | **10.55 MiB** | **70.8×** |
| typical import (200 × 12) | 16 | 0.16 MiB | 0.08 MiB | 10.1× |

| Limit | Value | Against measurement |
| :--- | ---: | :--- |
| `maxEntries` | 256 | 16 observed; headroom for Excel/Sheets files, which carry more parts than ExcelJS emits |
| `maxEntryUncompressedBytes` | 16 MiB | 10.55 MiB observed |
| `maxTotalUncompressedBytes` | 32 MiB | 12.25 MiB observed |
| `maxEntryCompressionRatio` | 250× | 70.8× observed |

The third row is why the suggested tidier values were not used: a legitimate
workbook of long pasted text really does expand past 12 MiB and really does
compress at 71:1, because XML of repeated markup is extremely compressible.
Limits set at 8 MiB per entry or 100:1 would have rejected honest imports.

The two limits are complementary rather than redundant: the aggregate cap bounds
total damage (32 MiB from a 5 MiB upload), and the ratio cap catches a
single-entry bomb that would otherwise stay under it.

### Residual risk — stated plainly

These are the sizes the central directory **declares**. A deflate stream can
declare one size and produce another, and nothing short of decompressing with a
hard output cap would catch that. This bounds the ordinary constructions — a
nested or repeated-block bomb, a hundred thousand members, a member claiming
gigabytes — and is a material improvement over no bound at all.

**It is not a proof, and XLSX denial-of-service is not "impossible".** If that
becomes the threat worth spending on, the answer is a streaming parser with an
output ceiling, not more rows in the limit table.

One behavioural consequence worth knowing: a grossly oversized but benign
workbook that previously failed with `IMPORT_TOO_MANY_ROWS` may now fail earlier
with `IMPORT_UNSAFE_ARCHIVE`. Both are 422; the rejection is correct either way.

### Proof

35 tests in `src/features/crm/__tests__/xlsx-archive-preflight.test.ts`. Every
archive is built byte by byte and stays a few hundred bytes long — the dangerous
cases are dangerous in what they *declare*, which is what the gate reads, so
nothing has to actually expand to test the limit that stops expansion.

The ordering guarantee is tested with an **injected loader that records whether
it ran**: for eleven unsafe archives the loader is never called, and for a safe
one it is called exactly once. Reading the source and seeing the two statements
in the right order would prove nothing about execution.

Preserved and re-tested: first worksheet, formula rejection, 1000-row and
50-column limits, header-keyed records, header fingerprint, worksheet name, and
the 5 MiB ceiling. A workbook at the full contract ceiling passes the gate.

---

## 3. HTTP security headers

### Before

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

No CSP. No HSTS.

### After

The four above, unchanged, plus in production only:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lpurlfmpvriyvpkujvyl.supabase.co; font-src 'self' data:; connect-src 'self' https://lpurlfmpvriyvpkujvyl.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; manifest-src 'self'; worker-src 'self' blob:
Strict-Transport-Security: max-age=31536000
```

### Why static-compatible and not nonce-based

A strict nonce policy needs a fresh nonce per request, which forces every page
carrying it to render dynamically. OneDecore's public pages — the ones that
convert visitors into enquiries — are statically prerendered, and trading their
rendering mode for a stricter script policy is a decision with a real cost.

So this is honest about what it is:

- **It does** bound where scripts, styles, images, fonts, connections, frames
  and form posts may come from. An injected `<script src="https://evil...">`
  does not load. Data cannot be exfiltrated to an arbitrary origin by fetch,
  image beacon or form post. The page cannot be framed. No plugins, no base-tag
  hijacking, no `eval`.
- **It does not** stop an injected *inline* script — `'unsafe-inline'` is
  present for scripts and is currently load-bearing, because the portfolio and
  product pages carry `<script type="application/ld+json">` JSON-LD, which CSP
  governs under `script-src`. Output encoding and React's escaping remain the
  controls that stop XSS.

Moving to nonces later is a project with a rendering-mode decision attached, not
a string tightened in one file.

### Browser origin inventory

| Class | Origins | Evidence |
| :--- | :--- | :--- |
| SCRIPT | `'self'` + inline | No `next/script`, no tag manager, no analytics. Built client chunks reference only `nextjs.org`, `react.dev`, `github.com` — framework error/doc strings, never fetched. |
| STYLE | `'self'` + inline | Next injects critical CSS; the quotation preview document carries inline styles. |
| IMAGE | `'self'`, `data:`, `blob:`, managed Supabase | `next/image` remote patterns; `URL.createObjectURL` in the portfolio media manager. |
| FONT | `'self'`, `data:` | `next/font/google` self-hosts at build time; no runtime CDN. |
| CONNECT | `'self'`, managed Supabase | No absolute-URL browser fetch. No realtime channel, so no `wss:`. |
| FRAME | none | One `<iframe sandbox="" srcDoc>` for the quotation preview — see below. |
| MEDIA / WORKER / MANIFEST | `'self'` (+ `blob:` for workers) | No `new Worker`; `blob:` kept as a defensive allowance. |

`https://wa.me/...` is an ordinary link, not a fetch or a frame, so no directive
covers it. Server-side Meta, Google and Groq endpoints are not browser origins
and are deliberately absent.

The Supabase origin is taken from the repository constant
`ONEDECORE_MANAGED_SUPABASE_HOST`, not from `NEXT_PUBLIC_SUPABASE_URL`. A
production build made with a developer's local env would otherwise ship a policy
naming `http://127.0.0.1:54321`.

### `frame-src 'none'` was measured, not assumed

The quotation preview is `<iframe sandbox="" srcDoc={html}>`, and browsers have
disagreed about whether a `srcdoc` frame is checked against `frame-src` or
inherits the parent policy. A probe served both policies with a sandboxed srcdoc
frame and a `securitypolicyviolation` listener: under `frame-src 'none'` the
frame **loads and raises no violation** in Chrome. The strictest value is also
the working one.

If a browser is ever found that checks srcdoc against `frame-src`, the symptom
is an empty preview box in admin and the fix is `'self'`. Nothing else frames
anything.

### HSTS

`max-age=31536000`, no `includeSubDomains`, no `preload`. Subdomains of
onedecore.in are not inventoried here, and preload is an effectively
irreversible submission to a browser-vendor list — neither belongs in a change
that has not been deployed and observed.

**Configured, not live.** Whether these headers reach a browser on onedecore.in
depends on a deployment this lane does not perform.

### Route classification

`next build` route output was captured before and after. Identical: 10 static,
108 dynamic, same routes in each class. The CSP changed no page's rendering
mode, which is exactly what a static-compatible policy is for.

### Local production smoke

`next start` on port 4711 against the production build:

| Path | Status | Headers |
| :--- | :--- | :--- |
| `/` | 200 | all four + CSP + HSTS; `Cache-Control: s-maxage=300, stale-while-revalidate=…` |
| `/interiors` | 200 | all four + CSP + HSTS; same cache header |
| `/shop` | 200 | all four + CSP + HSTS |
| `/api/health` | 200 | all four + CSP + HSTS; `cache-control: no-store` |
| 404 path | 404 | all four + CSP + HSTS |
| `/auth/login` | **500** | `Cache-Control: private, no-cache, no-store…` only |
| `/admin` | **500** | same |

The two 500s are **not** a Lane 5 regression. `next start` runs with
`NODE_ENV=production`, and the local `.env` points at `127.0.0.1:54321`, which
the Lane 1 runtime-target guard correctly refuses in production. Header presence
on those two routes could not be observed locally; the header rule matches
`/:path*`, and both a dynamic route (`/shop`, `/api/health`) and an error route
(404) carry the full set.

Worth recording separately: Next's unhandled-500 path does **not** carry the
configured headers. No form was submitted and no managed endpoint was called.

---

## 4. CI guard

`npm run verify:dependencies` → `scripts/verify-dependency-security.mjs`, joined
to `npm run check`, so it runs in **Application Quality**. It needs no database.

Policy:

- **Fails** on any unreviewed production **critical** or **high**.
- **Reports** moderate and low. A guard that fails a release on every moderate
  gets bypassed, and a bypassed guard protects nothing.
- **Dev-only** advisories are not enforced.
- Prints advisory ids, packages and URLs — not the audit JSON, and no secrets.

An exception is per-advisory and must state: `advisory`, `package`, `severity`,
`path`, `whyNoSafePatch`, `reachability`, `compensatingControl`, `reviewBy`,
`removeWhen`. An incomplete exception fails; an expired one fails. There is no
"ignore this package" switch. **No exception file exists today**, because
nothing high or critical remains.

The policy lives in `scripts/lib/dependency-policy.mjs` as pure functions, so
the suite feeds it synthetic audits and checks what comes back — including that
a production high does block, that a moderate does not, that an expired
exception fails, and that an exception excuses only its own advisory.

npm is invoked as `node <npm-cli.js>` rather than `npm.cmd`: Node refuses to
spawn a `.cmd` without a shell, and reaching for `shell: true` would mean the
command line is re-parsed by cmd.exe on Windows and sh on Linux.

---

## 5. What this lane did not do

- No migration, no managed SQL, no `db push`, no Supabase branch, no RLS change.
- No deployment, no SSH, no PM2, no Nginx, no production env change.
- No feature activation, no repository visibility change.
- `src/types/database.generated.ts` untouched; the Lane 4 overlay and its
  PostgREST 14.5 pin are intact.
- No COOP/COEP/CORP — they can break popups and resources and were not required.
- No nonce CSP, no `report-uri` endpoint, no third-party origin added
  speculatively.
- The pre-existing local ordering issue — `check:db` must run before
  `test:phase-9d-d1-concurrency` on the same database — was left alone.
- Six pre-existing `as any`/`@ts-ignore` occurrences elsewhere in `src/` are
  unrelated and untouched.
