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
    { id: "cambio", label: "Câmbio", icon: "dollar" },
    { id: "concierge", label: "Concierge", icon: "bell" },
    { id: "mais", label: "Mais", icon: "more" }
  ];
  const MORE = [
    { id: "reservas", label: "Reservas", icon: "ticket", text: "Voos, hotéis, carro e ingressos com código e situação" },
    { id: "compras", label: "Compras", icon: "bag", text: "Uma lista para o Leo, outra para a Camily, e os outlets" },
    { id: "comida", label: "Onde comer", icon: "utensils", text: "Opções práticas para o dia a dia" },
    { id: "contatos", label: "Contatos e emergência", icon: "shield", text: "911, contato no Brasil e o que fazer se perder algo" },
    { id: "ajustes", label: "Ajustes e backup", icon: "sliders", text: "Salvar, restaurar, instalar no iPhone" }
  ];
  MORE.splice(1, 0, { id: "trocar", label: "Trocar de celular", icon: "phone", text: "Como levar o roteiro e o que você fez para o iPhone novo" });
  const EX = FT.extra || { routes: {}, more: [], rail: [] };
  MORE.splice(1, 0, ...EX.more);
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
    const del = `<button type="button" data-act="${it.custom ? "del-custom" : "hide-item"}" data-id="${esc(it.id)}">${icon("trash")} Remover</button>`;
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

  /* ---------- fases do checklist ---------- */
  const PHASES = [
    { id: "pre", name: "Pré-viagem", intro: "Tudo o que resolver antes de embarcar. Dá para ver por prazo ou por área." },
    { id: "magic", name: "Magic Kingdom", intro: "Ingresso, app e Lightning Lane antes de ir, e o que levar e conferir no dia 7." },
    { id: "uni", name: "Universal", intro: "Ingresso Park-to-Park, app e Express Pass antes de ir, e o que conferir no dia 9." },
    { id: "trip", name: "Na viagem", intro: "Chegada a Miami, rota para Kissimmee, Disney Springs, outlets e outros dias." },
    { id: "volta", name: "Pré-volta", intro: "Imposto e declaração, malas, carro e MCO, e o que fazer depois de chegar." }
  ];
  const PH_MAGIC0 = ["par-md-ingresso", "par-md-app", "par-md-ll", "par-md-restaurante"];
  const PH_UNI0 = ["par-uni-ingresso", "par-uni-app", "par-uni-express"];
  const PH_VOLTA0 = ["com-cota", "com-govbr"];
  function phaseOf(it) {
    if (it.phase && PHASES.some(p => p.id === it.phase)) return it.phase;
    if (PH_MAGIC0.includes(it.id) || it.day === 7) return "magic";
    if (PH_UNI0.includes(it.id) || it.day === 9) return "uni";
    if (PH_VOLTA0.includes(it.id) || it.day >= 11) return "volta";
    if (it.day > 0) return "trip";
    return "pre";
  }
  function defaultPhase() {
    const t = today(), T = FT.TRIP;
    if (t >= T.start && t <= T.end) { const n = Number(t.slice(8)); return n === 7 ? "magic" : n === 9 ? "uni" : n >= 11 ? "volta" : "trip"; }
    return "pre";
  }
  const curPhase = () => (PHASES.some(p => p.id === S().ui.phase) ? S().ui.phase : defaultPhase());

  /* Grupos de uma fase: [rótulo, itens, é-atrasado]. */
  function phaseGroups(ph, items) {
    const groups = [], dayTitle = n => { const d = FT.DAYS_DEFAULT[n - 4]; return d ? d.title : ""; };
    const late = items.filter(i => !isDone(i) && isLate(i));
    const rest = items.filter(i => !late.includes(i));
    if (late.length) groups.push(["Atrasados", late, true]);
    const by = (label, fn) => { const l = rest.filter(fn); if (l.length) groups.push([label, l, false]); };
    if (ph === "magic") { by("Antes de ir", i => i.day !== 7); by("No dia 7, Magic Kingdom", i => i.day === 7); }
    else if (ph === "uni") { by("Antes de ir", i => i.day !== 9); by("No dia 9, Universal", i => i.day === 9); }
    else if (ph === "volta") {
      by("Planejar antes de voltar", i => !i.day);
      by("Dia 11, última noite", i => i.day === 11);
      by("Dia 12, dia da volta", i => i.day === 12);
      by("Depois da viagem", i => i.day === 13);
    } else if (ph === "trip") {
      for (const n of [4, 5, 6, 7, 8, 9, 10]) by(`Dia ${n}, ${dayTitle(n)}`, i => i.day === n);
      by("Outros", i => !(i.day >= 4 && i.day <= 10));
    }
    return groups;
  }

  function addFormHTML(ph) {
    const sel = (name, opts) => `<label class="label" for="ai-${name}-${ph}">${name === "cat" ? "Área" : name === "day" ? "Dia" : "Quando"}</label><select class="field" id="ai-${name}-${ph}" name="${name}">${opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select>`;
    let extra = "";
    if (ph === "pre") extra = sel("cat", FT.CATS.map(c => [c.id, c.short]));
    else if (ph === "magic" || ph === "uni") extra = sel("when", [["0", "Antes de ir"], ["day", "No dia do parque"]]);
    else if (ph === "volta") extra = sel("when", [["0", "Planejar antes de voltar"], ["11", "Dia 11"], ["12", "Dia 12"], ["13", "Depois da viagem"]]);
    else extra = sel("day", [4, 5, 6, 7, 8, 9, 10].map(n => [String(n), "Dia " + n]));
    return `<details class="addrow"><summary>${icon("plus")} Adicionar item nesta fase</summary>
      <form data-form="add-item" data-phase="${ph}">
        <label class="label" for="ai-t-${ph}">O que precisa fazer?</label>
        <input class="field" id="ai-t-${ph}" name="title" maxlength="140" required>
        <div class="two"><div><label class="label" for="ai-p-${ph}">Prioridade</label><select class="field" id="ai-p-${ph}" name="pri"><option value="e">Essencial</option><option value="i" selected>Importante</option><option value="o">Opcional</option></select></div>
        <div>${extra}</div></div>
        <label class="label" for="ai-d-${ph}">Prazo (opcional)</label><input class="field" id="ai-d-${ph}" name="due" type="date">
        <div style="margin-top:12px"><button class="btn btn--primary" type="submit">Adicionar</button></div>
      </form></details>`;
  }

  function checklistBody() {
    const ui = S().ui, ph = curPhase(), phase = PHASES.find(p => p.id === ph);
    const all = store.items().filter(i => phaseOf(i) === ph), items = all.filter(passes);
    const done = all.filter(isDone).length;
    const head = `<div class="phasehead"><div><div class="phasehead__name">${esc(phase.name)}</div><p class="small muted">${esc(phase.intro)}</p></div><div class="phasehead__count"><b>${done}</b>/${all.length}</div></div>`;
    const add = `<section class="section">${addFormHTML(ph)}</section>`;
    if (!items.length) {
      return head + `<div class="sheet empty">${ui.status === "pend" ? (all.length ? "Nada pendente nesta fase. Bom trabalho." : "Nenhum item nesta fase ainda.") : "Nenhum item com esses filtros."}</div>` + add;
    }
    if (ph === "pre" && ui.view === "cat") {
      const open = ui.open || { docs: true };
      return head + FT.CATS.map(c => {
        const allc = all.filter(i => i.cat === c.id);
        const list = items.filter(i => i.cat === c.id).sort(sortItems);
        const d = allc.filter(isDone).length;
        if (!list.length && ui.status !== "all") return "";
        if (!allc.length) return "";
        const isOpen = !!open[c.id];
        const pct = allc.length ? Math.round(d / allc.length * 100) : 0;
        return `<section class="sheet cat">
        <h3><button type="button" class="cat__head" data-act="cat-toggle" data-id="${c.id}" aria-expanded="${isOpen}" aria-controls="cat-${c.id}">
          <span class="cat__icon">${icon(c.icon)}</span>
          <span class="cat__titles"><span class="cat__name">${esc(c.name)}</span><span class="cat__intro">${esc(c.intro)}</span></span>
          <span class="cat__count${d === allc.length && allc.length ? " cat__count--done" : ""}">${d}/${allc.length}</span>${icon("chev-d", "cat__chev")}
        </button></h3>
        <div class="cat__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="cat__body" id="cat-${c.id}"${isOpen ? "" : " hidden"}>
          <ul>${list.map(i => itemHTML(i, false)).join("") || '<li class="empty small">Nada neste filtro.</li>'}</ul>
        </div></section>`;
      }).join("") + add;
    }
    let groups;
    if (ph === "pre") {
      const g = new Map();
      for (const it of items) { const [k, label] = bucket(it); if (!g.has(k)) g.set(k, { label, list: [] }); g.get(k).list.push(it); }
      groups = [...g.entries()].sort((a, b) => a[0] - b[0]).map(([k, x]) => [x.label, x.list.sort(sortItems), k === 0]);
    } else groups = phaseGroups(ph, items);
    return head + groups.map(([label, list, isLateG]) => `
        <h3 class="group-title${isLateG ? " group-title--late" : ""}">${isLateG ? icon("alert") : ""}${esc(label)} <span class="chip chip--plain">${list.length}</span></h3>
        <div class="sheet" style="padding:0 16px"><ul>${list.sort(sortItems).map(it => itemHTML(it, ph === "pre")).join("")}</ul></div>`).join("") + add;
  }

  function viewChecklist() {
    const st = stats(), ui = S().ui, items = store.items(), ph = curPhase();
    const f = (k, v, label) => `<button type="button" class="filter-chip" data-act="filter" data-k="${k}" data-v="${v}" aria-pressed="${ui[k] === v}">${label}</button>`;
    const tabs = PHASES.map(p => {
      const all = items.filter(i => phaseOf(i) === p.id), d = all.filter(isDone).length, lt = all.filter(i => !isDone(i) && isLate(i)).length;
      return `<button type="button" class="phase" data-act="phase" data-v="${p.id}" aria-pressed="${p.id === ph}"><span class="phase__name">${esc(p.name)}</span><span class="phase__n${lt ? " phase__n--late" : ""}">${d}/${all.length}</span><span class="phase__bar" aria-hidden="true"><span style="width:${all.length ? d / all.length * 100 : 0}%"></span></span></button>`;
    }).join("");
    return `
      <header class="page-head">
        <h1 class="h-page">Checklist</h1>
        <p class="lede">${st.total} itens separados por momento da viagem. Toque no item para ver o passo a passo.</p>
      </header>
      <section class="sheet sheet--pad cl__summary" aria-label="Progresso">
        <div class="cl__numbers"><div class="cl__big">${st.done}<small>de ${st.total} concluídos</small></div>
          <div class="chips"><span class="chip chip--e">${st.eDone}/${st.eTotal} essenciais</span>${st.late ? `<button type="button" class="chip chip--late" data-act="goto-late">${icon("alert")} ${st.late} ${st.late === 1 ? "atrasado" : "atrasados"}</button>` : ""}</div></div>
        ${st.next ? `<p class="small muted">Próximo prazo: ${short(st.next)}${diffDays(today(), st.next) >= 0 ? ` (${diffDays(today(), st.next) === 0 ? "hoje" : "em " + diffDays(today(), st.next) + " dias"})` : ""}.</p>` : ""}
      </section>
      <div class="phasebar" role="group" aria-label="Fase da viagem">${tabs}</div>
      <div class="cl__controls">
        ${ph === "pre" ? `<div class="segmented" role="group" aria-label="Organizar por"><button type="button" data-act="view-mode" data-v="cat" aria-pressed="${ui.view === "cat"}">Por área</button><button type="button" data-act="view-mode" data-v="prazo" aria-pressed="${ui.view === "prazo"}">Por prazo</button></div>` : ""}
        <div class="filters" role="group" aria-label="Filtros">${f("status", "pend", "Pendentes")}${f("status", "done", "Concluídos")}${f("status", "all", "Todos")}<button type="button" class="filter-chip" data-act="filter" data-k="pri" data-v="${ui.pri === "e" ? "all" : "e"}" aria-pressed="${ui.pri === "e"}">Só essenciais</button></div>
      </div>
      ${checklistBody()}
      ${removedHTML()}`;
  }

  function removedHTML() {
    const list = store.hiddenItems();
    if (!list.length) return "";
    return `<details class="section" style="margin-top:24px"><summary class="small"><strong>Itens removidos (${list.length})</strong></summary>
      <ul class="stack" style="list-style:none;padding:0;margin-top:8px">${list.map(it => `<li class="row row--between row--wrap" style="padding:8px 0;border-top:1px solid var(--line,#ddd)"><span class="small">${esc(it.title)}</span><button class="btn btn--quiet" type="button" data-act="unhide-item" data-id="${esc(it.id)}">Trazer de volta</button></li>`).join("")}</ul></details>`;
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
          <dl class="pass__fields"><div><dt>Noites</dt><dd>8</dd></div><div><dt>Hotéis</dt><dd>2</dd></div><div><dt>Parques</dt><dd>4 dias</dd></div><div><dt>Dias</dt><dd>9</dd></div></dl>
        </div>
        <a class="pass__stub" href="#/checklist"><div><div class="pass__count">${count}</div><div class="pass__count-label">${label}</div></div><div class="pass__stub-note"><strong>${stubNote}</strong>Abrir o checklist</div></a>
      </section>
      ${dayBlock}
      ${inTrip ? `<a class="btn btn--primary" href="#/hoje" style="margin-bottom:8px">${icon("clock")} Abrir a tela Hoje</a>` : ""}
      <section class="section">
        <div class="section__head"><h2 class="h-section">Para fazer agora</h2><a class="btn btn--quiet btn--sm" href="#/checklist">Checklist completo ${icon("chev-r")}</a></div>
        ${upcoming.length ? `<div class="sheet" style="padding:0 16px"><ul>${upcoming.map(i => itemHTML(i, true)).join("")}</ul></div>` : `<div class="sheet empty">Tudo em dia por enquanto.</div>`}
      </section>
      <div class="glance">
        <section class="section"><div class="section__head"><h2 class="h-section">Preparação</h2></div>
          <div class="meter" role="img" aria-label="${st.done} de ${st.total} itens concluídos"><span class="meter__fill" style="width:${st.total ? st.done / st.total * 100 : 0}%"></span></div>
          <dl style="margin-top:8px"><div class="stat"><dt>Itens concluídos</dt><dd>${st.done} de ${st.total}</dd></div><div class="stat"><dt>Essenciais concluídos</dt><dd>${st.eDone} de ${st.eTotal}</dd></div><div class="stat"><dt>Atrasados</dt><dd>${st.late}</dd></div><div class="stat"><dt>Reservas confirmadas</dt><dd><a href="#/reservas">${res} de ${FT.RESERVAS.length}</a></dd></div></dl>
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
      ${S().days ? `<div class="callout callout--info" style="margin-bottom:20px">${icon("info")}<div><strong>Roteiro personalizado</strong>Este roteiro foi alterado por vocês ou pelo concierge. Você pode restaurar o original em <a href="#/ajustes">Ajustes</a>.</div></div>` : ""}
      ${legs}
      <div class="callout" style="margin-top:28px">${icon("alert")}<div><strong>Confirme perto da data</strong>Horários de parques, shows, abertura de lojas e trânsito mudam. Este roteiro é uma base, não uma reserva.</div></div>`;
  }

  function viewDay(n) {
    const days = store.days(), plans = store.plans();
    const i = Number(n) - 4;
    if (!(i >= 0 && i < days.length)) return notFound();
    if (editor && editor.n === Number(n)) return viewEditDay(i);
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
      ${(Number(d.date) === 7 || Number(d.date) === 9) ? `<section class="section"><a class="btn btn--primary" href="#/parques/${Number(d.date) === 7 ? "mk" : "usf"}">${icon("sun")} Guia do parque com filas ao vivo</a></section>` : ""}
      <section class="section btn-row"><button class="btn" type="button" data-act="ed-open" data-day="${Number(d.date)}">${icon("edit")} Editar este dia</button><button class="btn" type="button" data-act="ask-day" data-day="${Number(d.date)}">${icon("bell")} Pedir ajuste ao concierge</button></section>`;
  }

  /* ---------- edição manual de um dia ---------- */
  let editor = null;
  function openEditor(n) {
    const i = n - 4, d = store.days()[i], p = store.plans()[i];
    editor = { n, draft: { title: d.title, where: d.where || "", desc: d.desc || "", tip: d.tip || "", tags: (d.tags || []).join(", "), note: "", schedule: p.schedule.map(b => [b[0] || "", b[1] || "", b[2] || "", b[3] || ""]) } };
  }
  function collectEditor() {
    const f = $("#editDay"); if (!f || !editor) return;
    const v = name => (f.querySelector(`[name="${name}"]`) || {}).value || "";
    const dr = editor.draft;
    dr.title = v("title"); dr.where = v("where"); dr.desc = v("desc"); dr.tip = v("tip"); dr.tags = v("tags"); dr.note = v("note");
    dr.schedule = [...f.querySelectorAll(".edrow")].map(r => ["t", "n", "d", "p"].map(k => (r.querySelector(`[data-f="${k}"]`) || {}).value || ""));
  }
  function viewEditDay(i) {
    const dr = editor.draft, d = store.days()[i], date = FT.u.dayDate(editor.n);
    const rows = dr.schedule.map((b, k) => `<fieldset class="edrow"><legend class="sr">Bloco ${k + 1}</legend>
      <div><div><label class="label" style="margin-top:0">Horário</label><input class="field" data-f="t" maxlength="30" value="${esc(b[0])}" placeholder="09:00–11:00"></div>
      <div><label class="label">Título</label><input class="field" data-f="n" maxlength="120" value="${esc(b[1])}" placeholder="O que fazer"></div></div>
      <label class="label">Detalhes</label><textarea class="field" data-f="d" rows="2" maxlength="500">${esc(b[2])}</textarea>
      <label class="label">Local para o mapa (opcional)</label><input class="field" data-f="p" maxlength="120" value="${esc(b[3])}">
      <button class="btn btn--quiet btn--sm btn--danger" type="button" data-act="ed-del" data-i="${k}" style="margin-top:10px">${icon("trash")} Remover bloco</button></fieldset>`).join("");
    return `<div class="daynav"><a class="back" href="#/roteiro/${editor.n}" data-act="ed-cancel">${icon("chev-l")} Cancelar edição</a></div>
      <header class="page-head"><h1 class="h-page">Editar o dia ${editor.n}</h1><p class="lede">${esc(FT.u.weekday(date))}, ${esc(FT.u.dateLong(date))}. Mude o que quiser e, se desejar, peça para a IA completar o resto.</p></header>
      <div id="editDay">
        <section class="sheet sheet--pad">
          <label class="label" style="margin-top:0" for="edTitle">Título do dia</label><input class="field" id="edTitle" name="title" maxlength="120" value="${esc(dr.title)}">
          <label class="label" for="edWhere">Onde</label><input class="field" id="edWhere" name="where" maxlength="160" value="${esc(dr.where)}">
          <label class="label" for="edDesc">Resumo</label><textarea class="field" id="edDesc" name="desc" rows="3" maxlength="600">${esc(dr.desc)}</textarea>
          <label class="label" for="edTags">Etiquetas (separe por vírgula)</label><input class="field" id="edTags" name="tags" maxlength="120" value="${esc(dr.tags)}">
          <label class="label" for="edTip">Dica do dia</label><textarea class="field" id="edTip" name="tip" rows="2" maxlength="400">${esc(dr.tip)}</textarea>
        </section>
        <section class="section"><div class="section__head"><h2 class="h-section">Programação</h2></div>${rows || '<div class="sheet empty">Nenhum bloco ainda.</div>'}
          <button class="btn" type="button" data-act="ed-add" style="margin-top:12px">${icon("plus")} Adicionar bloco</button></section>
        <section class="section sheet sheet--pad"><strong>Complementar com a IA</strong>
          <p class="small muted" style="margin-top:4px">A IA mantém o que você escreveu e completa o que faltar neste dia: deslocamentos, refeições, plano B e dica.</p>
          <label class="label" for="edNote">Algo que ela deva considerar? (opcional)</label><textarea class="field" id="edNote" name="note" rows="2" maxlength="300" placeholder="Ex.: queremos sair do parque às 15h">${esc(dr.note)}</textarea></section>
        <div class="btn-row" style="margin-top:16px"><button class="btn btn--primary" type="button" data-act="ed-save">${icon("check")} Salvar</button><button class="btn" type="button" data-act="ed-save-ai">${icon("bell")} Salvar e pedir à IA para completar</button></div>
      </div>`;
  }
  function saveEditor() {
    collectEditor();
    const dr = editor.draft, n = editor.n, i = n - 4;
    const title = clamp(dr.title, 120);
    if (!title) { toast("Dê um título ao dia."); return false; }
    const schedule = dr.schedule.map(b => [clamp(b[0], 30), clamp(b[1], 120), clamp(b[2], 500), clamp(b[3], 120)]).filter(b => b[1]).map(b => (b[3] ? b : b.slice(0, 3)));
    const days = JSON.parse(JSON.stringify(store.days())), plans = JSON.parse(JSON.stringify(store.plans()));
    Object.assign(days[i], { title, where: clamp(dr.where, 160), desc: clamp(dr.desc, 600), tip: clamp(dr.tip, 400), tags: dr.tags.split(",").map(x => clamp(x, 30)).filter(Boolean).slice(0, 6) });
    plans[i].schedule = schedule;
    store.update(s => { s.days = days; s.plans = plans; });
    return true;
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
          <label class="label" for="rn-${r.id}">Código e detalhes</label><input class="field" id="rn-${r.id}" data-act="res-note" data-id="${r.id}" value="${esc(v.note)}" placeholder="${esc(r.hint)}" maxlength="300" autocomplete="off">${FT.extra ? FT.extra.attachHTML(r.id) : ""}</div></article>`;
      }).join("")}`;
  }


  let shopWho = "leo";
  function viewCompras() {
    const st = S(), who = shopWho === "camily" ? "camily" : "leo", name = who === "camily" ? "Camily" : "Leo";
    const of = w => st.shopping.filter(x => (x.who || "leo") === w);
    const list = of(who), left = list.filter(x => !x.done).length;
    const tab = (w, label) => `<button type="button" data-act="shop-who" data-v="${w}" aria-pressed="${who === w}">${label} <span class="small muted">${of(w).filter(x => !x.done).length}</span></button>`;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Compras</h1><p class="lede">Uma lista para cada um. O que está marcado já foi comprado.</p></header>
      <div class="segmented" role="group" aria-label="Lista de quem" style="margin-bottom:14px">${tab("leo", "Leo")}${tab("camily", "Camily")}</div>
      <section><div class="section__head"><h2 class="h-section">Lista ${who === "leo" ? "do" : "da"} ${esc(name)}</h2><span class="small muted">${left} por comprar</span></div>
        <div class="sheet" style="padding:0 16px">${list.length ? list.map(x => `<div class="shop-item${x.done ? " shop-item--done" : ""}"><label class="check"><input type="checkbox" data-act="toggle-shop" data-id="${esc(x.id)}"${x.done ? " checked" : ""} aria-label="Comprado: ${esc(x.name)}"><span class="check__box">${icon("check")}</span></label><span class="shop-item__name">${esc(x.name)}</span><button class="btn btn--quiet btn--icon btn--danger" type="button" data-act="del-shop" data-id="${esc(x.id)}" aria-label="Remover ${esc(x.name)}">${icon("trash")}</button></div>`).join("") : `<div class="empty">A lista da ${esc(name)} está vazia.</div>`}</div>
        <form class="row" data-form="shop" style="margin-top:12px"><label class="sr" for="shopName">Novo item para ${esc(name)}</label><input class="field" id="shopName" name="name" maxlength="80" placeholder="Adicionar item para ${esc(name)}" required><button class="btn btn--primary" type="submit">Adicionar</button></form></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Outlets no roteiro</h2></div>
        <div class="sheet" style="padding:0 16px">${FT.OUTLETS.map(o => `<div class="place"><span class="place__icon">${icon("bag")}</span><div><div class="place__name">${esc(o.name)} <span class="chip chip--plain">${esc(o.day)}</span></div><p class="place__note">${esc(o.note)}</p><div class="place__links"><a href="${esc(mapsUrl(o.q))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Abrir no mapa</a></div></div></div>`).join("")}</div></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Estratégia</h2></div><ol class="steps">${FT.ESTRATEGIA_COMPRAS.map(s => `<li><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></li>`).join("")}</ol></section>`;
  }

  function viewComida() {
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Onde comer</h1><p class="lede">Opções práticas para o dia a dia. Confirme horário e unidade antes de ir.</p></header>
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

  function viewTrocar() {
    const y = FT.sync, on = y.connected, ok = on && (y.status === "ok" || y.status === "pending");
    const addr = location.href.split("#")[0];
    const status = on
      ? `<div class="callout callout--info">${icon("info")}<div><strong>Sincronização ligada</strong>Seus dados já estão na nuvem do casal${ok ? "" : ", mas o status agora não está em dia: abra Ajustes e confira antes de trocar"}. No celular novo ${y.loginEmail ? "basta entrar com o e-mail e a senha" : "basta colar o convite"}. Mesmo assim, salve um backup por garantia.</div></div>`
      : `<div class="callout callout--alert">${icon("alert")}<div><strong>A sincronização está desligada</strong>Seus dados existem só neste aparelho. Salve o backup abaixo e guarde fora do celular. Se quiser, ligue a sincronização em Ajustes: aí o celular novo recupera tudo sozinho.</div></div>`;
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Trocar de celular</h1><p class="lede">No dia 4 você muda de aparelho. Faça isto antes, para não perder o roteiro, o checklist marcado e as listas de compras.</p></header>
      ${status}
      <section class="section"><div class="section__head"><h2 class="h-section">Antes de trocar</h2></div>
        <ol class="steps">
          <li><strong>Salve o backup</strong><span>Toque no botão abaixo. Mande o arquivo para o seu e-mail ou salve no iCloud Drive ou no Drive, fora do celular antigo.</span></li>
          ${on && !y.loginEmail ? `<li><strong>Guarde o convite da sincronização</strong><span>Copie e guarde numa nota ou mensagem para você mesmo. É ele que traz tudo de volta no aparelho novo.</span></li>` : ""}${on && y.loginEmail ? `<li><strong>Guarde o convite de configuração</strong><span>Ele só leva a configuração do Firebase, sem dados. No aparelho novo você cola o convite e entra com e-mail e senha.</span></li>` : ""}
          <li><strong>Refaça o backup depois de mudanças grandes</strong><span>Em especial na véspera da viagem, dia 3 de dezembro.</span></li>
        </ol>
        <div class="btn-row" style="margin-top:12px"><button class="btn btn--primary" type="button" data-act="export">${icon("download")} Salvar backup</button>${on ? `<button class="btn" type="button" data-act="${y.loginEmail ? "sync-copy-cfg" : "sync-copy-invite"}">${icon("link")} Enviar link${y.loginEmail ? " de configuração" : ""}</button>` : `<a class="btn" href="#/ajustes">Ajustes e sincronização</a>`}</div></section>
      <section class="section"><div class="section__head"><h2 class="h-section">No celular novo</h2></div>
        <ol class="steps">
          <li><strong>Abra o guia no Safari</strong><span>Endereço: ${esc(addr)}. Depois toque em Compartilhar e em Adicionar à Tela de Início.</span></li>
          <li><strong>Recupere os dados</strong><span>${on ? (y.loginEmail ? "Em Ajustes e backup, cole o convite de configuração em Já recebeu um convite (ou configure o Firebase) e entre em Já tem login com o mesmo e-mail e senha." : "Em Ajustes e backup, cole o convite em Já recebeu um convite.") : "Em Ajustes e backup, toque em Restaurar backup e escolha o arquivo que você salvou."}</span></li>
          <li><strong>Confira antes de entregar o antigo</strong><span>Veja o roteiro que você editou, o checklist marcado e as duas listas de compras. Só então entregue o aparelho antigo e saia do Apple ID.</span></li>
          <li><strong>Chave da IA</strong><span>${on ? "Ela vai junto com a sincronização, criptografada." : "O backup não inclui a chave. Cole-a de novo em Concierge."}</span></li>
        </ol></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Bom saber</h2></div>
        <div class="stack">
          <div class="callout">${icon("info")}<div><strong>Anexos das reservas</strong>O backup não leva os arquivos anexados. Com a sincronização ligada, os de até cerca de 650 KB vão junto. Guarde os originais nas Fotos ou no Drive.</div></div>
          <div class="callout">${icon("info")}<div><strong>Transferência da Apple</strong>Se você trouxer tudo do celular antigo pelo iCloud ou pelo Início Rápido, o atalho do guia pode vir junto, mas não conte com isso. Use o backup ou o convite.</div></div>
          <div class="callout callout--alert">${icon("alert")}<div><strong>Não apague nada antes de conferir</strong>Não limpe os dados do Safari nem apague o atalho do guia no celular antigo até ver tudo certo no novo.</div></div>
        </div></section>`;
  }

  let bkPoints = [];

  function viewAjustes() {
    return `${backTo()}
      <header class="page-head"><h1 class="h-page">Ajustes e backup</h1><p class="lede">Seus dados ficam neste aparelho e, se você ligar a sincronização, também no seu projeto Firebase. Antes de trocar de celular, veja <a href="#/trocar">o passo a passo</a>.</p></header>
      ${syncSection()}
      <section class="section"><div class="section__head"><h2 class="h-section">Backup automático</h2></div>
        <div class="stack"><p class="small muted">Todo dia, ao abrir o app, ele guarda uma cópia: ${FT.backup.local().length} neste aparelho (últimos 7 dias)${FT.sync.connected ? " e na nuvem do casal (últimos 14 dias)" : ". Ligue a sincronização para guardar também na nuvem"}. Se algo for apagado sem querer, volte a um dia anterior.</p>
          <div class="btn-row"><button class="btn" type="button" data-act="bk-list">${icon("refresh")} Ver cópias e restaurar</button><button class="btn btn--quiet" type="button" data-act="bk-now">Guardar agora</button></div>
          <div id="bkList"></div></div></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Backup em arquivo</h2></div>
        <div class="btn-row"><button class="btn" type="button" data-act="export">${icon("download")} Salvar backup</button><button class="btn" type="button" data-act="import">${icon("upload")} Restaurar backup</button></div>
        <input type="file" id="importFile" accept="application/json,.json" hidden></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Instalar no iPhone</h2></div>
        <ol class="steps"><li><strong>Abra no Safari</strong><span>O atalho só funciona por lá.</span></li><li><strong>Toque em Compartilhar</strong><span>O ícone de quadrado com seta para cima.</span></li><li><strong>Adicionar à Tela de Início</strong><span>Depois disso o guia abre em tela cheia e funciona sem internet.</span></li></ol></section>
      <section class="section"><div class="section__head"><h2 class="h-section">Restaurar</h2></div>
        <div class="stack"><button class="btn" type="button" data-act="reset-plan">${icon("refresh")} Restaurar o roteiro original</button><button class="btn btn--danger" type="button" data-act="reset-all">${icon("trash")} Apagar todos os dados deste aparelho</button></div></section>
      <p class="small muted" style="margin-top:32px">Versão ${VERSION}. Regras, preços e prazos pesquisados em outubro de 2026: confirme sempre na fonte oficial perto da viagem.</p>`;
  }

  const LOGIN_CREATE = '<form class="sheet sheet--pad" data-form="sync-login-create"><strong>__T__</strong><p class="small muted" style="margin-top:6px">__D__</p><label class="label" for="sync-login-create-em">E-mail</label><input class="field" id="sync-login-create-em" name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" required><label class="label" for="sync-login-create-pw">Senha (mínimo 8 caracteres)</label><input class="field" id="sync-login-create-pw" name="pw" type="password" autocomplete="new-password" minlength="8" required><div style="margin-top:12px"><button class="btn btn--primary" type="submit">Criar login</button></div></form>';
  const LOGIN_ENTER = '<form class="sheet sheet--pad" data-form="sync-login-enter"><strong>Já tem login?</strong><p class="small muted" style="margin-top:6px">Entre com o e-mail e a senha que foram criados no outro aparelho.</p><label class="label" for="sync-login-enter-em">E-mail</label><input class="field" id="sync-login-enter-em" name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" required><label class="label" for="sync-login-enter-pw">Senha (mínimo 8 caracteres)</label><input class="field" id="sync-login-enter-pw" name="pw" type="password" autocomplete="current-password" minlength="8" required><div style="margin-top:12px"><button class="btn" type="submit">Entrar</button></div></form>';
  const SYNC_LABEL = { off: "Desligada", connecting: "Conectando…", ok: "Sincronizado", pending: "Enviando alterações…", offline: "Sem internet: salvo, envia quando voltar", error: "Com problema" };

  function syncSection() {
    const y = FT.sync;
    let body;
    if (y.connected) {
      const ok = y.status === "ok" || y.status === "pending";
      body = `<div class="sheet sheet--pad stack">
        <div class="row row--between row--wrap"><strong>Sincronização ligada</strong><span class="chip ${ok ? "chip--ok" : y.status === "error" ? "chip--late" : "chip--plain"}">${esc(SYNC_LABEL[y.status] || "")}</span></div>
        ${y.detail ? `<div class="callout callout--alert">${icon("alert")}<div>${esc(y.detail)}</div></div>` : ""}
        <p class="small muted">Tudo que vocês marcarem, registrarem ou mudarem no roteiro aparece nos dois aparelhos. A chave da IA vai criptografada.</p>
        ${y.loginEmail ? `<p class="small"><strong>Login:</strong> ${esc(y.loginEmail)}. Em outro aparelho, entre com este e-mail e a mesma senha.</p>` : ""}
        <div class="btn-row">${y.loginEmail ? `<button class="btn btn--primary" type="button" data-act="sync-copy-cfg">${icon("link")} Enviar link de configuração</button>` : `<button class="btn btn--primary" type="button" data-act="sync-copy-invite">${icon("link")} Enviar link para ela</button>`}<button class="btn" type="button" data-act="sync-show-code">Ver código</button><button class="btn btn--quiet btn--danger" type="button" data-act="sync-disconnect">Desligar neste aparelho</button></div>
        <p class="hint">${y.loginEmail ? "Quem souber o e-mail e a senha vê e edita tudo. Use uma senha que só vocês dois conheçam." : "O link contém o código secreto. Mande só para ela, de preferência por mensagem direta."}</p></div>
        ${y.loginEmail ? "" : LOGIN_CREATE.replace("__T__", "Trocar o código por e-mail e senha").replace("__D__", "Mais fácil de lembrar. Seus dados atuais continuam e passam a ficar sob este login. Depois é só entrar com e-mail e senha no outro aparelho; o convite antigo deixa de valer.")}`;
    } else {
      body = `<div class="stack">
        ${y.hasConfig() ? `<div class="sheet sheet--pad stack"><strong>Criar a conta compartilhada</strong><p class="small muted">Gera um código secreto. Depois você copia o convite e manda para ela.</p><button class="btn btn--primary" type="button" data-act="sync-create">Criar código do casal</button></div>`
        : `<form class="sheet sheet--pad" data-form="sync-config"><strong>1. Configurar o Firebase (uma vez)</strong><p class="small muted" style="margin-top:6px">Cole aqui a configuração do app web do seu projeto Firebase.</p><label class="label" for="fbCfg">Configuração do Firebase</label><textarea class="field" id="fbCfg" name="cfg" rows="5" placeholder="const firebaseConfig = { apiKey: ..., projectId: ..., appId: ... }" required></textarea><div style="margin-top:12px"><button class="btn btn--primary" type="submit">Salvar configuração</button></div></form>`}
        ${y.hasConfig() ? LOGIN_CREATE.replace("__T__", "Criar login com e-mail e senha").replace("__D__", "Sem código para decorar. Escolha um e-mail e uma senha que só vocês dois saibam; no outro aparelho vocês entram com os mesmos dois.") + LOGIN_ENTER : ""}
        <form class="sheet sheet--pad" data-form="sync-join"><strong>Já recebeu um convite?</strong><p class="small muted" style="margin-top:6px">Normalmente basta abrir o link que a outra pessoa mandou. Se preferir, cole o link ou o convite aqui.</p><label class="label" for="inv">Link, convite ou código</label><input class="field" id="inv" name="invite" autocomplete="off" autocapitalize="off" spellcheck="false" required><div style="margin-top:12px"><button class="btn" type="submit">Entrar</button></div></form></div>`;
    }
    return `<section><div class="section__head"><h2 class="h-section">Sincronizar com a namorada</h2></div>${body}</section>`;
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
    compras: { title: "Compras", tab: "mais", fn: viewCompras },
    comida: { title: "Onde comer", tab: "mais", fn: viewComida },
    contatos: { title: "Contatos e emergência", tab: "mais", fn: viewContatos },
    trocar: { title: "Trocar de celular", tab: "mais", fn: viewTrocar },
    ajustes: { title: "Ajustes e backup", tab: "mais", fn: viewAjustes }
  };
  Object.assign(ROUTES, EX.routes);

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const id = parts[0] || "inicio";
    return { id: ROUTES[id] ? id : null, arg: parts[1] || "" };
  }

  function drawNav(tab) {
    $("#tabs").innerHTML = NAV.map(n => `<a class="tab" href="#/${n.id}"${n.id === tab ? ' aria-current="page"' : ""}>${icon(n.icon)}<span>${n.label}</span></a>`).join("");
    const link = (n, cur) => `<a class="rail__link" href="#/${n.id}"${n.id === cur ? ' aria-current="page"' : ""}>${icon(n.icon)}${n.label}</a>`;
    const r = parseRoute();
    $("#railNav").innerHTML = [NAV[0]].concat(EX.rail, NAV.slice(1, 5)).map(n => link(n, r.id)).join("") + '<div class="rail__sep"></div>' + MORE.map(n => link(n, r.id)).join("");
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
    if (editor) collectEditor();
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
    if (/^#\/entrar\//.test(location.hash)) return;
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
    if (FT.extra && await FT.extra.act(act, el, ev)) return;
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
      case "hide-item": {
        const r = await dialog({ title: "Remover este item?", text: "Ele sai do checklist e das contagens. Dá para trazer de volta em \"Itens removidos\", no fim da lista.", ok: "Remover", danger: true });
        if (r.value === "ok") { store.update(s => { s.hidden = s.hidden || {}; s.hidden[el.dataset.id] = true; delete s.checks[el.dataset.id]; }); render({ keepScroll: true }); toast("Item removido."); }
        break;
      }
      case "unhide-item": store.update(s => { if (s.hidden) delete s.hidden[el.dataset.id]; }); render({ keepScroll: true }); toast("Item de volta no checklist."); break;
      case "cat-toggle": saveUI(ui => { ui.open = Object.assign({}, ui.open || { docs: true }); ui.open[el.dataset.id] = !ui.open[el.dataset.id]; }); render({ keepScroll: true }); break;
      case "filter": recent = new Set(); saveUI(ui => { ui[el.dataset.k] = el.dataset.v; }); render({ keepScroll: true }); break;
      case "view-mode": recent = new Set(); saveUI(ui => { ui.view = el.dataset.v; }); render({ keepScroll: true }); break;
      case "phase": recent = new Set(); saveUI(ui => { ui.phase = el.dataset.v; }); render({ keepScroll: false }); window.scrollTo(0, 0); break;
      case "goto-late": recent = new Set(); { const first = store.items().filter(i => !isDone(i) && isLate(i)).map(phaseOf); const order = PHASES.map(p => p.id); const target = order.find(id => first.includes(id)); saveUI(ui => { ui.view = "prazo"; ui.status = "pend"; ui.pri = "all"; if (target) ui.phase = target; }); } render(); $("#view").querySelector(".group-title--late")?.scrollIntoView({ block: "start" }); break;
      case "res-status": store.update(s => { const r = s.reservas[el.dataset.id] || { status: "Pendente", note: "" }; r.status = el.dataset.v; s.reservas[el.dataset.id] = r; }); render({ keepScroll: true }); break;
      case "ed-open": openEditor(Number(el.dataset.day)); render({ keepScroll: false }); window.scrollTo(0, 0); break;
      case "ed-cancel": editor = null; render({ keepScroll: false }); break;
      case "ed-add": collectEditor(); editor.draft.schedule.push(["", "", "", ""]); render({ keepScroll: true }); break;
      case "ed-del": collectEditor(); editor.draft.schedule.splice(Number(el.dataset.i), 1); render({ keepScroll: true }); break;
      case "ed-save": { if (saveEditor()) { const n = editor.n; editor = null; toast("Dia salvo."); render({ keepScroll: false }); window.scrollTo(0, 0); } break; }
      case "ed-save-ai": {
        collectEditor(); const note = clamp(editor.draft.note, 300), n = editor.n;
        if (!saveEditor()) break;
        editor = null;
        store.update(s => { s.ai.mode = "edit"; });
        location.hash = "#/concierge";
        FT.ai.send("Editei o dia " + n + " manualmente; o roteiro atual já traz as minhas alterações. Mantenha o que escrevi e complete só o que faltar nesse dia (deslocamentos, refeições, tempos de espera, plano B e dica)." + (note ? " Considere: " + note : ""));
        break;
      }
      case "shop-who": shopWho = el.dataset.v === "camily" ? "camily" : "leo"; render({ keepScroll: true }); break;
      case "toggle-shop": store.update(s => { const x = s.shopping.find(i => i.id === el.dataset.id); if (x) x.done = el.checked; }); render({ keepScroll: true }); break;
      case "del-shop": store.update(s => { s.shopping = s.shopping.filter(x => x.id !== el.dataset.id); }); render({ keepScroll: true }); break;
      case "ask-day": FT.ai.prefill("No dia " + el.dataset.day + ", ", "edit"); location.hash = "#/concierge"; setTimeout(() => $("#aiq") && $("#aiq").focus(), 50); break;
      case "sync-create": { const ok = await FT.sync.create(); toast(ok ? "Código criado. Copie o convite e mande para ela." : "Configure o Firebase primeiro."); render({ keepScroll: true }); break; }
      case "sync-copy-cfg": {
        const inv = FT.sync.configLink();
        if (navigator.share) { try { await navigator.share({ title: "Florida · Caderno de viagem", text: "Guia da viagem para a Florida: abra o link e entre com o e-mail e a senha.", url: inv }); break; } catch (e) { if (e && e.name === "AbortError") break; } }
        try { await navigator.clipboard.writeText(inv); toast("Link copiado. Abra no outro aparelho e entre com e-mail e senha."); }
        catch (e) { await dialog({ title: "Copie o link", html: `<textarea class="field" rows="5" readonly>${esc(inv)}</textarea>`, ok: "Fechar", cancel: null }); }
        break;
      }
      case "sync-copy-invite": {
        const inv = FT.sync.inviteLink();
        if (navigator.share) { try { await navigator.share({ title: "Florida · Caderno de viagem", text: "Entra no nosso guia da viagem para a Florida: abra o link e toque em Entrar.", url: inv }); break; } catch (e) { if (e && e.name === "AbortError") break; } }
        try { await navigator.clipboard.writeText(inv); toast("Link copiado. Mande para ela por mensagem direta; ao abrir, ela já entra."); }
        catch (e) { await dialog({ title: "Copie o link", html: `<textarea class="field" rows="5" readonly>${esc(inv)}</textarea>`, ok: "Fechar", cancel: null }); }
        break;
      }
      case "sync-show-code": await dialog({ title: "Código do casal", text: "Quem tiver este código vê e edita tudo. Trate como senha.", html: `<p class="tnum" style="font-size:1.3rem;font-weight:700;letter-spacing:0.04em;margin-top:12px">${esc(FT.sync.code)}</p>`, ok: "Fechar", cancel: null }); break;
      case "sync-disconnect": {
        const r = await dialog({ title: "Desligar a sincronização?", text: "Este aparelho mantém os dados que tem agora, mas para de enviar e receber mudanças.", ok: "Desligar", danger: true });
        if (r.value === "ok") { FT.sync.disconnect(); toast("Sincronização desligada neste aparelho."); render({ keepScroll: true }); }
        break;
      }
      case "bk-list": {
        const box = $("#bkList"); if (!box) break;
        box.innerHTML = '<p class="small muted">Buscando…</p>';
        bkPoints = await FT.backup.points();
        box.innerHTML = bkPoints.length ? bkPoints.map((p, i) => `<div class="row row--between row--wrap" style="padding:8px 0;border-top:1px solid var(--line,#ddd)"><span class="small"><strong>${esc(short(p.day))}</strong> · ${p.src === "nuvem" ? "na nuvem" : "neste aparelho"}</span><button class="btn btn--quiet" type="button" data-act="bk-restore" data-i="${i}">Restaurar</button></div>`).join("") : '<p class="small muted">Ainda não há cópias. A primeira é criada ao abrir o app.</p>';
        break;
      }
      case "bk-now": FT.backup.runLocal(); await FT.backup.runCloud(true); toast("Cópia de hoje salva."); render({ keepScroll: true }); break;
      case "bk-restore": {
        const p = bkPoints[Number(el.dataset.i)]; if (!p) break;
        const r = await dialog({ title: "Restaurar a cópia de " + short(p.day) + "?", text: "Os dados deste aparelho voltam ao estado daquele dia. Se a sincronização estiver ligada, o outro aparelho recebe o mesmo.", ok: "Restaurar", danger: true });
        if (r.value === "ok") { try { FT.backup.restore(p.d); toast("Cópia restaurada."); render(); } catch (e) { toast("Essa cópia não pôde ser lida."); } }
        break;
      }
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
        const r = await dialog({ title: "Apagar todos os dados?", text: "Checklist, gastos, reservas e conversas deste aparelho serão apagados e a sincronização será desligada aqui (o outro aparelho não é afetado). Faça um backup antes, se quiser guardar.", ok: "Apagar tudo", danger: true });
        if (r.value === "ok") { FT.sync.disconnect(); store.reset(); recent = new Set(); toast("Dados apagados."); render(); }
        break;
      }
    }
  }

  function onChangeValue(act, el) {
    if (FT.extra && FT.extra.change(act, el)) return;
    const val = el.value;
    switch (act) {
      case "res-note": store.update(s => { const r = s.reservas[el.dataset.id] || { status: "Pendente", note: "" }; r.note = clamp(val, 300); s.reservas[el.dataset.id] = r; }); break;
    }
  }

  async function onSubmit(name, form) {
    if (FT.ai && await FT.ai.submit(name, form)) return;
    if (FT.extra && await FT.extra.submit(name, form)) return;
    const d = new FormData(form);
    switch (name) {
      case "add-item": {
        const title = clamp(d.get("title"), 140); if (!title) return;
        const ph = PHASES.some(x => x.id === form.dataset.phase) ? form.dataset.phase : "pre";
        let cat = "dias", day = 0;
        if (ph === "pre") cat = FT.CATS.some(c => c.id === d.get("cat")) ? d.get("cat") : "dias";
        else if (ph === "magic" || ph === "uni") { cat = "parques"; day = d.get("when") === "day" ? (ph === "magic" ? 7 : 9) : 0; }
        else if (ph === "volta") { const w = Number(d.get("when")); day = [11, 12, 13].includes(w) ? w : 0; }
        else { const n = Number(d.get("day")); day = n >= 4 && n <= 10 ? n : 4; }
        let due = /^\d{4}-\d{2}-\d{2}$/.test(d.get("due") || "") ? d.get("due") : "";
        if (!due && day >= 4 && day <= 12) due = FT.u.dayDate(day);
        store.update(s => { s.custom.push({ id: "u-" + uid(), cat, pri: ["e", "i", "o"].includes(d.get("pri")) ? d.get("pri") : "i", title, detail: "", due, day, phase: ph, custom: true }); });
        toast("Item adicionado."); render({ keepScroll: true }); break;
      }
      case "shop": { const nm = clamp(d.get("name"), 80); if (!nm) return; store.update(s => { s.shopping.push({ id: uid(), name: nm, who: shopWho === "camily" ? "camily" : "leo", done: false }); }); render({ keepScroll: true }); $("#shopName") && $("#shopName").focus(); break; }
      case "sync-config": { const ok = FT.sync.configure(String(d.get("cfg"))); toast(ok ? "Configuração salva." : "Não encontrei apiKey, projectId e appId nesse texto."); render({ keepScroll: true }); break; }
      case "sync-login-create": case "sync-login-enter": {
        const create = name === "sync-login-create";
        if (!create || !FT.sync.connected || (await dialog({ title: "Trocar para e-mail e senha?", text: "Seus dados continuam. O código e o convite antigos deixam de valer; a outra pessoa precisa entrar com o e-mail e a senha.", ok: "Trocar" })).value === "ok") {
          toast(create ? "Criando o login…" : "Entrando…");
          const r = await FT.sync.login(String(d.get("email")), String(d.get("pw")), create);
          toast({ ok: create ? "Pronto. Entre com o mesmo e-mail e senha no outro aparelho." : "Conectado. Os dados do casal vão aparecer aqui.", nodata: "Não achei dados com esse e-mail e senha. Confira ou use Criar login.", senha: "Use um e-mail válido e senha com 8 ou mais caracteres.", config: "Configure o Firebase primeiro (cole o convite de configuração).", timeout: "Sem resposta da nuvem. Verifique a internet e tente de novo." }[r] || "Não foi possível entrar.");
          render({ keepScroll: true });
        }
        break;
      }
      case "sync-join": { const ok = await FT.sync.join(String(d.get("invite"))); toast(ok ? (FT.sync.connected ? "Conectado. Os dados do casal vão aparecer aqui." : "Configuração salva. Agora entre com e-mail e senha.") : "Convite ou código inválido. Se for só o código, configure o Firebase antes."); render({ keepScroll: true }); break; }
      case "contact": store.update(s => { s.contacts = { name: clamp(d.get("name"), 60), phone: clamp(d.get("phone"), 30) }; }); toast("Contato salvo."); render({ keepScroll: true }); break;
    }
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw !== "object" || raw.v !== 2) throw new Error("formato");
      const r = await dialog({ title: "Restaurar este backup?", text: "Os dados atuais deste aparelho serão substituídos e a sincronização será desligada aqui.", ok: "Restaurar", danger: true });
      if (r.value === "ok") { FT.sync.disconnect(); store.replace(raw); toast("Backup restaurado."); render(); }
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
    if (FT.extra && FT.extra.input(el)) return;
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
  window.addEventListener("hashchange", () => { if (editor && location.hash !== "#/roteiro/" + editor.n) editor = null; });
  window.addEventListener("hashchange", onRoute);
  FT.sync.onUI = () => { if (location.hash === "#/ajustes") render({ keepScroll: true }); };

  /* Link de convite: abrir #/entrar/<convite> conecta direto, sem copiar e colar. */
  function acceptLink() {
    const m = location.hash.match(/^#\/entrar\/(.+)$/); if (!m) return;
    let inv = m[1]; try { inv = decodeURIComponent(inv); } catch (e) { /* usa como veio */ }
    history.replaceState(null, "", "#/inicio");
    setTimeout(async () => {
      if (inv.startsWith("FTRIP2.")) {
        const ok = await FT.sync.join(inv);
        toast(ok ? "Configuração salva. Entre com o e-mail e a senha." : "Link inválido.");
        if (ok) location.hash = "#/ajustes";
        return;
      }
      const r = await dialog({ title: "Entrar na nuvem do casal?", text: "Os dados do casal vão aparecer neste aparelho. O que já existe aqui e não estiver lá é enviado para a nuvem.", ok: "Entrar" });
      if (r.value !== "ok") return;
      const ok = await FT.sync.join(inv);
      toast(ok ? "Conectado. Os dados do casal vão aparecer aqui." : "Link inválido ou incompleto.");
      render({ keepScroll: true });
    }, 0);
  }
  window.addEventListener("hashchange", acceptLink);
  FT.app = { render, toast, dialog, stats, itemHTML, wxHTML };
  if (!location.hash) history.replaceState(null, "", FT.u.today() >= FT.TRIP.start && FT.u.today() <= FT.TRIP.end ? "#/hoje" : "#/inicio");
  acceptLink();
  onRoute();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    /* Nova versão publicada: recarrega sozinho, mas só se ninguém estiver digitando. */
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      const el = document.activeElement;
      if (editor || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      reloaded = true; location.reload();
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* sem offline, mas o app funciona */ }));
  }
})();
