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
