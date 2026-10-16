/* Telas extras: Hoje, Câmbio, Guia do parque e anexos de reservas. */
(function () {
  const FT = window.FT;
  const { esc, icon, money, today, short, diffDays, mapsUrl, clamp, num, uid, safeUrl } = FT.u;
  const store = FT.store;
  const S = () => store.state;
  const $ = sel => document.querySelector(sel);
  const ex = (FT.extra = { routes: {}, more: [], rail: [] });
  const toast = m => FT.app.toast(m);
  const brl = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl4 = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  /* ======================================================================
     Anexos (imagens e PDFs) — guardados no aparelho (IndexedDB) e, se couber, sincronizados
     ====================================================================== */
  const SYNC_LIMIT = 650000; // bytes: o Firestore aceita ~1 MB por documento, e o base64 aumenta o tamanho em um terço
  const files = (FT.files = (function () {
    const mem = new Map();
    let dbp = null;
    const open = () => dbp || (dbp = new Promise(res => {
      if (typeof indexedDB === "undefined") return res(null);
      try {
        const r = indexedDB.open("florida-files", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("f");
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
    async function run(mode, fn) {
      const db = await open();
      if (!db) return undefined;
      return new Promise((res, rej) => {
        const t = db.transaction("f", mode); const q = fn(t.objectStore("f"));
        t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error);
      });
    }
    const toB64 = buf => {
      const b = new Uint8Array(buf); let s = "";
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    const fetching = new Set();
    const api = {
      toB64, fromB64,
      async put(id, buf, type) { if (await open()) await run("readwrite", s => s.put({ buf, type }, id)); else mem.set(id, { buf, type }); },
      async get(id) { return (await open()) ? run("readonly", s => s.get(id)) : mem.get(id); },
      async del(id) { if (await open()) await run("readwrite", s => s.delete(id)); else mem.delete(id); },
      async has(id) { return !!(await api.get(id)); },
      async upload(id) {
        const rec = await api.get(id);
        if (rec && FT.sync) FT.sync.putFile(id, toB64(rec.buf));
      },
      async remove(id) { await api.del(id); if (FT.sync) FT.sync.putFile(id, ""); },
      /* Baixa os anexos que o outro aparelho enviou e este ainda não tem. */
      async ensure() {
        if (!FT.sync || !FT.sync.connected) return;
        let got = false;
        for (const d of S().docs) {
          if (d.sync === false || fetching.has(d.id) || (await api.has(d.id))) continue;
          fetching.add(d.id);
          try {
            const b64 = await FT.sync.getFile(d.id);
            if (b64) { await api.put(d.id, fromB64(b64), d.type); got = true; }
          } catch (e) { /* tenta de novo na próxima mudança */ } finally { fetching.delete(d.id); }
        }
        if (got && /^#\/reservas/.test(location.hash)) FT.app.render({ keepScroll: true });
      }
    };
    return api;
  })());

  async function shrinkImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      let last = null;
      for (const [max, q] of [[1600, 0.8], [1200, 0.7], [900, 0.6]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        last = await new Promise(r => c.toBlob(r, "image/jpeg", q));
        if (last && last.size <= SYNC_LIMIT) return last;
      }
      return last || file;
    } finally { URL.revokeObjectURL(url); }
  }

  async function addFiles(resId, list) {
    let added = 0, local = 0;
    for (const f of Array.from(list || [])) {
      const isImg = /^image\//.test(f.type), isPdf = f.type === "application/pdf";
      if (!isImg && !isPdf) { toast("Só imagens e PDFs. Ignorei " + f.name + "."); continue; }
      if (f.size > 15 * 1024 * 1024) { toast(f.name + " passa de 15 MB."); continue; }
      let blob = f, name = f.name;
      if (isImg) { try { blob = await shrinkImage(f); name = name.replace(/\.[^.]+$/, "") + ".jpg"; } catch (e) { blob = f; } }
      const id = uid();
      await files.put(id, await blob.arrayBuffer(), blob.type || f.type);
      const sync = blob.size <= SYNC_LIMIT;
      store.update(s => { s.docs.push({ id, res: resId, name: clamp(name, 80), type: blob.type || f.type, size: blob.size, sync }); });
      if (sync) files.upload(id); else local++;
      added++;
    }
    if (added) toast(local ? "Anexado. " + local + " arquivo(s) grande(s) ficam só neste aparelho." : "Anexado.");
    FT.app.render({ keepScroll: true });
  }

  async function openDoc(id) {
    const rec = await files.get(id);
    if (!rec) { toast("Este anexo ainda não chegou neste aparelho. Aguarde a sincronização."); return; }
    const url = URL.createObjectURL(new Blob([rec.buf], { type: rec.type || "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

  ex.attachHTML = function (resId) {
    const list = S().docs.filter(d => d.res === resId);
    return `<div class="docs"><div class="docs__title">Anexos</div>
      ${list.map(d => `<div class="doc">${icon(d.type === "application/pdf" ? "note" : "ticket")}<button type="button" class="doc__name" data-act="doc-open" data-id="${esc(d.id)}">${esc(d.name)}</button><span class="small muted">${fmtSize(d.size)}${d.sync === false ? ", só em um aparelho" : ""}</span><button type="button" class="btn btn--quiet btn--icon btn--sm btn--danger" data-act="doc-del" data-id="${esc(d.id)}" aria-label="Remover ${esc(d.name)}">${icon("trash")}</button></div>`).join("")}
      <label class="btn btn--sm doc__add">${icon("plus")} Anexar print ou PDF<input type="file" hidden multiple accept="image/*,application/pdf" data-act="doc-add" data-res="${esc(resId)}"></label></div>`;
  };

  /* ======================================================================
     Hoje
     ====================================================================== */
  const startMin = t => { const m = /^\s*(\d{1,2}):(\d{2})/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };
  const PARK_DAYS = { 7: "mk", 9: "usf" };

  function viewHoje(arg) {
    const T = FT.TRIP, t = today(), days = store.days(), plans = store.plans();
    const inTrip = t >= T.start && t <= T.end;
    let n = inTrip ? Number(t.slice(8)) : 4;
    const picked = /^\d+$/.test(arg || "") ? Math.min(12, Math.max(4, Number(arg))) : null;
    if (picked) n = picked;
    const live = inTrip && (!picked || picked === n && n === Number(t.slice(8)));
    const i = n - 4, d = days[i], p = plans[i], date = FT.u.dayDate(n);
    const now = FT.now(), nowMin = now.getHours() * 60 + now.getMinutes();
    let cur = -1, nxt = -1;
    if (live) p.schedule.forEach((b, k) => { const s = startMin(b[0]); if (s == null) return; if (s <= nowMin) cur = k; else if (nxt < 0) nxt = k; });
    const block = (label, k) => k < 0 ? "" : `<div class="nowcard"><div class="nowcard__label">${label}</div><div class="nowcard__title">${esc(p.schedule[k][1])}</div><div class="small muted">${esc(p.schedule[k][0])}${p.schedule[k][2] ? " · " + esc(p.schedule[k][2]) : ""}</div>${p.schedule[k][3] ? `<a class="tl__place" href="${esc(mapsUrl(p.schedule[k][3]))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Abrir no mapa</a>` : ""}</div>`;
    const reminders = store.items().filter(it => it.day === n && !S().checks[it.id]);
    const park = PARK_DAYS[n];
    const nav = `<div class="daynav"><a class="back" href="#/inicio">${icon("chev-l")} Início</a><div class="daynav__steps">${i > 0 ? `<a class="btn btn--quiet btn--icon" href="#/hoje/${n - 1}" aria-label="Dia anterior">${icon("chev-l")}</a>` : ""}${i < days.length - 1 ? `<a class="btn btn--quiet btn--icon" href="#/hoje/${n + 1}" aria-label="Próximo dia">${icon("chev-r")}</a>` : ""}</div></div>`;
    return `${nav}
      <header class="dayhero" style="--leg-color:var(--leg-${esc(d.leg)})">
        <div class="dayhero__date">${live ? "Hoje" : inTrip || !picked ? "Prévia do primeiro dia" : "Prévia do dia " + n}, ${esc(FT.u.weekday(date).toLowerCase())}, ${esc(FT.u.dateLong(date))}</div>
        <h1 class="dayhero__title">${esc(d.title)}</h1>
        <div class="dayhero__where">${icon("pin")}<span>${esc(d.where)}</span></div>
        <div class="chips" style="margin-top:12px">${FT.app.wxHTML ? FT.app.wxHTML(date) : ""}</div>
      </header>
      ${!live ? `<div class="callout callout--info">${icon("info")}<div><strong>Esta tela fica ao vivo durante a viagem</strong>Nos dias 4 a 12 de dezembro ela mostra o que está acontecendo agora e o que vem a seguir. Por enquanto, é uma prévia do dia.</div></div>` : ""}
      ${live ? `<div class="nowgrid">${block("Agora", cur) || `<div class="nowcard"><div class="nowcard__label">Agora</div><div class="nowcard__title">Ainda não começou</div></div>`}${block("A seguir", nxt) || `<div class="nowcard"><div class="nowcard__label">A seguir</div><div class="nowcard__title">Fim da programação de hoje</div></div>`}</div>` : ""}
      <div class="btn-row" style="margin-top:16px">
        ${park ? `<a class="btn" href="#/parques/${park}">${icon("sun")} Guia do parque</a>` : ""}
      </div>
      <section class="section"><div class="section__head"><h2 class="h-section">Programação</h2></div>
        <ol class="tl">${p.schedule.map((b, k) => `<li class="tl__item${k === cur ? " tl__item--now" : ""}"><div class="tl__time">${esc(b[0])}</div><div class="tl__body"><div class="tl__title">${esc(b[1])}</div>${b[2] ? `<p class="tl__desc">${esc(b[2])}</p>` : ""}${b[3] ? `<a class="tl__place" href="${esc(mapsUrl(b[3]))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Abrir no mapa</a>` : ""}</div></li>`).join("")}</ol></section>
      ${reminders.length ? `<section class="section"><div class="section__head"><h2 class="h-section">Não esqueça hoje</h2></div><div class="sheet" style="padding:0 16px"><ul>${reminders.map(it => FT.app.itemHTML(it, true)).join("")}</ul></div></section>` : ""}
      ${d.tip ? `<div class="callout callout--info" style="margin-top:24px">${icon("info")}<div><strong>Dica do dia</strong>${esc(d.tip)}</div></div>` : ""}
      <p class="small" style="margin-top:20px"><a href="#/roteiro/${n}">Ver o dia completo, com planos B ${icon("chev-r")}</a></p>`;
  }

  /* ======================================================================
     Câmbio
     ====================================================================== */
  const RATE_KEY = "floridaTripAI_fxrate";
  const fxs = { rate: null, at: 0, src: "", err: "", busy: false, amount: "" };
  try { const c = JSON.parse(FT.ls.get(RATE_KEY) || "null"); if (c && c.rate > 0) Object.assign(fxs, { rate: c.rate, at: c.at, src: c.src }); } catch (e) { /* sem cache */ }

  async function getJson(url) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error("http " + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }

  async function fetchRate(force) {
    if (fxs.busy || (!force && fxs.at && Date.now() - fxs.at < 30 * 60000)) return;
    fxs.busy = true; fxs.err = ""; updateFx();
    try {
      let rate = 0, src = "";
      try { const j = await getJson("https://open.er-api.com/v6/latest/USD"); rate = Number(j.rates && j.rates.BRL); src = "open.er-api.com"; }
      catch (e) { const j = await getJson("https://economia.awesomeapi.com.br/json/last/USD-BRL"); rate = Number(j.USDBRL && j.USDBRL.ask); src = "AwesomeAPI"; }
      if (!(rate > 2 && rate < 20)) throw new Error("cotação inválida");
      Object.assign(fxs, { rate, at: Date.now(), src });
      FT.ls.set(RATE_KEY, JSON.stringify({ rate, at: fxs.at, src }));
    } catch (e) {
      fxs.err = fxs.rate ? "Sem internet agora. Usando a última cotação salva." : "Não consegui buscar a cotação. Digite uma cotação em Ajustar.";
    } finally { fxs.busy = false; updateFx(); }
  }

  function fxCalc(usd) {
    const fx = S().fx, ref = fx.manual || fxs.rate;
    if (!ref) return null;
    const withSpread = ref + fx.spread, final = withSpread * (1 + fx.tax / 100);
    return { ref, withSpread, final, tax: usd * withSpread * fx.tax / 100, total: usd * final };
  }

  function fxResultHTML() {
    const usd = num(fxs.amount), fx = S().fx;
    const c = fxCalc(usd > 0 ? usd : 0);
    if (!c) return `<div class="empty small">Buscando a cotação… Se demorar, digite uma em “Ajustar”.</div>`;
    if (!(usd > 0)) return `<div class="small muted" style="padding:8px 0">Digite um valor em dólar para ver o total em reais.</div>`;
    return `<div class="fx__total"><span class="small muted">Total aproximado</span><strong>${brl(c.total)}</strong></div>
      <dl class="fx__lines">
        <div class="stat"><dt>US$ ${usd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × cotação de referência</dt><dd>${brl4(c.ref)}</dd></div>
        <div class="stat"><dt>+ ${brl(fx.spread)} por dólar</dt><dd>${brl4(c.withSpread)}</dd></div>
        <div class="stat"><dt>+ ${String(fx.tax).replace(".", ",")}% de imposto</dt><dd>${brl4(c.final)}</dd></div>
        <div class="stat"><dt>Imposto neste valor</dt><dd>${brl(c.tax)}</dd></div>
      </dl>`;
  }

  function fxRateHTML() {
    const when = fxs.at ? new Date(fxs.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    const man = S().fx.manual;
    return `<div class="row row--between row--wrap"><div><div class="small muted">Cotação de referência</div><div class="fx__rate">${man ? brl4(man) + " (manual)" : fxs.rate ? brl4(fxs.rate) : "…"}</div></div>
      <button class="btn btn--sm" type="button" data-act="fx-refresh"${fxs.busy ? " disabled" : ""}>${icon("refresh")} ${fxs.busy ? "Buscando…" : "Atualizar"}</button></div>
      ${fxs.at && !man ? `<p class="hint">Atualizada em ${esc(when)} (${esc(fxs.src)}). É a cotação de mercado, sem as taxas do banco.</p>` : ""}
      ${fxs.err ? `<div class="callout callout--alert" style="margin-top:8px">${icon("alert")}<div>${esc(fxs.err)}</div></div>` : ""}`;
  }

  function updateFx() {
    const a = document.getElementById("fxRate"), b = document.getElementById("fxResult");
    if (a) a.innerHTML = fxRateHTML();
    if (b) b.innerHTML = fxResultHTML();
    const q = document.getElementById("fxQuick");
    if (q) q.innerHTML = fxQuickHTML();
  }

  function fxQuickHTML() {
    return [10, 20, 50, 100, 250, 500, 1000].map(v => { const c = fxCalc(v); return `<div class="stat"><dt>US$ ${v.toLocaleString("pt-BR")}</dt><dd>${c ? brl(c.total) : "…"}</dd></div>`; }).join("");
  }

  function viewCambio() {
    fetchRate(false);
    const fx = S().fx;
    return `<header class="page-head"><h1 class="h-page">Câmbio</h1><p class="lede">Quanto uma compra em dólar vai custar em reais, já com o acréscimo do cartão e o imposto.</p></header>
      <section class="sheet sheet--pad">
        <div id="fxRate">${fxRateHTML()}</div>
        <label class="label" for="fxAmt">Valor da compra (US$)</label>
        <input class="field fx__input" id="fxAmt" data-act="fx-amt" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(fxs.amount)}">
        <div id="fxResult">${fxResultHTML()}</div>
      </section>
      <section class="section"><div class="section__head"><h2 class="h-section">Tabela rápida</h2></div><div class="sheet" style="padding:4px 16px" id="fxQuick">${fxQuickHTML()}</div></section>
      <section class="section"><details class="alt" ${fx.manual || fx.spread !== 0.2 || fx.tax !== 6 ? "open" : ""}><summary>Ajustar acréscimo, imposto e cotação${icon("chev-d")}</summary>
        <div style="padding-bottom:14px">
          <label class="label" for="fxSpread" style="margin-top:0">Acréscimo por dólar (R$)</label><input class="field" id="fxSpread" data-act="fx-spread" inputmode="decimal" value="${String(fx.spread).replace(".", ",")}">
          <label class="label" for="fxTax">Imposto sobre o total (%)</label><input class="field" id="fxTax" data-act="fx-tax" inputmode="decimal" value="${String(fx.tax).replace(".", ",")}">
          <p class="hint">Seu banco pode cobrar um percentual diferente (o checklist cita cerca de 3,5% de IOF). Ajuste aqui se precisar.</p>
          <label class="label" for="fxManual">Cotação manual (R$ por dólar)</label><input class="field" id="fxManual" data-act="fx-manual" inputmode="decimal" value="${fx.manual ? String(fx.manual).replace(".", ",") : ""}" placeholder="Em branco = automática">
        </div></details>
        <p class="small muted" style="margin-top:12px">Conta usada: (cotação + acréscimo) × (1 + imposto). É uma estimativa: a fatura depende da cotação do dia da compra e das regras do seu banco.</p></section>`;
  }

  /* ======================================================================
     Guia por parque: prioridades, plano do dia e filas ao vivo (ThemeParks.wiki)
     ====================================================================== */
  const ENTITY = { mk: "75ea578a-adc8-4116-a54d-dccb60765ef9", usf: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57", ioa: "267615cc-8943-4c2a-ae2c-5da728ca591f" };
  const LIVE_KEY = "floridaTripAI_live";
  const WAIT_KEY = "floridaTripAI_waits";
  const RIDE_LABEL = { must: "Imperdível", maybe: "Se der", skip: "Pular" };
  const STRATEGY = {
    tras: ["Do fundo para a entrada", "Começa pelas atrações de alta demanda do fundo do parque e volta em direção à entrada. As filas costumam ser menores nas primeiras horas, e o fundo do parque enche depois."],
    frente: ["Da entrada para o fundo", "Segue o caminho natural, começando pelas atrações de alta demanda mais perto da entrada."],
    fila: ["Menor fila agora", "Ordena pelo tempo de fila ao vivo, da menor para a maior. Útil para decidir na hora."]
  };
  const live = { data: {}, busy: {}, tried: {}, err: {}, strategy: "tras" };
  let samples = {};
  try { samples = JSON.parse(FT.ls.get(WAIT_KEY) || "{}") || {}; } catch (e) { samples = {}; }
  try { const c = JSON.parse(FT.ls.get(LIVE_KEY) || "{}"); for (const k of Object.keys(c)) if (c[k] && Array.isArray(c[k].rides)) live.data[k] = c[k]; } catch (e) { /* sem cache */ }

  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[™®©]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const STOP = new Set(["the", "of", "a", "and", "to", "in"]);
  const tokens = s => norm(s).split(" ").filter(w => w && !STOP.has(w));

  const aliasesOf = ride => (ride[6] ? String(ride[6]).split("|").map(norm).filter(Boolean) : []);

  /* Lê o roteiro do dia e devolve as atrações do guia citadas nos títulos, na ordem em que aparecem. */
  function ridesFromDay(park) {
    const plan = FT.store.plans()[park.day - 4];
    if (!plan) return [];
    const found = [];
    for (const b of plan.schedule) {
      const title = norm(b[1]), tt = title.split(" ");
      const hits = [];
      for (const r of park.rides) {
        if (found.includes(r)) continue;
        let pos = -1;
        for (const al of aliasesOf(r)) { const i = title.indexOf(al); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
        if (pos < 0) for (const nm of [r[1], r[7]]) { const mine = nm ? tokens(nm) : []; if (mine.length && mine.every(w => tt.includes(w))) { pos = title.indexOf(mine[0]); break; } }
        if (pos >= 0) hits.push([pos, r]);
      }
      hits.sort((x, y) => x[0] - y[0]).forEach(h => found.push(h[1]));
    }
    return found;
  }

  /* Casa uma atração do guia com uma entrada da fila ao vivo, pelo nome. */
  function matchLive(ride, rides) {
    const names = [ride[1], ride[7]].filter(Boolean).map(tokens), aliases = aliasesOf(ride);
    let best = null;
    for (const l of rides) {
      const ln = norm(l.name), lt = tokens(l.name);
      if (aliases.some(al => ln.includes(al)) || names.some(mine => mine.length && mine.every(w => lt.includes(w)))) { if (!best || lt.length < tokens(best.name).length) best = l; }
    }
    return best;
  }

  async function fetchLive(parkKey, force) {
    const id = ENTITY[parkKey];
    if (!id || live.busy[parkKey]) return;
    const cur = live.data[parkKey];
    if (!force && cur && Date.now() - cur.at < 90000) return;
    if (!force && live.tried[parkKey] && Date.now() - live.tried[parkKey] < 30000) return;
    live.tried[parkKey] = Date.now();
    live.busy[parkKey] = true; live.err[parkKey] = "";
    try {
      const j = await getJson(`https://api.themeparks.wiki/v1/entity/${id}/live`);
      const rides = (j.liveData || []).filter(e => e.entityType === "ATTRACTION").map(e => {
        const w = e.queue && e.queue.STANDBY ? e.queue.STANDBY.waitTime : null;
        return { id: e.id, name: e.name, status: e.status, wait: typeof w === "number" ? w : null };
      });
      if (!rides.length) throw new Error("vazio");
      const now = Date.now();
      live.data[parkKey] = { at: now, rides };
      FT.ls.set(LIVE_KEY, JSON.stringify(live.data));
      recordSamples(parkKey, rides, now);
    } catch (e) {
      live.err[parkKey] = live.data[parkKey] ? "Sem internet agora. Mostrando a última leitura." : "Não consegui buscar as filas agora.";
    } finally {
      live.busy[parkKey] = false;
      if (/^#\/parques/.test(location.hash)) FT.app.render({ keepScroll: true });
    }
  }

  function recordSamples(parkKey, rides, now) {
    const book = (samples[parkKey] = samples[parkKey] || {});
    const cutoff = now - 3 * 3600000;
    for (const r of rides) {
      if (r.status !== "OPERATING" || r.wait == null) continue;
      const list = (book[r.id] = (book[r.id] || []).filter(x => x[0] > cutoff));
      if (!list.length || now - list[list.length - 1][0] > 60000) list.push([now, r.wait]);
      if (list.length > 60) list.splice(0, list.length - 60);
    }
    try { FT.ls.set(WAIT_KEY, JSON.stringify(samples)); } catch (e) { /* cheio: segue sem histórico */ }
  }

  /* Tendência: compara a fila de agora com a leitura de 10 a 40 minutos atrás. */
  function trendOf(parkKey, liveRide) {
    const list = ((samples[parkKey] || {})[liveRide.id]) || [];
    const now = Date.now();
    const old = list.filter(x => now - x[0] >= 10 * 60000 && now - x[0] <= 40 * 60000).sort((a, b) => Math.abs(now - a[0] - 20 * 60000) - Math.abs(now - b[0] - 20 * 60000))[0];
    const todays = list.filter(x => new Date(x[0]).toDateString() === new Date(now).toDateString());
    const min = todays.length ? todays.reduce((m, x) => (x[1] < m[1] ? x : m)) : null;
    if (!old || liveRide.wait == null) return { kind: "none", min };
    const d = liveRide.wait - old[1], mins = Math.round((now - old[0]) / 60000);
    return { kind: d <= -10 ? "down" : d >= 10 ? "up" : "flat", delta: d, mins, min };
  }

  const clsWait = w => (w <= 20 ? "wait--ok" : w <= 45 ? "wait--mid" : "wait--high");
  function waitBadge(l) {
    if (!l) return `<span class="wait wait--none">sem dados</span>`;
    if (l.status === "DOWN") return `<span class="wait wait--down">${icon("alert")} Parada</span>`;
    if (l.status === "CLOSED") return `<span class="wait wait--none">Fechada</span>`;
    if (l.status === "REFURBISHMENT") return `<span class="wait wait--none">Em reforma</span>`;
    if (l.wait == null) return `<span class="wait wait--none">Aberta, sem fila informada</span>`;
    return `<span class="wait ${clsWait(l.wait)}"><strong>${l.wait}</strong> min</span>`;
  }
  function trendChip(t) {
    if (t.kind === "down") return `<span class="chip chip--ok">↓ Caindo: ${t.delta} min em ${t.mins} min</span>`;
    if (t.kind === "up") return `<span class="chip chip--e">↑ Subindo: +${t.delta} min em ${t.mins} min</span>`;
    if (t.kind === "flat") return `<span class="chip chip--plain">→ Estável</span>`;
    return `<span class="chip chip--plain">Tendência aparece após alguns minutos</span>`;
  }

  function orderedMusts(park) {
    const S_ = S(), musts = park.rides.filter(r => S_.rides[r[0]] === "must");
    const saved = (S_.rideOrder[park.id] || []).map(id => musts.find(r => r[0] === id)).filter(Boolean);
    return saved.concat(musts.filter(r => !saved.includes(r)));
  }

  function suggestOrder(park) {
    const musts = park.rides.filter(r => S().rides[r[0]] === "must");
    const L = (live.data[park.id] || {}).rides || [];
    const waitOf = r => { const l = matchLive(r, L); return l && l.status === "OPERATING" && l.wait != null ? l.wait : 999; };
    const st = live.strategy;
    const sorted = musts.slice().sort((a, b) => {
      if (st === "fila") return waitOf(a) - waitOf(b);
      const hd = b[3] - a[3];
      if (hd) return hd;
      return st === "tras" ? b[5] - a[5] : a[5] - b[5];
    });
    store.update(s => { s.rideOrder[park.id] = sorted.map(r => r[0]); });
  }

  const farTxt = n => (n <= 1 ? "perto da entrada" : n <= 3 ? "meio do parque" : "fundo do parque");

  const fmtT = ms => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const FILTERS = [["all", "Todas"], ["high", "Mais disputadas"], ["short", "Fila curta"], ["thrill", "Emoção"], ["easy", "Família e clássicos"]];
  live.filter = "all";

  /* Número grande da fila, colorido pelo tempo. */
  function waitTile(l) {
    if (!l) return `<div class="wtile wtile--none"><b>–</b><span>sem dados</span></div>`;
    if (l.status === "DOWN") return `<div class="wtile wtile--down"><b>!</b><span>parada</span></div>`;
    if (l.status === "CLOSED" || l.status === "REFURBISHMENT") return `<div class="wtile wtile--none"><b>–</b><span>fechada</span></div>`;
    if (l.wait == null) return `<div class="wtile wtile--none"><b>·</b><span>aberta</span></div>`;
    return `<div class="wtile ${clsWait(l.wait).replace("wait--", "wtile--")}"><b>${l.wait}</b><span>min</span></div>`;
  }

  function viewParques(arg) {
    const parks = FT.PARQUES, t = today();
    const park = parks.find(p => p.id === arg) || parks.find(p => FT.u.dayDate(p.day) === t) || parks[0];
    fetchLive(park.id, false);
    const S_ = S(), R = S_.rides, data = live.data[park.id], L = data ? data.rides : [];
    const st = r => R[r[0]] || "";
    const lv = r => matchLive(r, L);
    const must = orderedMusts(park), maybe = park.rides.filter(r => st(r) === "maybe");
    const isDone = r => !!S_.rideDone[r[0]];
    const pending = must.filter(r => !isDone(r)), finished = must.filter(isDone);
    const parkDay = FT.u.dayDate(park.day) === t;
    const mode = live.mode || (parkDay && must.length ? "hoje" : "montar");
    const when = data ? fmtT(data.at) : "";
    const isOpen = l => l && l.status === "OPERATING";
    const waitOf = r => { const l = lv(r); return isOpen(l) && l.wait != null ? l.wait : null; };
    const used = new Set(park.rides.map(r => { const l = lv(r); return l ? l.id : ""; }));
    const others = L.filter(l => !used.has(l.id) && l.status !== "CLOSED" && l.status !== "REFURBISHMENT").sort((a, b) => (a.wait == null) - (b.wait == null) || a.wait - b.wait);

    /* Atrações do "Se der tempo" que estão com fila curta ou caindo agora. */
    const hot = maybe.filter(r => !isDone(r)).map(r => {
      const l = lv(r), w = waitOf(r); if (w == null) return null;
      const tr = trendOf(park.id, l);
      const why = w <= 10 ? "Fila super curta" : w <= 20 ? "Fila curta" : tr.kind === "down" && w <= 35 ? `Fila caindo (${tr.delta} min em ${tr.mins} min)` : "";
      return why ? { r, w, why } : null;
    }).filter(Boolean).sort((a, b) => a.w - b.w);
    const hotHTML = hot.length ? `<section class="hot" aria-label="Vale a pena agora">
      <div class="hot__title">${icon("check")} Vale a pena agora</div>
      ${hot.map(h => `<div class="hot__item"><div class="hot__main"><div class="hot__name">${esc(h.r[1])}</div><div class="hot__why">${esc(h.why)}</div></div><div class="hot__wait"><b>${h.w}</b><span>min</span></div><button class="btn btn--sm hot__go" type="button" data-act="ride-go" data-id="${esc(h.r[0])}" data-park="${park.id}">Ir agora</button></div>`).join("")}</section>` : "";

    const head = `
      <a class="back" href="#/mais">${icon("chev-l")} Mais</a>
      <header class="page-head"><h1 class="h-page">Guia do parque</h1></header>
      <div class="ptabs" role="group" aria-label="Parque">${parks.map(p => `<a class="ptab" href="#/parques/${p.id}" aria-pressed="${p.id === park.id}"><strong>${esc(p.short || p.name)}</strong><span>${p.day} de dezembro</span></a>`).join("")}</div>
      <div class="pulse"><span class="pulse__dot${data && !live.err[park.id] ? " pulse__dot--on" : ""}"></span><span class="pulse__txt">${live.busy[park.id] ? "Buscando as filas…" : data ? "Filas ao vivo · " + when : "Sem leitura ainda"}</span>
        <button class="btn btn--quiet btn--sm" type="button" data-act="live-refresh" data-id="${park.id}"${live.busy[park.id] ? " disabled" : ""}>${icon("refresh")} Atualizar</button></div>
      ${live.err[park.id] ? `<p class="small" style="color:var(--alert);margin:-4px 0 12px">${esc(live.err[park.id])}</p>` : ""}
      <div class="modes" role="group" aria-label="Modo">
        <button type="button" data-act="mode" data-v="montar" aria-pressed="${mode === "montar"}">Montar o dia</button>
        <button type="button" data-act="mode" data-v="hoje" aria-pressed="${mode === "hoje"}">No parque${pending.length ? ` <i>${pending.length}</i>` : ""}</button></div>
      ${hotHTML}`;

    const eatRow = e => `<div class="eat"><div class="eat__main"><div class="eat__name">${esc(e[0])}</div><div class="small muted">${esc(e[2])}</div><p class="eat__note">${esc(e[3])}</p></div><a class="eat__map" href="${esc(mapsUrl(e[0].replace(/^Carrinhos de /, "").replace(/^The Leaky Cauldron e carrinho /, "") + " " + park.name + " Orlando"))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Mapa</a></div>`;
    const eatHTML = park.eat && park.eat.length ? `<details class="alt" style="margin-top:24px"><summary>Pausa para comer e comidas típicas${icon("chev-d")}</summary>
      <div style="padding-top:6px"><h3 class="eat__h">Rápidos para o almoço</h3>${park.eat.filter(e => e[1] === "Rápido").map(eatRow).join("")}
      <h3 class="eat__h">Típicos do parque</h3>${park.eat.filter(e => e[1] === "Típico").map(eatRow).join("")}
      <p class="small muted" style="margin-top:12px">Dica geral: almoçar antes das 11h30 ou depois das 13h30 costuma pegar menos fila. Cardápios e horários mudam: confirme no app do parque, onde muitos restaurantes de serviço rápido aceitam pedido pelo celular.</p></div></details>` : "";
    const foot = `
      ${eatHTML}
      ${others.length ? `<details class="alt"><summary>Outras atrações abertas (${others.length})${icon("chev-d")}</summary><div style="padding-top:6px">${others.map(l => `<div class="stat"><dt>${esc(l.name)}</dt><dd>${waitBadge(l)}</dd></div>`).join("")}</div></details>` : ""}
      <details class="alt"><summary>Dicas e fonte dos dados${icon("chev-d")}</summary><p>${esc(park.note)}</p><p>Os tempos de fila vêm do ThemeParks.wiki e são os informados pelo próprio parque; atualizam sozinhos a cada 2 minutos com esta tela aberta. A tendência é calculada com as leituras feitas neste aparelho, e as distâncias até a entrada são aproximadas.</p></details>`;

    /* ---------- modo: no parque ---------- */
    if (mode === "hoje") {
      let eta = Date.now();
      const plan = pending.map(r => { const w = waitOf(r); const row = { r, w, at: eta }; eta += ((w == null ? 20 : w) + 12) * 60000; return row; });
      const isDown = x => { const l = lv(x.r); return l && l.status === "DOWN"; };
      const next = plan.find(x => !isDown(x)) || plan[0];
      let hero;
      if (!must.length) hero = `<div class="sheet empty">Você ainda não montou o dia deste parque. <button class="btn btn--primary btn--sm" type="button" data-act="mode" data-v="montar" style="margin-top:12px">Montar o dia</button></div>`;
      else if (!next) hero = `<div class="nextup nextup--done"><div class="nextup__label">Dia completo</div><div class="nextup__name">Todas as atrações do roteiro foram feitas.</div><p class="nextup__sub">Veja se alguma atração “Se der tempo” está com a fila baixa agora.</p></div>`;
      else {
        const l = lv(next.r), tr = isOpen(l) ? trendOf(park.id, l) : { kind: "none" };
        const second = plan.filter(x => x !== next).find(x => x.w != null && next.w != null && next.w >= 30 && x.w <= next.w / 2);
        hero = `<section class="nextup" aria-label="Próxima atração">
          <div class="nextup__label">Próxima atração</div>
          <div class="nextup__row"><div class="nextup__name">${esc(next.r[1])}</div><div class="nextup__wait">${l && l.status === "DOWN" ? `<b>!</b><span>parada</span>` : next.w != null ? `<b>${next.w}</b><span>min de fila</span>` : `<b>–</b><span>sem dado</span>`}</div></div>
          <p class="nextup__sub">${esc(next.r[4])}</p>
          <div class="nextup__chips">${isOpen(l) ? trendChip(tr).replace("chip chip--ok", "nchip nchip--ok").replace("chip chip--e", "nchip nchip--e").replace("chip chip--plain", "nchip") : ""}${tr.min && tr.kind !== "none" && next.w != null ? `<span class="nchip">Menor hoje: ${tr.min[1]} min às ${fmtT(tr.min[0])}</span>` : ""}<span class="nchip">${farTxt(next.r[5])}</span></div>
          <div class="nextup__act"><button class="btn btn--sun" type="button" data-act="ride-fin" data-id="${esc(next.r[0])}">${icon("check")} Já fizemos</button><button class="btn btn--ghost" type="button" data-act="ride-skip" data-id="${esc(next.r[0])}">Pular</button></div>
          ${second ? `<div class="nudge">${icon("info")}<div><strong>${esc(second.r[1])}</strong> está com ${second.w} min agora, bem menos que a fila atual.<button class="btn btn--sm" type="button" data-act="ride-first" data-id="${esc(second.r[0])}" data-park="${park.id}" style="margin-top:8px">Ir primeiro nessa</button></div></div>` : ""}
        </section>`;
      }
      const total = must.length;
      const prog = total ? `<div class="prog"><div class="prog__bar"><i style="width:${Math.round(finished.length / total * 100)}%"></i></div><span>${finished.length} de ${total} feitas${plan.length ? ` · termina por volta das ${fmtT(eta)}` : ""}</span></div>` : "";
      return head + hero + prog + `
        ${plan.length > 1 ? `<section class="section"><div class="section__head"><h2 class="h-section">Depois disso</h2></div><ol class="route">${plan.filter(x => x !== next).map((x, i) => `<li><span class="route__n">${i + 2}</span><div class="route__main"><div class="route__name">${esc(x.r[1])}</div><div class="small muted">${isDown(x) ? "parada agora, volte a olhar depois" : "chegada ~" + fmtT(x.at)}</div></div>${waitBadge(lv(x.r))}</li>`).join("")}</ol></section>` : ""}
        ${finished.length ? `<details class="alt" style="margin-top:20px"><summary>Já feitas (${finished.length})${icon("chev-d")}</summary><div style="padding-top:6px">${finished.map(r => `<div class="stat"><dt style="text-decoration:line-through;color:var(--muted)">${esc(r[1])}</dt><dd><button class="btn btn--quiet btn--sm" type="button" data-act="ride-undone" data-id="${esc(r[0])}">Desfazer</button></dd></div>`).join("")}</div></details>` : ""}
        ${foot}`;
    }

    /* ---------- modo: montar o dia ---------- */
    const pass = r => {
      const w = waitOf(r), f = live.filter;
      return f === "all" || (f === "high" && r[3]) || (f === "short" && w != null && w <= 25) || (f === "thrill" && /Emoção|Aquática/.test(r[2])) || (f === "easy" && !/Emoção|Aquática/.test(r[2]));
    };
    const list = park.rides.filter(pass).sort((a, b) => (st(a) === "skip") - (st(b) === "skip") || ((waitOf(a) == null) - (waitOf(b) == null)) || (waitOf(a) - waitOf(b)));
    const card = r => {
      const l = lv(r), s = st(r), tr = isOpen(l) ? trendOf(park.id, l) : { kind: "none" };
      const idx = must.indexOf(r), isHot = hot.some(h => h.r === r);
      return `<li class="rcard${s === "must" ? " rcard--in" : ""}${s === "skip" ? " rcard--skip" : ""}${isHot ? " rcard--hot" : ""}">
        ${waitTile(l)}
        <div class="rcard__main"><div class="rcard__name">${esc(r[1])}</div>${r[7] && r[7] !== r[1] ? `<div class="rcard__en">${esc(r[7])}</div>` : ""}<p class="rcard__desc">${esc(r[4])}</p>
          <div class="chips" style="margin-top:5px"><span class="chip chip--plain">${esc(r[2])}</span>${isHot ? '<span class="chip chip--ok">Vale a pena agora</span>' : ""}${r[3] ? '<span class="chip chip--i">Disputada</span>' : ""}${tr.kind === "down" ? `<span class="chip chip--ok">↓ caindo</span>` : tr.kind === "up" ? `<span class="chip chip--e">↑ subindo</span>` : ""}</div>
          <div class="rcard__more"><button type="button" data-act="ride" data-id="${esc(r[0])}" data-v="maybe" aria-pressed="${s === "maybe"}">Se der tempo</button><button type="button" data-act="ride" data-id="${esc(r[0])}" data-v="skip" aria-pressed="${s === "skip"}">Pular</button><span class="small muted">${farTxt(r[5])}</span></div></div>
        <button class="radd" type="button" data-act="ride" data-id="${esc(r[0])}" data-v="must" aria-pressed="${s === "must"}" aria-label="${s === "must" ? "Tirar do roteiro: " : "Adicionar ao roteiro: "}${esc(r[1])}">${s === "must" ? `<b>${idx + 1}</b>` : icon("plus")}</button>
      </li>`;
    };
    const mine = must.length ? `<ol class="mine" data-park="${park.id}">${must.map((r, i) => `<li data-id="${esc(r[0])}"><button type="button" class="grip" aria-label="Arrastar para mudar a ordem: ${esc(r[1])}"><i></i><i></i><i></i></button><span class="route__n">${i + 1}</span><span class="mine__name">${esc(r[1])}${isDone(r) ? " ✓" : ""}</span>${waitBadge(lv(r))}<button type="button" class="mine__x" data-act="ride" data-id="${esc(r[0])}" data-v="must" aria-label="Tirar do roteiro: ${esc(r[1])}">${icon("close")}</button></li>`).join("")}</ol>${must.length > 1 ? `<p class="hint" style="margin-top:8px">Segure no ícone de três linhas e arraste para mudar a ordem.</p>` : ""}`
      : `<p class="small muted" style="margin:0">Toque no <strong>+</strong> das atrações abaixo para montar o roteiro do dia.</p>`;
    return head + `
      <section class="sheet sheet--pad mineBox">
        <div class="row row--between"><h2 class="h-section" style="margin:0">Meu roteiro</h2><span class="small muted">${must.length} ${must.length === 1 ? "atração" : "atrações"}</span></div>
        <button class="btn btn--sm" type="button" data-act="plan-from-day" data-id="${park.id}" style="margin-top:10px">${icon("route")} Usar o roteiro do dia ${park.day}</button>
        <div style="margin-top:10px">${mine}</div>
        ${must.length > 1 ? `<div class="mineBox__order"><div class="segmented seg-wrap" role="group" aria-label="Ordenar por">${Object.keys(STRATEGY).map(k => `<button type="button" data-act="strategy" data-v="${k}" aria-pressed="${live.strategy === k}">${esc(STRATEGY[k][0])}</button>`).join("")}</div>
          <p class="small muted" style="margin:8px 0 10px">${esc(STRATEGY[live.strategy][1])}</p>
          <button class="btn btn--primary" type="button" data-act="plan-suggest" data-id="${park.id}">${icon("route")} Ordenar para mim</button></div>` : ""}
      </section>
      <div class="fchips" role="group" aria-label="Filtrar">${FILTERS.map(f => `<button type="button" data-act="filter" data-v="${f[0]}" aria-pressed="${live.filter === f[0]}">${f[1]}</button>`).join("")}</div>
      ${list.length ? `<ul class="rcards">${list.map(card).join("")}</ul>` : `<div class="sheet empty">Nenhuma atração com esse filtro agora.</div>`}
      ${foot}`;
  }


  /* Arrastar para reordenar o roteiro (funciona com toque e mouse). */
  (function () {
    let drag = null;
    document.addEventListener("pointerdown", ev => {
      const g = ev.target.closest && ev.target.closest(".mine .grip");
      if (!g) return;
      const li = g.closest("li"), ol = li.parentNode;
      drag = { li, ol, id: g.pointerId };
      li.classList.add("is-drag");
      try { g.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura */ }
      ev.preventDefault();
    });
    document.addEventListener("pointermove", ev => {
      if (!drag) return;
      const items = [...drag.ol.children].filter(x => x !== drag.li);
      for (const it of items) {
        const b = it.getBoundingClientRect();
        if (ev.clientY > b.top && ev.clientY < b.bottom) {
          const before = ev.clientY < b.top + b.height / 2;
          drag.ol.insertBefore(drag.li, before ? it : it.nextSibling);
          break;
        }
      }
      const top = drag.ol.getBoundingClientRect().top, bottom = drag.ol.getBoundingClientRect().bottom;
      if (ev.clientY < top) drag.ol.insertBefore(drag.li, drag.ol.firstChild);
      else if (ev.clientY > bottom) drag.ol.appendChild(drag.li);
      const edge = 70;
      if (ev.clientY < edge) window.scrollBy(0, -12); else if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
    });
    const end = () => {
      if (!drag) return;
      const ids = [...drag.ol.children].map(x => x.dataset.id), park = drag.ol.dataset.park;
      drag.li.classList.remove("is-drag"); drag = null;
      store.update(st => { st.rideOrder[park] = ids; });
      FT.app.render({ keepScroll: true });
    };
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  })();

  setInterval(() => {
    const m = /^#\/parques\/?([a-z]*)/.exec(location.hash);
    if (!m || document.hidden) return;
    const key = FT.PARQUES.some(p => p.id === m[1]) ? m[1] : (FT.PARQUES.find(p => FT.u.dayDate(p.day) === today()) || FT.PARQUES[0]).id;
    fetchLive(key, true);
  }, 120000);

  /* ======================================================================
     Ações, formulários e eventos
     ====================================================================== */
  ex.act = async function (act, el) {
    switch (act) {
      case "ride": {
        const id = el.dataset.id, v = el.dataset.v;
        store.update(s => { if (s.rides[id] === v) delete s.rides[id]; else s.rides[id] = v; });
        FT.app.render({ keepScroll: true }); return true;
      }
      case "ride-done": { const id = el.dataset.id, on = el.checked; store.update(st => { if (on) st.rideDone[id] = true; else delete st.rideDone[id]; }); FT.app.render({ keepScroll: true }); return true; }
      case "ride-move": {
        const park = FT.PARQUES.find(p => p.rides.some(r => r[0] === el.dataset.id)), d = Number(el.dataset.v);
        const ids = orderedMusts(park).map(r => r[0]), i = ids.indexOf(el.dataset.id), j = i + d;
        if (i >= 0 && j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; store.update(st => { st.rideOrder[park.id] = ids; }); }
        FT.app.render({ keepScroll: true }); return true;
      }
      case "mode": live.mode = el.dataset.v; FT.app.render({ keepScroll: false }); window.scrollTo(0, 0); return true;
      case "filter": live.filter = el.dataset.v; FT.app.render({ keepScroll: true }); return true;
      case "ride-fin": store.update(st => { st.rideDone[el.dataset.id] = true; }); toast("Boa! Marcada como feita."); FT.app.render({ keepScroll: true }); return true;
      case "ride-undone": store.update(st => { delete st.rideDone[el.dataset.id]; }); FT.app.render({ keepScroll: true }); return true;
      case "ride-skip": store.update(st => { st.rides[el.dataset.id] = "skip"; }); FT.app.render({ keepScroll: true }); return true;
      case "ride-go": { const park = FT.PARQUES.find(p => p.id === el.dataset.park), id = el.dataset.id; if (park) store.update(st => { st.rides[id] = "must"; st.rideOrder[park.id] = [id].concat(orderedMusts(park).map(r => r[0]).filter(x => x !== id)); }); live.mode = "hoje"; toast("Passou para o começo do roteiro."); FT.app.render({ keepScroll: false }); window.scrollTo(0, 0); return true; }
      case "ride-first": { const park = FT.PARQUES.find(p => p.id === el.dataset.park), id = el.dataset.id; if (park) store.update(st => { st.rideOrder[park.id] = [id].concat(orderedMusts(park).map(r => r[0]).filter(x => x !== id)); }); FT.app.render({ keepScroll: true }); return true; }
      case "plan-from-day": {
        const park = FT.PARQUES.find(p => p.id === el.dataset.id); if (!park) return true;
        const list = ridesFromDay(park);
        if (!list.length) { toast(`Não achei atrações do guia no roteiro do dia ${park.day}.`); return true; }
        const old = orderedMusts(park).filter(r => !list.includes(r));
        const r = await FT.app.dialog({ title: `Usar o roteiro do dia ${park.day}?`, html: `<p class="dialog__text">O plano do guia fica na mesma ordem do roteiro do dia:</p><ol style="padding-left:20px;margin:8px 0">${list.map(x => `<li>${esc(x[1])}</li>`).join("")}</ol>${old.length ? `<p class="dialog__text">Ficam em “Se der tempo”: ${old.map(x => esc(x[1])).join(", ")}.</p>` : ""}`, ok: "Usar este roteiro" });
        if (r.value !== "ok") return true;
        store.update(st => { for (const x of old) st.rides[x[0]] = "maybe"; for (const x of list) { st.rides[x[0]] = "must"; delete st.rideDone[x[0]]; } st.rideOrder[park.id] = list.map(x => x[0]); });
        live.mode = "montar"; toast("Plano atualizado com o roteiro do dia."); FT.app.render({ keepScroll: true }); return true;
      }
      case "strategy": live.strategy = el.dataset.v; FT.app.render({ keepScroll: true }); return true;
      case "plan-suggest": { const park = FT.PARQUES.find(p => p.id === el.dataset.id); suggestOrder(park); toast("Ordem sugerida: " + STRATEGY[live.strategy][0].toLowerCase() + "."); FT.app.render({ keepScroll: true }); return true; }
      case "live-refresh": fetchLive(el.dataset.id, true); return true;
      case "doc-open": await openDoc(el.dataset.id); return true;
      case "doc-del": {
        const r = await FT.app.dialog({ title: "Remover este anexo?", text: "Ele some dos dois aparelhos.", ok: "Remover", danger: true });
        if (r.value === "ok") { const id = el.dataset.id; store.update(s => { s.docs = s.docs.filter(d => d.id !== id); }); await files.remove(id); FT.app.render({ keepScroll: true }); }
        return true;
      }
      case "fx-refresh": fetchRate(true); return true;
    }
    return false;
  };

  ex.change = function (act, el) {
    const v = el.value;
    switch (act) {
      case "doc-add": addFiles(el.dataset.res, el.files); el.value = ""; return true;
      case "fx-spread": { const n = num(v); if (n >= 0 && n <= 10) store.update(s => { s.fx.spread = n; }); else toast("Digite um acréscimo entre 0 e 10."); FT.app.render({ keepScroll: true }); return true; }
      case "fx-tax": { const n = num(v); if (n >= 0 && n <= 50) store.update(s => { s.fx.tax = n; }); else toast("Digite um percentual entre 0 e 50."); FT.app.render({ keepScroll: true }); return true; }
      case "fx-manual": { const n = v.trim() === "" ? null : num(v); store.update(s => { s.fx.manual = n > 0 ? n : null; }); FT.app.render({ keepScroll: true }); return true; }
    }
    return false;
  };

  ex.input = function (el) {
    if (el.dataset && el.dataset.act === "fx-amt") { fxs.amount = el.value; updateFx(); return true; }
    return false;
  };

  ex.submit = async function () { return false; };

  /* ---------- rotas e menus ---------- */
  Object.assign(ex.routes, {
    hoje: { title: "Hoje", tab: "inicio", fn: viewHoje },
    cambio: { title: "Câmbio", tab: "cambio", fn: viewCambio },
    parques: { title: "Guia do parque", tab: "mais", fn: viewParques }
  });
  ex.more = [
    { id: "parques", label: "Guia do parque", icon: "sun", text: "Plano do dia, ordem sugerida e filas ao vivo" }
  ];
  ex.rail = [{ id: "hoje", label: "Hoje", icon: "clock" }];

  /* Migração: se o cabeçalho do dia 9 ainda é o texto antigo (só Universal Studios), troca pelo de Park-to-Park. Edições do usuário nunca são tocadas. */
  (function migrateParkToPark() {
    try {
      const st = S(), d = st && st.days && st.days[5], nd = FT.DAYS_DEFAULT[5];
      if (!d || d.title !== "Universal Studios Florida") return;
      if (!/^Dia inteiro no Universal Studios Florida, priorizando/.test(d.desc || "")) return;
      if (!/^Defina de quatro a seis/.test(d.tip || "")) return;
      store.update(s => { Object.assign(s.days[5], { title: nd.title, where: nd.where, desc: nd.desc, tags: nd.tags.slice(), tip: nd.tip }); });
    } catch (e) { /* sem migração */ }
  })();

  /* Na viagem, a tela Hoje se atualiza sozinha a cada minuto. */
  setInterval(() => {
    if (!/^#\/hoje/.test(location.hash)) return;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    FT.app.render({ keepScroll: true });
  }, 60000);
})();
