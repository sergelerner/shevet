// app.js — SHEVET application.
const { h, render } = preact;
const { signal, effect } = preactSignals;
const html = htm.bind(h);
const L = window.ShevetLib;
const CFG = window.SHEVET_CONFIG;

// ---- state ----
const products = signal([]);
const status = signal("loading"); // loading | ready | error
const query = signal("");
const selected = signal(null); // product shown in the bottom sheet
const adding = signal(false); // add-item form open?

// lock background scroll while the bottom sheet is open
effect(() => {
  document.body.style.overflow = selected.value || adding.value ? "hidden" : "";
});

function parseHash() {
  const hash = decodeURIComponent(location.hash.slice(1) || "/");
  const m = hash.match(/^\/c\/(.+)$/);
  return m ? { page: "category", category: m[1] } : { page: "home" };
}
const route = signal(parseHash());
window.addEventListener("hashchange", () => {
  route.value = parseHash();
  selected.value = null;
  adding.value = false;
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
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length && parsed.every((p) => p && typeof p.name === "string" && p.name)) {
        products.value = parsed;
        status.value = "ready";
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
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
      <p>לא הצלחנו לטעון את ההמלצות.</p>
      <p class="kicker">בדקו את החיבור לאינטרנט, או שהגיליון עדיין משותף לצפייה.</p>
      <button class="retry" onClick=${() => { status.value = "loading"; load(); }}>נסו שוב</button>
    </div>`;
}

function Home() {
  const cats = L.orderCategories(products.value, CFG.CATEGORIES, CFG.FALLBACK_EMOJI);
  const q = query.value;
  return html`
    <header class="masthead">
      <div class="mast-row">
        <div>
          <h1>${CFG.TITLE}<span class="dot">.</span></h1>
          <p class="kicker">${CFG.KICKER} · ${products.value.length} המלצות</p>
        </div>
        <img class="logo" src="assets/logo.png" alt="" />
      </div>
      <div class="rule"></div>
      <input
        class="search" type="search" placeholder="🔍 חיפוש בכל המדריך…"
        value=${q} onInput=${(e) => (query.value = e.target.value)} />
    </header>
    ${q.trim() ? html`<${SearchResults} />` : html`<${CategoryIndex} cats=${cats} />`}
  `;
}

// OpenMoji Black outline icons (CC BY-SA 4.0, openmoji.org); falls back to the
// native emoji if the CDN misses a glyph. Filename convention: codepoints joined
// by "-", FE0F kept only inside ZWJ sequences.
function emojiHex(emoji) {
  const cps = [...emoji].map((c) => c.codePointAt(0));
  const hasZwj = cps.includes(0x200d);
  return cps
    .filter((cp) => hasZwj || cp !== 0xfe0f)
    .map((cp) => cp.toString(16).toUpperCase().padStart(4, "0"))
    .join("-");
}

function Emoji({ e, inline }) {
  const [failed, setFailed] = preactHooks.useState(false);
  if (failed) return html`<span class="cat-icon-txt">${e}</span>`;
  return html`<img
    class=${"cat-icon" + (inline ? " inline" : "")} alt="" loading="lazy"
    src=${"https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/" + emojiHex(e) + ".svg"}
    onError=${() => setFailed(true)} />`;
}

// Renders text from the sheet, swapping any embedded emoji for OpenMoji icons.
const EMOJI_RE =
  /(\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*(?:‍\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|️)*)*)/gu;

function EmojiText({ text }) {
  if (!text) return null;
  return String(text)
    .split(EMOJI_RE)
    .map((part, i) => (i % 2 ? html`<${Emoji} e=${part} inline key=${i} />` : part));
}

function CategoryIndex({ cats }) {
  return html`
    <ol class="index">
      ${cats.map((c, i) => html`
        <li key=${c.name}>
          <a class="idx-row" href=${"#/c/" + encodeURIComponent(c.name)}>
            <span class="no">${String(i + 1).padStart(2, "0")}</span>
            <span class="nm"><${Emoji} e=${c.emoji} /> ${c.name}</span>
            <span class="ct">${c.items.length} המלצות</span>
          </a>
        </li>`)}
    </ol>`;
}

function SearchResults() {
  const results = L.searchProducts(products.value, query.value);
  if (!results.length) return html`<p class="empty"><${EmojiText} text=${"לא נמצאו תוצאות 🤷🏻‍♀️"} /></p>`;
  return html`
    <div class="results">
      ${results.map((p) => html`
        <div key=${p.category + "|" + p.name} class="result-wrap">
          <${ProductCard} product=${p} />
          <span class="result-chip">${p.category}</span>
        </div>`)}
    </div>`;
}

function CategoryPage({ name }) {
  const items = products.value.filter((p) => p.category === name);
  const cfg = CFG.CATEGORIES.find((c) => c.name === name);
  const emoji = cfg ? cfg.emoji : CFG.FALLBACK_EMOJI;
  return html`
    <header class="cat-head">
      <a class="back" href="#/">→ חזרה</a>
      <h2><${Emoji} e=${emoji} /> ${name}</h2>
      <p class="kicker">${items.length} המלצות</p>
      <div class="rule"></div>
    </header>
    ${items.length
      ? items.map((p) => html`<${ProductCard} product=${p} key=${p.name} />`)
      : html`<p class="empty">אין עדיין המלצות בקטגוריה הזו</p>`}
  `;
}

function ProductCard({ product: p }) {
  if (!L.hasDetails(p)) {
    return html`<div class="pcard plain"><b><${EmojiText} text=${p.name} /></b></div>`;
  }
  return html`
    <button type="button" class="pcard" onClick=${() => (selected.value = p)}>
      <b><${EmojiText} text=${p.name} /></b>
      ${p.description && html`<p class="desc clamp"><${EmojiText} text=${p.description} /></p>`}
    </button>`;
}

function BottomSheet({ product: p }) {
  const href = L.normalizeLink(p.link);
  const close = () => (selected.value = null);
  return html`
    <div class="backdrop" onClick=${close}>
      <div class="sheet" onClick=${(e) => e.stopPropagation()}>
        <div class="handle"></div>
        <button class="close" onClick=${close} aria-label="סגירה">✕</button>
        <h3><${EmojiText} text=${p.name} /></h3>
        <p class="chip">${p.category}</p>
        <div class="sheet-scroll">
          ${p.description && html`
            <p class=${"sheet-desc" + (L.hasWarning(p.description) ? " warn" : "")}><${EmojiText} text=${p.description} /></p>`}
          ${p.notes && html`
            <p class=${"sheet-notes" + (L.hasWarning(p.notes) ? " warn" : "")}>
              <${EmojiText} text=${(L.hasWarning(p.notes) ? "⚠️ " : "📌 ") + p.notes} /></p>`}
          ${p.link && !href && html`<p class="sheet-notes"><${EmojiText} text=${"🔗 " + p.link} /></p>`}
        </div>
        ${href && html`
          <a class="linkbtn" href=${href} target="_blank" rel="noopener">🔗 פתיחת קישור</a>`}
      </div>
    </div>`;
}

function AddForm() {
  const preset = route.value.page === "category" ? route.value.category : CFG.CATEGORIES[0].name;
  const [form, setForm] = preactHooks.useState({
    category: preset, name: "", description: "", link: "", website: "",
  });
  const [sending, setSending] = preactHooks.useState(false);
  const [error, setError] = preactHooks.useState("");
  const close = () => (adding.value = false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const built = L.buildSubmission(form);
    if (!built.ok) { setError(built.error); return; }
    setSending(true); setError("");
    try {
      // string body => text/plain => no CORS preflight (Apps Script can't answer one)
      const res = await fetch(CFG.SUBMIT_URL, { method: "POST", body: JSON.stringify(built.payload) });
      const reply = JSON.parse(await res.text());
      if (!reply.ok) throw new Error(reply.error || "submit failed");
      const fresh = [...products.value, built.product];
      products.value = fresh;
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      close();
    } catch (err) {
      console.error("submit failed:", err);
      setError("לא הצלחנו לשלוח, נסו שוב");
      setSending(false);
    }
  }

  return html`
    <div class="backdrop" onClick=${close}>
      <div class="sheet" onClick=${(e) => e.stopPropagation()}>
        <div class="handle"></div>
        <button class="close" onClick=${close} aria-label="סגירה">✕</button>
        <h3>הוספת המלצה</h3>
        <form class="add-form sheet-scroll" onSubmit=${submit}>
          <label>קטגוריה
            <select value=${form.category} onChange=${set("category")}>
              ${CFG.CATEGORIES.map((c) => html`<option value=${c.name} key=${c.name}>${c.emoji} ${c.name}</option>`)}
            </select>
          </label>
          <label>שם *
            <input type="text" value=${form.name} onInput=${set("name")} required placeholder="שם המוצר או ההמלצה" />
          </label>
          <label>תיאור
            <textarea rows="3" value=${form.description} onInput=${set("description")} placeholder="למה זה מומלץ?"></textarea>
          </label>
          <label>קישור
            <input type="text" inputmode="url" value=${form.link} onInput=${set("link")} placeholder="https://…" />
          </label>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off"
            aria-hidden="true" value=${form.website} onInput=${set("website")} />
          ${error && html`<p class="form-error">${error}</p>`}
          <button class="linkbtn submit" type="submit" disabled=${sending}>
            ${sending ? "שולח…" : "הוספה"}
          </button>
        </form>
      </div>
    </div>`;
}

function App() {
  if (status.value === "loading") return html`<${Loading} />`;
  if (status.value === "error") return html`<${ErrorScreen} />`;
  const r = route.value;
  return html`
    <div class="app">
      ${r.page === "home"
        ? html`<${Home} />`
        : html`<${CategoryPage} name=${r.category} />`}
      <footer class="credit">
        אייקונים: <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a> (CC BY-SA 4.0)
      </footer>
      ${selected.value && html`<${BottomSheet} product=${selected.value} />`}
      ${CFG.SUBMIT_URL && !selected.value && !adding.value && html`
        <button class="fab" onClick=${() => (adding.value = true)} aria-label="הוספת המלצה">+</button>`}
      ${adding.value && html`<${AddForm} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
load();
