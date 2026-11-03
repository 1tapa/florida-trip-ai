/* Avisos no celular: filas e atrações dos parques e prazos do checklist.
 * O envio é feito por um pequeno Worker (pasta worker/). Este arquivo só inscreve o aparelho e guarda,
 * neste aparelho, quais atrações vigiar. Nada do roteiro ou das reservas sai daqui. */
(function () {
  const FT = window.FT;
  const { esc, icon } = FT.u;
  const KEY = "floridaTripAI_push";
  const URL_PADRAO = ""; // endereço do Worker depois do deploy, ex.: https://florida-trip-push.SEU-USUARIO.workers.dev
  const safe = fn => { try { return fn(); } catch (e) { return undefined; } };
  const cfg = Object.assign({ url: "", vigiar: {}, max: 30, parque: "" }, safe(() => JSON.parse(localStorage.getItem(KEY) || "{}")) || {});
  const save = () => safe(() => localStorage.setItem(KEY, JSON.stringify(cfg)));
  const P = (FT.push = {});
  const ui = { estado: "carregando", parques: null, atracoes: null, carregando: false, erro: "" };

  const baseUrl = () => (cfg.url || URL_PADRAO).replace(/\/+$/, "");
  const suportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalado = () => safe(() => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
  const render = () => FT.app && FT.app.render({ keepScroll: true });
  const toast = m => FT.app && FT.app.toast(m);

  async function api(path, corpo) {
    const base = baseUrl(); if (!base) throw new Error("Falta o endereço do servidor de avisos.");
    const r = await fetch(base + path, corpo ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) } : {});
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "O servidor de avisos não respondeu (" + r.status + ").");
    return d;
  }
  const chaveBytes = b64 => { const s = (b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const inscricao = async () => { const reg = await navigator.serviceWorker.getRegistration(); return reg ? reg.pushManager.getSubscription() : null; };

  async function corpoInscricao(sub) {
    const j = sub.toJSON(), st = FT.store.state;
    return { endpoint: j.endpoint, keys: j.keys, feitos: Object.keys(st.checks || {}).slice(0, 400), ocultos: Object.keys(st.hidden || {}).slice(0, 400), vigiar: cfg.vigiar };
  }
  /** Manda ao servidor o que já foi feito e o que vigiar. Chamado ao abrir o app e ao mudar a lista. */
  async function sincronizar() {
    if (!suportado() || Notification.permission !== "granted" || !baseUrl()) return;
    const sub = await inscricao(); if (!sub) return;
    await api("/inscrever", await corpoInscricao(sub)).catch(() => {});
  }
  async function atualizarEstado() {
    if (!suportado()) { ui.estado = ehIos() && !instalado() ? "ios" : "sem"; return; }
    if (!baseUrl()) { ui.estado = "semurl"; return; }
    if (Notification.permission === "denied") { ui.estado = "bloqueado"; return; }
    const sub = await inscricao().catch(() => null);
    ui.estado = sub && Notification.permission === "granted" ? "ligado" : "desligado";
  }

  async function ligar() {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") { ui.estado = Notification.permission === "denied" ? "bloqueado" : "desligado"; return toast("Sem permissão, os avisos não chegam."); }
    const reg = await navigator.serviceWorker.ready;
    const { publica } = await api("/chave");
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(publica) }));
    await api("/inscrever", await corpoInscricao(sub));
    ui.estado = "ligado"; toast("Avisos ligados neste aparelho.");
  }
  async function desligar() {
    const sub = await inscricao();
    if (sub) { await api("/desinscrever", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    ui.estado = "desligado"; toast("Avisos desligados.");
  }
  async function carregarParques() { if (!ui.parques) ui.parques = (await api("/parques")).parques; return ui.parques; }
  async function carregarFilas() {
    if (!cfg.parque) return;
    ui.carregando = true; ui.erro = ""; render();
    try { ui.atracoes = (await api("/filas?parque=" + encodeURIComponent(cfg.parque))).atracoes; } catch (e) { ui.erro = e.message; ui.atracoes = null; }
    ui.carregando = false;
  }

  /* ---------- tela (seção em Ajustes) ---------- */
  const TXT = {
    carregando: "Verificando…",
    sem: "Este navegador não recebe avisos. No iPhone, abra o guia pelo ícone da Tela de Início (iOS 16.4 ou mais novo).",
    ios: "No iPhone: toque em Compartilhar → Adicionar à Tela de Início, abra o guia pelo ícone e só então ligue os avisos.",
    semurl: "Falta o endereço do servidor de avisos. Cole abaixo o endereço do Worker (veja worker/LEIAME.md).",
    bloqueado: "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.",
    desligado: "Desligados neste aparelho.",
    ligado: "Ligados neste aparelho."
  };
  const nVig = () => Object.keys(cfg.vigiar).length;

  P.section = function () {
    const e = !baseUrl() && ui.estado === "carregando" ? "semurl" : ui.estado;
    const botoes = e === "ligado"
      ? `<button class="btn" type="button" data-act="push-teste">Enviar aviso de teste</button><button class="btn btn--quiet" type="button" data-act="push-off">Desligar</button>`
      : e === "desligado" ? `<button class="btn btn--primary" type="button" data-act="push-on">${icon("bell") || ""} Ligar avisos</button>` : "";
    const urlBox = `<label class="label" for="pushUrl">Servidor de avisos</label><input class="field" id="pushUrl" data-act="push-url" value="${esc(cfg.url || URL_PADRAO)}" placeholder="https://florida-trip-push.seu-usuario.workers.dev" autocapitalize="off" spellcheck="false" inputmode="url">`;
    const parquesSel = (ui.parques || []).map(p => `<option value="${esc(p.id)}"${String(p.id) === String(cfg.parque) ? " selected" : ""}>${esc(p.nome)}</option>`).join("");
    const lista = (ui.atracoes || []).slice().sort((a, b) => (b.aberta - a.aberta) || a.nome.localeCompare(b.nome)).map(a => {
      const k = cfg.parque + ":" + a.id, w = cfg.vigiar[k];
      return `<div class="row row--between" style="padding:8px 0;border-top:1px solid var(--line,#ddd);gap:8px"><span class="small"><strong>${esc(a.nome)}</strong><br><span class="muted">${a.aberta ? a.espera + " min agora" : "fechada agora"}</span></span><button class="btn ${w ? "btn--primary" : "btn--quiet"} btn--sm" type="button" data-act="push-watch" data-key="${esc(k)}" data-name="${esc(a.nome)}">${w ? "Vigiando ≤ " + w.max + " min" : "Vigiar"}</button></div>`;
    }).join("");
    const vigiadas = Object.entries(cfg.vigiar).map(([k, w]) => `<span class="chip">${esc(w.n)} ≤ ${w.max} min <button class="btn btn--quiet btn--sm" type="button" data-act="push-watch" data-key="${esc(k)}" data-name="${esc(w.n)}" aria-label="Parar de vigiar ${esc(w.n)}">×</button></span>`).join(" ");
    return `<section class="section"><div class="section__head"><h2 class="h-section">Avisos no celular</h2></div><div class="stack">
      <p class="small muted">${esc(TXT[e] || "")} Você recebe: <strong>filas e atrações dos parques</strong> que escolher abaixo (conferidas a cada 5 minutos entre 3 e 12/12, das 8h às 23h de Orlando) e um <strong>resumo dos prazos do checklist</strong> às 9h. O que você já marcou como feito não gera aviso.</p>
      <div class="btn-row">${botoes}</div>
      ${e === "semurl" || cfg.url ? urlBox : ""}
      <div class="sheet sheet--pad"><strong>Atrações para vigiar</strong>
        <p class="small muted" style="margin-top:6px">Aviso quando a fila ficar igual ou menor que o tempo que escolher, e quando uma atração fechada reabrir.</p>
        <div class="btn-row" style="margin:8px 0">${[15, 20, 30, 45].map(n => `<button class="btn btn--sm ${cfg.max === n ? "btn--primary" : "btn--quiet"}" type="button" data-act="push-max" data-n="${n}">≤ ${n} min</button>`).join("")}</div>
        <div class="btn-row"><select class="field" id="pushParque" data-act="push-parque" aria-label="Parque">${parquesSel ? '<option value="">Escolha o parque</option>' + parquesSel : '<option value="">Toque em Carregar parques</option>'}</select>${ui.parques ? "" : `<button class="btn" type="button" data-act="push-parques">Carregar parques</button>`}${cfg.parque ? `<button class="btn" type="button" data-act="push-filas">${ui.carregando ? "Carregando…" : "Ver filas agora"}</button>` : ""}</div>
        ${ui.erro ? `<p class="small" style="color:var(--alert)">${esc(ui.erro)}</p>` : ""}
        ${vigiadas ? `<p class="small" style="margin-top:10px"><strong>Vigiando (${nVig()}):</strong> ${vigiadas}</p>` : ""}
        <div>${lista}</div>
        <p class="small muted" style="margin-top:10px">Tempos de fila por <a href="https://queue-times.com/" target="_blank" rel="noopener">Queue-Times.com</a>. São estimativas de terceiros e podem atrasar alguns minutos.</p>
      </div></div></section>`;
  };

  P.act = async function (act, el) {
    if (!act.startsWith("push-")) return false;
    try {
      switch (act) {
        case "push-on": await ligar(); break;
        case "push-off": await desligar(); break;
        case "push-teste": { const sub = await inscricao(); if (!sub) throw new Error("Este aparelho não está inscrito."); await sincronizar(); await api("/teste", { endpoint: sub.endpoint }); toast("Aviso de teste enviado."); return true; }
        case "push-parques": await carregarParques(); break;
        case "push-filas": await carregarFilas(); break;
        case "push-max": cfg.max = Number(el.dataset.n) || 30; save(); break;
        case "push-watch": {
          const k = el.dataset.key;
          if (cfg.vigiar[k]) delete cfg.vigiar[k]; else if (nVig() >= 40) throw new Error("Máximo de 40 atrações vigiadas."); else cfg.vigiar[k] = { n: el.dataset.name, max: cfg.max };
          save(); sincronizar(); break;
        }
      }
    } catch (e) { toast(e.message || "Não deu certo."); }
    await atualizarEstado(); render(); return true;
  };
  P.change = function (act, el) {
    if (act === "push-url") { cfg.url = String(el.value || "").trim().slice(0, 200); save(); ui.parques = null; atualizarEstado().then(render); return true; }
    if (act === "push-parque") { cfg.parque = el.value; ui.atracoes = null; ui.erro = ""; save(); if (cfg.parque) carregarFilas().then(render); else render(); return true; }
    return false;
  };
  P.init = async function () {
    await atualizarEstado();
    if (baseUrl()) carregarParques().then(render).catch(() => {});
    setTimeout(sincronizar, 4000);
  };
  window.addEventListener("load", () => setTimeout(P.init, 500));
})();
