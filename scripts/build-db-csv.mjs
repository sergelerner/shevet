// scripts/build-db-csv.mjs — one-time: flatten all spreadsheet tabs into data/db.csv.
// Usage: node scripts/build-db-csv.mjs
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseGviz, parseStackedTab, parseGuidesTab, parseBooksTab, toCsv,
} from "./lib-migrate.mjs";

const SHEET_ID = "1tRYgf0smzXqIrGJ1LdA-sF26Q3H8Zrw9zgbhrjlxZEM";
const BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

// Tab names live in the xlsx export's workbook.xml (public sheet, no auth).
async function listTabs() {
  const res = await fetch(`${BASE}/export?format=xlsx`);
  if (!res.ok) throw new Error(`xlsx export failed: ${res.status}`);
  const file = join(tmpdir(), "shevet-sheet.xlsx");
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const xml = execSync(`unzip -p ${JSON.stringify(file)} xl/workbook.xml`, { encoding: "utf8" });
  return [...xml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  );
}

async function fetchRows(tab) {
  const url = `${BASE}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gviz failed for "${tab}": ${res.status}`);
  return parseGviz(await res.text());
}

const tabs = await listTabs();
console.log("tabs:", tabs.join(" | "));

const products = [];
for (const tab of tabs) {
  if (tab === "DB") continue; // don't re-ingest our own output on re-runs
  const rows = await fetchRows(tab);
  let parsed;
  if (tab.includes("רשימת ספרים")) parsed = parseBooksTab(rows);
  else if (tab.includes("מדריכים מפי")) parsed = parseGuidesTab(rows);
  else parsed = parseStackedTab(rows);
  console.log(`  ${tab}: ${parsed.length} rows`);
  products.push(...parsed);
}

if (products.length < 50) throw new Error(`suspiciously few rows: ${products.length}`);
mkdirSync("data", { recursive: true });
writeFileSync("data/db.csv", toCsv(products));
console.log(`wrote data/db.csv — ${products.length} products, ${new Set(products.map((p) => p.category)).size} categories`);
