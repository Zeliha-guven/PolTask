"use strict";

// ---------------------------------------------------------------- sabitler
const DURUMLAR = ["Başlamadı", "Beklemede", "Geliştirmede", "Testte", "Tamamlandı", "İptal"];
const KAPANAN = new Set(["Tamamlandı", "İptal"]);
const KAPSAM_TIPLERI = ["Ana Kapsam", "Bug fix", "Ek İstek", "Kapsam İçi Değişiklik"];
const BOS = "__bos__";

// Excel kolonları — sıra ve başlıklar Excel ile aynı
const FIELDS = [
  { k: "ana_baslik", label: "Ana Başlık", type: "text", sec: "Genel", list: true },
  { k: "konu", label: "Konu", type: "textarea", sec: "Genel", full: true },
  { k: "aciklama", label: "Açıklama", type: "textarea", sec: "Genel", full: true },
  { k: "ltr_yorum", label: "LTR Yorum", type: "textarea", sec: "Genel", full: true },
  { k: "kapsam_tipi", label: "Kapsam Tipi", type: "select", options: KAPSAM_TIPLERI, sec: "Durum" },
  { k: "sozlesme", label: "Sözleşme Kapsamı", type: "select", options: ["Dahil", "Dahil değil"], sec: "Durum" },
  { k: "durum", label: "Tamamlanma Durumu", type: "select", options: DURUMLAR, sec: "Durum" },
  { k: "yuzde", label: "Tamamlanma %", type: "number", sec: "Durum" },
  { k: "oncelik", label: "Öncelik", type: "select", options: ["1", "2", "3"], sec: "Durum" },
  { k: "kimde_bekliyor", label: "Kimde Bekliyor?", type: "text", sec: "Durum", list: true },
  { k: "opm_talep_tarihi", label: "OPM Talep Tarihi", type: "date", sec: "Tarihler" },
  { k: "ilk_hedef_tarih", label: "İlk Verilen Hedef Teslim", type: "date", sec: "Tarihler" },
  { k: "hedef_tarih", label: "Hedef Teslim (Linktera)", type: "date", sec: "Tarihler" },
  { k: "uat_hedef", label: "UAT Hedefi (TurkOnay)", type: "date", sec: "Tarihler" },
  { k: "bitis_tarihi", label: "Bitiş Tarihi", type: "date", sec: "Tarihler" },
  { k: "yayginlastirma_tarihi", label: "Yaygınlaştırma Tarihi", type: "date", sec: "Tarihler" },
  { k: "opm_no", label: "OPM No", type: "text", sec: "Sorumlular & Referanslar" },
  { k: "cr_no", label: "CR Numarası", type: "text", sec: "Sorumlular & Referanslar" },
  { k: "talep_sorumlusu", label: "Talep Sorumlusu", type: "text", sec: "Sorumlular & Referanslar", list: true },
  { k: "linktera_sorumlusu", label: "Linktera Sorumlusu", type: "text", sec: "Sorumlular & Referanslar", list: true },
];
const F = Object.fromEntries(FIELDS.map(f => [f.k, f]));

const FILTER_FIELDS = ["ana_baslik", "kapsam_tipi", "durum", "kimde_bekliyor", "oncelik", "talep_sorumlusu", "linktera_sorumlusu", "sozlesme"];
const PIVOT_DIMS = FILTER_FIELDS;

// Liste görünümünde seçilebilir kolonlar
const LIST_COLS = [
  "konu", "kapsam_tipi", "durum", "yuzde", "kimde_bekliyor", "oncelik", "opm_no", "hedef_tarih",
  "ilk_hedef_tarih", "uat_hedef", "opm_talep_tarihi", "bitis_tarihi", "yayginlastirma_tarihi",
  "talep_sorumlusu", "linktera_sorumlusu", "sozlesme", "ltr_yorum", "cr_no",
];
const DEFAULT_COLS = ["konu", "kapsam_tipi", "durum", "yuzde", "kimde_bekliyor", "oncelik", "opm_no", "hedef_tarih", "talep_sorumlusu"];

// OPM'de kapanmış kayıtların bizdeki karşılığı (OPM kapalı ama bizde açıksa uyarı verilir)
const OPM_KAPALI = { "Kapatıldı": "Tamamlandı", "Çözüldü": "Tamamlandı", "Reddedildi": "İptal" };

// Özel (kolon olmayan) filtreler — Özet'teki kutulardan gelir
const SPECIAL = {
  acik: { label: "Açık işler", test: t => !KAPANAN.has(t.durum) },
  gecikmis: { label: "Hedef tarihi geçmiş", test: t => isLate(t) },
  uat_hafta: { label: "Bu hafta UAT", test: t => inThisWeek(t.uat_hedef) },
  opm_uyumsuz: { label: "OPM'de kapanmış", test: t => !!opmMismatch(t) },
};

// ---------------------------------------------------------------- durum
const state = {
  tasks: [],
  filters: {},          // {alan: değer}
  special: new Set(),   // SPECIAL anahtarları
  q: "",
  sort: { k: null, dir: 1 },
  cols: load("cols", DEFAULT_COLS),
  pivotRow: load("pivotRow", "kapsam_tipi"),
  pivotCol: load("pivotCol", "durum"),
  boardShowAll: {},
  iptalOpen: false,
  snapshots: null,
};

