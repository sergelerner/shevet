// tests/lib.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib.js");

const gvizWrap = (rows) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    table: { cols: [], rows: rows.map((r) => ({ c: r.map((v) => (v == null ? null : { v })) })) },
  })});`;

test("parseGviz + toProducts: cleans placeholders, drops nameless rows", () => {
  const text = gvizWrap([
    ["מנשאים", "מנשא Neko", "תיאור\nרב שורתי", "lunalubabies.com", "-"],
    ["מנשאים", "", "יתום", "", ""],
    ["ספרים לקטנטנים", "האריה שבפנים", "", "\\-", ""],
  ]);
  const products = L.toProducts(L.parseGviz(text));
  assert.equal(products.length, 2);
  assert.deepEqual(products[0], {
    category: "מנשאים", name: "מנשא Neko",
    description: "תיאור\nרב שורתי", link: "lunalubabies.com", notes: "",
  });
  assert.equal(products[1].link, "");
});

test("normalizeLink", () => {
  assert.equal(L.normalizeLink("https://a.co/x"), "https://a.co/x");
  assert.equal(L.normalizeLink("lunalubabies.com/product-page/x"), "https://lunalubabies.com/product-page/x");
  assert.equal(L.normalizeLink("econawa_il (אינסטגרם)"), null);
  assert.equal(L.normalizeLink(""), null);
  // first URL wins in multi-link cells
  assert.equal(L.normalizeLink("babykaring.com/topa-top/ ; topa-top.com"), "https://babykaring.com/topa-top/");
});

test("hasWarning", () => {
  assert.equal(L.hasWarning("אזהרה: דווח על פציעות"), true);
  assert.equal(L.hasWarning("צוין כלא מומלץ באמת"), true);
  assert.equal(L.hasWarning("מומלץ בחום"), false);
});

test("hasDetails: books are plain, products with any detail are tappable", () => {
  assert.equal(L.hasDetails({ description: "", link: "", notes: "" }), false);
  assert.equal(L.hasDetails({ description: "יש", link: "", notes: "" }), true);
  assert.equal(L.hasDetails({ description: "", link: "a.co", notes: "" }), true);
});

test("orderCategories: config order, unknown categories last with fallback emoji", () => {
  const cfg = [{ name: "מדריכים", emoji: "🧭" }, { name: "מנשאים", emoji: "🎒" }];
  const products = [
    { category: "מנשאים", name: "א" },
    { category: "קטגוריה חדשה", name: "ב" },
    { category: "מדריכים", name: "ג" },
  ];
  const out = L.orderCategories(products, cfg, "📦");
  assert.deepEqual(out.map((c) => c.name), ["מדריכים", "מנשאים", "קטגוריה חדשה"]);
  assert.equal(out[2].emoji, "📦");
  assert.equal(out[1].items.length, 1);
});

test("searchProducts: case-insensitive over name+description, empty query -> []", () => {
  const products = [
    { category: "מנשאים", name: "Neko Switch", description: "ילקוט" },
    { category: "האכלה", name: "בקבוק", description: "פטמה עגולה" },
  ];
  assert.equal(L.searchProducts(products, "neko").length, 1);
  assert.equal(L.searchProducts(products, "פטמה").length, 1);
  assert.equal(L.searchProducts(products, "  ").length, 0);
});
