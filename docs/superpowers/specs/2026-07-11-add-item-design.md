# Add-item feature — design

**Date:** 2026-07-11
**Status:** approved

## Summary

A floating `+` button on the site opens a form (category, name, description,
link). Submissions are appended live to the `DB` tab of the Google Sheet via a
Google Apps Script web app, and appear on the site immediately. Anti-abuse is
a honeypot field only. No accounts, no review queue, no backend infrastructure.

## Decisions (made with the user)

| Question | Decision |
|---|---|
| Moderation | **Live immediately** — rows append straight to the `DB` tab |
| Anti-abuse | **Honeypot only** — invisible field; bots that fill it get a fake success |
| Form fields | **Category, name, description, link** (`notes` stays curator-only) |
| Write path | **Google Apps Script web app** deployed by a sheet editor |

## UI

- **FAB**: fixed circular `+` button, bottom corner, rendered on home and
  category pages. Hidden entirely when `SUBMIT_URL` is empty (pre-deploy state).
- **Form**: opens in the existing sheet/modal presentation (bottom sheet on
  mobile, centered modal ≥700px; reuse `.backdrop` / `.sheet` styles).
  RTL Hebrew labels. Fields:
  - **קטגוריה** — `<select>` built from `CFG.CATEGORIES` (name + emoji).
    Pre-selected to the current category when opened from a category page;
    defaults to the first category on home.
  - **שם** — single-line text, required.
  - **תיאור** — textarea, optional.
  - **קישור** — single-line text, optional.
  - **Honeypot** — a text input visually hidden (off-screen, `aria-hidden`,
    `tabindex="-1"`, autocomplete off). Humans never see it; bots that fill
    every field reveal themselves.
- **States**: submit button disabled + label "שולח…" while in flight; on
  failure an inline error line appears and the form contents are preserved;
  on success the form closes.
- **After success**: the new item is appended optimistically to the in-memory
  `products` signal and the localStorage cache, so the submitter sees it on
  the site instantly. Everyone else picks it up on their next load (the site
  always re-fetches gviz on load).

## Data flow

```
browser form ──POST text/plain JSON──▶ Apps Script /exec ──appendRow──▶ DB tab
     ▲                                        │
     └────────── {ok:true} JSON ◀─────────────┘
```

- Client sends `fetch(SUBMIT_URL, { method: "POST", body: JSON.stringify(payload) })`
  with **no custom Content-Type** (defaults to `text/plain`) — this keeps the
  request "simple" so there is no CORS preflight, which Apps Script cannot
  answer. Apps Script's `/exec` responses include CORS headers for simple
  requests, so the JSON reply is readable.
- Payload: `{ category, name, description, link, website }` where `website`
  is the honeypot field (must be empty).
- Row appended: `[category, name, description, link, ""]` — matching the
  existing 5 DB columns (`notes` empty).

## Apps Script (`scripts/apps-script/Code.gs`)

Container-bound script on the sheet, deployed as a web app
(**Execute as: Me**, **Who has access: Anyone**). `doPost`:

1. Parse `e.postData.contents` as JSON; on parse failure return `{ok:false}`.
2. If honeypot non-empty → return `{ok:true}` **without writing** (fake success).
3. Validate: `name` required after trim; `category` must be a non-empty string;
   every field length-capped at 500 chars (truncate, don't reject).
4. `LockService.getScriptLock()` around the write to serialize concurrent posts.
5. `appendRow` on the `DB` tab (looked up by name, not index).
6. Return `ContentService` JSON `{ok:true}`.

The script never reads sheet content back to the caller and only ever appends —
no edit/delete surface. Sheet sharing settings are unchanged (public
view-only for gviz).

Deploy instructions ship in the repo (README section): Extensions → Apps
Script → paste `Code.gs` → Deploy → New deployment → Web app → Execute as Me /
Anyone → copy the `/exec` URL into `config.js` `SUBMIT_URL`.

## Config

`config.js` gains one key:

```js
SUBMIT_URL: "", // Apps Script /exec URL; empty = add-item button hidden
```

## Client validation & pure logic (`lib.js`)

New pure functions (node-testable, no DOM):

- `buildSubmission({category, name, description, link, website})` →
  trims fields, returns `{ ok: true, payload }` or
  `{ ok: false, error }` (missing name). Link is passed through as typed —
  the site already renders imperfect links gracefully via `normalizeLink`.

Client-side the form requires `name` before enabling submit; everything else
is optional, mirroring the script's rules.

## Error handling

- Network failure / non-`{ok:true}` reply → inline error in the form
  ("לא הצלחנו לשלוח, נסו שוב"), contents preserved, user can retry.
- No response-body parse assumptions beyond `{ok}` — a redirect-followed 200
  with unparseable body is treated as failure.
- Double-submit prevented by disabling the button while in flight.

## Testing

- `tests/lib.test.js` additions: `buildSubmission` — trims, requires name,
  preserves optional fields, carries honeypot through.
- Manual/preview verification: FAB hidden with empty `SUBMIT_URL`; form opens
  pre-selected on category pages; optimistic append renders the new card.
- Apps Script verified with a `curl` POST after deploy (real append + honeypot
  fake-success).

## Out of scope

- Review/moderation queue, edit/delete from the site, submitter attribution,
  rate limiting, CAPTCHA, new-category creation from the form (unknown
  categories already render with the fallback emoji if ever needed).