function load(key, def) {
  try { const v = localStorage.getItem("poltask." + key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(key, v) {
  try { localStorage.setItem("poltask." + key, JSON.stringify(v)); } catch { /* yok say */ }
}

// ---------------------------------------------------------------- yardımcılar
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sClass = d => "s-" + slug(d);
const isoLocal = d => d.toLocaleDateString("sv-SE");
const today = () => isoLocal(new Date());
const fmtDate = d => d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "";
const fmtDateShort = d => d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "";
const fmtTs = ts => ts ? `${fmtDate(ts.slice(0, 10))} ${ts.slice(11, 16)}` : "";
const trCmp = (a, b) => String(a).localeCompare(String(b), "tr");

// "Süreç İsterleri" gibi çok sayıda işte tekrarlanan KONU değerleri alt başlıktır; asıl içerik Açıklama'dadır
let genericKonu = new Set();
function computeGeneric() {
  const n = {};
  for (const t of state.tasks) if (t.konu) n[t.konu] = (n[t.konu] || 0) + 1;
  genericKonu = new Set(Object.keys(n).filter(k => n[k] > 20));
}
function title(t) { return genericKonu.has(t.konu) && t.aciklama ? t.aciklama.split("\n")[0] : t.konu; }
function subtitle(t) { return genericKonu.has(t.konu) && t.aciklama ? null : t.aciklama; }
function chip(d) { return d ? `<span class="chip ${sClass(d)}">${esc(d)}</span>` : `<span class="muted">—</span>`; }
function targetDate(t) { return t.hedef_tarih || t.ilk_hedef_tarih; }
function isLate(t) { const d = targetDate(t); return !!d && !KAPANAN.has(t.durum) && d < today(); }
function weekRange() {
  const n = new Date(); const day = (n.getDay() + 6) % 7;
  const s = new Date(n); s.setDate(n.getDate() - day);
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return [isoLocal(s), isoLocal(e)];
}
function inThisWeek(d) { if (!d) return false; const [s, e] = weekRange(); return d >= s && d <= e; }
function opmMismatch(t) {
  if (!t.opm || KAPANAN.has(t.durum)) return null;
  return OPM_KAPALI[t.opm.durum] || null;
}
function val(t, k) { const v = t[k]; return v === null || v === undefined || v === "" ? BOS : String(v); }
function dimLabel(v) { return v === BOS ? "(boş)" : v; }

function distinct(k) {
  const set = new Set(state.tasks.map(t => val(t, k)));
  const order = F[k]?.options;
  return [...set].sort((a, b) => {
    if (a === BOS) return 1; if (b === BOS) return -1;
    if (order) return order.indexOf(a) - order.indexOf(b);
    return trCmp(a, b);
  });
}

function toast(msg, err = false) {
  const el = $("#toast");
  el.textContent = msg; el.className = "toast" + (err ? " err" : ""); el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
}

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers["Content-Type"] = "application/json"; }
  const r = await fetch(url, opt);
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).error || msg; } catch { /* yok say */ }
    toast(msg, true);
    throw new Error(msg);
  }
  return r.status === 204 || r.status === 201 && !r.headers.get("content-type")?.includes("json") ? null : r.json();
}

async function loadTasks() { state.tasks = await api("GET", "/api/tasks"); computeGeneric(); }
function replaceTask(t) {
  const i = state.tasks.findIndex(x => x.id === t.id);
  if (i >= 0) state.tasks[i] = { ...state.tasks[i], ...t }; else state.tasks.push({ ...t, yorum_sayisi: 0 });
}

