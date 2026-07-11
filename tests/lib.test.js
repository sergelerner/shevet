// tests/lib.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib.js");

const gvizWrap = (rows, cols = []) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    table: {
      cols: cols.map((label) => ({ label })),
      rows: rows.map((r) => ({ c: r.map((v) => (v == null ? null : { v })) })),
    },
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

test("parseGvizTable: returns cols labels alongside rows", () => {
  const text = gvizWrap(
    [["מנשאים", "מנשא Neko", "תיאור", "lunalubabies.com", ""]],
    ["category", "name", "description", "link", "notes"]
  );
  const { labels, rows } = L.parseGvizTable(text);
  assert.deepEqual(labels, ["category", "name", "description", "link", "notes"]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], ["מנשאים", "מנשא Neko", "תיאור", "lunalubabies.com", ""]);
});

test("normalizeLink", () => {
  assert.equal(L.normalizeLink("https://a.co/x"), "https://a.co/x");
  assert.equal(L.normalizeLink("lunalubabies.com/product-page/x"), "https://lunalubabies.com/product-page/x");
  assert.equal(L.normalizeLink("econawa_il (אינסטגרם)"), null);
  assert.equal(L.normalizeLink(""), null);
  // first URL wins in multi-link cells
  assert.equal(L.normalizeLink("babykaring.com/topa-top/ ; topa-top.com"), "https://babykaring.com/topa-top/");
  // comma inside a query string must survive
  assert.equal(L.normalizeLink("https://iherb.co/p?a=1,2"), "https://iherb.co/p?a=1,2");
  // comma+space separated list still picks the first
  assert.equal(L.normalizeLink("a-store.com/x, b-store.com/y"), "https://a-store.com/x");
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

test("buildSubmission: trims fields, requires name, builds payload + product", () => {
  const bad = L.buildSubmission({ category: "מנשאים", name: "  ", description: "", link: "", website: "" });
  assert.equal(bad.ok, false);
  assert.ok(bad.error);

  const good = L.buildSubmission({
    category: " מנשאים ", name: " מנשא חדש ", description: " נוח מאוד ",
    link: " lunalubabies.com ", website: "",
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.payload, {
    category: "מנשאים", name: "מנשא חדש", description: "נוח מאוד",
    link: "lunalubabies.com", website: "",
  });
  assert.deepEqual(good.product, {
    category: "מנשאים", name: "מנשא חדש", description: "נוח מאוד",
    link: "lunalubabies.com", notes: "",
  });

  // honeypot value is carried through untouched for the server to judge
  const bot = L.buildSubmission({ category: "מנשאים", name: "spam", description: "", link: "", website: "http://spam.example" });
  assert.equal(bot.ok, true);
  assert.equal(bot.payload.website, "http://spam.example");

  // missing keys tolerated (treated as empty strings)
  const sparse = L.buildSubmission({ category: "מנשאים", name: "רק שם" });
  assert.equal(sparse.ok, true);
  assert.equal(sparse.payload.description, "");
});
