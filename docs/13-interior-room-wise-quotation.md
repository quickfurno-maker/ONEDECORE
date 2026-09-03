# 13 — ONEDECORE INTERIOR ROOM-WISE QUOTATION (PRODUCT AUTHORITY)

**Document status:** Owner-locked product authority for the quotation domain
**Governing phase:** P4 — Quotation → Closed-Won → project certification
**Migration:** `20260904140000_interior_room_wise_quotation.sql` (M55)

---

## 1. What the quotation system IS

ONEDECORE is an interior design and execution business. Its quotation is a
**room-wise interior estimate**, not a generic business quotation builder.

```
Room
 └── Interior work item
      ├── calculation basis   (area | quantity | fixed)
      ├── dimensions / quantity / fixed amount
      ├── rate
      └── server-authoritative amount
 └── room subtotal
quotation subtotal
 → discount
 → taxable value
 → tax
 → grand total
 → finalized immutable version
 → deterministic PDF
 → secure client capability link
 → client acceptance
 → Closed-Won
 → project
```

The persisted tables keep their original names (`quotation_sections`,
`quotation_items`) for migration safety. **A section IS a room and an item IS an
interior work item.** Product language, contracts, validation and UI say so:

| Persisted name | Product language |
| :--- | :--- |
| `quotation_sections` | Room / Area |
| `section_name` | Room name |
| `quotation_items` | Interior Work Item |

Room presets (Kitchen, Living Room / Hall, Master Bedroom, Bedroom, Guest
Bedroom, Kids Bedroom, Study Room, Dining, Foyer / Entry, Utility / Dry Balcony,
Mandir / Pooja, Passage, Other / Custom Room) are **suggestions, not keys** — a
flat routinely has several bedrooms, so nothing keys off the room name and a
custom name is always allowed.

---

## 2. The three calculation bases

There is deliberately **no formula engine**. Exactly three bases exist.

### AREA — the default

```
area_sqft        = round(width_ft × height_ft, 3)
line_total_paise = round(area_sqft × unit_rate_paise)
```

| Field | Source |
| :--- | :--- |
| Width (ft) | operator, up to 3 decimals, > 0 |
| Height (ft) | operator, up to 3 decimals, > 0 |
| **Area (sq.ft)** | **derived — never typed, never accepted from a client** |
| Rate / sq.ft | operator |
| **Amount** | **derived** |

Unit of measure is always `sqft`; the server sets it.

### QUANTITY — hardware and accessories

```
line_total_paise = round(quantity × unit_rate_paise)
```

Width, height and area are **null and hidden**. Units are deliberately short and
interior-specific: `nos`, `set`, `pair`, `unit`.

### FIXED — lump sum

```
quantity         = 1
unit_of_measure  = 'fixed'
unit_rate_paise  = line_total_paise = the fixed amount
```

Canonicalizing to one unit keeps the pre-existing database invariant
`line_total_paise = round(quantity × unit_rate_paise)` true for all three bases.

---

## 3. Money and measurement precision

- Money is **integer paise** end to end. No floating-point total is ever
  authoritative, and no `578345.8333`-style value can reach a document.
- Dimensions are `numeric(10,3)` — up to 3 decimal places of a foot.
- Area is derived to **3 decimals** for calculation and storage semantics; the
  UI and the PDF normally **display 2**, without rounding the stored value.
- The browser preview uses integer milli-foot arithmetic so it agrees with the
  server exactly rather than approximately. `10.5 × 2.5` being exact in IEEE-754
  is luck; `0.1 × 0.3` is not.

---

## 4. The server is authoritative

`save_quotation_draft_items` **derives** what it used to accept:

| Client sends | Server does |
| :--- | :--- |
| `widthFt`, `heightFt` | derives `quantity` = area, sets `unit_of_measure = sqft` |
| `quantity` on an area item | **ignored** |
| `areaSqFt` | **ignored** |
| `lineTotalPaise` | **ignored** — recomputed |
| room / quotation `subtotalPaise` | **ignored** — recalculated |

Three CHECK constraints make the invariant hold even against a writer that
bypasses the RPC entirely:

- `chk_quotation_items_area_shape` — an area row's `quantity` **must equal**
  `round(width_ft × height_ft, 3)`, with both dimensions positive and `sqft`
- `chk_quotation_items_non_area_shape` — quantity and fixed rows carry **no**
  dimensions, so a stale width cannot survive a basis switch
- `chk_quotation_items_fixed_shape` — a fixed row is one unit at the fixed amount

Preserved unchanged: optimistic `lock_version`, durable idempotency, permission
checks, draft-only mutation, canonical totals recalculation, finalized
immutability, and the audit event.

---

## 5. Legacy rows

Production held **zero** `quotation_items`, zero `quotation_sections` and zero
non-draft versions when M55 was written, so nothing had to be guessed at.

