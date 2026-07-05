// scripts/lib-migrate.mjs — pure parsing for the one-time sheet migration.

/** Map original long category headers -> clean site category names. */
const CATEGORY_MAP = {
  "מנשאים": "מנשאים",
  "עגלות, סלקלים וכיסאות בטיחות": "עגלות וסלקלים",
  "הנקה ושאיבה": "הנקה ושאיבה",
  "האכלה (בקבוקים, כוסות, מוצצים)": "האכלה",
  "טיפוח ואמבטיה (שמנים, סבונים, מגבונים)": "טיפוח ואמבטיה",
  "מוצרי שינה וניטור": "שינה וניטור",
  "ביגוד לתינוק": "ביגוד",
  "ציוד התפתחות ומשחק": "התפתחות ומשחק",
  "ריהוט וחדר הילד/ה": "ריהוט וחדר הילד",
};

export function parseGviz(text) {
  const json = JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")));
  return json.table.rows.map((r) =>
    (r.c || []).map((c) => (c && c.v != null ? String(c.v) : ""))
  );
}

/** "🎒 קטגוריית מנשאים" -> "מנשאים" (mapped through CATEGORY_MAP). */
export function stripCategory(header) {
  const stripped = header
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "")
    .replace(/קטגוריית/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return CATEGORY_MAP[stripped] || stripped;
}

/** "-", "\-" and whitespace-only are "no value". */
function cleanField(v) {
  const t = (v || "").trim();
  return t === "-" || t === "\\-" ? "" : t;
}

/** Clean link fields: strip leading dashes (only when followed by more text). */
function cleanLink(v) {
  const t = cleanField(v);
  if (!t) return t; // already empty
  return t.replace(/^[\-]+(?=\S)/, "");
}

export function parseStackedTab(rows) {
  const products = [];
  let category = null;
  for (const cells of rows) {
    const vals = cells.map((c) => (c || "").trim());
    if (!vals.some(Boolean)) continue;
    if (vals[0].includes("קטגוריית")) { category = stripCategory(vals[0]); continue; }
    if (/^שם(\s*\/|\s+המוצר)/.test(vals[0])) continue; // skip all header phrasings
    if (!category || !vals[0]) continue;
    products.push({
      category, name: vals[0],
      description: cleanField(vals[1]), link: cleanLink(vals[2]), notes: cleanField(vals[3]),
    });
  }
  return products;
}

export function parseGuidesTab(rows) {
  if (rows.length < 2) return [];
  const [titles, bodies] = rows;
  const out = [];
  for (let i = 0; i < titles.length; i++) {
    const name = (titles[i] || "").trim();
    if (!name) continue;
    out.push({
      category: "מדריכים", name,
      description: (bodies[i] || "").trim(), link: "", notes: "",
    });
  }
  return out;
}

export function parseBooksTab(rows) {
  return rows
    .map((cells) => (cells[0] || "").trim())
    .filter((name, i) => name && i > 0) // row 0 is the tab's title line
    .map((name) => ({
      category: "ספרים לקטנטנים", name, description: "", link: "", notes: "",
    }));
}

function csvEscape(v) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(products) {
  const header = "category,name,description,link,notes";
  const lines = products.map((p) =>
    [p.category, p.name, p.description, p.link, p.notes].map(csvEscape).join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}
