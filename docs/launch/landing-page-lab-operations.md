# Landing Page Lab — how to run a campaign page

For the ONEDECORE owner. No code, no JSON, no database.

A landing page is a single page built for one advert. Someone taps your ad, lands
here, and either enquires or leaves. It is deliberately shorter than the main
site and has no navigation — there is nowhere to wander off to.

---

## Make a page

1. **Admin → Landing Lab**
2. **New campaign page**
3. **Start from** — pick the closest template (Modular Kitchen, 2 BHK, Villa…).
   Everything in it can be changed afterwards. *Blank* gives you only the two
   sections a page cannot be published without.
4. **Page title** — internal name, also the browser tab title.
5. **Web address** — this becomes `onedecore.in/lp/your-address`. It is
   suggested from the title; change it if you want. This is the link that goes
   in the advert, so keep it short and readable.
6. **Create page.**

---

## Edit it

Three panels:

| Panel | What it is for |
|---|---|
| **Add a section** (left) | Every section type you can add. One click adds it to the bottom. |
| **Preview** (middle) | The real page. Not an approximation — the same code the public page runs. |
| **Section settings** (right) | The fields of whichever section is selected. |

- **Select a section** by clicking it in the outline, or by clicking it in the preview.
- **Reorder** with the ↑ ↓ buttons in the outline.
- **Duplicate** with ⧉. **Remove** with ✕, then confirm.
- **Mobile / Tablet / Desktop** above the preview shows the page at 390px, 768px
  and 1280px. Most ad traffic is phones — check Mobile before you publish.

**Save** is in the top bar. An **Unsaved** badge appears the moment you change
anything, and the browser will warn you if you try to close the tab with work
outstanding. Nothing saves by itself.

### The sections

| Section | Notes |
|---|---|
| Hero | First screen. Leave *Button goes to* blank and the button opens the enquiry form — usually what you want. A background image is optional. |
| Trust points | Short factual points. **Not in any template on purpose** — add it when you have proof you can stand behind. |
| Services | What the campaign covers, as cards. |
| How it works | Numbered steps. The numbers are automatic. |
| Project gallery | Real photographs from your portfolio. Enter the address of a published project (the part of `/portfolio/…` after the last slash). A project you later unpublish quietly drops out. |
| Testimonials | Only quotes you actually received and may use. No star ratings are shown. |
| Questions | Opens and closes when tapped. |
| Call to action | A focused prompt partway down the page. |
| **Enquiry form** | Opens the standard ONEDECORE enquiry form. **Required** — without it the page cannot collect a lead. |
| **Footer** | Legal line, phone, email. **Required.** |

### Things the page will not let you do

- Publish without an enquiry section or a footer.
- Type `<` or `>` in page text — the page rejects HTML outright. Use an arrow (→) or a word.
- Add custom questions to the enquiry form. Every ONEDECORE lead is collected the
  same way so they stay comparable in the CRM.

---

## Publish it

1. **Save.**
2. **Freeze v1.** A frozen version can never be edited again — that is the point.
   It is what a publication and an A/B test point at, so what a visitor saw is
   always recoverable.
3. **Create publication** — choose the frozen version. Optionally attach a
   campaign reference.
4. Press **live** on the publication.
5. **Open live page ↗** to see it as a visitor does.

Your ad link is `https://onedecore.in/lp/<your-address>`.

> Campaign pages are deliberately kept out of Google. They duplicate the main
> site, often exist in two variants at once, and get retired — indexing them
> would compete with the pages meant to rank.

---

## Change a published page

Frozen versions are immutable, so you do not edit a live page — you make the next one.

1. **Create next version** (top bar). This copies the frozen version into a new draft.
2. Edit and **Save**.
3. **Freeze** it.
4. Create a publication for the new version and set it **live**.

## Pause or retire a page

On the publication: **paused** stops it serving (visitors get a not-found), and
**live** brings it back. **archived** is permanent — an archived publication can
never go live again, so archive only when the campaign is finished.

---

## Run an A/B test

You need **two frozen versions** — so freeze v1, create v2, change one thing, freeze v2.

1. Scroll to **Experiment**.
2. **Control** shows one version, **B** shows the other.
3. Set the split. It must total 100.
4. **Save test**, then **Start experiment**.

Each visitor is assigned once and keeps seeing the same version for the life of
their visitor cookie, so the test is not measuring people flipping between two
pages.

**Concluding it is your decision.** Nothing is promoted automatically. When you
have seen enough, pick the winner and conclude. Make the winner the live
publication afterwards if you want it to be the permanent page.

> Treat small differences as noise. A handful of leads either way is not a result.

---

## Read the numbers

The **Analytics** table shows, per publication:

**Exposures** (unique visitors who saw the page) → **Leads** → **Qualified** →
**Consultation** → **Proposal** → **Closed won**.

These come from the CRM, so they are the same numbers your sales pipeline shows.
There is no spend, CPL or ROAS here — ONEDECORE does not hold ad-cost data, and
inventing it would be worse than leaving it out.

---

## Tracking and consent

If a visitor allows advertising cookies, the page reports a PageView and — after
a successful enquiry — a Lead to Meta. If they decline or ignore the banner,
**nothing is sent** and the enquiry still works normally. Meta never receives a
name, phone number, email, budget, service or anything the visitor typed.

---

## Emergency: turn every landing page off

On the production server, set:

```
ONEDECORE_LANDING_LAB_PUBLIC_ENABLED=false
```

and restart the app. Every `/lp/*` address immediately stops serving.

Nothing else is affected — the homepage, portfolio, CRM, quotations, WhatsApp
and the normal enquiry form all keep working, because the landing page system
fails closed and on its own.

---

## Who to ask

Landing pages need the `landing_pages.manage` permission. Publishing needs
`landing_pages.publish`, experiments `landing_experiments.manage`, and the
numbers `landing_analytics.read`. If a button is missing, it is a permission,
not a fault.
