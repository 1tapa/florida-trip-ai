/* Telas, navegação e eventos do guia. */
(function () {
  const FT = window.FT;
  const { esc, icon, money, today, short, diffDays, mapsUrl, safeUrl, num, clamp, uid } = FT.u;
  const store = FT.store;
  const S = () => store.state;
  const $ = sel => document.querySelector(sel);
  const VERSION = "2.0";

  const NAV = [
    { id: "inicio", label: "Início", icon: "home" },
    { id: "roteiro", label: "Roteiro", icon: "route" },
    { id: "checklist", label: "Checklist", icon: "checklist" },
    { id: "concierge", label: "Concierge", icon: "bell" },
    { id: "mais", label: "Mais", icon: "more" }
  ];
  const MORE = [
    { id: "reservas", label: "Reservas", icon: "ticket", text: "Voos, hotéis, carro e ingressos com código e situação" },
    { id: "orcamento", label: "Orçamento", icon: "wallet", text: "Quanto já gastou e quanto sobra, por categoria" },
    { id: "compras", label: "Compras e alfândega", icon: "bag", text: "Lista, outlets e simulador do imposto na volta" },
    { id: "comida", label: "Onde comer", icon: "utensils", text: "Opções práticas e o orçamento de alimentação" },
    { id: "contatos", label: "Contatos e emergência", icon: "shield", text: "911, contato no Brasil e o que fazer se perder algo" },
    { id: "ajustes", label: "Ajustes e backup", icon: "sliders", text: "Salvar, restaurar, instalar no iPhone" }
  ];
  const FOOD_ICON = { pancake: "coffee", chicken: "utensils", burger: "utensils", fries: "utensils", shake: "coffee", cart: "cart" };
  const PRI = { e: ["Essencial", "chip--e"], i: ["Importante", "chip--i"], o: ["Opcional", "chip--o"] };
  const PRI_ORDER = { e: 0, i: 1, o: 2 };

  /* ---------- utilitários de tela ---------- */
  let recent = new Set(); // itens marcados nesta tela: ficam visíveis até sair dela
  const catOf = id => FT.CATS.find(c => c.id === id);
  const isDone = it => !!S().checks[it.id];
  const isLate = it => !isDone(it) && !!it.due && it.due < today();

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function dialog(o) {
    return new Promise(resolve => {
      const d = $("#dialog");
      const extra = (o.extra || []).map(x => `<button class="btn${x.danger ? " btn--danger" : ""}" type="submit" value="${esc(x.value)}" formnovalidate>${esc(x.label)}</button>`).join("");
      d.innerHTML = `<form method="dialog"><div class="dialog__body"><h2 class="dialog__title">${esc(o.title)}</h2>${o.text ? `<p class="dialog__text">${esc(o.text)}</p>` : ""}${o.html || ""}</div>
        <div class="dialog__foot">${o.cancel === null ? "" : `<button class="btn" type="button" data-close="cancel">${esc(o.cancel || "Cancelar")}</button>`}${extra}<button class="btn ${o.danger ? "btn--danger" : "btn--primary"}" type="submit" value="ok">${esc(o.ok || "Confirmar")}</button></div></form>`;
      const form = d.querySelector("form");
      d.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => d.close("cancel")));
      d.addEventListener("close", function onClose() {
        d.removeEventListener("close", onClose);
        resolve({ value: d.returnValue || "cancel", form: new FormData(form) });
      });
      d.returnValue = "";
      if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    });
  }

  /* ---------- previsão do tempo ---------- */
  const wx = { map: null, started: false };
  function wxLabel(code) { return code >= 51 ? ["rain", "chuva"] : code >= 3 ? ["sun", "nublado"] : ["sun", "sol"]; }
  function wxHTML(date) {
    const w = wx.map && wx.map[date];
    if (!w) {
      const from = FT.u.addDays(date, -15);
      return today() < from ? `<span class="small muted">Previsão a partir de ${short(from)}</span>` : "";
    }
    const [ic, txt] = wxLabel(w.code);
    return `<span class="wx">${icon(ic)} ${Math.round(w.max)}°/${Math.round(w.min)}°C · ${txt}${w.pop != null ? ", chuva " + Math.round(w.pop) + "%" : ""}</span>`;
  }
  async function loadWeather() {
    if (wx.started) return; wx.started = true;
    try { const c = JSON.parse(FT.ls.get(FT.KEYS.weather) || "null"); if (c && c.map) wx.map = c.map; } catch (e) { /* sem cache */ }
    if (diffDays(today(), FT.TRIP.start) > 15 || today() > FT.TRIP.end) return;
    const w = FT.TRIP.weather;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=16`, { signal: ctrl.signal });
      const j = await r.json(); const map = {};
      (j.daily.time || []).forEach((d, i) => { map[d] = { code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], pop: j.daily.precipitation_probability_max[i] }; });
      wx.map = Object.assign({}, wx.map, map);
      FT.ls.set(FT.KEYS.weather, JSON.stringify({ map: wx.map }));
      if (/^#\/roteiro\/\d+/.test(location.hash)) render({ keepScroll: true });
    } catch (e) { /* offline: segue sem previsão */ } finally { clearTimeout(t); }
  }

  /* ---------- checklist: peças ---------- */
  function stats() {
    const items = store.items();
    const t = today();
    let done = 0, eTotal = 0, eDone = 0, late = 0, next = "";
    for (const it of items) {
      const d = isDone(it);
      if (d) done++;
      if (it.pri === "e") { eTotal++; if (d) eDone++; }
      if (!d && it.due) { if (it.due < t) late++; else if (!next || it.due < next) next = it.due; }
    }
    return { total: items.length, done, eTotal, eDone, late, next, pending: items.length - done };
  }

  function dueChip(it) {
    if (isDone(it)) return "";
    if (isLate(it)) return `<span class="chip chip--late">${icon("alert")} Atrasado, era até ${short(it.due)}</span>`;
    if (it.day >= 4 && it.day <= 12) return `<span class="chip">${icon("calendar")} Dia ${short(it.due)}</span>`;
    if (it.day === 13) return `<span class="chip">${icon("calendar")} Depois da viagem${it.due ? ", até " + short(it.due) : ""}</span>`;
    if (it.due) {
      const n = diffDays(today(), it.due);
      return `<span class="chip">${icon("clock")} Até ${short(it.due)}${n >= 0 && n <= 30 ? (n === 0 ? ", hoje" : ", em " + n + (n === 1 ? " dia" : " dias")) : ""}</span>`;
    }
    return "";
  }

  function itemHTML(it, showCat) {
    const done = isDone(it), open = !!S().ui.exp[it.id];
    const [priTxt, priCls] = PRI[it.pri] || PRI.i;
    const link = it.link && safeUrl(it.link[1]) ? `<a href="${esc(safeUrl(it.link[1]))}" target="_blank" rel="noopener noreferrer">${esc(it.link[0])} ${icon("external")}</a>` : "";
    const del = it.custom ? `<button type="button" data-act="del-custom" data-id="${esc(it.id)}">${icon("trash")} Remover</button>` : "";
    const cat = showCat ? catOf(it.cat) : null;
    return `<li class="item${done ? " item--done" : ""}">
      <label class="check"><input type="checkbox" data-act="toggle-check" data-id="${esc(it.id)}"${done ? " checked" : ""} aria-label="Concluído: ${esc(it.title)}"><span class="check__box">${icon("check")}</span></label>
      <div class="item__main">
        <button type="button" class="item__toggle" data-act="item-detail" data-id="${esc(it.id)}" aria-expanded="${open}"><span class="item__title">${esc(it.title)}</span></button>
        <div class="item__meta"><span class="chip ${priCls}">${priTxt}</span>${dueChip(it)}${cat ? `<span class="chip chip--plain">${esc(cat.short)}</span>` : ""}${it.ai ? '<span class="chip chip--plain">Sugerido pela IA</span>' : it.custom ? '<span class="chip chip--plain">Seu item</span>' : ""}</div>
        ${open ? `${it.detail ? `<div class="item__detail">${esc(it.detail)}</div>` : ""}${link || del ? `<div class="item__links">${link}${del}</div>` : ""}` : ""}
      </div></li>`;
  }

  const sortItems = (a, b) => (a.due || "9").localeCompare(b.due || "9") || PRI_ORDER[a.pri] - PRI_ORDER[b.pri] || a.title.localeCompare(b.title, "pt-BR");

  function passes(it) {
    const ui = S().ui, d = isDone(it), keep = recent.has(it.id);
    if (ui.pri === "e" && it.pri !== "e") return false;
    if (ui.status === "pend" && d && !keep) return false;
    if (ui.status === "done" && !d && !keep) return false;
    return true;
  }

  function bucket(it) {
    const t = today();
    if (it.day === 13) return [900, "Depois da viagem"];
    if (it.day >= 4 && it.day <= 12) {
      const dd = FT.DAYS_DEFAULT[it.day - 4];
      return [100 + it.day, `Durante a viagem, dia ${it.day} (${dd.title})`];
    }
    if (!it.due) return [50, "Sem prazo fixo"];
    const n = diffDays(t, it.due);
    if (n < 0) return isDone(it) ? [5, "Prazo já passou (concluídos)"] : [0, "Atrasados"];
    if (n <= 7) return [1, "Nos próximos 7 dias"];
    if (n <= 30) return [2, "Nos próximos 30 dias"];
    return [3, "Mais adiante"];
  }

  function checklistBody() {
    const ui = S().ui, items = store.items().filter(passes);
    if (!items.length) {
      return `<div class="sheet empty">${ui.status === "pend" ? "Nada pendente com esses filtros. Bom trabalho." : "Nenhum item com esses filtros."}</div>`;
    }
    if (ui.view === "prazo") {
      const groups = new Map();
      for (const it of items) { const [k, label] = bucket(it); if (!groups.has(k)) groups.set(k, { label, list: [] }); groups.get(k).list.push(it); }
      return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, g]) => `
        <h3 class="group-title${k === 0 ? " group-title--late" : ""}">${k === 0 ? icon("alert") : ""}${esc(g.label)} <span class="chip chip--plain">${g.list.length}</span></h3>
        <div class="sheet" style="padding:0 16px"><ul>${g.list.sort(sortItems).map(it => itemHTML(it, true)).join("")}</ul></div>`).join("");
    }
    const open = ui.open || { docs: true };
    return FT.CATS.map(c => {
      const all = store.items().filter(i => i.cat === c.id);
      const list = items.filter(i => i.cat === c.id).sort(sortItems);
      const done = all.filter(isDone).length;
      if (!list.length && ui.status !== "all") return "";
      const isOpen = !!open[c.id];
      const pct = all.length ? Math.round(done / all.length * 100) : 0;
      return `<section class="sheet cat">
        <h3><button type="button" class="cat__head" data-act="cat-toggle" data-id="${c.id}" aria-expanded="${isOpen}" aria-controls="cat-${c.id}">
          <span class="cat__icon">${icon(c.icon)}</span>
          <span class="cat__titles"><span class="cat__name">${esc(c.name)}</span><span class="cat__intro">${esc(c.intro)}</span></span>
          <span class="cat__count${done === all.length && all.length ? " cat__count--done" : ""}">${done}/${all.length}</span>${icon("chev-d", "cat__chev")}
        </button></h3>
        <div class="cat__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="cat__body" id="cat-${c.id}"${isOpen ? "" : " hidden"}>
          <ul>${list.map(i => itemHTML(i, false)).join("") || '<li class="empty small">Nada neste filtro.</li>'}</ul>
          <details class="addrow"><summary>${icon("plus")} Adicionar item nesta categoria</summary>
            <form data-form="add-item" data-cat="${c.id}">
              <label class="label" for="ai-t-${c.id}">O que precisa fazer?</label>
              <input class="field" id="ai-t-${c.id}" name="title" maxlength="140" required>
              <div class="two"><div><label class="label" for="ai-p-${c.id}">Prioridade</label><select class="field" id="ai-p-${c.id}" name="pri"><option value="e">Essencial</option><option value="i" selected>Importante</option><option value="o">Opcional</option></select></div>
              <div><label class="label" for="ai-d-${c.id}">Prazo (opcional)</label><input class="field" id="ai-d-${c.id}" name="due" type="date"></div></div>
              <div style="margin-top:12px"><button class="btn btn--primary" type="submit">Adicionar</button></div>
            </form></details>
        </div></section>`;
    }).join("");
  }

  function viewChecklist() {
    const st = stats(), ui = S().ui, items = store.items();
    const segs = FT.CATS.map(c => {
      const all = items.filter(i => i.cat === c.id); const d = all.filter(isDone).length;
      return `<span class="segbar__seg" title="${esc(c.short)}"><span style="width:${all.length ? d / all.length * 100 : 0}%"></span></span>`;
    }).join("");
    const f = (k, v, label) => `<button type="button" class="filter-chip" data-act="filter" data-k="${k}" data-v="${v}" aria-pressed="${ui[k] === v}">${label}</button>`;
    return `
      <header class="page-head">
        <h1 class="h-page">Checklist</h1>
        <p class="lede">${st.total} itens em 12 áreas, com prazo e prioridade. Toque no item para ver o passo a passo.</p>
      </header>
      <section class="sheet sheet--pad cl__summary" aria-label="Progresso">
        <div class="cl__numbers"><div class="cl__big">${st.done}<small>de ${st.total} concluídos</small></div>
          <div class="chips"><span class="chip chip--e">${st.eDone}/${st.eTotal} essenciais</span>${st.late ? `<button type="button" class="chip chip--late" data-act="goto-late">${icon("alert")} ${st.late} ${st.late === 1 ? "atrasado" : "atrasados"}</button>` : `<span class="chip chip--ok">${icon("check")} Nada atrasado</span>`}</div></div>
        <div class="segbar" aria-hidden="true">${segs}</div>
        ${st.next ? `<p class="small muted">Próximo prazo: ${short(st.next)}${diffDays(today(), st.next) >= 0 ? ` (${diffDays(today(), st.next) === 0 ? "hoje" : "em " + diffDays(today(), st.next) + " dias"})` : ""}.</p>` : ""}
      </section>
      <div class="cl__controls">
        <div class="segmented" role="group" aria-label="Organizar por"><button type="button" data-act="view-mode" data-v="cat" aria-pressed="${ui.view === "cat"}">Por área</button><button type="button" data-act="view-mode" data-v="prazo" aria-pressed="${ui.view === "prazo"}">Por prazo</button></div>
        <div class="filters" role="group" aria-label="Filtros">${f("status", "pend", "Pendentes")}${f("status", "done", "Concluídos")}${f("status", "all", "Todos")}<button type="button" class="filter-chip" data-act="filter" data-k="pri" data-v="${ui.pri === "e" ? "all" : "e"}" aria-pressed="${ui.pri === "e"}">Só essenciais</button></div>
      </div>
      ${checklistBody()}`;
  }

  /* ---------- início ---------- */
  function dayRow(i, opts) {
    const d = store.days()[i], date = FT.u.dayDate(Number(d.date));
    const t = today();
    return `<a class="day-row${date === t ? " day-row--today" : ""}" style="--leg-color:var(--leg-${esc(d.leg)})" href="#/roteiro/${Number(d.date)}">
      <span class="day-row__date"><span class="day-row__num">${esc(d.date)}</span><span class="day-row__dow">${esc(FT.u.weekdayShort(date))}</span></span>
      <span><span class="day-row__title">${esc(d.title)}</span><span class="day-row__where" style="display:block">${esc(d.where)}</span>
      <span class="day-row__tags">${(d.tags || []).map(x => `<span class="chip chip--plain">${esc(x)}</span>`).join("")}${opts && opts.today ? '<span class="chip chip--ok">Hoje</span>' : ""}</span></span>
      ${icon("chev-r", "i-chev")}</a>`;
  }

  function viewHome() {
    const T = FT.TRIP, t = today(), st = stats();
    const toStart = diffDays(t, T.start), inTrip = t >= T.start && t <= T.end;
    let count, label;
    if (toStart > 0) { count = toStart; label = toStart === 1 ? "dia para o embarque" : "dias para o embarque"; }
    else if (inTrip) { count = "Dia " + (diffDays(T.start, t) + 1); label = "de 9 da viagem"; }
    else { count = "Fim"; label = "viagem concluída"; }
    const stubNote = st.late ? `${st.late} ${st.late === 1 ? "item atrasado" : "itens atrasados"}` : `${st.eTotal - st.eDone} essenciais pendentes`;

    let upcoming = store.items().filter(i => !isDone(i) && (isLate(i) || i.pri === "e" || (i.due && diffDays(t, i.due) <= 45)))
      .filter(i => !(i.day >= 4 && i.day <= 13 && diffDays(t, i.due || T.start) > 14));
    upcoming = upcoming.sort((a, b) => (isLate(b) - isLate(a)) || sortItems(a, b)).slice(0, 5);

    const spent = S().expenses.reduce((a, e) => a + e.amount, 0), left = S().budget - spent;
    const pctSpent = Math.min(100, spent / S().budget * 100);
    const res = FT.RESERVAS.filter(r => (S().reservas[r.id] || {}).status && S().reservas[r.id].status !== "Pendente").length;

    let dayBlock = "";
    if (inTrip) { const i = diffDays(T.start, t); dayBlock = `<section class="section"><div class="section__head"><h2 class="h-section">Hoje</h2></div>${dayRow(i, { today: true })}</section>`; }
    else if (toStart > 0) dayBlock = `<section class="section"><div class="section__head"><h2 class="h-section">Primeiro dia</h2><a class="btn btn--quiet btn--sm" href="#/roteiro">Ver roteiro ${icon("chev-r")}</a></div>${dayRow(0)}</section>`;

    return `
      <section class="pass" aria-label="Resumo da viagem">
        <div class="pass__main">
          <div class="pass__kicker">Flórida · 4 a 12 de dezembro de 2026 · ${T.travelers} viajantes</div>
          <div class="pass__route">
            <div class="pass__stop"><span class="pass__code">${T.arrive.code}</span><span class="pass__city">${T.arrive.city}</span><span class="pass__when">sex, 04/12 · 06h30</span></div>
            <div class="pass__line">${icon("plane", "pass__plane")}</div>
            <div class="pass__stop pass__stop--end"><span class="pass__code">${T.depart.code}</span><span class="pass__city">${T.depart.city}</span><span class="pass__when">sáb, 12/12 · 18h15</span></div>
          </div>
          <dl class="pass__fields"><div><dt>Noites</dt><dd>8</dd></div><div><dt>Hotéis</dt><dd>2</dd></div><div><dt>Parques</dt><dd>4 dias</dd></div><div><dt>Orçamento</dt><dd>${money(S().budget)}</dd></div></dl>
        </div>
        <a class="pass__stub" href="#/checklist"><div><div class="pass__count">${count}</div><div class="pass__count-label">${label}</div></div><div class="pass__stub-note"><strong>${stubNote}</strong>Abrir o checklist</div></a>
      </section>
      ${dayBlock}
      <section class="section">
        <div class="section__head"><h2 class="h-section">Para fazer agora</h2><a class="btn btn--quiet btn--sm" href="#/checklist">Checklist completo ${icon("chev-r")}</a></div>
        ${upcoming.length ? `<div class="sheet" style="padding:0 16px"><ul>${upcoming.map(i => itemHTML(i, true)).join("")}</ul></div>` : `<div class="sheet empty">Tudo em dia por enquanto.</div>`}
      </section>
      <div class="glance">
        <section class="section"><div class="section__head"><h2 class="h-section">Preparação</h2></div>
          <div class="meter" role="img" aria-label="${st.done} de ${st.total} itens concluídos"><span class="meter__fill" style="width:${st.total ? st.done / st.total * 100 : 0}%"></span></div>
          <dl style="margin-top:8px"><div class="stat"><dt>Itens concluídos</dt><dd>${st.done} de ${st.total}</dd></div><div class="stat"><dt>Essenciais concluídos</dt><dd>${st.eDone} de ${st.eTotal}</dd></div><div class="stat"><dt>Atrasados</dt><dd>${st.late}</dd></div><div class="stat"><dt>Reservas confirmadas</dt><dd><a href="#/reservas">${res} de ${FT.RESERVAS.length}</a></dd></div></dl>
        </section>
        <section class="section"><div class="section__head"><h2 class="h-section">Dinheiro</h2><a class="btn btn--quiet btn--sm" href="#/orcamento">Orçamento ${icon("chev-r")}</a></div>
          <div class="bignum">${money(left)}</div><div class="small muted" style="margin:4px 0 10px">restante de ${money(S().budget)}</div>
          <div class="meter" role="img" aria-label="${Math.round(pctSpent)}% do orçamento gasto"><span class="meter__fill${pctSpent > 100 ? " meter__fill--over" : pctSpent > 85 ? " meter__fill--warn" : ""}" style="width:${pctSpent}%"></span></div>
        </section>
      </div>
      <section class="section"><a class="menu__item" href="#/concierge"><span class="menu__icon">${icon("bell")}</span><span><span class="menu__title">Concierge</span><span class="menu__text">Pergunte algo ou peça uma mudança no roteiro</span></span>${icon("chev-r", "i-chev")}</a></section>`;
  }

  /* ---------- roteiro ---------- */
  function viewRoteiro() {
    const days = store.days();
    const legs = Object.keys(FT.LEGS).map(k => {
      const idx = days.map((d, i) => d.leg === k ? i : -1).filter(i => i >= 0);
      return idx.length ? `<section class="leg" style="--leg-color:var(--leg-${k})"><h2 class="leg__title"><span class="leg__dot"></span>${esc(FT.LEGS[k].name)}</h2>${idx.map(i => dayRow(i)).join("")}</section>` : "";
    }).join("");
    return `
      <header class="page-head"><h1 class="h-page">Roteiro</h1>
        <p class="lede">Nove dias de Miami a Orlando. Abra um dia para ver a programação hora a hora.</p></header>
      ${S().days ? `<div class="callout callout--info" style="margin-bottom:20px">${icon("info")}<div><strong>Roteiro personalizado</strong>Este roteiro foi alterado pelo concierge. Você pode restaurar o original em <a href="#/ajustes">Ajustes</a>.</div></div>` : ""}
      ${legs}
      <div class="callout" style="margin-top:28px">${icon("alert")}<div><strong>Confirme perto da data</strong>Horários de parques, shows, abertura de lojas e trânsito mudam. Este roteiro é uma base, não uma reserva.</div></div>`;
  }

  function viewDay(n) {
    const days = store.days(), plans = store.plans();
    const i = Number(n) - 4;
    if (!(i >= 0 && i < days.length)) return notFound();
    const d = days[i], p = plans[i], date = FT.u.dayDate(Number(d.date));
    const reminders = store.items().filter(it => it.day === Number(d.date) && !(isDone(it) && !recent.has(it.id)));
    const prev = i > 0 ? `<a class="btn btn--quiet btn--icon" href="#/roteiro/${Number(days[i - 1].date)}" aria-label="Dia anterior">${icon("chev-l")}</a>` : "";
    const next = i < days.length - 1 ? `<a class="btn btn--quiet btn--icon" href="#/roteiro/${Number(days[i + 1].date)}" aria-label="Próximo dia">${icon("chev-r")}</a>` : "";
    return `
      <div class="daynav"><a class="back" href="#/roteiro">${icon("chev-l")} Roteiro</a><div class="daynav__steps">${prev}${next}</div></div>
      <header class="dayhero" style="--leg-color:var(--leg-${esc(d.leg)})">
        <div class="dayhero__date">${esc(FT.u.weekday(date))}, ${esc(FT.u.dateLong(date))} · dia ${i + 1} de ${days.length}</div>
        <h1 class="dayhero__title">${esc(d.title)}</h1>
        <div class="dayhero__where">${icon("pin")}<span>${esc(d.where)}</span></div>
        <p class="dayhero__desc">${esc(d.desc)}</p>
        <div class="chips" style="margin-top:12px">${(d.tags || []).map(x => `<span class="chip chip--plain">${esc(x)}</span>`).join("")}${wxHTML(date)}</div>
      </header>
      ${d.tip ? `<div class="callout callout--info">${icon("info")}<div><strong>Dica do dia</strong>${esc(d.tip)}</div></div>` : ""}
      <section class="section"><div class="section__head"><h2 class="h-section">Programação</h2></div>
        <ol class="tl">${p.schedule.map(b => `<li class="tl__item"><div class="tl__time">${esc(b[0])}</div><div class="tl__body"><div class="tl__title">${esc(b[1])}</div>${b[2] ? `<p class="tl__desc">${esc(b[2])}</p>` : ""}${b[3] ? `<a class="tl__place" href="${esc(mapsUrl(b[3]))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Abrir no mapa</a>` : ""}</div></li>`).join("")}</ol></section>
      ${reminders.length ? `<section class="section"><div class="section__head"><h2 class="h-section">Não esqueça neste dia</h2></div><div class="sheet" style="padding:0 16px"><ul>${reminders.map(it => itemHTML(it, true)).join("")}</ul></div></section>` : ""}
      ${p.alternatives && p.alternatives.length ? `<section class="section"><div class="section__head"><h2 class="h-section">Planos B e detalhes</h2></div>${p.alternatives.map(a => `<details class="alt"><summary>${esc(a[0])}${icon("chev-d")}</summary><p>${esc(a[1])}</p></details>`).join("")}</section>` : ""}
      <section class="section"><button class="btn" type="button" data-act="ask-day" data-day="${Number(d.date)}">${icon("bell")} Pedir ajuste deste dia ao concierge</button></section>`;
  }

  /* ---------- mais e subpáginas ---------- */
  function backTo(label) { return `<a class="back" href="#/mais">${icon("chev-l")} ${label || "Mais"}</a>`; }

  function viewMais() {
    return `<header class="page-head"><h1 class="h-page">Mais</h1><p class="lede">Reservas, dinheiro, compras e o que fazer se algo der errado.</p></header>
      <nav class="menu" aria-label="Mais seções">${MORE.map(m => `<a class="menu__item" href="#/${m.id}"><span class="menu__icon">${icon(m.icon)}</span><span><span class="menu__title">${esc(m.label)}</span><span class="menu__text">${esc(m.text)}</span></span>${icon("chev-r", "i-chev")}</a>`).join("")}</nav>`;
  }

  function viewReservas() {
    const R = S().reservas;
    const ok = FT.RESERVAS.filter(r => R[r.id] && R[r.id].status !== "Pendente").length;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Reservas</h1><p class="lede">Guarde aqui o código e a situação de cada reserva. Tudo fica só neste aparelho.</p></header>
      <div class="sheet sheet--pad" style="margin-bottom:20px"><div class="row row--between"><strong>${ok} de ${FT.RESERVAS.length} confirmadas</strong></div><div class="meter" style="margin-top:10px"><span class="meter__fill" style="width:${ok / FT.RESERVAS.length * 100}%"></span></div></div>
      ${FT.RESERVAS.map(r => {
        const v = R[r.id] || { status: "Pendente", note: "" }; const done = v.status !== "Pendente";
        return `<article class="voucher${done ? " voucher--ok" : ""}">
          <div class="voucher__main"><span class="voucher__icon">${icon(r.icon)}</span><div><div class="voucher__title">${esc(r.title)}</div><div class="voucher__when">${esc(r.when)}</div></div><span class="chip ${done ? "chip--ok" : "chip--plain"}">${esc(v.status)}</span></div>
          <div class="voucher__stub"><div class="status" role="group" aria-label="Situação: ${esc(r.title)}">${FT.RESERVA_STATUS.map(s => `<button type="button" data-act="res-status" data-id="${r.id}" data-v="${s}" aria-pressed="${v.status === s}">${s}</button>`).join("")}</div>
          <label class="label" for="rn-${r.id}">Código e detalhes</label><input class="field" id="rn-${r.id}" data-act="res-note" data-id="${r.id}" value="${esc(v.note)}" placeholder="${esc(r.hint)}" maxlength="300" autocomplete="off"></div></article>`;
      }).join("")}`;
  }

  function spentBy(cat) { return S().expenses.filter(e => e.category === cat).reduce((a, e) => a + e.amount, 0); }

  function viewOrcamento() {
    const st = S(), spent = st.expenses.reduce((a, e) => a + e.amount, 0), left = st.budget - spent;
    const pct = spent / st.budget * 100, goals = FT.EXPENSE_CATS.reduce((a, c) => a + st.catBudgets[c], 0);
    const cls = p => p > 100 ? " meter__fill--over" : p > 85 ? " meter__fill--warn" : "";
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Orçamento</h1><p class="lede">Registre cada gasto e veja o que sobra. Valores em dólares.</p></header>
      <section class="sheet sheet--pad">
        <div class="bignum">${money(left)}</div><div class="small muted" style="margin:4px 0 12px">${left < 0 ? "acima do orçamento" : "restante"} de ${money(st.budget)}</div>
        <div class="meter" role="img" aria-label="${Math.round(pct)}% gasto"><span class="meter__fill${cls(pct)}" style="width:${Math.min(100, pct)}%"></span></div>
        <dl style="margin-top:10px"><div class="stat"><dt>Gasto até agora</dt><dd>${money(spent)}</dd></div><div class="stat"><dt>Gasto por dia de viagem (média)</dt><dd>${money(spent / 9)}</dd></div></dl>
        <label class="label" for="totalBudget">Orçamento total (US$)</label><input class="field" id="totalBudget" data-act="total-budget" inputmode="decimal" value="${st.budget}">
      </section>
      <section class="section"><div class="section__head"><h2 class="h-section">Por categoria</h2></div>
        <div class="sheet sheet--pad"><div class="cat-row cat-row--head"><span>Categoria</span><span style="text-align:right">Meta (US$)</span><span style="text-align:right">Gasto</span></div>
        ${FT.EXPENSE_CATS.map(c => { const sp = spentBy(c), g = st.catBudgets[c], p = g ? sp / g * 100 : (sp ? 101 : 0);
          return `<div class="cat-row"><label for="cb-${esc(c)}">${esc(c)}</label><input class="field" id="cb-${esc(c)}" data-act="cat-budget" data-cat="${esc(c)}" inputmode="decimal" value="${g}"><span class="cat-row__spent">${money(sp)}</span><div class="meter cat-row__bar"><span class="meter__fill${cls(p)}" style="width:${Math.min(100, p)}%"></span></div></div>`; }).join("")}
        </div>
        <p class="hint">As metas somam ${money(goals)}${Math.round(goals) !== Math.round(st.budget) ? `, diferente do total de ${money(st.budget)}` : ""}. São sugestões: ajuste como preferir.</p></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Registrar gasto</h2></div>
        <form class="sheet sheet--pad" data-form="expense">
          <label class="label" for="exName" style="margin-top:0">Descrição</label><input class="field" id="exName" name="name" maxlength="80" required placeholder="Ex.: Almoço no Denny’s">
          <div class="two"><div><label class="label" for="exAmt">Valor (US$)</label><input class="field" id="exAmt" name="amount" inputmode="decimal" required placeholder="0,00"></div>
          <div><label class="label" for="exCat">Categoria</label><select class="field" id="exCat" name="category">${FT.EXPENSE_CATS.map(c => `<option>${esc(c)}</option>`).join("")}</select></div></div>
          <div style="margin-top:14px"><button class="btn btn--primary" type="submit">${icon("plus")} Registrar</button></div></form></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Gastos registrados</h2></div>
        ${st.expenses.length ? `<div class="sheet" style="padding:0 16px">${st.expenses.slice().reverse().map(e => `<div class="expense"><div><div class="expense__name">${esc(e.name)}</div><div class="small muted">${esc(e.category)}${e.date ? " · " + short(e.date) : ""}</div></div><div class="row"><span class="expense__amount">${money(e.amount)}</span><button class="btn btn--quiet btn--icon btn--danger" type="button" data-act="del-expense" data-id="${esc(e.id)}" aria-label="Remover ${esc(e.name)}">${icon("trash")}</button></div></div>`).join("")}</div>` : `<div class="sheet empty">Nenhum gasto ainda. Registre o primeiro acima.</div>`}</section>`;
  }

  function viewCompras() {
    const st = S(), T = FT.TRIP;
    const auto = FT.CUSTOMS_CATS.reduce((a, c) => a + spentBy(c), 0) / T.travelers;
    const a = st.customs.a != null ? st.customs.a : auto, b = st.customs.b != null ? st.customs.b : auto;
    const exA = Math.max(0, a - T.quota), exB = Math.max(0, b - T.quota), tax = (exA + exB) * T.customsRate;
    const receita = FT.CHECKLIST.map(i => i.link).find(l => l && /receita/i.test(l[1]));
    const left = st.shopping.filter(x => !x.done).length;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Compras e alfândega</h1><p class="lede">O que comprar, onde, e quanto pode custar de imposto na volta.</p></header>
      <section><div class="section__head"><h2 class="h-section">Lista de compras</h2><span class="small muted">${left} por comprar</span></div>
        <div class="sheet" style="padding:0 16px">${st.shopping.length ? st.shopping.map(x => `<div class="shop-item${x.done ? " shop-item--done" : ""}"><label class="check"><input type="checkbox" data-act="toggle-shop" data-id="${esc(x.id)}"${x.done ? " checked" : ""} aria-label="Comprado: ${esc(x.name)}"><span class="check__box">${icon("check")}</span></label><span class="shop-item__name">${esc(x.name)}</span><button class="btn btn--quiet btn--icon btn--danger" type="button" data-act="del-shop" data-id="${esc(x.id)}" aria-label="Remover ${esc(x.name)}">${icon("trash")}</button></div>`).join("") : '<div class="empty">Lista vazia.</div>'}</div>
        <form class="row" data-form="shop" style="margin-top:12px"><label class="sr" for="shopName">Novo item</label><input class="field" id="shopName" name="name" maxlength="80" placeholder="Adicionar item" required><button class="btn btn--primary" type="submit">Adicionar</button></form></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Outlets no roteiro</h2></div>
        <div class="sheet" style="padding:0 16px">${FT.OUTLETS.map(o => `<div class="place"><span class="place__icon">${icon("bag")}</span><div><div class="place__name">${esc(o.name)} <span class="chip chip--plain">${esc(o.day)}</span></div><p class="place__note">${esc(o.note)}</p><div class="place__links"><a href="${esc(mapsUrl(o.q))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Abrir no mapa</a></div></div></div>`).join("")}</div></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Estratégia</h2></div><ol class="steps">${FT.ESTRATEGIA_COMPRAS.map(s => `<li><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></li>`).join("")}</ol></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Simulador do imposto na volta</h2></div>
        <div class="callout callout--info">${icon("info")}<div><strong>Estimativa, não é cálculo oficial</strong>A cota é de ${money(T.quota)} por pessoa em compras no exterior (viagem aérea). O que passar disso paga cerca de ${Math.round(T.customsRate * 100)}% de imposto. Confirme as regras vigentes na Receita Federal e declare na e-DBV.${receita && safeUrl(receita[1]) ? ` <a href="${esc(safeUrl(receita[1]))}" target="_blank" rel="noopener noreferrer">${esc(receita[0])}</a>` : ""}</div></div>
        <div class="sheet sheet--pad" style="margin-top:12px"><div class="two"><div><label class="label" for="custA" style="margin-top:0">Pessoa 1, total em compras (US$)</label><input class="field" id="custA" data-act="cust" data-k="a" inputmode="decimal" value="${st.customs.a != null ? st.customs.a : ""}" placeholder="${Math.round(auto)}"></div>
        <div><label class="label" for="custB" style="margin-top:0">Pessoa 2, total em compras (US$)</label><input class="field" id="custB" data-act="cust" data-k="b" inputmode="decimal" value="${st.customs.b != null ? st.customs.b : ""}" placeholder="${Math.round(auto)}"></div></div>
        <p class="hint">Em branco, usa metade dos gastos registrados em ${FT.CUSTOMS_CATS.join(" e ")}.</p>
        <div class="sim__result"><div class="stat"><dt>Excedente da pessoa 1</dt><dd>${money(exA)}</dd></div><div class="stat"><dt>Excedente da pessoa 2</dt><dd>${money(exB)}</dd></div>
        <div class="sim__total"><span>Imposto estimado</span><strong>${money(tax)}</strong></div></div></div></section>`;
  }

  function viewComida() {
    const days = 9, goal = FT.TRIP.foodPerDay * days, sp = spentBy("Alimentação"), p = sp / goal * 100;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Onde comer</h1><p class="lede">Opções práticas para o dia a dia. Confirme horário e unidade antes de ir.</p></header>
      <section class="sheet sheet--pad"><div class="row row--between"><strong>Alimentação</strong><span class="small muted">meta de ${money(FT.TRIP.foodPerDay)} por dia</span></div>
        <div class="bignum" style="margin-top:8px">${money(sp)}</div><div class="small muted" style="margin:4px 0 10px">de ${money(goal)} em ${days} dias</div>
        <div class="meter"><span class="meter__fill${p > 100 ? " meter__fill--over" : p > 85 ? " meter__fill--warn" : ""}" style="width:${Math.min(100, p)}%"></span></div></section>
      <section class="section"><div class="sheet" style="padding:0 16px">${FT.COMIDA.map(c => `<div class="place"><span class="place__icon">${icon(FOOD_ICON[c.icon] || "utensils")}</span><div><div class="place__name">${esc(c.name)} <span class="chip chip--plain">${esc(c.kind)}</span></div><p class="place__note">${esc(c.note)}</p><div class="place__links"><a href="${esc(mapsUrl(c.q))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Procurar perto de mim</a></div></div></div>`).join("")}</div></section>`;
  }

  function viewContatos() {
    const c = S().contacts, seg = (S().reservas.seguro || {}).note;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Contatos e emergência</h1><p class="lede">Deixe aqui o que você precisaria achar rápido, com pressa e sem sinal bom.</p></header>
      <section class="sheet" style="padding:4px 16px">
        <div class="contact"><div><strong>Emergência nos EUA</strong><div class="small muted">Polícia, bombeiros e ambulância</div></div><a href="tel:911">911</a></div>
        <div class="contact"><div><strong>Seguro-viagem</strong><div class="small muted">${seg ? esc(seg) : "Preencha em Reservas: apólice e telefone 24 horas"}</div></div><a href="#/reservas">Abrir</a></div>
        <div class="contact"><div><strong>${c.name ? esc(c.name) : "Contato no Brasil"}</strong><div class="small muted">${c.phone ? esc(c.phone) : "Alguém que saiba onde vocês estão"}</div></div>${c.phone ? `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">Ligar</a>` : ""}</div></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Contato no Brasil</h2></div>
        <form class="sheet sheet--pad" data-form="contact"><label class="label" for="ctName" style="margin-top:0">Nome</label><input class="field" id="ctName" name="name" maxlength="60" value="${esc(c.name)}">
        <label class="label" for="ctPhone">Telefone com DDI</label><input class="field" id="ctPhone" name="phone" type="tel" maxlength="30" value="${esc(c.phone)}" placeholder="+55 11 90000-0000"><div style="margin-top:14px"><button class="btn btn--primary" type="submit">Salvar</button></div></form></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Se perder algo</h2></div>
        <ol class="steps"><li><strong>Cartão perdido ou clonado</strong><span>Bloqueie pelo app do banco ou pelo telefone do verso do cartão e peça outro. Anote o protocolo.</span></li>
        <li><strong>Passaporte perdido ou roubado</strong><span>Faça um boletim na polícia local e procure o consulado brasileiro mais próximo para o documento de viagem.</span></li>
        <li><strong>Celular perdido</strong><span>Use Buscar iPhone em outro aparelho, bloqueie a linha e troque as senhas de e-mail e bancos.</span></li>
        <li><strong>Problema com o carro</strong><span>Ligue para a locadora antes de qualquer conserto e guarde fotos e recibos.</span></li></ol></section>`;
  }

  function viewAjustes() {
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Ajustes e backup</h1><p class="lede">Seus dados ficam só neste aparelho. Faça backup antes de trocar de celular.</p></header>
      <section><div class="section__head"><h2 class="h-section">Backup</h2></div>
        <div class="btn-row"><button class="btn" type="button" data-act="export">${icon("download")} Salvar backup</button><button class="btn" type="button" data-act="import">${icon("upload")} Restaurar backup</button></div>
        <input type="file" id="importFile" accept="application/json,.json" hidden></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Instalar no iPhone</h2></div>
        <ol class="steps"><li><strong>Abra no Safari</strong><span>O atalho só funciona por lá.</span></li><li><strong>Toque em Compartilhar</strong><span>O ícone de quadrado com seta para cima.</span></li><li><strong>Adicionar à Tela de Início</strong><span>Depois disso o guia abre em tela cheia e funciona sem internet.</span></li></ol></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Restaurar</h2></div>
        <div class="stack"><button class="btn" type="button" data-act="reset-plan">${icon("refresh")} Restaurar o roteiro original</button><button class="btn btn--danger" type="button" data-act="reset-all">${icon("trash")} Apagar todos os dados deste aparelho</button></div></section>
      <p class="small muted" style="margin-top:32px">Versão ${VERSION}. Regras, preços e prazos pesquisados em outubro de 2026: confirme sempre na fonte oficial perto da viagem.</p>`;
  }

  function notFound() {
    return `<header class="page-head"><h1 class="h-page">Página não encontrada</h1></header><p><a class="btn" href="#/inicio">Voltar ao início</a></p>`;
  }

  /* ---------- navegação ---------- */
  const ROUTES = {
    inicio: { title: "Início", tab: "inicio", fn: viewHome },
    roteiro: { title: "Roteiro", tab: "roteiro", fn: a => (a ? viewDay(a) : viewRoteiro()) },
    checklist: { title: "Checklist", tab: "checklist", fn: viewChecklist },
    concierge: { title: "Concierge", tab: "concierge", fn: () => FT.ai.view() },
    mais: { title: "Mais", tab: "mais", fn: viewMais },
    reservas: { title: "Reservas", tab: "mais", fn: viewReservas },
    orcamento: { title: "Orçamento", tab: "mais", fn: viewOrcamento },
    compras: { title: "Compras e alfândega", tab: "mais", fn: viewCompras },
    comida: { title: "Onde comer", tab: "mais", fn: viewComida },
    contatos: { title: "Contatos e emergência", tab: "mais", fn: viewContatos },
    ajustes: { title: "Ajustes e backup", tab: "mais", fn: viewAjustes }
  };

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const id = parts[0] || "inicio";
    return { id: ROUTES[id] ? id : null, arg: parts[1] || "" };
  }

  function drawNav(tab) {
    $("#tabs").innerHTML = NAV.map(n => `<a class="tab" href="#/${n.id}"${n.id === tab ? ' aria-current="page"' : ""}>${icon(n.icon)}<span>${n.label}</span></a>`).join("");
    const link = (n, cur) => `<a class="rail__link" href="#/${n.id}"${n.id === cur ? ' aria-current="page"' : ""}>${icon(n.icon)}${n.label}</a>`;
    const r = parseRoute();
    $("#railNav").innerHTML = NAV.slice(0, 4).map(n => link(n, r.id)).join("") + '<div class="rail__sep"></div>' + MORE.map(n => link(n, r.id)).join("");
    const left = diffDays(today(), FT.TRIP.start);
    $("#railFoot").textContent = left > 0 ? `Faltam ${left} ${left === 1 ? "dia" : "dias"} para a viagem.` : "Boa viagem!";
  }

  function focusKey(el) {
    if (!el || !el.dataset || !el.dataset.act && !el.name) return "";
    const d = el.dataset;
    return [el.tagName, d.act || "", d.id || "", d.cat || "", d.k || "", d.v || "", el.name || "", el.id || ""].join("|");
  }

  function render(opts) {
    opts = opts || {};
    const route = parseRoute();
    const r = route.id ? ROUTES[route.id] : null;
    const y = window.scrollY;
    const fk = opts.keepScroll ? focusKey(document.activeElement) : "";
    const view = $("#view");
    view.innerHTML = r ? r.fn(route.arg) : notFound();
    drawNav(r ? r.tab : "inicio");
    document.title = (r ? r.title : "Página não encontrada") + " · Florida";
    if (opts.keepScroll) {
      window.scrollTo(0, y);
      if (fk) { const el = [...view.querySelectorAll("[data-act],[name]")].find(e => focusKey(e) === fk); if (el) el.focus({ preventScroll: true }); }
    }
  }

  function onRoute() {
    recent = new Set();
    render();
    window.scrollTo(0, 0);
    const v = $("#view"); v.focus({ preventScroll: true });
    loadWeather();
  }

  /* ---------- ações ---------- */
  const toggleExp = id => { const e = S().ui.exp; e[id] = !e[id]; };
  const saveUI = fn => store.update(s => fn(s.ui));

  async function onAct(act, el, ev) {
    const st = S();
    if (FT.ai && await FT.ai.act(act, el, ev)) return;
    switch (act) {
      case "toggle-check": {
        const id = el.dataset.id; recent.add(id);
        store.update(s => { if (el.checked) s.checks[id] = true; else delete s.checks[id]; });
        render({ keepScroll: true }); break;
      }
      case "item-detail": toggleExp(el.dataset.id); render({ keepScroll: true }); break;
      case "del-custom": {
        const r = await dialog({ title: "Remover este item?", text: "O item sai do checklist.", ok: "Remover", danger: true });
        if (r.value === "ok") { store.update(s => { s.custom = s.custom.filter(x => x.id !== el.dataset.id); delete s.checks[el.dataset.id]; }); render({ keepScroll: true }); }
        break;
      }
      case "cat-toggle": saveUI(ui => { ui.open = Object.assign({}, ui.open || { docs: true }); ui.open[el.dataset.id] = !ui.open[el.dataset.id]; }); render({ keepScroll: true }); break;
      case "filter": recent = new Set(); saveUI(ui => { ui[el.dataset.k] = el.dataset.v; }); render({ keepScroll: true }); break;
      case "view-mode": recent = new Set(); saveUI(ui => { ui.view = el.dataset.v; }); render({ keepScroll: true }); break;
      case "goto-late": recent = new Set(); saveUI(ui => { ui.view = "prazo"; ui.status = "pend"; ui.pri = "all"; }); render(); $("#view").querySelector(".group-title--late")?.scrollIntoView({ block: "start" }); break;
      case "res-status": store.update(s => { const r = s.reservas[el.dataset.id] || { status: "Pendente", note: "" }; r.status = el.dataset.v; s.reservas[el.dataset.id] = r; }); render({ keepScroll: true }); break;
      case "del-expense": store.update(s => { s.expenses = s.expenses.filter(x => x.id !== el.dataset.id); }); toast("Gasto removido."); render({ keepScroll: true }); break;
      case "toggle-shop": store.update(s => { const x = s.shopping.find(i => i.id === el.dataset.id); if (x) x.done = el.checked; }); render({ keepScroll: true }); break;
      case "del-shop": store.update(s => { s.shopping = s.shopping.filter(x => x.id !== el.dataset.id); }); render({ keepScroll: true }); break;
      case "ask-day": FT.ai.prefill("No dia " + el.dataset.day + ", ", "edit"); location.hash = "#/concierge"; setTimeout(() => $("#aiq") && $("#aiq").focus(), 50); break;
      case "export": {
        const blob = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "florida-backup-" + today() + ".json";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast("Backup salvo. A chave da IA não é incluída."); break;
      }
      case "import": $("#importFile").click(); break;
      case "reset-plan": {
        const r = await dialog({ title: "Restaurar o roteiro original?", text: "As mudanças feitas pelo concierge no roteiro são descartadas. O checklist e os gastos ficam como estão.", ok: "Restaurar", danger: true });
        if (r.value === "ok") { store.update(s => { s.days = null; s.plans = null; s.undo = null; }); toast("Roteiro original restaurado."); render({ keepScroll: true }); }
        break;
      }
      case "reset-all": {
        const r = await dialog({ title: "Apagar todos os dados?", text: "Checklist, gastos, reservas e conversas deste aparelho serão apagados. Faça um backup antes, se quiser guardar.", ok: "Apagar tudo", danger: true });
        if (r.value === "ok") { store.reset(); recent = new Set(); toast("Dados apagados."); render(); }
        break;
      }
    }
  }

  function onChangeValue(act, el) {
    const val = el.value;
    switch (act) {
      case "total-budget": { const n = num(val); if (n > 0) { store.update(s => { s.budget = n; }); render({ keepScroll: true }); } else toast("Digite um valor maior que zero."); break; }
      case "cat-budget": { const n = num(val); if (n >= 0) { store.update(s => { s.catBudgets[el.dataset.cat] = n; }); render({ keepScroll: true }); } break; }
      case "cust": { const n = val.trim() === "" ? null : num(val); store.update(s => { s.customs[el.dataset.k] = n != null && n >= 0 ? n : null; }); render({ keepScroll: true }); break; }
      case "res-note": store.update(s => { const r = s.reservas[el.dataset.id] || { status: "Pendente", note: "" }; r.note = clamp(val, 300); s.reservas[el.dataset.id] = r; }); break;
    }
  }

  async function onSubmit(name, form) {
    if (FT.ai && await FT.ai.submit(name, form)) return;
    const d = new FormData(form);
    switch (name) {
      case "add-item": {
        const title = clamp(d.get("title"), 140); if (!title) return;
        const due = /^\d{4}-\d{2}-\d{2}$/.test(d.get("due") || "") ? d.get("due") : "";
        store.update(s => { s.custom.push({ id: "u-" + uid(), cat: form.dataset.cat, pri: ["e", "i", "o"].includes(d.get("pri")) ? d.get("pri") : "i", title, detail: "", due, day: 0, custom: true }); });
        toast("Item adicionado."); render({ keepScroll: true }); break;
      }
      case "expense": {
        const amount = num(d.get("amount")); const nm = clamp(d.get("name"), 80);
        if (!(amount > 0) || !nm) { toast("Informe a descrição e um valor maior que zero."); return; }
        const category = FT.EXPENSE_CATS.includes(d.get("category")) ? d.get("category") : "Outros";
        store.update(s => { s.expenses.push({ id: uid(), name: nm, amount, category, date: today() }); });
        toast("Gasto registrado."); render({ keepScroll: true }); break;
      }
      case "shop": { const nm = clamp(d.get("name"), 80); if (!nm) return; store.update(s => { s.shopping.push({ id: uid(), name: nm, done: false }); }); render({ keepScroll: true }); $("#shopName") && $("#shopName").focus(); break; }
      case "contact": store.update(s => { s.contacts = { name: clamp(d.get("name"), 60), phone: clamp(d.get("phone"), 30) }; }); toast("Contato salvo."); render({ keepScroll: true }); break;
    }
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw !== "object" || raw.v !== 2) throw new Error("formato");
      const r = await dialog({ title: "Restaurar este backup?", text: "Os dados atuais deste aparelho serão substituídos.", ok: "Restaurar", danger: true });
      if (r.value === "ok") { store.replace(raw); toast("Backup restaurado."); render(); }
    } catch (e) { toast("Esse arquivo não é um backup válido deste guia."); }
    $("#importFile").value = "";
  }

  /* ---------- eventos ---------- */
  const isField = el => el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-act]");
    if (!el || isField(el)) return;
    onAct(el.dataset.act, el, ev);
  });
  document.addEventListener("change", ev => {
    const el = ev.target;
    if (el.id === "importFile") { importFile(el.files && el.files[0]); return; }
    if (!el.dataset || !el.dataset.act) return;
    if (el.type === "checkbox") onAct(el.dataset.act, el, ev); else onChangeValue(el.dataset.act, el);
  });
  document.addEventListener("input", ev => {
    const el = ev.target;
    if (el.id === "aiq") { FT.ai.setDraft(el.value); el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; }
    else if (el.dataset && el.dataset.act === "res-note") onChangeValue("res-note", el);
  });
  document.addEventListener("keydown", ev => {
    if (ev.target.id === "aiq" && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  });
  document.addEventListener("submit", ev => {
    const form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    onSubmit(form.dataset.form, form);
  });
  window.addEventListener("hashchange", onRoute);

  FT.app = { render, toast, dialog, stats, itemHTML };
  if (!location.hash) history.replaceState(null, "", "#/inicio");
  onRoute();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* sem offline, mas o app funciona */ }));
  }
})();