// ---------------------------------------------------------------- filtreleme
function filtered() {
  const q = state.q.trim().toLocaleLowerCase("tr");
  return state.tasks.filter(t => {
    for (const [k, v] of Object.entries(state.filters)) if (val(t, k) !== v) return false;
    for (const s of state.special) if (!SPECIAL[s].test(t)) return false;
    if (q) {
      const hay = [t.konu, t.aciklama, t.opm_no, t.ltr_yorum, t.ana_baslik, t.cr_no, t.kimde_bekliyor].join(" ").toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function filterBar(list) {
  const sel = FILTER_FIELDS.map(k => {
    const cur = state.filters[k];
    return `<select data-filter="${k}" class="${cur ? "on" : ""}">
      <option value="">${esc(F[k].label)}: Tümü</option>
      ${distinct(k).map(v => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(dimLabel(v))}</option>`).join("")}
    </select>`;
  }).join("");
  const sp = Object.entries(SPECIAL).map(([k, s]) =>
    `<label class="chk"><input type="checkbox" data-special="${k}" ${state.special.has(k) ? "checked" : ""}>${esc(s.label)}</label>`).join("");
  const any = Object.keys(state.filters).length || state.special.size || state.q;
  return `<div class="filters">${sel}${sp}
    ${any ? `<button class="ghost small" data-act="clear-filters">✕ Filtreleri temizle</button>` : ""}
    <span class="count">${list.length} / ${state.tasks.length} iş</span></div>`;
}

function bindFilterBar(root) {
  $$("[data-filter]", root).forEach(s => s.onchange = () => {
    if (s.value) state.filters[s.dataset.filter] = s.value; else delete state.filters[s.dataset.filter];
    render();
  });
  $$("[data-special]", root).forEach(c => c.onchange = () => {
    c.checked ? state.special.add(c.dataset.special) : state.special.delete(c.dataset.special);
    render();
  });
  const clr = $("[data-act=clear-filters]", root);
  if (clr) clr.onclick = () => { state.filters = {}; state.special.clear(); state.q = ""; $("#search").value = ""; render(); };
}

// ---------------------------------------------------------------- yönlendirme
const VIEWS = {
  ozet: { title: "Özet", render: renderOzet },
  liste: { title: "Liste", render: renderListe },
  pano: { title: "Pano", render: renderPano },
  karsilastirma: { title: "Karşılaştırma", render: renderKarsilastirma },
  aktarim: { title: "İçe / Dışa Aktar", render: renderAktarim },
};
function currentView() { const v = location.hash.replace(/^#\/?/, "").split("?")[0]; return VIEWS[v] ? v : "ozet"; }
function go(view) { if (currentView() === view) render(); else location.hash = "#/" + view; }

function render() {
  const v = currentView();
  $("#viewTitle").textContent = VIEWS[v].title;
  $$("nav a").forEach(a => a.classList.toggle("active", a.dataset.view === v));
  const el = $("#view");
  if (!state.tasks.length && v !== "aktarim" && v !== "karsilastirma") {
    el.innerHTML = `<div class="empty-state"><h2>Henüz iş yok</h2><p>Excel listenizi içe aktararak başlayın.</p>
      <button class="primary" onclick="location.hash='#/aktarim'">İçe aktar</button></div>`;
    return;
  }
  VIEWS[v].render(el);
}

// ---------------------------------------------------------------- Özet
function pivotData(list, rowK, colK) {
  const rows = new Map(), cols = new Set();
  for (const t of list) {
    const r = val(t, rowK), c = val(t, colK);
    cols.add(c);
    if (!rows.has(r)) rows.set(r, {});
    rows.get(r)[c] = (rows.get(r)[c] || 0) + 1;
  }
  const order = k => (a, b) => {
    if (a === BOS) return 1; if (b === BOS) return -1;
    const o = F[k]?.options; return o ? o.indexOf(a) - o.indexOf(b) : trCmp(a, b);
  };
  return { rows: [...rows.keys()].sort(order(rowK)).map(k => [k, rows.get(k)]), cols: [...cols].sort(order(colK)) };
}

function renderOzet(el) {
  const T = state.tasks;
  const open = T.filter(t => !KAPANAN.has(t.durum));
  const kpis = [
    { k: "acik", v: open.length, l: "Açık iş" },
    { k: "linktera", v: open.filter(t => t.kimde_bekliyor === "Linktera").length, l: "Linktera'da bekleyen" },
    { k: "gecikmis", v: T.filter(isLate).length, l: "Hedef tarihi geçmiş" },
    { k: "uat_hafta", v: T.filter(t => inThisWeek(t.uat_hedef)).length, l: "Bu hafta UAT" },
    { k: "opm_uyumsuz", v: T.filter(t => opmMismatch(t)).length, l: "OPM'de kapanmış, bizde açık" },
  ];
  const { rows, cols } = pivotData(T, state.pivotRow, state.pivotCol);
  const colTot = Object.fromEntries(cols.map(c => [c, rows.reduce((s, [, r]) => s + (r[c] || 0), 0)]));
  const isDurumCol = state.pivotCol === "durum";
  const dimOpts = cur => PIVOT_DIMS.map(k => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(F[k].label)}</option>`).join("");

  const upcoming = open
    .flatMap(t => [["Hedef", t.hedef_tarih || t.ilk_hedef_tarih, t], ["UAT", t.uat_hedef, t]])
    .filter(([, d]) => d)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const lateOnes = upcoming.filter(([, d]) => d < today()).slice(-5);
  const next = upcoming.filter(([, d]) => d >= today()).slice(0, 10);

  const head = (kind, d) => kind === "UAT" ? `<span class="tag">UAT</span>` : `<span class="tag">Teslim</span>`;
  const upItem = ([kind, d, t]) => `<li data-id="${t.id}"><span class="d ${d < today() ? "late" : ""}">${fmtDateShort(d)}</span>
    <div class="t grow"><div><b>${esc(title(t))}</b></div><div class="muted">${head(kind)} ${esc(t.kimde_bekliyor || "")} ${t.opm_no ? "· " + esc(t.opm_no) : ""}</div></div>${chip(t.durum)}</li>`;

  el.innerHTML = `
    <div class="kpis">${kpis.map(k => `<button class="card kpi" data-kpi="${k.k}"><div class="v">${k.v}</div><div class="l">${k.l}</div></button>`).join("")}</div>
    <div class="ozet-grid">
      <div class="card">
        <div class="card-h"><h2>Güncel Durum</h2>
          <div class="row"><span class="muted">Satır</span><select id="pvRow">${dimOpts(state.pivotRow)}</select>
          <span class="muted">Kolon</span><select id="pvCol">${dimOpts(state.pivotCol)}</select></div></div>
        <div class="card-b pivot-wrap">
          <table class="pivot">
            <thead><tr><th>${esc(F[state.pivotRow].label)}</th>${cols.map(c => `<th>${isDurumCol && c !== BOS ? chip(c) : esc(dimLabel(c))}</th>`).join("")}<th>Genel Toplam</th></tr></thead>
            <tbody>
              ${rows.map(([rk, r]) => {
                const tot = Object.values(r).reduce((a, b) => a + b, 0);
                return `<tr><td>${esc(dimLabel(rk))}</td>${cols.map(c => r[c]
                  ? `<td class="cell" data-r="${esc(rk)}" data-c="${esc(c)}">${r[c]}</td>`
                  : `<td class="empty">·</td>`).join("")}<td class="cell total" data-r="${esc(rk)}">${tot}</td></tr>`;
              }).join("")}
              <tr class="total"><td>Genel Toplam</td>${cols.map(c => `<td class="cell" data-c="${esc(c)}">${colTot[c]}</td>`).join("")}<td class="cell">${T.length}</td></tr>
            </tbody>
          </table>
          ${isDurumCol ? `<div style="margin-top:14px">${statusBar(T)}</div>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Yaklaşan tarihler</h2><span class="muted">açık işler</span></div>
        <div class="card-b">
          ${lateOnes.length ? `<div class="muted" style="font-size:12px">Geçmiş (son 5)</div><ul class="upcoming">${lateOnes.map(upItem).join("")}</ul>` : ""}
          <div class="muted" style="font-size:12px;margin-top:8px">Önümüzdeki</div>
          <ul class="upcoming">${next.map(upItem).join("") || `<li class="muted">Tarihli açık iş yok</li>`}</ul>
        </div>
      </div>
    </div>`;

  $("#pvRow").onchange = e => { state.pivotRow = e.target.value; save("pivotRow", state.pivotRow); render(); };
  $("#pvCol").onchange = e => { state.pivotCol = e.target.value; save("pivotCol", state.pivotCol); render(); };
  $$(".pivot td.cell", el).forEach(td => td.onclick = () => {
    state.filters = {}; state.special.clear();
    if (td.dataset.r !== undefined) state.filters[state.pivotRow] = td.dataset.r;
    if (td.dataset.c !== undefined) state.filters[state.pivotCol] = td.dataset.c;
    go("liste");
  });
  $$("[data-kpi]", el).forEach(b => b.onclick = () => {
    state.filters = {}; state.special.clear();
    if (b.dataset.kpi === "linktera") { state.special.add("acik"); state.filters.kimde_bekliyor = "Linktera"; }
    else state.special.add(b.dataset.kpi);
    go("liste");
  });
  $$(".upcoming li[data-id]", el).forEach(li => li.onclick = () => openDrawer(+li.dataset.id));
}

function statusBar(list) {
  const n = list.length || 1;
  const counts = DURUMLAR.map(d => [d, list.filter(t => t.durum === d).length]).filter(([, c]) => c);
  return `<div class="bar" title="${counts.map(([d, c]) => `${d}: ${c}`).join(" · ")}">${counts.map(([d, c]) => `<span class="${sClass(d)}" style="width:${(c / n) * 100}%"></span>`).join("")}</div>`;
}

// ---------------------------------------------------------------- Liste
function cellHtml(t, k) {
  const v = t[k];
  switch (k) {
    case "konu":
      return `<td class="konu">${genericKonu.has(v) ? `<span class="tag">${esc(v)}</span> ` : ""}<b class="clamp">${esc(title(t))}</b>${subtitle(t) ? `<div class="clamp">${esc(subtitle(t))}</div>` : ""}
        ${t.yorum_sayisi ? `<span class="muted" style="font-size:12px">💬 ${t.yorum_sayisi}</span>` : ""}</td>`;
    case "durum": {
      const mm = opmMismatch(t);
      return `<td class="nowrap"><select class="inline ${sClass(v)}" data-durum="${t.id}">${DURUMLAR.map(d => `<option ${d === v ? "selected" : ""}>${d}</option>`).join("")}</select>
        ${mm ? `<div><span class="warn-badge" title="OPM durumu: ${esc(t.opm.durum)}">OPM: ${esc(t.opm.durum)}</span></div>` : ""}</td>`;
    }
    case "yuzde": return `<td class="nowrap">${v == null ? "" : v + "%"}</td>`;
    case "oncelik": return `<td>${v ? `<span class="prio prio-${v}">P${v}</span>` : ""}</td>`;
    case "kapsam_tipi": return `<td class="nowrap"><span class="tag">${esc(v || "")}</span></td>`;
    case "hedef_tarih": {
      const d = targetDate(t);
      return `<td class="nowrap ${isLate(t) ? "late" : ""}">${fmtDate(d)}${!t.hedef_tarih && d ? ` <span class="muted" title="İlk verilen hedef">(ilk)</span>` : ""}</td>`;
    }
    case "ltr_yorum": return `<td><div class="clamp" style="max-width:260px">${esc(v)}</div></td>`;
    default:
      if (F[k].type === "date") return `<td class="nowrap">${fmtDate(v)}</td>`;
      return `<td class="nowrap">${esc(v)}</td>`;
  }
}

function sortList(list) {
  const { k, dir } = state.sort;
  if (!k) return list;
  const get = t => k === "hedef_tarih" ? targetDate(t) : t[k];
  return [...list].sort((a, b) => {
    const x = get(a), y = get(b);
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (typeof x === "number" ? x - y : trCmp(x, y)) * dir;
  });
}

function renderListe(el) {
  const list = sortList(filtered());
  const cols = state.cols.filter(c => F[c]);
  const groups = new Map();
  for (const t of list) {
    const g = t.ana_baslik || "(Ana başlık yok)";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const th = c => {
    const label = c === "hedef_tarih" ? "Hedef Teslim" : F[c].label;
    const arrow = state.sort.k === c ? `<span class="arrow">${state.sort.dir > 0 ? " ▲" : " ▼"}</span>` : "";
    return `<th data-sort="${c}">${esc(label)}${arrow}</th>`;
  };
  el.innerHTML = `
    <div class="row" style="align-items:flex-start">
      <div class="grow">${filterBar(list)}</div>
      <div class="colpicker"><button class="small" id="colBtn">Kolonlar ▾</button>
        <div class="menu" id="colMenu" hidden>
          ${LIST_COLS.map(c => `<label><input type="checkbox" value="${c}" ${state.cols.includes(c) ? "checked" : ""} ${c === "konu" ? "disabled" : ""}>${esc(F[c].label)}</label>`).join("")}
          <button class="ghost small" id="colReset" style="margin-top:6px">Varsayılana dön</button>
        </div></div>
    </div>
    <div class="card table-wrap">
      <table class="grid">
        <thead><tr>${cols.map(th).join("")}</tr></thead>
        <tbody>
          ${[...groups].map(([g, ts]) => `
            <tr class="group"><td colspan="${cols.length}">${esc(g)} <span class="muted">· ${ts.length}</span>${statusBar(ts)}</td></tr>
            ${ts.map(t => `<tr class="task" data-id="${t.id}">${cols.map(c => cellHtml(t, c)).join("")}</tr>`).join("")}
          `).join("") || `<tr><td colspan="${cols.length}" class="empty-state">Filtreye uyan iş yok</td></tr>`}
        </tbody>
      </table>
    </div>`;

  bindFilterBar(el);
  $$("th[data-sort]", el).forEach(h => h.onclick = () => {
    const k = h.dataset.sort;
    if (state.sort.k !== k) state.sort = { k, dir: 1 };
    else if (state.sort.dir === 1) state.sort.dir = -1;
    else state.sort = { k: null, dir: 1 };
    render();
  });
  $$("tr.task", el).forEach(tr => tr.onclick = e => { if (!e.target.closest("select")) openDrawer(+tr.dataset.id); });
  $$("select[data-durum]", el).forEach(s => s.onchange = () => setDurum(+s.dataset.durum, s.value));
  $("#colBtn").onclick = e => { e.stopPropagation(); $("#colMenu").hidden = !$("#colMenu").hidden; };
  $("#colMenu").onclick = e => e.stopPropagation();
  $$("#colMenu input", el).forEach(c => c.onchange = () => {
    state.cols = LIST_COLS.filter(k => k === "konu" || $(`#colMenu input[value="${k}"]`).checked);
    save("cols", state.cols); render(); $("#colMenu").hidden = false;
  });
  $("#colReset").onclick = () => { state.cols = [...DEFAULT_COLS]; save("cols", state.cols); render(); };
}

async function setDurum(id, durum) {
  const t = state.tasks.find(x => x.id === id);
  const patch = { durum };
  if (durum === "Tamamlandı" && (t.yuzde !== 100 || !t.bitis_tarihi)
      && confirm("Tamamlandı olarak işaretleniyor.\nTamamlanma % 100 ve Bitiş Tarihi bugün olarak ayarlansın mı?")) {
    patch.yuzde = 100;
    if (!t.bitis_tarihi) patch.bitis_tarihi = today();
  }
  replaceTask(await api("PATCH", `/api/tasks/${id}`, patch));
  toast(`Durum: ${durum}`);
  render();
}

// ---------------------------------------------------------------- Pano
const BOARD_LIMIT = 40;

function renderPano(el) {
  const list = filtered();
  const by = Object.fromEntries(DURUMLAR.map(d => [d, []]));
  for (const t of list) (by[t.durum] || (by[t.durum] = [])).push(t);
  for (const d in by) by[d].sort((a, b) => (a.oncelik || 9) - (b.oncelik || 9) || (targetDate(a) || "9").localeCompare(targetDate(b) || "9"));

  const card = t => {
    const d = targetDate(t);
    return `<div class="kcard k-${slug(t.kapsam_tipi)}" draggable="true" data-id="${t.id}">
      <div class="top"><span class="tag">${esc(t.kapsam_tipi || "—")}</span>${t.oncelik ? `<span class="prio prio-${t.oncelik}">P${t.oncelik}</span>` : ""}
        ${opmMismatch(t) ? `<span class="warn-badge">OPM: ${esc(t.opm.durum)}</span>` : ""}</div>
      <div class="ttl clamp">${esc(title(t))}</div>
      ${subtitle(t) ? `<div class="clamp">${esc(subtitle(t))}</div>` : ""}
      <div class="meta">${t.opm_no && /LTR/i.test(t.opm_no) ? `<span>${esc(t.opm_no)}</span>` : ""}
        ${d ? `<span class="${isLate(t) ? "late" : ""}">⏱ ${fmtDate(d)}</span>` : ""}
        ${t.kimde_bekliyor ? `<span>→ ${esc(t.kimde_bekliyor)}</span>` : ""}
        ${t.yuzde != null && t.yuzde > 0 && t.yuzde < 100 ? `<span>${t.yuzde}%</span>` : ""}
        ${t.yorum_sayisi ? `<span>💬 ${t.yorum_sayisi}</span>` : ""}</div>
    </div>`;
  };
  const column = d => {
    const items = by[d] || [];
    const collapsed = d === "İptal" && !state.iptalOpen;
    const shown = state.boardShowAll[d] ? items : items.slice(0, BOARD_LIMIT);
    return `<div class="col ${collapsed ? "collapsed" : ""}" data-col="${esc(d)}">
      <div class="col-h"><span class="chip ${sClass(d)}">${esc(d)}</span><span class="n">${items.length}</span>${collapsed ? `<span class="muted" style="margin-top:8px">${items.length}</span>` : ""}</div>
      <div class="col-b">${shown.map(card).join("")}
        ${items.length > shown.length ? `<button class="ghost small more" data-more="${esc(d)}">+ ${items.length - shown.length} iş daha göster</button>` : ""}</div>
    </div>`;
  };

  el.innerHTML = `${filterBar(list)}<div class="board">${DURUMLAR.map(column).join("")}</div>`;
  bindFilterBar(el);

  $$(".kcard", el).forEach(c => {
    c.onclick = () => openDrawer(+c.dataset.id);
    c.ondragstart = e => { e.dataTransfer.setData("text/plain", c.dataset.id); c.classList.add("dragging"); };
    c.ondragend = () => c.classList.remove("dragging");
  });
  $$(".col", el).forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add("over"); };
    col.ondragleave = () => col.classList.remove("over");
    col.ondrop = e => {
      e.preventDefault(); col.classList.remove("over");
      const id = +e.dataTransfer.getData("text/plain");
      const t = state.tasks.find(x => x.id === id);
      if (t && t.durum !== col.dataset.col) setDurum(id, col.dataset.col);
    };
    if (col.classList.contains("collapsed")) col.onclick = () => { state.iptalOpen = true; render(); };
  });
  $$("[data-more]", el).forEach(b => b.onclick = e => { e.stopPropagation(); state.boardShowAll[b.dataset.more] = true; render(); });
}

