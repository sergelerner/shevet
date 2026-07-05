# SHEVET (שבט) — Design Spec

**Date:** 2026-07-05
**Status:** Approved pending user review

A mobile-first, RTL Hebrew static website presenting curated baby-gear recommendations collected from a parents' group. Google Sheets is the database; the site reads it on load. Public audience (moms group / friends).

## Goals

- Make the recommendations sheet browsable with a friendly UX on phones.
- Wife maintains data in Google Sheets only — no code involvement, no redeploys for content changes.
- Free hosting, zero build tooling, zero servers.

## Non-goals

- No auth, no user accounts, no write operations from the site.
- No "mark as bought" personal state (public catalog only).
- No SEO/prerendering work beyond basic meta tags.

## Data layer

### Source of truth: `DB` tab

A new flat tab named `DB` in the existing spreadsheet (`1tRYgf0smzXqIrGJ1LdA-sF26Q3H8Zrw9zgbhrjlxZEM`). One header row, then one row per product:

| Column | Header (row 1) | Notes |
|---|---|---|
| A | `category` | Hebrew category name, no emoji (emoji lives in app config). Data-validation dropdown. |
| B | `name` | Product / brand name. Required — rows with empty name are skipped by the app. |
| C | `description` | Full recommendation text. May contain newlines. |
| D | `link` | URL or free text; may be empty or `-`. |
| E | `notes` | Special notes / warnings. May be empty or `-`. |

- The original tabs remain untouched as archive.
- One-time migration: Claude parses the already-read sheet content into a clean CSV; user imports it via File → Import → Insert new sheet(s), renames the tab to `DB`.
- Migration also folds in the two non-product tabs as categories:
  - **מדריכים מפי נועה** (transposed layout: each column = one guide; row 1 title, row 2 body) → `category=מדריכים`, `name`=guide title, `description`=guide body.
  - **רשימת ספרים לקטנטנים** (one-column book list) → `category=ספרים לקטנטנים`, `name`=book title, other fields empty.
- Going forward the wife edits the `DB` tab directly (append rows).
- Sheet stays link-readable ("anyone with the link can view") — required for the public read endpoint.

### Read path (client, on every load)

- Endpoint: `https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:json&sheet=DB`
- Response is JSON wrapped in `google.visualization.Query.setResponse(...)`; unwrap with a substring/regex, then map `table.rows[].c[].v` to product objects.
- **Cache**: last good payload stored in `localStorage`. On load: render cached data immediately (if present), fetch fresh in background, swap in on success and update cache (stale-while-revalidate).
- **Errors**: fetch fails with no cache → friendly Hebrew error screen with a retry button. Fetch fails with cache → keep showing cached data silently.
- **Row hygiene**: skip rows with empty `name`; treat `-`, `\-`, and empty as "no value" for `link`/`notes`; trim whitespace.
- Links get `https://` prefixed when missing a scheme; a link cell that isn't URL-shaped renders as plain text, not an anchor.

## App structure

No bundler, no npm at runtime. Classic `<script>` tags from CDN: Preact + htm + @preact/signals (UMD globals `preact`, `preactHooks`, `preactSignals`).

```
shevet/
  index.html    — CDN scripts, Google Fonts, meta (og:, viewport, RTL lang), mounts app
  config.js     — SHEET_ID, TAB_NAME, category config: order, emoji, display name
  app.js        — all components (htm templates), state, routing, gviz parsing
  style.css     — editorial theme
  docs/superpowers/specs/ — this spec
```

- **State** (signals): `products` (array), `route` (parsed from hash), `searchQuery`, `status` (`loading | ready | error`).
- **Routing**: hash-based. `#/` = home; `#/c/{encodeURIComponent(category)}` = category page. `hashchange` listener updates the route signal. Browser back works; links shareable.
- **Category config** in `config.js` maps sheet category values → emoji + sort order. Categories present in data but missing from config still render (fallback emoji, listed last) — new categories in the sheet must not break or hide data.
- **Category order**: `מדריכים` is pinned first, then product categories, `ספרים לקטנטנים` at the end. Order is a single array in `config.js`.

## UX

### Home (`#/`)
- Editorial masthead: **שבט.** (Rubik 900, terracotta period), kicker line beneath.
- Global search field (see Search).
- Numbered category index (magazine table-of-contents style): `01 מנשאים … 13 המלצות` — number in terracotta Rubik, name in Rubik 600, count in Open Sans muted. Tap → category page.

### Search
- Typing ≥1 char on home replaces the category index with live results across all categories (case-insensitive substring match on `name` + `description`).
- Each result shows product name, category chip, and first line of description. Tap → opens the product's bottom sheet.
- Clearing the query restores the index.

### Category page (`#/c/…`)
- Header: category emoji + name + count, back link (→ חזרה) to home.
- Compact product cards: `name` (Rubik 600) + first ~2 lines of description (Open Sans, clamped).
- Tap card → **bottom sheet** slides up over a dimmed backdrop:
  - Full description, notes prefixed 📌, link as a button (🔗 פתיחת קישור, opens new tab).
  - Warning highlight: if `notes` or `description` contains "אזהרה" or "לא מומלץ", that text block gets a red-tinted callout with ⚠️.
  - Dismiss: backdrop tap, ✕ button, or drag-handle affordance (visual only; no gesture lib).
  - Long content (e.g., guides): sheet caps at `max-height: 90vh` with internal scroll.
- **Detail-less items** (e.g., books — no description/link/notes): render as plain list items, not tappable, no bottom sheet.

### Visual identity (approved via mockups)
- Palette: cream `#faf5ec` background, ink `#2d2a26` text, terracotta `#c14e33` accent, muted `#8a7f6f`, hairlines `#d8ccb8`.
- Ink rules (1.5px solid) as section dividers instead of boxed cards on home.
- Fonts (Google Fonts, free): **Rubik** — masthead, navigation, headings, numbers; **Open Sans** — body, descriptions, metadata. Both loaded with Hebrew subset.
- `dir="rtl" lang="he"` on `<html>`; layout mobile-first, desktop gets a centered `max-width: 640px` column.

## Hosting & deployment

- Public GitHub repo (`shevet`), GitHub Pages serving from `main` branch root.
- Deploy = `git push`. No Actions, no build step.
- Content updates need **no deploy** — the site reads the sheet live.

## Error handling summary

| Failure | Behavior |
|---|---|
| gviz fetch fails, no cache | Hebrew error screen + retry button |
| gviz fetch fails, cache exists | Show cached data, silent |
| Row missing `name` | Skipped |
| `-` / empty `link`/`notes` | Field omitted from card/sheet |
| Unknown category value | Rendered with fallback emoji at end of index |
| Sheet made private by accident | Same as fetch-fail path (gviz returns non-JSON) — error screen mentions checking sheet sharing |

## Testing

- Manual smoke test against the live sheet on mobile viewport (DevTools + real phone).
- Parser checks: multiline descriptions, empty cells, Hebrew + emoji, links with/without scheme, `-` placeholders.
- Verify: home render, search, category navigation, bottom sheet open/close, back button, shared category URL deep-link, localStorage cache path (offline reload).

## Milestones

1. **Data migration** — parse sheet → clean CSV → user imports as `DB` tab → verify gviz endpoint returns it.
2. **Site skeleton** — index.html + CDN wiring, config, gviz fetch + parse, home with real data.
3. **UX complete** — category pages, bottom sheet, search, editorial styling.
4. **Deploy** — GitHub repo + Pages, real-phone verification.