The backfill is still deterministic for local and CI databases: only the
unambiguous fixed shape (`fixed`/`lump_sum` unit, quantity 1, rate equal to
total) is reclassified. **No dimension is ever invented** — an area row cannot
be reconstructed from a quantity, and a fabricated measurement on a client
document is worse than a row that stays classified as `quantity`.

---

## 6. Canonical content hash

The finalized SHA-256 covers room identity and order, item identity and order,
**calculation basis, width, height, derived area**, quantity, unit, rate, total,
description and specifications, plus every commercial field it already covered.

Without the dimensions in the hash, a width could change between two finalized
versions while the hash stayed identical — the attestation would no longer match
the measurements printed on the document.

The canonical form is tagged `odq-content-v2-interior` so the change is explicit
rather than a silent redefinition of what an existing hash meant. Production
holds zero finalized versions, so no existing attestation is invalidated.

---

## 7. Room-wise PDF

```
PARTICULAR            W (FT)  H (FT)   AREA / QTY      RATE            AMOUNT
WARDROBE               11.25    7.00   78.75 SQ.FT     ₹1,550.00/SQ.FT ₹1,22,062.50
TANDEM                     —       —   5 NOS           ₹4,500.00/NOS      ₹22,500.00
TV UNIT                    —       —   FIXED           —                  ₹14,800.00
                                                       ROOM SUBTOTAL   ₹…
AREA TOTAL 78.75 SQ.FT
```

- One room at a time, with the room heading and the column header **repeated**
  on a continued page and a `(continued)` marker.
- A short room is kept whole where it fits.
- Fixed and quantity rows print an **em dash**, never a meaningless `0.00`.
- Description and specification render as smaller secondary text under the item
  rather than widening the table.
- Money is rupee-formatted to exactly two decimals; integer paise stays the
  source of truth.
- Output stays **deterministic** for an identical frozen payload: stable PDF id,
  frozen creation and modification dates.

---

## 8. Finalized quotation management

A finalized quotation is the **commercial record**. It is never described as
archived, and it no longer disappears on reload.

`/admin/quotations/[quotationId]/draft` now renders a read-only finalized view
showing: quotation number, version, status, client snapshot, rooms with
measurements, amount breakdown, commercial summary, payment schedule, finalized
timestamp, finalized content SHA-256, PDF status, and the actions below.

---

## 9. Secure client link — independent of WhatsApp

P4 certification does **not** depend on P9. `generateQuotationClientLinkAction`
creates **no** WhatsApp conversation, **no** send intent and makes **no**
provider call, and works with `ONEDECORE_WHATSAPP_OUTBOUND_MODE=disabled`. The
existing WhatsApp send path keeps its own prerequisites for P9.

It still requires: `quotations.send`, a **finalized** version, a **READY** PDF,
and the existing lead-scope check — all enforced inside
`issue_quotation_access_grant_internal`.

**Grant reuse rule.** When an active grant already exists the RPC returns it,
and now also returns its **persisted** `derivation_nonce` and
`capability_token_hash`. The token is derived from the persisted identity and
verified against the persisted hash; a mismatch fails closed. Deriving from a
freshly generated but never-persisted nonce would produce a link that simply
does not work.

**Reissue** revokes the active grant, creates a new one and returns the new
link; the old link stops working.

The plaintext token is never persisted, never logged, never placed in an audit
payload, and only the relative `/q/<token>` path is returned to the authorized
caller.

---

## 10. Finalized PDF ensure / retry

Finalization commits the database first and then renders, so a render failure
can leave a legitimately finalized quotation without a document. Reversing the
finalization for that would be far worse — the commercial record is correct;
only the artifact is missing.

`ensureQuotationPdfAction` is finalized-only, reuses a READY artifact
idempotently (`skippedRender`), never overwrites one (`upsert: false`), and
refreshes canonical state on return.

---

## 11. Unchanged commercial governance

Acceptance, Closed-Won and project materialization are **not** weakened:
valid live grant, finalized version, READY PDF, legitimate assigned Sales
Executive, single acceptance per lead, acceptance snapshot, atomic Closed-Won
transition, `quotation.accepted` event, and exactly-once idempotent project
materialization.

Commercial ranking is unchanged: `accepted > issued > finalized > draft >
unknown`. Room subtotals feed the same canonical quotation totals and are never
counted as separate revenue.

---

## 12. P4 certification status

**PENDING.** This work is code, migration and tests only.

Production E2E certification still requires, from the owner:

- Super Admin commercial settings
- a legitimate tax profile
- a legitimate active Sales Executive
- a legitimate Project Manager
- a legitimate Designer
- a real test quotation and client the owner approves

No production role, account, rate, discount limit, payment value or client data
was created by this work, and M55 has not been applied to managed Supabase.
