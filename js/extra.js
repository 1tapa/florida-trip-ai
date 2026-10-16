/* Telas extras: Hoje, Câmbio, Prioridades por parque, Frases, Onde estacionei e anexos de reservas. */
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
        <a class="btn" href="#/carro">${icon("car")} Onde estacionei</a>
        <a class="btn" href="#/orcamento">${icon("wallet")} Registrar gasto</a>
        <a class="btn" href="#/frases">${icon("note")} Frases úteis</a>
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
      <form class="sheet sheet--pad" data-form="fx-expense" style="margin-top:12px">
        <strong>Registrar esta compra como gasto</strong><p class="small muted" style="margin-top:4px">O gasto entra no orçamento em dólar, com o valor digitado acima.</p>
        <div class="two"><div><label class="label" for="fxName">Descrição</label><input class="field" id="fxName" name="name" maxlength="80" placeholder="Ex.: Tênis no outlet"></div>
        <div><label class="label" for="fxCat">Categoria</label><select class="field" id="fxCat" name="category">${FT.EXPENSE_CATS.map(c => `<option>${esc(c)}</option>`).join("")}</select></div></div>
        <div style="margin-top:14px"><button class="btn btn--primary" type="submit">${icon("plus")} Registrar gasto</button></div></form>
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
  const ENTITY = { mk: "75ea578a-adc8-4116-a54d-dccb60765ef9", usf: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57" };
  const LIVE_KEY = "floridaTripAI_live";
  const WAIT_KEY = "floridaTripAI_waits";
  const RIDE_LABEL = { must: "Imperdível", maybe: "Se der", skip: "Pular" };
  const STRATEGY = {
    tras: ["Do fundo para a entrada", "Começa pelas atrações de alta demanda do fundo do parque e volta em direção à entrada. As filas costumam ser menores nas primeiras horas, e o fundo do parque enche depois."],
    frente: ["Da entrada para o fundo", "Segue o caminho natural, começando pelas atrações de alta demanda mais perto da entrada."],
    fila: ["Menor fila agora", "Ordena pelo tempo de fila ao vivo, da menor para a maior. Útil para decidir na hora."]
  };
  const live = { data: {}, busy: {}, tried: {}, err: {}, strategy: "tras", alerts: [], notified: {} };
  let samples = {};
  try { samples = JSON.parse(FT.ls.get(WAIT_KEY) || "{}") || {}; } catch (e) { samples = {}; }
  try { const c = JSON.parse(FT.ls.get(LIVE_KEY) || "{}"); for (const k of Object.keys(c)) if (c[k] && Array.isArray(c[k].rides)) live.data[k] = c[k]; } catch (e) { /* sem cache */ }

  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[™®©]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const STOP = new Set(["the", "of", "a", "and", "to", "in"]);
  const tokens = s => norm(s).split(" ").filter(w => w && !STOP.has(w));

  /* Casa uma atração do guia com uma entrada da fila ao vivo, pelo nome. */
  function matchLive(ride, rides) {
    const mine = tokens(ride[1]), alias = ride[6] ? norm(ride[6]) : "";
    let best = null;
    for (const l of rides) {
      const ln = norm(l.name), lt = tokens(l.name);
      if ((alias && ln.includes(alias)) || mine.every(w => lt.includes(w))) { if (!best || lt.length < tokens(best.name).length) best = l; }
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
      checkAlerts(parkKey, rides);
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

  function checkAlerts(parkKey, rides) {
    const park = FT.PARQUES.find(p => p.id === parkKey);
    const A = S().rideAlert;
    for (const r of park.rides) {
      const th = A[r[0]];
      if (!th) continue;
      const l = matchLive(r, rides);
      if (!l || l.status !== "OPERATING" || l.wait == null || l.wait > th) continue;
      if (Date.now() - (live.notified[r[0]] || 0) < 15 * 60000) continue;
      live.notified[r[0]] = Date.now();
      const msg = `Fila baixa: ${r[1]} está com ${l.wait} min.`;
      live.alerts.unshift({ t: Date.now(), msg });
      live.alerts = live.alerts.slice(0, 5);
      toast(msg);
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* sem vibração */ }
    }
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

  function viewParques(arg) {
    const parks = FT.PARQUES, t = today();
    const park = parks.find(p => p.id === arg) || parks.find(p => FT.u.dayDate(p.day) === t) || parks[0];
    fetchLive(park.id, false);
    const S_ = S(), R = S_.rides, data = live.data[park.id], L = data ? data.rides : [];
    const st = r => R[r[0]] || "";
    const lv = r => matchLive(r, L);
    const must = orderedMusts(park), maybe = park.rides.filter(r => st(r) === "maybe");
    const when = data ? new Date(data.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    const used = new Set(park.rides.map(r => { const l = lv(r); return l ? l.id : ""; }));
    const others = L.filter(l => !used.has(l.id) && l.status !== "CLOSED" && l.status !== "REFURBISHMENT").sort((a, b) => (a.wait == null) - (b.wait == null) || a.wait - b.wait);
    const alertBtn = r => { const th = S_.rideAlert[r[0]]; return `<button type="button" class="btn btn--quiet btn--sm" data-act="ride-alert" data-id="${esc(r[0])}">${icon("bell")} ${th ? "Avisar ≤ " + th + " min" : "Sem aviso"}</button>`; };
    const row = (r, i, total) => {
      const l = lv(r), tr = l && l.status === "OPERATING" ? trendOf(park.id, l) : { kind: "none" };
      const done = !!S_.rideDone[r[0]], low = S_.rideAlert[r[0]] && l && l.status === "OPERATING" && l.wait != null && l.wait <= S_.rideAlert[r[0]];
      return `<li class="plan${done ? " plan--done" : ""}${low ? " plan--low" : ""}">
        <label class="check"><input type="checkbox" data-act="ride-done" data-id="${esc(r[0])}"${done ? " checked" : ""} aria-label="Já fizemos: ${esc(r[1])}"><span class="check__box">${icon("check")}</span></label>
        <div class="plan__main"><div class="row row--between"><span class="plan__name">${esc(r[1])}</span>${waitBadge(l)}</div>
          <div class="chips" style="margin-top:6px">${l && l.status === "OPERATING" ? trendChip(tr) : ""}${tr.min && l && l.wait != null ? `<span class="chip chip--plain">Menor hoje: ${tr.min[1]} min às ${new Date(tr.min[0]).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}<span class="chip chip--plain">${farTxt(r[5])}</span>${r[3] ? '<span class="chip chip--i">Alta demanda</span>' : ""}${low ? '<span class="chip chip--ok">Fila baixa agora</span>' : ""}</div>
          <p class="small muted" style="margin-top:6px">${esc(r[4])}</p>
          <div class="plan__ctrl">${alertBtn(r)}<span class="plan__move"><button type="button" class="btn btn--quiet btn--icon btn--sm" data-act="ride-move" data-id="${esc(r[0])}" data-v="-1" aria-label="Subir na ordem"${i === 0 ? " disabled" : ""}>${icon("chev-l", "rot-up")}</button><button type="button" class="btn btn--quiet btn--icon btn--sm" data-act="ride-move" data-id="${esc(r[0])}" data-v="1" aria-label="Descer na ordem"${i === total - 1 ? " disabled" : ""}>${icon("chev-r", "rot-down")}</button></span></div></div></li>`;
    };
    const quick = must.filter(r => { const l = lv(r); return l && l.status === "OPERATING" && l.wait != null; }).sort((a, b) => lv(a).wait - lv(b).wait).slice(0, 3);
    return `<a class="back" href="#/mais">${icon("chev-l")} Mais</a>
      <header class="page-head"><h1 class="h-page">Guia do parque</h1><p class="lede">Escolha as atrações, monte a ordem do dia e acompanhe a fila ao vivo. Vocês dois veem o mesmo plano.</p></header>
      <div class="segmented" role="group" aria-label="Parque" style="margin-bottom:16px">${parks.map(p => `<a class="seg-link" href="#/parques/${p.id}" aria-pressed="${p.id === park.id}">${esc(p.name)}</a>`).join("")}</div>
      <div class="callout callout--info">${icon("info")}<div><strong>Dia ${park.day} de dezembro</strong>${esc(park.note)}</div></div>
      <section class="sheet sheet--pad livebar" style="margin-top:16px">
        <div class="row row--between row--wrap"><div><strong>Filas ao vivo</strong><div class="small muted">${data ? "Leitura das " + when : live.busy[park.id] ? "Buscando…" : "Ainda sem leitura"}</div></div>
          <button class="btn btn--sm" type="button" data-act="live-refresh" data-id="${park.id}"${live.busy[park.id] ? " disabled" : ""}>${icon("refresh")} ${live.busy[park.id] ? "Buscando…" : "Atualizar"}</button></div>
        ${live.err[park.id] ? `<p class="small" style="margin-top:8px;color:var(--alert)">${esc(live.err[park.id])}</p>` : ""}
        ${quick.length ? `<p class="small" style="margin-top:10px">Menores filas entre as imperdíveis agora: ${quick.map(r => `<strong>${esc(r[1])}</strong> (${lv(r).wait} min)`).join(", ")}.</p>` : ""}
        ${live.alerts.length ? `<div class="callout callout--info" style="margin-top:10px">${icon("bell")}<div><strong>Avisos de fila baixa</strong>${live.alerts.map(a => `${esc(a.msg)}`).join("<br>")}</div></div>` : ""}
        <p class="hint">Atualiza sozinho a cada 2 minutos com esta tela aberta; com os avisos ligados, o servidor vigia mesmo com o app fechado. Fonte: ThemeParks.wiki. São os tempos informados pelo próprio parque, e a tendência é calculada a partir das leituras feitas por este aparelho.</p></section>
      ${notifyHTML()}
      <section class="section"><div class="section__head"><h2 class="h-section">Plano do dia</h2><span class="small muted">${must.length} imperdíveis</span></div>
        <div class="sheet sheet--pad stack"><div class="small muted">Estratégia para ordenar</div>
          <div class="segmented seg-wrap" role="group" aria-label="Estratégia">${Object.keys(STRATEGY).map(k => `<button type="button" data-act="strategy" data-v="${k}" aria-pressed="${live.strategy === k}">${esc(STRATEGY[k][0])}</button>`).join("")}</div>
          <p class="small muted">${esc(STRATEGY[live.strategy][1])}</p>
          <button class="btn btn--primary" type="button" data-act="plan-suggest" data-id="${park.id}"${must.length ? "" : " disabled"}>${icon("route")} Sugerir ordem</button>
          <p class="hint" style="margin-top:0">Distâncias até a entrada são aproximadas, só para ordenar. Use as setas para ajustar do seu jeito e siga o roteiro de preferência de vocês.</p></div>
        ${must.length ? `<ol class="plans" style="margin-top:12px">${must.map((r, i) => row(r, i, must.length)).join("")}</ol>` : `<div class="sheet empty" style="margin-top:12px">Marque atrações como “Imperdível” na lista abaixo e elas aparecem aqui.</div>`}</section>
      ${maybe.length ? `<section class="section"><div class="section__head"><h2 class="h-section">Se der tempo</h2></div><div class="sheet" style="padding:0 16px">${maybe.map(r => { const l = lv(r); return `<div class="stat"><dt>${esc(r[1])}</dt><dd>${waitBadge(l)}</dd></div>`; }).join("")}</div></section>` : ""}
      <section class="section"><div class="section__head"><h2 class="h-section">Todas as atrações</h2></div>
        <div class="sheet" style="padding:0 16px">${park.rides.map(r => `<div class="ride"><div class="ride__top"><div style="min-width:0"><div class="row row--between"><span class="ride__name">${esc(r[1])}</span>${waitBadge(lv(r))}</div><div class="chips" style="margin-top:6px"><span class="chip chip--plain">${esc(r[2])}</span>${r[3] ? '<span class="chip chip--i">Alta demanda</span>' : ""}</div></div></div>
          <div class="status" role="group" aria-label="${esc(r[1])}">${Object.keys(RIDE_LABEL).map(k => `<button type="button" data-act="ride" data-id="${esc(r[0])}" data-v="${k}" aria-pressed="${st(r) === k}">${RIDE_LABEL[k]}</button>`).join("")}</div></div>`).join("")}</div></section>
      ${others.length ? `<section class="section"><div class="section__head"><h2 class="h-section">Outras atrações abertas</h2></div><div class="sheet" style="padding:0 16px">${others.map(l => `<div class="stat"><dt>${esc(l.name)}</dt><dd>${waitBadge(l)}</dd></div>`).join("")}</div></section>` : ""}`;
  }

  setInterval(() => {
    const m = /^#\/parques\/?([a-z]*)/.exec(location.hash);
    if (!m || document.hidden) return;
    const key = FT.PARQUES.some(p => p.id === m[1]) ? m[1] : (FT.PARQUES.find(p => FT.u.dayDate(p.day) === today()) || FT.PARQUES[0]).id;
    fetchLive(key, true);
  }, 120000);


  /* ======================================================================
     Avisos no celular (Cloudflare Worker + ntfy): funcionam com o app fechado
     ====================================================================== */
  const nst = { at: 0, n: 0, err: "", busy: false, t: null };
  const notifyOn = () => { const n = S().notify; return !!(n && n.url && n.topic); };
  const newTopic = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return "florida-" + Array.from(a, b => (b % 36).toString(36)).join("") + "x"; };

  async function postWorker(path, body) {
    const n = S().notify;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(n.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ topic: n.topic }, body)), signal: ctrl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "http " + r.status);
      return j;
    } finally { clearTimeout(t); }
  }

  /* Envia ao servidor as atrações com aviso ligado (e ainda não feitas). */
  async function pushNotify() {
    if (!notifyOn() || nst.busy) return;
    nst.busy = true;
    try {
      const alerts = [];
      for (const park of FT.PARQUES) {
        const wanted = park.rides.filter(r => S().rideAlert[r[0]] && !S().rideDone[r[0]]);
        if (!wanted.length) continue;
        if (!live.data[park.id]) await fetchLive(park.id, true);
        const L = live.data[park.id] ? live.data[park.id].rides : [];
        for (const r of wanted) { const l = matchLive(r, L); if (l) alerts.push({ park: park.id, id: l.id, name: r[1], max: S().rideAlert[r[0]] }); }
      }
      const j = await postWorker("/config", { alerts });
      Object.assign(nst, { at: Date.now(), n: j.n || 0, err: "" });
    } catch (e) {
      nst.err = "Não consegui falar com o servidor de avisos. Confira o endereço e a internet.";
    } finally { nst.busy = false; if (/^#\/parques/.test(location.hash)) FT.app.render({ keepScroll: true }); }
  }
  const pushSoon = () => { clearTimeout(nst.t); nst.t = setTimeout(pushNotify, 1500); };
  /* Renova a configuração sempre que o app abre, para ela não expirar no servidor. */
  setTimeout(pushNotify, 4000);

  function notifyHTML() {
    const n = S().notify, on = notifyOn();
    const when = nst.at ? new Date(nst.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    if (!on) return `<section class="section"><div class="section__head"><h2 class="h-section">Avisos com o celular bloqueado</h2></div>
      <form class="sheet sheet--pad" data-form="notify-save">
        <p class="small">Receba uma notificação quando a fila de uma atração marcada cair, mesmo com o app fechado. Precisa de uma configuração única, de uns 10 minutos: <strong>worker/LEIAME.md</strong> no repositório do app explica passo a passo.</p>
        <label class="label" for="nfUrl">Endereço do servidor de avisos</label>
        <input class="field" id="nfUrl" name="url" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://florida-filas.seunome.workers.dev" required>
        <div style="margin-top:12px"><button class="btn btn--primary" type="submit">${icon("bell")} Ligar avisos</button></div></form></section>`;
    return `<section class="section"><div class="section__head"><h2 class="h-section">Avisos com o celular bloqueado</h2></div>
      <div class="sheet sheet--pad stack">
        <div class="callout callout--info">${icon("bell")}<div><strong>Ligado</strong>${nst.err ? esc(nst.err) : nst.at ? `${nst.n} ${nst.n === 1 ? "atração vigiada" : "atrações vigiadas"} (enviado às ${when}).` : nst.busy ? "Enviando…" : "Aguardando o primeiro envio."} Para vigiar uma atração, toque em “Sem aviso” no plano do dia até aparecer o limite.</div></div>
        <ol class="small" style="padding-left:18px;display:grid;gap:4px">
          <li>Instale o app gratuito <strong>ntfy</strong> (App Store) em cada celular.</li>
          <li>Toque em “+” e assine o tópico: <strong style="user-select:all">${esc(n.topic)}</strong></li>
          <li>Ative as notificações do ntfy nos Ajustes do iPhone.</li>
        </ol>
        <div class="btn-row"><button class="btn btn--sm" type="button" data-act="notify-test">Enviar aviso de teste</button><button class="btn btn--sm" type="button" data-act="notify-push">${icon("refresh")} Reenviar atrações</button><button class="btn btn--quiet btn--sm" type="button" data-act="notify-off">Desligar</button></div>
        <p class="hint" style="margin-top:0">O código do tópico é o que protege os avisos: não compartilhe com outras pessoas. Aviso de fila baixa não se repete por 25 minutos, e você também é avisado quando uma atração parada voltar.</p></div></section>`;
  }

  /* ======================================================================
     Frases úteis
     ====================================================================== */
  function viewFrases() {
    return `<a class="back" href="#/mais">${icon("chev-l")} Mais</a>
      <header class="page-head"><h1 class="h-page">Frases úteis</h1><p class="lede">Toque em Mostrar para exibir a frase em letras grandes e entregar o celular para a pessoa ler.</p></header>
      ${FT.FRASES.map((g, gi) => `<section class="section"><div class="section__head"><h2 class="h-section">${esc(g.name)}</h2></div>
        <div class="sheet" style="padding:0 16px">${g.list.map((f, fi) => `<div class="phrase"><div class="phrase__text"><div class="phrase__en">${esc(f[1])}</div><div class="phrase__pt">${esc(f[0])}</div></div><button class="btn btn--sm" type="button" data-act="phrase-show" data-g="${gi}" data-i="${fi}">Mostrar</button></div>`).join("")}</div></section>`).join("")}`;
  }

  /* ======================================================================
     Onde estacionei
     ====================================================================== */
  function viewCarro() {
    const p = S().parking;
    const ago = p ? Math.max(0, Math.round((FT.now().getTime() - p.t) / 60000)) : 0;
    const agoTxt = ago < 1 ? "agora há pouco" : ago < 60 ? `há ${ago} min` : ago < 1440 ? `há ${Math.floor(ago / 60)} h` : "há mais de um dia";
    return `<a class="back" href="#/mais">${icon("chev-l")} Mais</a>
      <header class="page-head"><h1 class="h-page">Onde estacionei</h1><p class="lede">Salve a localização do carro quando estacionar. Vocês dois enxergam o mesmo local.</p></header>
      ${p ? `<section class="sheet sheet--pad stack">
          <div class="row row--between row--wrap"><strong>Carro salvo ${agoTxt}</strong><span class="chip chip--ok">${icon("pin")} Localização salva</span></div>
          <a class="btn btn--primary" href="${esc("https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lon + "&travelmode=walking")}" target="_blank" rel="noopener noreferrer">${icon("route")} Rota a pé até o carro</a>
          <a class="btn" href="${esc("https://www.google.com/maps/search/?api=1&query=" + p.lat + "," + p.lon)}" target="_blank" rel="noopener noreferrer">${icon("pin")} Ver no mapa</a>
          <label class="label" for="parkNote">Anotação (andar, fileira, referência)</label><input class="field" id="parkNote" data-act="park-note" maxlength="120" value="${esc(p.note)}" placeholder="Ex.: Pateta, fileira 12">
          <div class="btn-row"><button class="btn" type="button" data-act="park-save">${icon("refresh")} Salvar de novo (mudei de lugar)</button><button class="btn btn--quiet btn--danger" type="button" data-act="park-clear">Apagar</button></div></section>`
      : `<section class="sheet sheet--pad stack"><p>Ainda não há carro salvo. Quando estacionar, toque no botão abaixo e permita o acesso à localização.</p><button class="btn btn--primary" type="button" data-act="park-save">${icon("pin")} Salvar local do carro agora</button></section>`}
      <div class="callout" style="margin-top:20px">${icon("info")}<div><strong>Dica</strong>Dentro de estacionamentos cobertos o GPS pode errar. Anote também o andar ou a fileira.</div></div>`;
  }

  function saveParking() {
    if (!navigator.geolocation) { toast("Este aparelho não oferece localização."); return; }
    toast("Buscando a localização…");
    navigator.geolocation.getCurrentPosition(pos => {
      store.update(s => { s.parking = { lat: pos.coords.latitude, lon: pos.coords.longitude, t: Date.now(), note: s.parking ? s.parking.note : "" }; });
      toast("Local do carro salvo."); FT.app.render({ keepScroll: true });
    }, err => {
      toast(err && err.code === 1 ? "Localização bloqueada. Permita para este site nas configurações do navegador." : "Não consegui pegar a localização. Tente de novo em campo aberto.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

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
      case "ride-done": { const id = el.dataset.id, on = el.checked; store.update(st => { if (on) st.rideDone[id] = true; else delete st.rideDone[id]; }); pushSoon(); FT.app.render({ keepScroll: true }); return true; }
      case "ride-move": {
        const park = FT.PARQUES.find(p => p.rides.some(r => r[0] === el.dataset.id)), d = Number(el.dataset.v);
        const ids = orderedMusts(park).map(r => r[0]), i = ids.indexOf(el.dataset.id), j = i + d;
        if (i >= 0 && j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; store.update(st => { st.rideOrder[park.id] = ids; }); }
        FT.app.render({ keepScroll: true }); return true;
      }
      case "ride-alert": {
        const id = el.dataset.id, cycle = [0, 30, 45, 60], cur = S().rideAlert[id] || 0, nx = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
        store.update(st => { if (nx) st.rideAlert[id] = nx; else delete st.rideAlert[id]; });
        if (nx) toast(`Aviso ligado: quando a fila ficar em ${nx} min ou menos${notifyOn() ? "." : " (com a tela aberta)."}`);
        pushSoon();
        FT.app.render({ keepScroll: true }); return true;
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
      case "notify-push": await pushNotify(); toast(nst.err || "Atrações enviadas ao servidor."); return true;
      case "notify-test": try { await pushNotify(); await postWorker("/test", {}); toast("Teste enviado. Olhe o app ntfy."); } catch (e) { toast("Não consegui enviar o teste. Confira o endereço do servidor."); } return true;
      case "notify-off": { const r = await FT.app.dialog({ title: "Desligar os avisos no celular?", text: "O servidor para de vigiar as filas. Vale para os dois aparelhos.", ok: "Desligar", danger: true }); if (r.value === "ok") { try { await postWorker("/config", { alerts: [] }); } catch (e) { /* expira sozinho */ } store.update(st => { st.notify = { url: "", topic: "" }; }); nst.at = 0; FT.app.render({ keepScroll: true }); } return true; }
      case "park-save": saveParking(); return true;
      case "park-clear": store.update(s => { s.parking = null; }); FT.app.render({ keepScroll: true }); return true;
      case "fx-refresh": fetchRate(true); return true;
      case "phrase-show": {
        const f = FT.FRASES[Number(el.dataset.g)].list[Number(el.dataset.i)];
        await FT.app.dialog({ title: "Show this to them", html: `<p class="phrase__big">${esc(f[1])}</p><p class="small muted" style="margin-top:12px">${esc(f[0])}</p>`, ok: "Fechar", cancel: null });
        return true;
      }
    }
    return false;
  };

  ex.change = function (act, el) {
    const v = el.value;
    switch (act) {
      case "doc-add": addFiles(el.dataset.res, el.files); el.value = ""; return true;
      case "park-note": store.update(s => { if (s.parking) s.parking.note = clamp(v, 120); }); return true;
      case "fx-spread": { const n = num(v); if (n >= 0 && n <= 10) store.update(s => { s.fx.spread = n; }); else toast("Digite um acréscimo entre 0 e 10."); FT.app.render({ keepScroll: true }); return true; }
      case "fx-tax": { const n = num(v); if (n >= 0 && n <= 50) store.update(s => { s.fx.tax = n; }); else toast("Digite um percentual entre 0 e 50."); FT.app.render({ keepScroll: true }); return true; }
      case "fx-manual": { const n = v.trim() === "" ? null : num(v); store.update(s => { s.fx.manual = n > 0 ? n : null; }); FT.app.render({ keepScroll: true }); return true; }
    }
    return false;
  };

  ex.input = function (el) {
    if (el.dataset && el.dataset.act === "fx-amt") { fxs.amount = el.value; updateFx(); return true; }
    if (el.dataset && el.dataset.act === "park-note") { store.update(s => { if (s.parking) s.parking.note = clamp(el.value, 120); }); return true; }
    return false;
  };

  ex.submit = async function (name, form) {
    if (name === "notify-save") {
      const url = String(new FormData(form).get("url") || "").trim().replace(/\/+$/, "");
      if (!/^https:\/\/[^\s"'<>]{4,180}$/.test(url)) { toast("Cole o endereço completo, começando com https://"); return true; }
      store.update(st => { st.notify = { url, topic: st.notify.topic || newTopic() }; });
      toast("Avisos ligados. Agora assine o tópico no app ntfy."); FT.app.render({ keepScroll: true }); pushNotify();
      return true;
    }
    if (name === "fx-expense") {
      const usd = num(fxs.amount);
      if (!(usd > 0)) { toast("Digite o valor da compra em dólar primeiro."); return true; }
      const d = new FormData(form);
      const category = FT.EXPENSE_CATS.includes(d.get("category")) ? d.get("category") : "Outros";
      store.update(s => { s.expenses.push({ id: uid(), name: clamp(d.get("name"), 80) || "Compra", amount: usd, category, date: today() }); });
      fxs.amount = ""; toast("Gasto registrado no orçamento."); FT.app.render({ keepScroll: true });
      return true;
    }
    return false;
  };

  /* ---------- rotas e menus ---------- */
  Object.assign(ex.routes, {
    hoje: { title: "Hoje", tab: "inicio", fn: viewHoje },
    cambio: { title: "Câmbio", tab: "cambio", fn: viewCambio },
    parques: { title: "Guia do parque", tab: "mais", fn: viewParques },
    frases: { title: "Frases úteis", tab: "mais", fn: viewFrases },
    carro: { title: "Onde estacionei", tab: "mais", fn: viewCarro }
  });
  ex.more = [
    { id: "parques", label: "Guia do parque", icon: "sun", text: "Plano do dia, ordem sugerida e filas ao vivo" },
    { id: "frases", label: "Frases úteis em inglês", icon: "note", text: "Aeroporto, hotel, restaurante, loja da Apple e emergência" },
    { id: "carro", label: "Onde estacionei", icon: "car", text: "Salve a localização do carro e volte a pé até ele" }
  ];
  ex.rail = [{ id: "hoje", label: "Hoje", icon: "clock" }];

  /* Na viagem, a tela Hoje se atualiza sozinha a cada minuto. */
  setInterval(() => {
    if (!/^#\/hoje/.test(location.hash)) return;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    FT.app.render({ keepScroll: true });
  }, 60000);
})();