// ---------------------------------------------------------------- Karşılaştırma
let chart = null;

function livePivot() {
  const p = {};
  for (const t of state.tasks) {
    const k = t.kapsam_tipi || "(boş)", d = t.durum || "(boş)";
    (p[k] = p[k] || {})[d] = (p[k][d] || 0) + 1;
  }
  return p;
}

async function renderKarsilastirma(el) {
  if (!state.snapshots) {
    // BR-6: haftalık snapshot açık bir istekle alınır (GET artık veri yazmaz — spec 0001 CB-7)
    await api("POST", "/api/snapshots/haftalik");
    state.snapshots = await api("GET", "/api/snapshots");
  }
  const snaps = state.snapshots;
  const options = [...snaps.map(s => ({ id: String(s.id), label: `${fmtDate(s.tarih.slice(0, 10))} — ${s.etiket || ""}`, pivot: s.pivot })),
                   { id: "live", label: "Şu an (canlı)", pivot: livePivot() }];
  const byId = Object.fromEntries(options.map(o => [o.id, o]));
  // Varsayılan: Excel'den gelen son elle alınmış özet ↔ canlı
  const lastHistoric = [...snaps].reverse().find(s => s.tarih.slice(0, 10) < today()) || snaps[snaps.length - 1];
  state.cmpA = byId[state.cmpA] ? state.cmpA : (lastHistoric ? String(lastHistoric.id) : "live");
  state.cmpB = byId[state.cmpB] ? state.cmpB : "live";
  const A = byId[state.cmpA].pivot, B = byId[state.cmpB].pivot;

  const kapsamlar = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort((a, b) => a === "(boş)" ? 1 : b === "(boş)" ? -1 : trCmp(a, b));
  const durumlar = DURUMLAR.filter(d => kapsamlar.some(k => (A[k] || {})[d] || (B[k] || {})[d]));
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const colSum = (P, d) => kapsamlar.reduce((s, k) => s + ((P[k] || {})[d] || 0), 0);
  const delta = (b, a) => {
    const n = b - a;
    return n ? `<span class="delta ${n > 0 ? "up" : "down"}">${n > 0 ? "+" : ""}${n}</span>` : "";
  };
  const cell = (b, a, cls = "") => `<td class="${cls}">${b || (a ? 0 : `<span class="empty">·</span>`)}${delta(b, a)}</td>`;
  const sel = (id, cur) => `<select id="${id}">${options.map(o => `<option value="${o.id}" ${o.id === cur ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;

  el.innerHTML = `
    <div class="cmp-grid">
      <div class="card">
        <div class="card-h"><h2>Durum karşılaştırması</h2>
          <div class="row">${sel("cmpA", state.cmpA)}<span class="muted">→</span>${sel("cmpB", state.cmpB)}</div></div>
        <div class="card-b pivot-wrap">
          <table class="pivot">
            <thead><tr><th>Kapsam Tipi</th>${durumlar.map(d => `<th>${chip(d)}</th>`).join("")}<th>Genel Toplam</th></tr></thead>
            <tbody>
              ${kapsamlar.map(k => `<tr><td>${esc(k)}</td>${durumlar.map(d => cell((B[k] || {})[d] || 0, (A[k] || {})[d] || 0)).join("")}${cell(sum(B[k]), sum(A[k]), "total")}</tr>`).join("")}
              <tr class="total"><td>Genel Toplam</td>${durumlar.map(d => cell(colSum(B, d), colSum(A, d))).join("")}${cell(sum(Object.fromEntries(kapsamlar.map(k => [k, sum(B[k])]))), sum(Object.fromEntries(kapsamlar.map(k => [k, sum(A[k])]))))}</tr>
            </tbody>
          </table>
          <p class="muted" style="font-size:12px;margin:10px 0 0">Hücrelerde sağdaki seçimin değeri, altında soldakine göre fark gösterilir.</p>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Anlık görüntüler</h2><span class="muted">${snaps.length} kayıt</span></div>
        <div class="card-b">
          <div class="row" style="margin-bottom:10px"><input type="text" id="snapLabel" class="grow" placeholder="Etiket (ör. 23 Ekim haftası)"><button class="primary" id="snapBtn">Anlık görüntü al</button></div>
          <ul class="snap-list">${[...snaps].reverse().map(s => `<li><span style="width:80px" class="muted">${fmtDate(s.tarih.slice(0, 10))}</span>
            <span class="grow">${esc(s.etiket || "")}</span><b>${sum(Object.fromEntries(Object.entries(s.pivot).map(([k, v]) => [k, sum(v)])))}</b>
            <button class="ghost small danger" data-delsnap="${s.id}" title="Sil">✕</button></li>`).join("")}</ul>
          <p class="muted" style="font-size:12px;margin:10px 0 0">Her hafta siteyi ilk açtığınızda otomatik bir görüntü alınır.</p>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-h"><h2>Haftalara göre durum dağılımı</h2></div>
      <div class="card-b"><div class="chart-box"><canvas id="trend"></canvas></div></div>
    </div>`;

  $("#cmpA").onchange = e => { state.cmpA = e.target.value; render(); };
  $("#cmpB").onchange = e => { state.cmpB = e.target.value; render(); };
  $("#snapBtn").onclick = async () => {
    await api("POST", "/api/snapshots", { etiket: $("#snapLabel").value });
    state.snapshots = null; toast("Anlık görüntü alındı"); render();
  };
  $$("[data-delsnap]", el).forEach(b => b.onclick = async () => {
    if (!confirm("Bu anlık görüntü silinsin mi?")) return;
    await api("DELETE", `/api/snapshots/${b.dataset.delsnap}`);
    state.snapshots = null; render();
  });
  drawTrend(snaps);
}

function drawTrend(snaps) {
  if (chart) { chart.destroy(); chart = null; }
  if (!window.Chart) { $("#trend").replaceWith(Object.assign(document.createElement("p"), { className: "muted", textContent: "Grafik kütüphanesi yüklenemedi (internet bağlantısı gerekli)." })); return; }
  // Aynı güne ait birden fazla görüntüde sonuncuyu kullan
  const byDay = new Map();
  for (const s of snaps) byDay.set(s.tarih.slice(0, 10), s);
  const pts = [...byDay.values()];
  const css = getComputedStyle(document.documentElement);
  const color = d => css.getPropertyValue("--" + sClass(d)).trim();
  const totals = s => { const o = {}; for (const r of Object.values(s.pivot)) for (const [d, n] of Object.entries(r)) o[d] = (o[d] || 0) + n; return o; };
  chart = new Chart($("#trend"), {
    type: "bar",
    data: {
      labels: pts.map(s => fmtDateShort(s.tarih.slice(0, 10))),
      datasets: DURUMLAR.filter(d => !KAPANAN.has(d)).map(d => ({
        label: d, data: pts.map(s => totals(s)[d] || 0), backgroundColor: color(d), borderRadius: 3, maxBarThickness: 36,
      })),
    },
    options: {
      maintainAspectRatio: false, animation: false,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: css.getPropertyValue("--muted") } },
        y: { stacked: true, grid: { color: css.getPropertyValue("--border") }, ticks: { color: css.getPropertyValue("--muted") } },
      },
      plugins: {
        legend: { position: "bottom", labels: { color: css.getPropertyValue("--text"), boxWidth: 12 } },
        tooltip: { mode: "index", intersect: false, footer: items => "Açık iş toplamı: " + items.reduce((a, i) => a + i.raw, 0) },
        subtitle: { display: true, text: "Açık işler (Tamamlandı ve İptal hariç) — haftalık değişim", color: css.getPropertyValue("--muted"), padding: { bottom: 10 } },
      },
    },
  });
}

