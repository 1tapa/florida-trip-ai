/* Avisos no celular do caderno de viagem (Cloudflare Worker).
 *  - filas e atrações dos parques (dados do Queue-Times.com), conferidas a cada 5 minutos nos dias de viagem;
 *  - prazos do checklist, um resumo por dia às 9h (Brasília).
 * Cada aparelho se inscreve pelo app. O servidor guarda só: o endereço de envio do aparelho, as chaves dele,
 * quais itens do checklist já foram feitos e quais atrações ele quer vigiar. Nada do roteiro ou das reservas. */
import { chavesVapid, enviarPush } from "./push.js";
import PRAZOS from "./prazos.json";

const ORIGENS = ["https://1tapa.github.io", "http://localhost:8000", "http://localhost:8080"];
const HOSTS_PUSH = /(^|\.)(googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|mozilla\.com|notify\.windows\.com)$/;
const JANELA = { de: "2026-12-03", ate: "2026-12-12" }; // dias da viagem (fuso de Orlando)
const PARQUES_BASE = [
  { id: 6, nome: "Magic Kingdom", achar: /magic kingdom/i },
  { id: 65, nome: "Universal Studios Florida", achar: /universal studios florida/i },
  { id: 64, nome: "Islands of Adventure", achar: /islands of adventure/i },
  { id: 334, nome: "Epic Universe", achar: /epic universe/i }
];
const MAX_SUBS = 20;
const TTL_SUB = 60 * 60 * 24 * 90;
const FONTE = "https://queue-times.com";

const json = (obj, status, origem) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "content-type": "application/json", ...cors(origem) } });
function cors(origem) {
  const h = { vary: "origin" };
  if (origem && ORIGENS.includes(origem)) { h["access-control-allow-origin"] = origem; h["access-control-allow-methods"] = "GET,POST,OPTIONS"; h["access-control-allow-headers"] = "content-type"; h["access-control-max-age"] = "86400"; }
  return h;
}
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");

/* ---------- datas ---------- */
export function partes(d, tz) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d);
  const g = t => f.find(p => p.type === t).value;
  return { data: `${g("year")}-${g("month")}-${g("day")}`, hora: Number(g("hour")), dia: g("weekday") };
}
const somaDias = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- filas ---------- */
async function parques(env) {
  const cache = await env.SUBS.get("parques", "json");
  if (cache && Date.now() - cache.em < 24 * 3600e3) return cache.lista;
  let lista = PARQUES_BASE.map(p => ({ id: p.id, nome: p.nome }));
  try {
    const r = await fetch(FONTE + "/parks.json", { headers: { "user-agent": "florida-trip-push (+https://1tapa.github.io/florida-trip-ai/)" } });
    if (r.ok) {
      const grupos = await r.json();
      const todos = (Array.isArray(grupos) ? grupos : []).flatMap(g => g.parks || []);
      lista = PARQUES_BASE.map(b => { const ach = todos.find(p => b.achar.test(p.name || "")); return { id: ach ? ach.id : b.id, nome: b.nome }; });
    }
  } catch (e) { /* usa os códigos conhecidos */ }
  await env.SUBS.put("parques", JSON.stringify({ em: Date.now(), lista }));
  return lista;
}

