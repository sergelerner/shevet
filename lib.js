// lib.js — pure data functions. Exposed as window.ShevetLib (browser) and module.exports (node tests).
(function (global) {
  function parseGviz(text) {
    const json = JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")));
    return json.table.rows.map((r) =>
      (r.c || []).map((c) => (c && c.v != null ? String(c.v) : ""))
    );
  }

  function cleanField(v) {
    const t = (v || "").trim();
    return t === "-" || t === "\\-" ? "" : t;
  }

  function toProducts(rows) {
    return rows
      .map((cells) => ({
        category: cleanField(cells[0]),
        name: cleanField(cells[1]),
        description: cleanField(cells[2]),
        link: cleanField(cells[3]),
        notes: cleanField(cells[4]),
      }))
      .filter((p) => p.name);
  }

  function normalizeLink(raw) {
    if (!raw) return null;
    const first = raw.split(/[\s;]+/)[0].replace(/[,.]+$/, "");
    if (/^https?:\/\//i.test(first)) return first;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(first)) return "https://" + first;
    return null;
  }

  function hasWarning(text) {
    return /אזהרה|לא מומלץ/.test(text || "");
  }

  function hasDetails(p) {
    return Boolean(p.description || p.notes || p.link);
  }

  function orderCategories(products, categoriesConfig, fallbackEmoji) {
    const byName = new Map();
    for (const p of products) {
      if (!byName.has(p.category)) byName.set(p.category, []);
      byName.get(p.category).push(p);
    }
    const out = [];
    for (const c of categoriesConfig) {
      const items = byName.get(c.name);
      if (items) { out.push({ name: c.name, emoji: c.emoji, items }); byName.delete(c.name); }
    }
    for (const [name, items] of byName) out.push({ name, emoji: fallbackEmoji, items });
    return out;
  }

  function searchProducts(products, q) {
    const needle = (q || "").trim().toLowerCase();
    if (!needle) return [];
    return products.filter((p) =>
      (p.name + " " + (p.description || "")).toLowerCase().includes(needle)
    );
  }

  const api = { parseGviz, toProducts, normalizeLink, hasWarning, hasDetails, orderCategories, searchProducts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ShevetLib = api;
})(typeof window !== "undefined" ? window : globalThis);
