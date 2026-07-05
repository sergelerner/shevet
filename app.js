// app.js — SHEVET application.
const { h, render } = preact;
const { signal } = preactSignals;
const html = htm.bind(h);
const L = window.ShevetLib;
const CFG = window.SHEVET_CONFIG;

// ---- state ----
const products = signal([]);
const status = signal("loading"); // loading | ready | error
const query = signal("");
const selected = signal(null); // product shown in the bottom sheet

function parseHash() {
  const hash = decodeURIComponent(location.hash.slice(1) || "/");
  const m = hash.match(/^\/c\/(.+)$/);
  return m ? { page: "category", category: m[1] } : { page: "home" };
}
const route = signal(parseHash());
window.addEventListener("hashchange", () => {
  route.value = parseHash();
  selected.value = null;
  window.scrollTo(0, 0);
});

// ---- data ----
const GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}` +
  `/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(CFG.TAB)}`;
const CACHE_KEY = "shevet-db-v1";

async function load() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try { products.value = JSON.parse(cached); status.value = "ready"; } catch { /* stale junk */ }
  }
  try {
    const res = await fetch(GVIZ_URL);
    const { labels, rows } = L.parseGvizTable(await res.text());
    if (!(labels[0] === "category" && labels[1] === "name")) {
      throw new Error("DB tab not found (gviz fallback)");
    }
    const fresh = L.toProducts(rows);
    if (!fresh.length) throw new Error("empty DB tab");
    products.value = fresh;
    status.value = "ready";
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
  } catch (err) {
    console.error("load failed:", err);
    if (status.value !== "ready") status.value = "error";
  }
}

// ---- components (placeholder bodies; Tasks 5-8 flesh these out) ----
function Loading() {
  return html`<div class="center"><p>טוען את ההמלצות…</p></div>`;
}

function ErrorScreen() {
  return html`
    <div class="center error">
      <h2>אופס 😅</h2>
      <p>לא הצלחנו לטעון את ההמלצות. בדקו את החיבור לאינטרנט ונסו שוב.</p>
      <button class="retry" onClick=${() => { status.value = "loading"; load(); }}>נסו שוב</button>
    </div>`;
}

function Home() {
  const cats = L.orderCategories(products.value, CFG.CATEGORIES, CFG.FALLBACK_EMOJI);
  return html`<pre dir="ltr">${JSON.stringify(cats.map((c) => c.name + ": " + c.items.length), null, 1)}</pre>`;
}

function CategoryPage() { return html`<p>category — Task 6</p>`; }
function BottomSheet() { return null; }

function App() {
  if (status.value === "loading") return html`<${Loading} />`;
  if (status.value === "error") return html`<${ErrorScreen} />`;
  const r = route.value;
  return html`
    <div class="app">
      ${r.page === "home"
        ? html`<${Home} />`
        : html`<${CategoryPage} name=${r.category} />`}
      ${selected.value && html`<${BottomSheet} product=${selected.value} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
load();
