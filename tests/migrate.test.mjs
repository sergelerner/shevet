import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseGviz, parseStackedTab, parseGuidesTab, parseBooksTab, toCsv, stripCategory,
} from "../scripts/lib-migrate.mjs";

const gvizWrap = (rows) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    version: "0.6", status: "ok",
    table: { cols: [], rows: rows.map((r) => ({ c: r.map((v) => (v == null ? null : { v })) })) },
  })});`;

test("parseGviz unwraps JSONP and stringifies cells", () => {
  const text = gvizWrap([["שלום", null, 5]]);
  assert.deepEqual(parseGviz(text), [["שלום", "", "5"]]);
});

test("stripCategory strips ZWJ emoji and collapses whitespace", () => {
  // ZWJ emoji like 🧑‍⚕️ (person health worker) leave behind U+200D + stray spaces
  assert.equal(stripCategory("🧑‍⚕️ קטגוריית אנשי מקצוע ומטפלים"), "אנשי מקצוע ומטפלים");
  // Regular emoji
  assert.equal(stripCategory("🎒 קטגוריית מנשאים"), "מנשאים");
  // Multiple spaces should collapse to single space
  assert.equal(stripCategory("🎒  קטגוריית  מנשאים"), "מנשאים");
  // ZWJ + multiple spaces
  assert.equal(stripCategory("🧑‍⚕️  קטגוריית  אנשי מקצוע ומטפלים"), "אנשי מקצוע ומטפלים");
});

test("parseStackedTab: category headers, column headers, products", () => {
  const rows = [
    ["", "", "", ""],
    ["🎒 קטגוריית מנשאים", "🎒 קטגוריית מנשאים", "🎒 קטגוריית מנשאים", "🎒 קטגוריית מנשאים"],
    ["שם המוצר / המותג", "תיאור והמלצות מהקבוצה", "לינק / מקור", "הערות ודגשים מיוחדים"],
    ["מנשא Neko Switch", "ילקוט פיזיולוגי.\nשורה שנייה", "lunalubabies.com", "-"],
    ["", "", "", ""],
    ["🍼 קטגוריית האכלה (בקבוקים, כוסות, מוצצים)", "", "", ""],
    ["שם המוצר / המותג", "תיאור", "לינק", "הערות"],
    ["בקבוק Avent", "מומלץ", "\\-", "אזהרה: לא לכולם"],
  ];
  const out = parseStackedTab(rows);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    category: "מנשאים", name: "מנשא Neko Switch",
    description: "ילקוט פיזיולוגי.\nשורה שנייה", link: "lunalubabies.com", notes: "",
  });
  assert.deepEqual(out[1], {
    category: "האכלה", name: "בקבוק Avent",
    description: "מומלץ", link: "", notes: "אזהרה: לא לכולם",
  });
});

test("parseStackedTab skips rows before any category header", () => {
  assert.deepEqual(parseStackedTab([["מוצר יתום", "תיאור", "", ""]]), []);
});

test("parseGuidesTab transposes columns into guides", () => {
  const rows = [
    ["מדריך שינה 💤", "", "מדריך חיתולים 💩"],
    ["טקסט ארוך על שינה", "", "טקסט על חיתולים"],
  ];
  const out = parseGuidesTab(rows);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    category: "מדריכים", name: "מדריך שינה 💤",
    description: "טקסט ארוך על שינה", link: "", notes: "",
  });
  assert.equal(out[1].name, "מדריך חיתולים 💩");
});

test("parseBooksTab skips title row and empty rows", () => {
  const rows = [
    ["רשימת ספרים מומלצים לקטנטנים 📚", "", "", ""],
    ["האריה שבפנים", "", "", ""],
    ["", "", "", ""],
    ["הזחל הרעב- אריק קרל", "", "", ""],
  ];
  const out = parseBooksTab(rows);
  assert.deepEqual(out.map((p) => p.name), ["האריה שבפנים", "הזחל הרעב- אריק קרל"]);
  assert.equal(out[0].category, "ספרים לקטנטנים");
  assert.equal(out[0].description, "");
});

test("toCsv quotes commas, quotes and newlines", () => {
  const csv = toCsv([{
    category: "מנשאים", name: 'מנשא "מיוחד", כן',
    description: "שורה 1\nשורה 2", link: "", notes: "",
  }]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "category,name,description,link,notes");
  assert.ok(csv.includes('"מנשא ""מיוחד"", כן"'));
  assert.ok(csv.includes('"שורה 1\nשורה 2"'));
});
