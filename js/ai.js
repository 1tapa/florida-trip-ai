/* Concierge de IA: conversa (só responde) e alteração do roteiro (propõe, você revisa, aplica, desfaz). */
(function () {
  const FT = (window.FT = window.FT || {});
  const { esc, icon, clamp, uid } = FT.u;
  const URL_API = "https://api.openai.com/v1/responses";
  const live = {}; // propostas em memória: id da mensagem -> proposta (não sobrevivem a recarregar a página)
  let busy = false;
  let draft = "";

  class AIError extends Error {
    constructor(msg) { super(msg); this.user = msg; }
  }

  /* ---------- chamada à API ---------- */
  async function call({ instructions, input, json, maxTokens, timeout }) {
    const key = FT.store.apiKey();
    if (!key) throw new AIError("Conecte sua chave da OpenAI para usar o concierge.");
    const body = { model: FT.store.state.ai.model, instructions, input, max_output_tokens: maxTokens, store: false };
    if (json) body.text = { format: { type: "json_object" } };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(URL_API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      if (e && e.name === "AbortError") throw new AIError("A OpenAI demorou demais para responder. Tente de novo.");
      throw new AIError("Sem conexão com a OpenAI. Verifique a internet e tente de novo.");
    } finally { clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* corpo vazio */ }
    if (!res.ok) {
      const detail = data && data.error && data.error.message ? String(data.error.message).slice(0, 200) : "";
      if (res.status === 401) throw new AIError("A OpenAI recusou a chave. Confira a chave ou crie uma nova.");
      if (res.status === 429) throw new AIError("Limite de uso ou saldo da conta OpenAI esgotado. Veja o painel da OpenAI.");
      if (res.status === 404) throw new AIError("Modelo não encontrado nesta conta. Troque o modelo nos ajustes da IA.");
      throw new AIError("A OpenAI devolveu um erro (" + res.status + ")." + (detail ? " " + detail : ""));
    }
    if (data && data.status === "incomplete") throw new AIError("A resposta veio cortada por ser longa demais. Peça uma mudança menor.");
    return extractText(data);
  }

  function extractText(data) {
    if (!data) return "";
    if (typeof data.output_text === "string" && data.output_text) return data.output_text;
    let out = "";
    for (const item of data.output || []) {
      if (item && item.type === "message") for (const c of item.content || []) if (c && c.type === "output_text" && typeof c.text === "string") out += c.text;
    }
    return out;
  }

  /* ---------- contexto enviado ao modelo ---------- */
  function scheduleLine(b) { return b[0] + " " + b[1]; }

  function summaryContext() {
    const S = FT.store.state, T = FT.TRIP;
    const days = FT.store.days(), plans = FT.store.plans();
    const st = checklistStats();
    const lines = [
      "Hoje: " + FT.u.today() + ".",
      "Viagem: 2 adultos, de 04/12/2026 a 12/12/2026. Chegada em MIA (Miami) 04/12 às 06h30; saída de MCO (Orlando) 12/12 às 18h15.",
      "Hotéis: Lauderdale-by-the-Sea (04 a 06/12) e Ramada em Kissimmee (06 a 12/12). Carro alugado: retirada no MIA, devolução no MCO.",
      "Checklist: " + st.pending + " itens pendentes, " + st.essentialPending + " essenciais pendentes, " + st.late + " atrasados.",
      "ROTEIRO ATUAL:"
    ];
    days.forEach((d, i) => {
      lines.push("Dia " + Number(d.date) + " (" + d.dow + ") " + d.title + " | " + d.where);
      lines.push("  " + plans[i].schedule.map(scheduleLine).join("; "));
    });
    return lines.join("\n");
  }

  function checklistStats() {
    const today = FT.u.today();
    let pending = 0, essentialPending = 0, late = 0;
    for (const it of FT.store.items()) {
      if (FT.store.state.checks[it.id]) continue;
      pending++;
      if (it.pri === "e") essentialPending++;
      if (it.due && it.due < today) late++;
    }
    return { pending, essentialPending, late };
  }

  function fullPlan() {
    const days = FT.store.days(), plans = FT.store.plans();
    return days.map((d, i) => ({
      day: Number(d.date), title: d.title, where: d.where, desc: d.desc, tags: d.tags, tip: d.tip || "",
      schedule: plans[i].schedule, alternatives: plans[i].alternatives
    }));
  }

  const ASK_INSTRUCTIONS = [
    "Você é o concierge do caderno de viagem de um casal brasileiro que vai à Flórida em dezembro de 2026.",
    "Responda em português do Brasil, de forma direta e prática, em até 180 palavras. Use listas curtas só quando ajudarem.",
    "Baseie-se no roteiro abaixo. Para preços, horários, regras de parques, pedágio, alfândega e qualquer dado que muda, diga que a pessoa deve confirmar na fonte oficial e não invente números.",
    "Se a pessoa pedir para mudar o roteiro ou o checklist, explique que deve usar o modo Fazer alterações (ele muda roteiro, checklist e as listas de compras do Leo e da Camily).",
    "Você não reserva, compra nem confirma nada."
  ].join("\n");

  const EDIT_INSTRUCTIONS = [
    "Você edita o roteiro de uma viagem de 2 adultos à Flórida (04 a 12 de dezembro de 2026) a pedido do usuário.",
    "Responda SOMENTE com um objeto JSON válido, sem texto fora dele, neste formato:",
    '{"summary": "1 a 3 frases em português dizendo o que mudou e por quê", "notes": ["no máximo 3 avisos curtos, ex.: confirmar horário"], "days": [ {"day": 7, "title": "...", "where": "...", "desc": "...", "tags": ["..."], "tip": "...", "schedule": [["09:00", "Título", "Descrição", "Local para o mapa (opcional)"]], "alternatives": [["Nome", "Texto"]]} ], "checklist_add": [ {"cat": "mala", "pri": "i", "title": "...", "detail": "...", "due": "AAAA-MM-DD ou vazio", "day": 0} ], "shopping_add": [{"name": "item", "who": "leo"}], "shopping_remove": ["nome exato de um item da lista"]}',
    "Regras:",
    "- Em days, inclua APENAS os dias que mudam, e dentro de cada dia APENAS os campos que mudam, mais o campo day (4 a 12). Se mudar schedule, envie a programação completa daquele dia, em ordem de horário.",
    "- Cada bloco de schedule é [horário, título, descrição] e, opcionalmente, um quarto item com um local pesquisável no mapa.",
    "- shopping_add e shopping_remove são opcionais. A lista de compras é dividida em duas: who \"leo\" ou who \"camily\" (se não souber de quem é, use leo). Use as compras que vêm junto com o roteiro e não repita itens que já existem.",
    "- checklist_add é opcional (até 8 itens). cat deve ser um destes: " + FT.CATS.map(c => c.id).join(", ") + ". pri: e (essencial), i (importante) ou o (opcional). day: 0 se não for um dia específico.",
    "- Se o usuário disser que editou um dia manualmente, o roteiro enviado já traz as alterações dele: preserve os blocos que ele escreveu (horário e título) e apenas complemente o que faltar, sem reescrever o dia.",
    "- Preserve tudo que o usuário não pediu para mudar. Mantenha chegada ao MIA às 06h30 no dia 4 e estar no MCO por volta das 15h no dia 12 (voo às 18h15), os ingressos de cada dia (Magic Kingdom no dia 7 e Universal no dia 9; não vão ao Kennedy Space Center nem à festa de Natal), a menos que o usuário peça outra coisa.",
    "- Não invente reservas, preços, ingressos comprados nem horários oficiais. Quando um horário depender de confirmação, diga isso em notes.",
    "- Se o pedido estiver vago ou não exigir mudança, devolva days vazio e explique em summary o que você precisa saber."
  ].join("\n");

  function history(messages) {
    return messages.filter(m => m.kind !== "error").slice(-6).map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text.slice(0, 1500) }));
  }

  /* ---------- validação da proposta ---------- */
  const DAY_FIELDS = { title: 90, where: 140, desc: 600, tip: 300 };

  function cleanSchedule(v) {
    if (!Array.isArray(v)) return null;
    const out = [];
    for (const b of v.slice(0, 20)) {
      let time, title, desc, place;
      if (Array.isArray(b)) [time, title, desc, place] = b;
      else if (b && typeof b === "object") ({ time, title, desc, place } = b);
      else continue;
      time = clamp(typeof time === "string" ? time : "", 20);
      title = clamp(typeof title === "string" ? title : "", 90);
      if (!time || !title) continue;
      const row = [time, title, clamp(typeof desc === "string" ? desc : "", 450)];
      const p = clamp(typeof place === "string" ? place : "", 100);
      if (p) row.push(p);
      out.push(row);
    }
    return out.length >= 2 ? out : null;
  }

  function cleanAlternatives(v) {
    if (!Array.isArray(v)) return null;
    const out = [];
    for (const a of v.slice(0, 6)) {
      let name, text;
      if (Array.isArray(a)) [name, text] = a; else if (a && typeof a === "object") ({ name, text } = a); else continue;
      name = clamp(typeof name === "string" ? name : "", 80); text = clamp(typeof text === "string" ? text : "", 450);
      if (name && text) out.push([name, text]);
    }
    return out;
  }

  /* Devolve { summary, notes, days:[{day, changes}], add:[...] } ou lança AIError. */
  function sanitizeProposal(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AIError("A IA não devolveu uma proposta no formato esperado. Nada foi alterado.");
    const summary = clamp(raw.summary, 500) || "Proposta de alteração.";
    const notes = (Array.isArray(raw.notes) ? raw.notes : []).filter(n => typeof n === "string").map(n => clamp(n, 200)).filter(Boolean).slice(0, 3);
    const days = [];
    const seen = new Set();
    for (const d of Array.isArray(raw.days) ? raw.days : []) {
      if (!d || typeof d !== "object") continue;
      const n = Number(d.day);
      if (!Number.isInteger(n) || n < 4 || n > 12 || seen.has(n)) continue;
      const changes = {};
      for (const [f, max] of Object.entries(DAY_FIELDS)) if (typeof d[f] === "string" && clamp(d[f], max)) changes[f] = clamp(d[f], max);
      if (Array.isArray(d.tags)) {
        const tags = d.tags.filter(t => typeof t === "string").map(t => clamp(t, 24)).filter(Boolean).slice(0, 4);
        if (tags.length) changes.tags = tags;
      }
      if (d.schedule !== undefined) {
        const s = cleanSchedule(d.schedule);
        if (!s) throw new AIError("A programação do dia " + n + " veio incompleta. Nada foi alterado; tente de novo.");
        changes.schedule = s;
      }
      if (d.alternatives !== undefined) {
        const a = cleanAlternatives(d.alternatives);
        if (a) changes.alternatives = a;
      }
      if (Object.keys(changes).length) { seen.add(n); days.push({ day: n, changes }); }
    }
    const add = [];
    for (const it of Array.isArray(raw.checklist_add) ? raw.checklist_add : []) {
      if (!it || typeof it !== "object" || add.length >= 8) continue;
      const title = clamp(it.title, 140);
      if (!title || !FT.CATS.some(c => c.id === it.cat)) continue;
      const day = Number.isInteger(it.day) && it.day >= 0 && it.day <= 13 ? it.day : 0;
      add.push({
        id: "ai-" + uid(), cat: it.cat, pri: ["e", "i", "o"].includes(it.pri) ? it.pri : "i", title,
        detail: clamp(it.detail, 600), due: /^\d{4}-\d{2}-\d{2}$/.test(it.due || "") ? it.due : "", day, custom: true, ai: true
      });
    }
    const names = v => (Array.isArray(v) ? v : []).filter(x => typeof x === "string").map(x => clamp(x, 80)).filter(Boolean).slice(0, 10);
    const existing = FT.store.state.shopping;
    const who = v => (String(v || "").toLowerCase().startsWith("c") ? "camily" : "leo");
    const shopAdd = (Array.isArray(raw.shopping_add) ? raw.shopping_add : []).map(x => typeof x === "string" ? { name: clamp(x, 80), who: "leo" } : x && typeof x === "object" && typeof x.name === "string" ? { name: clamp(x.name, 80), who: who(x.who) } : null)
      .filter(x => x && x.name).slice(0, 10)
      .filter((x, i, a) => a.findIndex(m => m.name.toLowerCase() === x.name.toLowerCase() && m.who === x.who) === i && !existing.some(e => e.name.toLowerCase() === x.name.toLowerCase() && (e.who || "leo") === x.who));
    const shopRemove = names(raw.shopping_remove).map(n => existing.find(x => x.name.toLowerCase() === n.toLowerCase())).filter(Boolean).map(x => x.id);
    return { summary, notes, days, add, shopAdd, shopRemove };
  }

  function parseJson(text) {
    let t = String(text || "").trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
    if (fence) t = fence[1].trim();
    try { return JSON.parse(t); } catch (e) { throw new AIError("Não consegui ler a resposta da IA. Nada foi alterado. Tente de novo."); }
  }

  /* ---------- aplicar e desfazer ---------- */
  function apply(proposal) {
    const S = FT.store.state;
    const snapshot = { days: S.days, plans: S.plans, custom: S.custom.slice(), shopping: S.shopping.map(x => Object.assign({}, x)), at: Date.now(), label: proposal.summary };
    const days = JSON.parse(JSON.stringify(FT.store.days()));
    const plans = JSON.parse(JSON.stringify(FT.store.plans()));
    for (const { day, changes } of proposal.days) {
      const i = day - 4;
      for (const f of ["title", "where", "desc", "tip", "tags"]) if (changes[f] !== undefined) days[i][f] = changes[f];
      if (changes.schedule) plans[i].schedule = changes.schedule;
      if (changes.alternatives) plans[i].alternatives = changes.alternatives;
    }
    FT.store.update(s => {
      s.undo = snapshot;
      if (proposal.days.length) { s.days = days; s.plans = plans; }
      s.custom = s.custom.concat(proposal.add);
      if (proposal.shopRemove.length) s.shopping = s.shopping.filter(x => !proposal.shopRemove.includes(x.id));
      for (const x of proposal.shopAdd) s.shopping.push({ id: uid(), name: x.name, who: x.who, done: false });
    });
  }

  function undo() {
    const U = FT.store.state.undo;
    if (!U) return false;
    FT.store.update(s => { s.days = U.days || null; s.plans = U.plans || null; s.custom = U.custom; if (U.shopping) s.shopping = U.shopping; s.undo = null; });
    return true;
  }

  /* ---------- fluxo das mensagens ---------- */
  function push(role, text, extra) {
    const m = Object.assign({ id: uid(), role, text, kind: "", applied: false }, extra || {});
    FT.store.update(s => { s.ai.messages.push(m); s.ai.messages = s.ai.messages.slice(-40); });
    return m;
  }

  async function send(text) {
    text = clamp(text, 1200);
    if (!text || busy) return;
    const S = FT.store.state;
    const hist = history(S.ai.messages);
    push("user", text);
    busy = true; draft = "";
    FT.app.render({ keepScroll: true });
    scrollThreadEnd();
    try {
      if (S.ai.mode === "edit") {
        const input = hist.concat([{ role: "user", content: "ROTEIRO ATUAL (JSON):\n" + JSON.stringify({ roteiro: fullPlan(), compras: { leo: FT.store.state.shopping.filter(x => (x.who || "leo") === "leo").map(x => x.name), camily: FT.store.state.shopping.filter(x => x.who === "camily").map(x => x.name) } }) + "\n\nHoje: " + FT.u.today() + "\n\nPEDIDO (responda em JSON):\n" + text }]);
        const out = await call({ instructions: EDIT_INSTRUCTIONS, input, json: true, maxTokens: 9000, timeout: 90000 });
        const proposal = sanitizeProposal(parseJson(out));
        const m = push("bot", proposal.summary);
        if (proposal.days.length || proposal.add.length || proposal.shopAdd.length || proposal.shopRemove.length) live[m.id] = proposal;
      } else {
        const input = hist.concat([{ role: "user", content: text }]);
        const out = await call({ instructions: ASK_INSTRUCTIONS + "\n\n" + summaryContext(), input, json: false, maxTokens: 900, timeout: 45000 });
        push("bot", out.trim() || "A IA não devolveu texto. Tente reformular a pergunta.");
      }
    } catch (e) {
      push("bot", e instanceof AIError ? e.user : "Algo deu errado ao falar com a IA. Nada foi alterado.", { kind: "error" });
    } finally {
      busy = false;
      FT.app.render({ keepScroll: true });
      scrollThreadEnd();
    }
  }

  function scrollThreadEnd() {
    const el = document.querySelector(".cc__composer");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "end", behavior: "auto" });
  }

  /* Texto para colar no ChatGPT quando não há chave. */
  function fallbackPrompt(question) {
    return [
      "Atue como concierge de viagem de um casal brasileiro na Flórida (04 a 12 de dezembro de 2026).",
      "Responda em português, de forma prática, e diga quando algo precisa ser confirmado em fonte oficial.",
      "", summaryContext(), "", "PERGUNTA: " + (clamp(question, 1200) || "Sugira ajustes para deixar o roteiro mais leve.")
    ].join("\n");
  }

  /* ---------- tela ---------- */
  function richText(text) {
    const blocks = String(text).split(/\n{2,}/);
    return blocks.map(b => {
      const lines = b.split("\n").filter(l => l.trim());
      if (lines.length && lines.every(l => /^\s*[-•*]\s+/.test(l))) {
        return "<ul>" + lines.map(l => "<li>" + inline(l.replace(/^\s*[-•*]\s+/, "")) + "</li>").join("") + "</ul>";
      }
      return "<p>" + lines.map(inline).join("<br>") + "</p>";
    }).join("");
  }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }

  function diffRows(day, ch) {
    const days = FT.store.days(), plans = FT.store.plans();
    const old = days[day - 4], oldPlan = plans[day - 4];
    const rows = [];
    const swap = (label, a, b) => rows.push(`<div class="proposal__diff">${esc(label)}: <s>${esc(a)}</s> → ${esc(b)}</div>`);
    if (ch.title !== undefined && ch.title !== old.title) swap("Título", old.title, ch.title);
    if (ch.where !== undefined && ch.where !== old.where) swap("Roteiro", old.where, ch.where);
    if (ch.desc !== undefined && ch.desc !== old.desc) rows.push(`<div class="proposal__diff">Resumo do dia atualizado: ${esc(ch.desc)}</div>`);
    if (ch.tip !== undefined && ch.tip !== old.tip) rows.push(`<div class="proposal__diff">Dica atualizada: ${esc(ch.tip)}</div>`);
    if (ch.schedule) {
      const oldT = oldPlan.schedule.map(b => b[1]), newT = ch.schedule.map(b => b[1]);
      const added = newT.filter(t => !oldT.includes(t)), removed = oldT.filter(t => !newT.includes(t));
      const timesChanged = !added.length && !removed.length && JSON.stringify(oldPlan.schedule.map(b => b[0])) !== JSON.stringify(ch.schedule.map(b => b[0]));
      let t = `Programação: ${oldT.length} → ${newT.length} blocos.`;
      if (added.length) t += " Entram: " + added.slice(0, 6).map(esc).join("; ") + ".";
      if (removed.length) t += " Saem: " + removed.slice(0, 6).map(esc).join("; ") + ".";
      if (timesChanged) t += " Horários ajustados.";
      rows.push(`<div class="proposal__diff">${t}</div>`);
    }
    if (ch.alternatives) rows.push(`<div class="proposal__diff">Planos B atualizados (${ch.alternatives.length}).</div>`);
    if (ch.tags) rows.push(`<div class="proposal__diff">Etiquetas: ${ch.tags.map(esc).join(", ")}.</div>`);
    return rows.join("") || '<div class="proposal__diff">Sem diferença visível.</div>';
  }

  function proposalHTML(m, p) {
    const days = FT.store.days();
    const rows = p.days.map(({ day, changes }) => `<div class="proposal__day">${icon("edit")}<div><div class="proposal__label">Dia ${day} · ${esc(days[day - 4].title)}</div>${diffRows(day, changes)}</div></div>`);
    if (p.add.length) {
      rows.push(`<div class="proposal__day">${icon("checklist")}<div><div class="proposal__label">Novos itens no checklist (${p.add.length})</div>${p.add.map(a => {
        const cat = FT.CATS.find(c => c.id === a.cat);
        return `<div class="proposal__diff">${esc(a.title)} <span class="muted">· ${esc(cat ? cat.short : "")}</span></div>`;
      }).join("")}</div></div>`);
    }
    if (p.shopAdd.length || p.shopRemove.length) {
      const S = FT.store.state;
      rows.push(`<div class="proposal__day">${icon("bag")}<div><div class="proposal__label">Listas de compras</div>${p.shopAdd.map(x => `<div class="proposal__diff">Entra (${x.who === "camily" ? "Camily" : "Leo"}): ${esc(x.name)}</div>`).join("")}${p.shopRemove.map(id => `<div class="proposal__diff">Sai: <s>${esc((S.shopping.find(x => x.id === id) || {}).name || "")}</s></div>`).join("")}</div></div>`);
    }
    const notes = p.notes.length ? `<div class="proposal__day">${icon("info")}<div><div class="proposal__label">Para conferir</div>${p.notes.map(n => `<div class="proposal__diff">${esc(n)}</div>`).join("")}</div></div>` : "";
    return `<div class="proposal">${rows.join("")}${notes}<div class="proposal__foot"><button class="btn btn--primary btn--sm" data-act="ai-apply" data-id="${esc(m.id)}">${icon("check")} Aplicar mudanças</button><button class="btn btn--sm" data-act="ai-discard" data-id="${esc(m.id)}">Descartar</button></div></div>`;
  }

  function messageHTML(m) {
    const cls = m.role === "user" ? "msg msg--user" : m.kind === "error" ? "msg msg--bot msg--error" : "msg msg--bot";
    let extra = "";
    if (m.role === "bot" && live[m.id]) extra = proposalHTML(m, live[m.id]);
    else if (m.applied) extra = `<div class="chips" style="margin-top:8px"><span class="chip chip--ok">${icon("check")} Aplicado</span></div>`;
    return `<div class="${cls}"><div class="msg__who">${m.role === "user" ? "Você" : "Concierge"}</div><div class="msg__body">${richText(m.text)}${extra}</div></div>`;
  }

  const CHIPS = {
    ask: ["O que levar na mochila dos parques?", "Como funcionam os pedágios do carro?", "Plano B se chover no dia 7", "O que não pode trazer na bagagem?"],
    edit: ["Deixe o dia 5 mais leve", "Troque o Sawgrass por descanso no dia 6", "Inclua jantar no Disney Springs no dia 8", "Adicione ao checklist itens para dias de chuva"]
  };

  function view() {
    const S = FT.store.state, mode = S.ai.mode, hasKey = !!FT.store.apiKey();
    const hint = mode === "edit"
      ? "A IA propõe mudanças no roteiro, no checklist e nas listas de compras. Você vê o antes e o depois e decide se aplica. Dá para desfazer."
      : "Tire dúvidas sobre o roteiro, parques, carro e compras. Aqui nada é alterado.";
    const setup = hasKey ? "" : `
      <section class="sheet sheet--pad cc__setup" aria-labelledby="ccSetup">
        <h2 class="h-section" id="ccSetup">Conecte sua chave da OpenAI</h2>
        <ol class="cc__steps">
          <li>Crie uma chave em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>.</li>
          <li>Cole a chave abaixo. Ela fica guardada só neste navegador.</li>
          <li>Cada pergunta é cobrada na sua conta da OpenAI, em geral alguns centavos.</li>
        </ol>
        <form data-form="ai-key" class="stack" style="margin-top:14px">
          <label class="label" for="aiKey" style="margin-top:0">Chave da API</label>
          <input class="field" id="aiKey" name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-…" required>
          <div class="callout callout--alert">${icon("alert")}<div><strong>Use uma chave só para este app</strong>Defina um limite mensal de gasto no painel da OpenAI. Quem usar este aparelho consegue ver a chave.</div></div>
          <button class="btn btn--primary" type="submit">Conectar</button>
        </form>
      </section>`;

    const msgs = S.ai.messages;
    const thread = msgs.length
      ? msgs.map(messageHTML).join("")
      : `<div class="msg msg--bot"><div class="msg__who">Concierge</div><div class="msg__body"><p>Olá! Eu conheço o seu roteiro dia a dia, o checklist e as listas de compras do Leo e da Camily.</p><p>${mode === "edit" ? "Diga o que quer mudar, por exemplo: deixar um dia mais leve, trocar um passeio ou incluir uma refeição." : "Pergunte o que quiser sobre a viagem. Para mudar o roteiro, use a aba Fazer alterações."}</p></div></div>`;
    const typing = busy ? `<div class="msg msg--bot msg--typing" role="status"><div class="msg__who">Concierge</div><div class="msg__body"><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span> <span>${mode === "edit" ? "Montando a proposta…" : "Pensando…"}</span></div></div>` : "";

    const undoBar = S.undo ? `<div class="callout callout--info" style="margin-top:16px">${icon("undo")}<div style="flex:1"><strong>Última alteração aplicada</strong>${esc(S.undo.label || "")}<div style="margin-top:8px"><button class="btn btn--sm" data-act="ai-undo">${icon("undo")} Desfazer</button></div></div></div>` : "";

    const composer = hasKey ? `
      <div class="cc__composer">
        <div class="cc__chips">${CHIPS[mode].map(c => `<button class="filter-chip" type="button" data-act="ai-chip" data-text="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        <form class="cc__inputrow" data-form="ai-send">
          <label class="sr" for="aiq">${mode === "edit" ? "O que você quer mudar?" : "Sua pergunta"}</label>
          <textarea class="field" id="aiq" name="q" rows="1" maxlength="1200" placeholder="${mode === "edit" ? "O que você quer mudar no roteiro?" : "Pergunte sobre a viagem"}"${busy ? " disabled" : ""}>${esc(draft)}</textarea>
          <button class="btn btn--primary btn--icon" type="submit" aria-label="Enviar"${busy ? " disabled" : ""}>${icon("send")}</button>
        </form>
      </div>` : "";

    const fallback = `
      <section class="cc__fallback">
        <details class="alt">
          <summary>Sem chave? Use o ChatGPT${icon("chev-d")}</summary>
          <p>Escreva sua pergunta abaixo e copie o texto pronto, com o seu roteiro incluído. Depois é só colar no ChatGPT ou em outra IA.</p>
          <form data-form="ai-copy" class="stack" style="padding-bottom:14px">
            <label class="sr" for="aiCopyQ">Pergunta</label>
            <textarea class="field" id="aiCopyQ" name="q" rows="2" maxlength="1200" placeholder="Ex.: monte um plano B para um dia de chuva no Magic Kingdom"></textarea>
            <button class="btn" type="submit">${icon("note")} Copiar texto para colar</button>
          </form>
        </details>
      </section>`;

    const clear = msgs.length ? `<div style="margin-top:14px"><button class="btn btn--quiet btn--sm" data-act="ai-clear">Limpar conversa</button></div>` : "";

    return `
      <header class="page-head">
        <div class="page-head__row">
          <h1 class="h-page">Concierge</h1>
          <button class="cc__status${hasKey ? " cc__status--on" : ""}" type="button" data-act="ai-key">${hasKey ? "IA conectada" : "IA desligada"}</button>
        </div>
        <p class="lede">Dúvidas e mudanças no roteiro, com a sua confirmação antes de qualquer alteração.</p>
      </header>
      ${setup}
      <div class="cc__modes">
        <div class="segmented" role="group" aria-label="Modo">
          <button type="button" data-act="ai-mode" data-v="ask" aria-pressed="${mode === "ask"}">Conversar</button>
          <button type="button" data-act="ai-mode" data-v="edit" aria-pressed="${mode === "edit"}">Fazer alterações</button>
        </div>
        <p class="cc__mode-hint">${hint}</p>
      </div>
      <div class="cc__thread" aria-live="polite">${thread}${typing}</div>
      ${clear}${undoBar}
      ${composer}
      ${fallback}`;
  }

  /* ---------- ações vindas da tela ---------- */
  async function act(name, el) {
    const S = FT.store.state;
    switch (name) {
      case "ai-mode":
        FT.store.update(s => { s.ai.mode = el.dataset.v === "edit" ? "edit" : "ask"; });
        FT.app.render({ keepScroll: true });
        return true;
      case "ai-chip": {
        draft = el.dataset.text || "";
        FT.app.render({ keepScroll: true });
        const ta = document.getElementById("aiq");
        if (ta) { ta.focus(); ta.setSelectionRange(draft.length, draft.length); }
        return true;
      }
      case "ai-apply": {
        const p = live[el.dataset.id];
        if (!p) return true;
        apply(p);
        delete live[el.dataset.id];
        FT.store.update(s => { const m = s.ai.messages.find(x => x.id === el.dataset.id); if (m) m.applied = true; });
        FT.app.toast("Mudanças aplicadas. Você pode desfazer abaixo.");
        FT.app.render({ keepScroll: true });
        return true;
      }
      case "ai-discard":
        delete live[el.dataset.id];
        FT.app.toast("Proposta descartada. Nada foi alterado.");
        FT.app.render({ keepScroll: true });
        return true;
      case "ai-undo":
        if (undo()) FT.app.toast("Alteração desfeita.");
        FT.app.render({ keepScroll: true });
        return true;
      case "ai-clear": {
        const r = await FT.app.dialog({ title: "Limpar a conversa?", text: "As mensagens somem deste aparelho. O roteiro não muda.", ok: "Limpar" });
        if (r.value === "ok") { FT.store.update(s => { s.ai.messages = []; }); for (const k of Object.keys(live)) delete live[k]; FT.app.render({ keepScroll: true }); }
        return true;
      }
      case "ai-key": {
        if (!FT.store.apiKey()) {
          const f = document.getElementById("aiKey");
          if (f) { f.scrollIntoView({ block: "center" }); f.focus(); }
          return true;
        }
        const r = await FT.app.dialog({
          title: "Ajustes da IA",
          text: "A chave fica guardada só neste navegador.",
          html: `<label class="label" for="aiModel">Modelo</label><input class="field" id="aiModel" name="model" value="${esc(S.ai.model)}" autocapitalize="off" spellcheck="false"><p class="hint">Use o nome de um modelo disponível na sua conta OpenAI.</p>`,
          ok: "Salvar", extra: [{ label: "Remover chave", value: "remove", danger: true }]
        });
        if (r.value === "remove") { FT.ls.del(FT.KEYS.apiKey); if (FT.sync) FT.sync.pushKey(); FT.app.toast("Chave removida" + (FT.sync && FT.sync.connected ? " de todos os aparelhos." : " deste aparelho.")); FT.app.render({ keepScroll: true }); }
        else if (r.value === "ok") {
          const model = clamp(r.form.get("model"), 60);
          if (model) FT.store.update(s => { s.ai.model = model; });
          FT.app.toast("Ajustes salvos.");
        }
        return true;
      }
    }
    return false;
  }

  async function submit(name, form) {
    const data = new FormData(form);
    if (name === "ai-send") { await send(String(data.get("q") || "")); return true; }
    if (name === "ai-key") {
      const key = String(data.get("key") || "").trim();
      if (!/^[\w-]{20,}$/.test(key)) { FT.app.toast("Essa chave parece incompleta. Copie a chave inteira."); return true; }
      FT.ls.set(FT.KEYS.apiKey, key);
      if (FT.sync) FT.sync.pushKey();
      FT.app.toast("Chave conectada neste aparelho.");
      FT.app.render({ keepScroll: true });
      return true;
    }
    if (name === "ai-copy") {
      const text = fallbackPrompt(String(data.get("q") || ""));
      try { await navigator.clipboard.writeText(text); FT.app.toast("Texto copiado. Cole no ChatGPT."); }
      catch (e) {
        await FT.app.dialog({ title: "Copie este texto", html: `<textarea class="field" rows="8" readonly>${esc(text)}</textarea>`, ok: "Fechar", cancel: null });
      }
      return true;
    }
    return false;
  }

  function prefill(text, mode) {
    draft = text || "";
    if (mode) FT.store.update(s => { s.ai.mode = mode; });
  }

  FT.ai = { view, act, submit, send, apply, undo, prefill, setDraft(v) { draft = v; }, sanitizeProposal, parseJson, extractText, richText, fallbackPrompt, summaryContext, live, setBusy(v) { busy = v; } };
})();
