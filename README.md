# שבט · SHEVET

מדריך הרכישות לתינוק — ההמלצות של הקבוצה, במקום אחד.

Static RTL Hebrew site. **Database = Google Sheet** (`DB` tab) read live via the
public gviz endpoint — content updates need no deploy, just edit the sheet.

## Stack
Preact + htm + @preact/signals via CDN `<script>` tags. No build, no npm.

## Develop
python3 -m http.server 8090   # then open http://localhost:8090

## Test
node --test tests/*.test.*

## Deploy
git push (GitHub Pages serves `main`).

## Data
- Edit content: add rows to the `DB` tab of the sheet (category, name, description, link, notes).
- New category: add a row value in the sheet + an entry in `config.js` CATEGORIES (order = display order).
- `scripts/build-db-csv.mjs` was the one-time migration that generated `data/db.csv` from the original tabs.

## Submissions (add-item form)

The `+` button posts new rows straight to the `DB` tab through a Google Apps
Script web app. One-time setup by anyone with **edit** access to the sheet:

1. Open the sheet → **Extensions → Apps Script**.
2. Replace the editor contents with `scripts/apps-script/Code.gs` and save.
3. **Deploy → New deployment → Web app**, "Execute as: **Me**",
   "Who has access: **Anyone**" → Deploy. Authorize when prompted
   (the "unverified app" warning is expected for a personal script).
4. Copy the `/exec` URL into `SUBMIT_URL` in `config.js` and push.

Until `SUBMIT_URL` is set, the `+` button is hidden and the site works as before.

Verify a deploy with (should append a row and print `{"ok":true}`):

    curl -sL -d '{"category":"מדריכים","name":"בדיקה","description":"","link":"","website":""}' \
      "$SUBMIT_URL"

The honeypot: same call with `"website":"x"` replies `{"ok":true}` but writes nothing.

## Credits
Category icons: [OpenMoji](https://openmoji.org) — CC BY-SA 4.0 (black/outline variant, loaded from jsDelivr).