export async function filas(parqueId) {
  const r = await fetch(`${FONTE}/parks/${Number(parqueId)}/queue_times.json`, { headers: { "user-agent": "florida-trip-push (+https://1tapa.github.io/florida-trip-ai/)" }, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!r.ok) throw new Error("fonte " + r.status);
  const d = await r.json();
  const todas = [...(d.lands || []).flatMap(l => (l.rides || []).map(x => ({ ...x, area: l.name }))), ...(d.rides || [])];
  const vistos = new Set();
  return todas.filter(x => x && x.id != null && !vistos.has(x.id) && vistos.add(x.id)).map(x => ({ id: x.id, nome: String(x.name || "").slice(0, 80), aberta: !!x.is_open, espera: Number(x.wait_time) || 0, area: x.area ? String(x.area).slice(0, 60) : "" }));
}

/** Decide os avisos de filas de um aparelho. Muda `insc.estado` quando algo mudou. */
export function avisosDeFilas(insc, mapa) {
  const out = []; let mudou = false;
  insc.estado = insc.estado || {};
  for (const [chave, w] of Object.entries(insc.vigiar || {})) {
    const info = (mapa[chave.split(":")[0]] || {})[chave.split(":")[1]];
    if (!info) continue;
    const max = Math.max(5, Math.min(240, Number(w.max) || 30));
    const antes = insc.estado[chave];
    let agora = antes;
    if (!info.aberta) agora = "fechada";
    else if (info.espera <= max) agora = "ok";
    else if (info.espera > max + 5 || antes === "fechada" || !antes) agora = "alta";
    if (agora !== antes) {
      insc.estado[chave] = agora; mudou = true;
      if (agora === "ok") out.push(`${w.n || info.nome}: fila em ${info.espera} min`);
      else if (antes === "fechada" && info.aberta) out.push(`${w.n || info.nome} reabriu (${info.espera} min)`);
    }
  }
  return { avisos: out, mudou };
}

/* ---------- prazos do checklist ---------- */
export function avisoDePrazos(insc, hoje) {
  const feitos = new Set([...(insc.feitos || []), ...(insc.ocultos || [])]);
  const abertos = PRAZOS.filter(p => !feitos.has(p.id) && p.pri !== "o");
  const nomes = l => l.slice(0, 3).map(p => p.title).join("; ") + (l.length > 3 ? ` e mais ${l.length - 3}` : "");
  const hojeL = abertos.filter(p => p.due === hoje), em3 = abertos.filter(p => p.due === somaDias(hoje, 3));
  const atras = abertos.filter(p => p.due < hoje);
  const dow = partes(new Date(hoje + "T12:00:00Z"), "UTC").dia;
  if (!hojeL.length && !em3.length && !(atras.length && (dow === "Mon" || dow === "Thu"))) return null;
  const partesTxt = [];
  if (hojeL.length) partesTxt.push("Vence hoje: " + nomes(hojeL));
  if (em3.length) partesTxt.push("Em 3 dias: " + nomes(em3));
  if (atras.length) partesTxt.push(`${atras.length} atrasado${atras.length > 1 ? "s" : ""}`);
  return { titulo: "Checklist da Flórida", corpo: partesTxt.join(". ") + ".", link: "#/checklist", tag: "prazos-" + hoje };
}

/* ---------- inscrições ---------- */
async function listar(env) {
  const out = []; let cursor;
  do {
    const r = await env.SUBS.list({ prefix: "s:", cursor });
    for (const k of r.keys) { const v = await env.SUBS.get(k.name, "json"); if (v) out.push({ k: k.name, v }); }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out;
}
const salvar = (env, k, v) => env.SUBS.put(k, JSON.stringify(v), { expirationTtl: TTL_SUB });

function limpar(corpo) {
  const ep = String(corpo.endpoint || "");
  let host = ""; try { const u = new URL(ep); if (u.protocol === "https:") host = u.hostname; } catch (e) {}
  if (!host || ep.length > 700 || !HOSTS_PUSH.test(host)) return null;
  const k = corpo.keys || {};
  if (typeof k.p256dh !== "string" || typeof k.auth !== "string" || k.p256dh.length > 200 || k.auth.length > 60) return null;
  const ids = a => (Array.isArray(a) ? a : []).slice(0, 400).map(x => String(x).slice(0, 40));
  const vigiar = {};
  for (const [c, w] of Object.entries(corpo.vigiar && typeof corpo.vigiar === "object" ? corpo.vigiar : {}).slice(0, 40)) {
    if (/^\d{1,6}:\d{1,12}$/.test(c) && w && typeof w === "object") vigiar[c] = { n: String(w.n || "").slice(0, 80), max: Math.max(5, Math.min(240, Number(w.max) || 30)) };
  }
  return { endpoint: ep, p256dh: k.p256dh, auth: k.auth, feitos: ids(corpo.feitos), ocultos: ids(corpo.ocultos), vigiar };
}

async function rota(req, env) {
  const url = new URL(req.url), origem = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origem) });
  if (origem && !ORIGENS.includes(origem)) return json({ erro: "origem não permitida" }, 403, origem);
  try {
    if (url.pathname === "/chave") return json({ publica: (await chavesVapid(env)).publica }, 200, origem);
    if (url.pathname === "/parques") return json({ parques: await parques(env), fonte: FONTE }, 200, origem);
    if (url.pathname === "/filas") { const ps = await parques(env); const p = ps.find(x => String(x.id) === url.searchParams.get("parque")); if (!p) return json({ erro: "parque desconhecido" }, 400, origem); return json({ parque: p, atracoes: await filas(p.id), fonte: FONTE }, 200, origem); }
    if (req.method !== "POST") return json({ erro: "não encontrado" }, 404, origem);
    const corpo = await req.json().catch(() => null);
    if (!corpo || JSON.stringify(corpo).length > 30000) return json({ erro: "pedido inválido" }, 400, origem);
    if (url.pathname === "/inscrever") {
      const d = limpar(corpo); if (!d) return json({ erro: "inscrição inválida" }, 400, origem);
      const k = "s:" + (await sha(d.endpoint)); const antes = await env.SUBS.get(k, "json");
      if (!antes && (await env.SUBS.list({ prefix: "s:", limit: MAX_SUBS + 1 })).keys.length >= MAX_SUBS) return json({ erro: "limite de aparelhos atingido" }, 429, origem);
      const estado = {}; for (const c of Object.keys(d.vigiar)) if (antes && antes.estado && antes.estado[c]) estado[c] = antes.estado[c];
      await salvar(env, k, { ...d, estado, ult: antes ? antes.ult : "" });
      return json({ ok: true }, 200, origem);
    }
    if (url.pathname === "/desinscrever") { const d = limpar({ ...corpo, keys: { p256dh: "x", auth: "x" } }); if (!d) return json({ erro: "inválido" }, 400, origem); await env.SUBS.delete("s:" + (await sha(d.endpoint))); return json({ ok: true }, 200, origem); }
    if (url.pathname === "/teste") {
      const d = limpar({ ...corpo, keys: { p256dh: "x", auth: "x" } }); if (!d) return json({ erro: "inválido" }, 400, origem);
      const k = "s:" + (await sha(d.endpoint)); const s = await env.SUBS.get(k, "json"); if (!s) return json({ erro: "aparelho não inscrito" }, 404, origem);
      const r = await enviarPush(await chavesVapid(env), s, { titulo: "Teste do caderno de viagem", corpo: "Se você viu isto, os avisos de fila e de prazos vão chegar.", link: "#/ajustes", tag: "teste" }, "high");
      if (r === "sumiu") await env.SUBS.delete(k);
      return json({ resultado: r }, r === "ok" ? 200 : 502, origem);
    }
    return json({ erro: "não encontrado" }, 404, origem);
  } catch (e) { console.error(e); return json({ erro: "falha no servidor" }, 500, origem); }
}

