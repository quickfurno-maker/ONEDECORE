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

### Gate 1 — structure and declarations

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

### Gate 2 — what the bytes ACTUALLY expand to

**Gate 1 alone was not enough, and this was reproduced before it was fixed.**

The central directory records what an entry *claims* to expand to. Nothing makes
the deflate stream agree. A 17 KB archive declaring 1 MiB — 60:1, comfortably
inside every Gate 1 limit — inflates to 17 MiB, and Gate 1 accepted it:

```
archive bytes on disk : 17722 (0.02 MiB)
declared uncompressed : 1048576 (1.00 MiB)
ACTUAL inflate output : 17825792 (17.00 MiB)
declared ratio        : 60.5:1 (limit 250)
ACTUAL ratio          : 1028.0:1
GATE 1 VERDICT        : ACCEPTED  <-- the bypass
```

JSZip — the library ExcelJS parses with — *does* notice, throwing
`Bug : uncompressed data size mismatch`. But it compares lengths at the end of
the stream, once the whole output has been materialised. **The declaration
bounded the error message, not the memory.**

`src/features/crm/server/xlsx-bounded-decompression.ts` —
`assertBoundedXlsxDecompression`, run after Gate 1 and still before ExcelJS.
For every entry it:

- rejects any compression method other than stored (0) or deflate (8);
- locates the payload from the local file header, verifying the signature, that
  the local method matches the directory's, and that the byte range lies inside
  the uploaded buffer;
- inflates with `createInflateRaw`, **counting chunks and discarding them** —
  nothing accumulates, so measuring a 17 MiB expansion never holds 17 MiB;
- stops the stream the moment the per-entry ceiling (16 MiB) or the archive's
  remaining aggregate budget (32 MiB total) is crossed;
- requires the produced length to **equal** the declared length, in both
  directions.

Two independent stops, because they fail differently. `maxOutputLength` is
zlib's own ceiling, enforced inside the inflater, so a stream that would produce
a gigabyte cannot allocate one even if the accounting were wrong. The chunk
counting is what enforces the aggregate budget, which zlib knows nothing about,
and what destroys the stream mid-flight rather than at its end.

Local size fields are deliberately ignored in favour of the directory's
compressed size. An entry written with a data descriptor (general purpose bit 3)
leaves them zero and writes the real values after the payload — legal, and
produced by streaming writers. ExcelJS itself does not use bit 3 (verified:
16 entries, methods 8 and 0, no data descriptors), but Excel and LibreOffice
may, and rejecting it would reduce compatibility for no security gain.

After the fix:

```
GATE 1 VERDICT        : ACCEPTED  <-- declarations only, as designed
GATE 2 VERDICT        : REJECTED — ACTUAL_ENTRY_LIMIT in xl/sharedStrings.xml
PARSER PATH           : IMPORT_UNSAFE_ARCHIVE | loader calls: 0
```

Server-side detail distinguishes `ACTUAL_ENTRY_LIMIT`, `ACTUAL_TOTAL_LIMIT`,
`SIZE_MISMATCH`, `UNSUPPORTED_COMPRESSION`, `MALFORMED_LOCAL_HEADER` and
`CORRUPT_STREAM`. The public contract is unchanged: one `IMPORT_UNSAFE_ARCHIVE`
at HTTP 422, with no ZIP internals in the message.

### Residual risk — stated plainly

Peak memory on the import path is now bounded by the per-entry ceiling during
Gate 2 and by the aggregate ceiling across the archive, and a lying directory is
rejected rather than merely disbelieved.

**This is not a claim that XLSX parsing is now free of resource risk.** ExcelJS
still builds its own object model from entries that pass, and a workbook can be
pathological in ways unrelated to compression. What is closed is the
amplification gap: 5 MiB of upload can no longer become an unbounded inflate.

One behavioural consequence worth knowing: a grossly oversized but benign
workbook that previously failed with `IMPORT_TOO_MANY_ROWS` may now fail earlier
with `IMPORT_UNSAFE_ARCHIVE`. Both are 422; the rejection is correct either way.

### Proof

51 tests in `src/features/crm/__tests__/xlsx-archive-preflight.test.ts`. Every
archive is built byte by byte. Gate 1 fixtures stay a few hundred bytes — those
cases are dangerous in what they *declare*. Gate 2 fixtures really do expand, at
a controlled compression ratio: a payload of one repeated byte compresses about
1000:1 and would be caught by Gate 1's ratio check before Gate 2 ever ran, so
each payload repeats a random block sized to give deflate exactly as much
redundancy as the test needs. Every Gate 2 case asserts that **Gate 1 accepts
it** first, or it would be testing the wrong gate.

The ordering guarantee is tested with an **injected loader that records whether
it ran**: for fifteen unsafe archives — eleven structural, four lying — the
loader is never called, and for a real workbook it is called exactly once.
Reading the source and seeing the calls in the right order would prove nothing
about execution.

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

An exception must state: `advisory`, `package`, `severity`, `path`,
`whyNoSafePatch`, `reachability`, `compensatingControl`, `reviewBy`,
`removeWhen`.

**It is matched on the whole identity — advisory, package, severity and the
exact installed node path.** The first version of this guard matched the
advisory id alone while the file went on asking for the other three, which is
documentation dressed as a control: a decision reviewed for `uuid` under
`exceljs` would have excused the same advisory arriving through a different
package, at a different severity, on a path nobody looked at. Findings are now
collected per installed location, so one advisory present at two paths is two
decisions and one exception leaves the other blocking.

Also refused: an incomplete exception; an expired one; a `reviewBy` that is not
a real calendar date in `YYYY-MM-DD` form (`2026-02-31` would otherwise roll
into March); two exceptions with the same identity, where the last loaded would
silently win; two that disagree about severity for the same advisory, package
and path; and an exception matching **no current finding** — `STALE_EXCEPTION`,
because an advisory that was fixed, a package that was removed or a dependency
that moved should bring someone back to the decision rather than leave it
quietly in place.

Against the live audit the guard reports real installed paths:

```
moderate: csv-parse 1193670 at node_modules/csv-parse (reported, not blocking)
moderate: uuid 1119441 at node_modules/uuid (reported, not blocking)
```

**No exception file exists today**, because nothing high or critical remains.
The identity rules are exercised with synthetic fixtures, not by adding one.

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
- The local `/auth/login` and `/admin` 500s were left alone: they are the Lane 1
  production-target guard refusing a loopback Supabase under `next start`, and
  weakening that guard to make a smoke test prettier would be the wrong trade.
  **Carried forward:** `/`, `/interiors`, `/auth/login`, `/admin` and
  `/api/health` must be checked for CSP and HSTS against the real production
  environment after an owner-authorised deployment.
- No third-party ZIP library was added. Node's `zlib` supplies streaming
  inflation with an output ceiling, so `yauzl`, `unzipper` and `adm-zip` were
  not needed.
- Six pre-existing `as any`/`@ts-ignore` occurrences elsewhere in `src/` are
  unrelated and untouched.