// ---------------------------------------------------------------- Aktarım
async function renderAktarim(el) {
  const m = await api("GET", "/api/meta");
  el.innerHTML = `
    <div class="io-grid">
      <div class="card"><div class="card-h"><h2>Excel'den içe aktar</h2></div><div class="card-b">
        <p>"Linktera_Tüm_İşler" sayfasını içeren Excel'i yükleyin. "Karşılaştırmalı özet" sayfasındaki geçmiş haftalar ve "opm" sayfası da alınır.</p>
        <p><b style="color:var(--danger)">Dikkat:</b> sitedeki tüm işler, yorumlar ve anlık görüntüler silinip yeniden oluşturulur.</p>
        <label class="drop">Excel dosyası seç (.xlsx)<input type="file" accept=".xlsx,.xlsm" id="fExcel"></label>
        <p class="muted" style="margin-top:10px;font-size:12px">Son içe aktarım: ${m.son_ice_aktarim ? fmtTs(m.son_ice_aktarim) : "—"} · ${m.is_sayisi} iş</p>
      </div></div>
      <div class="card"><div class="card-h"><h2>OPM export yükle</h2></div><div class="card-b">
        <p>OPM sisteminden aldığınız listeyi yükleyin. İşler OPM NO ile eşleşir; durumlar <b>otomatik değişmez</b>, uyumsuz olanlar işaretlenir.</p>
        <label class="drop">OPM Excel dosyası seç (.xlsx)<input type="file" accept=".xlsx,.xlsm" id="fOpm"></label>
        <p class="muted" style="margin-top:10px;font-size:12px">Son OPM yüklemesi: ${m.son_opm_aktarim ? fmtTs(m.son_opm_aktarim) : "—"} · ${m.opm_sayisi} kayıt</p>
      </div></div>
      <div class="card"><div class="card-h"><h2>Excel'e aktar</h2></div><div class="card-b">
        <p>Tüm işleri orijinal kolon düzeniyle ve "Güncel Durum" pivotuyla birlikte indirin. Yorumlar "İçerik Detayı-Tarihçe" kolonuna yazılır.</p>
        <a href="/api/export"><button class="primary">Excel indir</button></a>
      </div></div>
    </div>`;

  $("#fExcel").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm(`"${f.name}" içe aktarılacak.\nMevcut tüm işler, yorumlar ve değişiklik geçmişi silinecek. Devam edilsin mi?`)) { e.target.value = ""; return; }
    const fd = new FormData(); fd.append("file", f);
    toast("İçe aktarılıyor…");
    const r = await api("POST", "/api/import/excel", fd);
    await loadTasks(); state.snapshots = null;
    toast(`${r.isler} iş, ${r.gecmis_ozet} geçmiş özet${r.opm != null ? `, ${r.opm} OPM kaydı` : ""} aktarıldı`);
    render();
  };
  $("#fOpm").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    toast("OPM yükleniyor…");
    const r = await api("POST", "/api/import/opm", fd);
    await loadTasks();
    toast(`${r.opm} OPM kaydı yüklendi, ${r.eslesen} iş eşleşti`);
    render();
  };
}