/* ---------- cron (a cada 5 minutos) ---------- */
export async function tick(env, agora = new Date()) {
  const subs = await listar(env); if (!subs.length) return { subs: 0 };
  const v = await chavesVapid(env);
  const ny = partes(agora, "America/New_York"), br = partes(agora, "America/Sao_Paulo");
  const naViagem = ny.data >= JANELA.de && ny.data <= JANELA.ate && ny.hora >= 8 && ny.hora < 23;
  const mapa = {};
  if (naViagem) {
    const ids = new Set(subs.flatMap(s => Object.keys(s.v.vigiar || {}).map(c => c.split(":")[0])));
    for (const id of ids) { try { mapa[id] = Object.fromEntries((await filas(id)).map(x => [String(x.id), x])); } catch (e) { console.error("filas", id, e.message); } }
  }
  let enviados = 0;
  for (const { k, v: s } of subs) {
    const fila = naViagem ? avisosDeFilas(s, mapa) : { avisos: [], mudou: false };
    const fila_ok = fila.avisos.length ? [{ titulo: fila.avisos.length > 1 ? `Filas: ${fila.avisos.length} atrações` : "Fila nos parques", corpo: fila.avisos.slice(0, 4).join(" · "), link: "#/ajustes", tag: "filas", urg: "high" }] : [];
    const prazo = br.hora === 9 && s.ult !== br.data ? avisoDePrazos(s, br.data) : null;
    const lista = [...fila_ok, ...(prazo ? [prazo] : [])];
    let sumiu = false;
    for (const a of lista) {
      const r = await enviarPush(v, s, a, a.urg || "normal").catch(() => "erro");
      if (r === "ok") enviados++; if (r === "sumiu") { sumiu = true; break; }
    }
    if (sumiu) { await env.SUBS.delete(k); continue; }
    if (br.hora === 9 && s.ult !== br.data) { s.ult = br.data; await salvar(env, k, s); }
    else if (fila.mudou) await salvar(env, k, s);
  }
  return { subs: subs.length, enviados };
}

export default {
  fetch: (req, env) => rota(req, env),
  scheduled: (ev, env, ctx) => ctx.waitUntil(tick(env))
};
