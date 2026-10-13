/* Estado do app (localStorage), migração da versão anterior e utilitários comuns. */
(function () {
  const FT = (window.FT = window.FT || {});
  const KEY = "floridaTripAI_v2";
  const OLD_KEY = "floridaTripAI_v1";
  const OLD_LIST_KEY = "floridaTripAI_checklistItems_v1";
  FT.KEYS = { state: KEY, apiKey: "floridaTripAI_openai_key", weather: "floridaTripAI_wx" };

  /* ---------- armazenamento tolerante a falhas ---------- */
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  FT.ls = ls;

  /* ---------- utilidades ---------- */
  const pad = n => String(n).padStart(2, "0");
  const u = (FT.u = {});
  FT.now = () => new Date();
  u.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  u.icon = (name, cls) => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  u.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  u.money = n => {
    const v = Number(n) || 0;
    return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  u.ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  u.today = () => u.ymd(FT.now());
  u.parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  u.addDays = (s, n) => { const d = u.parse(s); d.setDate(d.getDate() + n); return u.ymd(d); };
  u.diffDays = (a, b) => Math.round((u.parse(b) - u.parse(a)) / 864e5);
  u.short = s => s.slice(8, 10) + "/" + s.slice(5, 7);
  u.weekday = s => { const w = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(u.parse(s)); return w.charAt(0).toUpperCase() + w.slice(1); };
  u.weekdayShort = s => new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(u.parse(s)).replace(".", "");
  u.dateLong = s => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(u.parse(s));
  u.mapsUrl = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  u.safeUrl = url => (/^https:\/\//i.test(String(url)) ? String(url) : "");
  u.num = v => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
  u.clamp = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  u.dayDate = n => `2026-12-${pad(n)}`;

  /* ---------- estado ---------- */
  const DEFAULT_CAT_BUDGETS = { "Alimentação": 990, "Roupas": 1000, "Eletrônicos": 2600, "Transporte": 400, "Parques": 700, "Outros": 310 };

  function defaults() {
    return {
      v: 2,
      checks: {},
      custom: [],
      expenses: [],
      budget: FT.TRIP.budget,
      catBudgets: Object.assign({}, DEFAULT_CAT_BUDGETS),
      shopping: FT.COMPRAS_PADRAO.map((name, i) => ({ id: "s" + i, name, done: false })),
      reservas: {},
      customs: { a: null, b: null },
      contacts: { name: "", phone: "" },
      days: null,
      plans: null,
      undo: null,
      ai: { messages: [], mode: "ask", model: "gpt-4.1-mini" },
      ui: { status: "pend", pri: "all", view: "cat", open: null, exp: {} }
    };
  }

  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const arr = v => (Array.isArray(v) ? v : []);

  /* Aceita qualquer objeto vindo do disco ou de um backup e devolve um estado válido. */
  function normalize(raw) {
    const d = defaults();
    if (!isObj(raw)) return d;
    const s = d;
    if (isObj(raw.checks)) for (const k of Object.keys(raw.checks)) if (raw.checks[k] === true) s.checks[k] = true;
    s.custom = arr(raw.custom).filter(x => isObj(x) && x.id && x.title && FT.CATS.some(c => c.id === x.cat)).slice(0, 300).map(x => ({
      id: String(x.id), cat: x.cat, pri: ["e", "i", "o"].includes(x.pri) ? x.pri : "i", title: u.clamp(x.title, 160),
      detail: u.clamp(x.detail, 800), due: /^\d{4}-\d{2}-\d{2}$/.test(x.due || "") ? x.due : "",
      day: Number.isInteger(x.day) && x.day >= 0 && x.day <= 13 ? x.day : 0, custom: true, ai: !!x.ai
    }));
    s.expenses = arr(raw.expenses).filter(x => isObj(x) && Number.isFinite(Number(x.amount))).slice(0, 1000).map(x => ({
      id: String(x.id || u.uid()), name: u.clamp(x.name, 80) || "Despesa", amount: Number(x.amount),
      category: FT.EXPENSE_CATS.includes(x.category) ? x.category : "Outros", date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || "") ? x.date : ""
    }));
    if (Number.isFinite(Number(raw.budget)) && Number(raw.budget) > 0) s.budget = Number(raw.budget);
    if (isObj(raw.catBudgets)) for (const c of FT.EXPENSE_CATS) if (Number.isFinite(Number(raw.catBudgets[c])) && Number(raw.catBudgets[c]) >= 0) s.catBudgets[c] = Number(raw.catBudgets[c]);
    if (Array.isArray(raw.shopping)) {
      s.shopping = raw.shopping.filter(x => isObj(x) && x.name).slice(0, 200).map(x => ({ id: String(x.id || u.uid()), name: u.clamp(x.name, 80), done: !!x.done }));
    }
    if (isObj(raw.reservas)) {
      for (const r of FT.RESERVAS) {
        const v = raw.reservas[r.id];
        if (isObj(v)) s.reservas[r.id] = { status: FT.RESERVA_STATUS.includes(v.status) ? v.status : "Pendente", note: u.clamp(v.note, 300) };
      }
    }
    if (isObj(raw.customs)) {
      for (const k of ["a", "b"]) { const n = Number(raw.customs[k]); s.customs[k] = raw.customs[k] != null && raw.customs[k] !== "" && Number.isFinite(n) && n >= 0 ? n : null; }
    }
    if (isObj(raw.contacts)) s.contacts = { name: u.clamp(raw.contacts.name, 60), phone: u.clamp(raw.contacts.phone, 30) };
    if (Array.isArray(raw.days) && raw.days.length === FT.DAYS_DEFAULT.length) s.days = raw.days;
    if (Array.isArray(raw.plans) && raw.plans.length === FT.PLANS_DEFAULT.length) s.plans = raw.plans;
    if (!s.days || !s.plans) { s.days = null; s.plans = null; }
    if (isObj(raw.undo) && Array.isArray(raw.undo.custom)) s.undo = raw.undo;
    if (isObj(raw.ai)) {
      s.ai.mode = raw.ai.mode === "edit" ? "edit" : "ask";
      s.ai.model = u.clamp(raw.ai.model, 60) || s.ai.model;
      s.ai.messages = arr(raw.ai.messages).filter(m => isObj(m) && (m.role === "user" || m.role === "bot") && typeof m.text === "string").slice(-40)
        .map(m => ({ id: String(m.id || u.uid()), role: m.role, text: u.clamp(m.text, 6000), kind: m.kind === "error" ? "error" : "", applied: !!m.applied }));
    }
    if (isObj(raw.ui)) {
      if (["pend", "all", "done"].includes(raw.ui.status)) s.ui.status = raw.ui.status;
      if (["all", "e"].includes(raw.ui.pri)) s.ui.pri = raw.ui.pri;
      if (["cat", "prazo"].includes(raw.ui.view)) s.ui.view = raw.ui.view;
      if (isObj(raw.ui.open)) s.ui.open = raw.ui.open;
      if (isObj(raw.ui.exp)) s.ui.exp = {};
    }
    return s;
  }

  /* Migra o estado da versão 1 (checks por índice, compras como texto). */
  function migrateV1() {
    let old;
    try { old = JSON.parse(ls.get(OLD_KEY) || "null"); } catch (e) { old = null; }
    if (!isObj(old)) return null;
    const legacy = Object.keys(FT.LEGACY_CHECKS);
    let list = legacy;
    try {
      const saved = JSON.parse(ls.get(OLD_LIST_KEY) || "null");
      if (Array.isArray(saved) && saved.every(x => typeof x === "string")) list = saved;
    } catch (e) { /* mantém a lista padrão */ }
    const oc = isObj(old.checks) ? old.checks : {};
    const raw = { checks: {}, custom: [], expenses: arr(old.expenses), budget: old.budget };
    list.forEach((text, i) => {
      const ids = FT.LEGACY_CHECKS[text];
      if (ids) { if (oc["c" + i]) ids.forEach(id => { raw.checks[id] = true; }); return; }
      const m = /^([^:]{2,20}):\s*(.+)$/.exec(text);
      const cat = (m && FT.LEGACY_PREFIX_CAT[m[1].trim().toUpperCase()]) || "docs";
      const id = "mig-" + i;
      raw.custom.push({ id, cat, pri: "i", title: (m ? m[2] : text), detail: "", due: "", day: 0 });
      if (oc["c" + i]) raw.checks[id] = true;
    });
    if (Array.isArray(old.shopping)) {
      raw.shopping = old.shopping.filter(x => typeof x === "string" && x.trim()).map((name, i) => ({ id: u.uid(), name, done: !!oc["shop" + i] }));
    }
    return normalize(raw);
  }

  function load() {
    const txt = ls.get(KEY);
    if (txt) { try { return normalize(JSON.parse(txt)); } catch (e) { /* cai para a migração */ } }
    return migrateV1() || defaults();
  }

  const store = (FT.store = {
    state: load(),
    save() {
      try { ls.set(KEY, JSON.stringify(store.state)); } catch (e) { /* sem espaço: segue só em memória */ }
      if (FT.sync) FT.sync.changed();
    },
    update(fn) { fn(store.state); store.save(); },
    replace(raw) { store.state = normalize(raw); store.save(); },
    reset() { store.state = defaults(); store.save(); },
    normalize,
    defaults,
    days() { return store.state.days || FT.DAYS_DEFAULT; },
    plans() { return store.state.plans || FT.PLANS_DEFAULT; },
    items() { return FT.CHECKLIST.concat(store.state.custom); },
    apiKey() { return ls.get(FT.KEYS.apiKey) || ""; }
  });
  store.save();
})();