// ---------------------------------------------------------------- Detay çekmecesi
let drawerTask = null;

function fieldInput(f, v) {
  const id = `f_${f.k}`;
  let input;
  if (f.type === "select") {
    input = `<select id="${id}" name="${f.k}"><option value="">—</option>${f.options.map(o => `<option ${String(v ?? "") === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  } else if (f.type === "textarea") {
    input = `<textarea id="${id}" name="${f.k}" rows="${f.k === "konu" ? 2 : 3}">${esc(v)}</textarea>`;
  } else if (f.type === "number") {
    input = `<input type="number" min="0" max="100" step="5" id="${id}" name="${f.k}" value="${esc(v)}">`;
  } else {
    input = `<input type="${f.type === "date" ? "date" : "text"}" id="${id}" name="${f.k}" value="${esc(v)}" ${f.list ? `list="dl_${f.k}"` : ""}>`;
  }
  const dl = f.list ? `<datalist id="dl_${f.k}">${distinct(f.k).filter(x => x !== BOS).map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : "";
  return `<div class="field ${f.full ? "full" : ""}"><label for="${id}">${esc(f.label)}</label>${input}${dl}</div>`;
}

function openDrawer(id) {
  const isNew = id == null;
  const t = isNew
    ? { id: null, durum: "Başlamadı", opm_talep_tarihi: today(), sozlesme: "Dahil", ana_baslik: state.filters.ana_baslik !== BOS ? state.filters.ana_baslik : "", kapsam_tipi: "Ek İstek" }
    : state.tasks.find(x => x.id === id);
  if (!t) return;
  drawerTask = t;
  const secs = [...new Set(FIELDS.map(f => f.sec))];
  const mm = opmMismatch(t);
  const opmBox = t.opm ? `<div class="form-sec"><h3>OPM kaydı</h3><div class="opm-box">
      <div class="row"><b>${esc(t.opm.kod)}</b>${chip(t.opm.durum)}${mm ? `<span class="warn-badge">Bizdeki durum: ${esc(t.durum)} → önerilen: ${esc(mm)}</span>
        <button class="small" id="applyOpm">Uygula</button>` : ""}</div>
      <dl><dt>Konu</dt><dd>${esc(t.opm.konu)}</dd><dt>Atanan</dt><dd>${esc(t.opm.atanan || "—")}</dd>
        <dt>Öncelik / Tür</dt><dd>${esc(t.opm.oncelik || "")} · ${esc(t.opm.tur || "")}</dd>
        <dt>Modül</dt><dd>${esc(t.opm.modul || "—")}</dd>
        <dt>Oluşturma</dt><dd>${esc(t.opm.olusturma || "")}</dd><dt>Son güncelleme</dt><dd>${esc(t.opm.son_guncelleme || "")}</dd></dl>
    </div></div>` : "";

  const d = $("#drawer");
  d.innerHTML = `
    <div class="drawer-h">${isNew ? "" : chip(t.durum)}<h2 title="${esc(title(t))}">${isNew ? "Yeni İş" : esc(title(t))}</h2>
      <button class="ghost" id="dClose" title="Kapat (Esc)">✕</button></div>
    <div class="drawer-b">
      <form id="dForm">
        ${secs.map(s => `<div class="form-sec"><h3>${esc(s)}</h3><div class="fgrid">${FIELDS.filter(f => f.sec === s).map(f => fieldInput(f, t[f.k])).join("")}</div></div>`).join("")}
      </form>
      ${opmBox}
      ${isNew ? "" : `<div class="form-sec"><h3>Yorumlar & Tarihçe</h3>
        <textarea id="cText" rows="2" placeholder="Not ekle… (Ctrl+Enter ile kaydet)"></textarea>
        <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="small primary" id="cAdd">Yorum ekle</button></div>
        <ul class="timeline" id="tl"><li class="muted">Yükleniyor…</li></ul></div>`}
    </div>
    <div class="drawer-f">
      <button class="primary" id="dSave">${isNew ? "Oluştur" : "Kaydet"}</button>
      <button id="dCancel">Kapat</button>
      ${isNew ? "" : `<span class="grow"></span><button class="danger ghost" id="dDel">Sil</button>`}
    </div>`;
  d.hidden = false; $("#drawerBackdrop").hidden = false;

  const form = $("#dForm");
  form.oninput = form.onchange = e => {
    const f = e.target.closest(".field"); if (!f) return;
    const k = e.target.name;
    f.classList.toggle("changed", String(e.target.value) !== String(t[k] ?? ""));
  };
  $("#dClose").onclick = $("#dCancel").onclick = closeDrawer;
  $("#dSave").onclick = () => saveDrawer(isNew);
  if (!isNew) {
    $("#dDel").onclick = async () => {
      if (!confirm(`"${title(t)}" silinsin mi? Bu işlem geri alınamaz.`)) return;
      await api("DELETE", `/api/tasks/${t.id}`);
      state.tasks = state.tasks.filter(x => x.id !== t.id);
      closeDrawer(true); toast("İş silindi"); render();
    };
    $("#cAdd").onclick = addComment;
    $("#cText").onkeydown = e => { if (e.key === "Enter" && e.ctrlKey) addComment(); };
    if ($("#applyOpm")) $("#applyOpm").onclick = () => { $("#f_durum").value = mm; $("#f_durum").dispatchEvent(new Event("change", { bubbles: true })); };
    loadTimeline();
  }
  setTimeout(() => (isNew ? $("#f_konu") : $("#dClose")).focus(), 0);
}

function formChanges() {
  const out = {};
  for (const el of $$("#dForm [name]")) {
    const k = el.name, v = el.value.trim();
    if (v !== String(drawerTask[k] ?? "")) out[k] = v;
  }
  return out;
}

function closeDrawer(force) {
  if (force !== true && drawerTask && Object.keys(formChanges()).length && !confirm("Kaydedilmemiş değişiklikler var. Kapatılsın mı?")) return;
  $("#drawer").hidden = true; $("#drawerBackdrop").hidden = true; drawerTask = null;
}

async function saveDrawer(isNew) {
  const changes = formChanges();
  if (isNew) {
    if (!changes.konu && !drawerTask.konu) { toast("Konu zorunlu", true); $("#f_konu").focus(); return; }
    const body = Object.fromEntries($$("#dForm [name]").map(el => [el.name, el.value.trim()]));
    const t = await api("POST", "/api/tasks", body);
    replaceTask(t); toast("İş oluşturuldu"); closeDrawer(true); render(); openDrawer(t.id);
    return;
  }
  if (!Object.keys(changes).length) { toast("Değişiklik yok"); return; }
  if (changes.durum === "Tamamlandı" && !changes.bitis_tarihi && !drawerTask.bitis_tarihi
      && confirm("Bitiş Tarihi bugün ve Tamamlanma % 100 olarak ayarlansın mı?")) {
    changes.bitis_tarihi = today(); changes.yuzde = "100";
  }
  const t = await api("PATCH", `/api/tasks/${drawerTask.id}`, changes);
  replaceTask(t); toast("Kaydedildi"); render(); openDrawer(t.id);
}

async function addComment() {
  const metin = $("#cText").value.trim(); if (!metin) return;
  await api("POST", `/api/tasks/${drawerTask.id}/comments`, { metin });
  $("#cText").value = "";
  drawerTask.yorum_sayisi = (drawerTask.yorum_sayisi || 0) + 1;
  loadTimeline(); render();
}

async function loadTimeline() {
  const id = drawerTask.id;
  const items = await api("GET", `/api/tasks/${id}/timeline`);
  if (!drawerTask || drawerTask.id !== id) return;
  const show = (k, v) => v == null || v === "" ? "<i>boş</i>" : esc(F[k]?.type === "date" ? fmtDate(v) : v);
  $("#tl").innerHTML = items.map(i => i.tip === "yorum"
    ? `<li class="yorum"><span class="when">${i.ice_aktarim ? "Excel'den aktarılan not" : fmtTs(i.zaman)}</span>
        <button class="ghost small del" data-cdel="${i.id}" title="Yorumu sil">✕</button>
        <div class="comment body">${esc(i.metin)}</div></li>`
    : i.alan === "_olusturma"
      ? `<li><span class="when">${fmtTs(i.zaman)}</span><div class="body">İş oluşturuldu</div></li>`
      : `<li><span class="when">${fmtTs(i.zaman)}</span><div class="body"><b>${esc(F[i.alan]?.label || i.alan)}</b>:
          <span class="old">${show(i.alan, i.eski)}</span> → ${show(i.alan, i.yeni)}</div></li>`
  ).join("") || `<li class="muted">Henüz yorum veya değişiklik yok</li>`;
  $$("[data-cdel]").forEach(b => b.onclick = async () => {
    if (!confirm("Yorum silinsin mi?")) return;
    await api("DELETE", `/api/comments/${b.dataset.cdel}`);
    drawerTask.yorum_sayisi = Math.max(0, (drawerTask.yorum_sayisi || 1) - 1);
    loadTimeline(); render();
  });
}

// ---------------------------------------------------------------- başlangıç
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

async function init() {
  applyTheme(load("theme", null));
  $("#themeBtn").onclick = () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    applyTheme(next); save("theme", next); render();
  };
  let searchT;
  $("#search").oninput = e => {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      state.q = e.target.value;
      if (!["liste", "pano"].includes(currentView())) go("liste"); else render();
    }, 200);
  };
  $("#newBtn").onclick = () => openDrawer(null);
  $("#drawerBackdrop").onclick = closeDrawer;
  document.addEventListener("click", () => { const m = $("#colMenu"); if (m) m.hidden = true; });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer();
    if (e.key === "/" && !e.target.closest("input, textarea, select")) { e.preventDefault(); $("#search").focus(); }
  });
  window.addEventListener("hashchange", () => { render(); openFromHash(); });
  await loadTasks();
  render();
  openFromHash();
}

// #/liste?is=123 bağlantısı doğrudan o işin detayını açar
function openFromHash() {
  const id = +new URLSearchParams(location.hash.split("?")[1] || "").get("is");
  if (id && state.tasks.some(t => t.id === id)) openDrawer(id);
}

init();
