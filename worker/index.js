/* Avisos de fila no celular: Cloudflare Worker (gratuito) + ntfy.
 *
 * O app envia para cá a lista de atrações vigiadas (POST /config). A cada minuto o Worker
 * consulta o ThemeParks.wiki e, quando a fila de uma atração cai até o limite escolhido
 * (ou ela volta a funcionar), envia uma notificação para o tópico ntfy do casal.
 * Nada além do código do tópico e das atrações vigiadas passa por aqui.
 */
const PARKS = {
  mk: "75ea578a-adc8-4116-a54d-dccb60765ef9",
  usf: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57"
};
const TOPIC_RE = /^[a-z0-9-]{16,64}$/;
const CFG_TTL = 14 * 24 * 3600; // configuração some sozinha se o app não renovar em 14 dias
const REPEAT_S = 25 * 60;       // não repete o mesmo aviso de fila por 25 minutos

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

const ascii = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "");

/* Envia pelo ntfy. Tenta o formato JSON e, se falhar, o texto simples. Lança erro com o motivo. */
async function notify(topic, title, message, tags) {
  let detail = "";
  try {
    const r = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "florida-filas/1.0" },
      body: JSON.stringify({ topic, title, message, tags: tags || ["tada"], priority: 4 })
    });
    if (r.ok) return;
    detail = "json " + r.status + " " + (await r.text()).slice(0, 120);
  } catch (e) { detail = "json " + String(e).slice(0, 120); }
  try {
    const r = await fetch("https://ntfy.sh/" + topic, {
      method: "POST",
      headers: { Title: ascii(title), Tags: (tags || ["tada"]).join(","), Priority: "4", "user-agent": "florida-filas/1.0" },
      body: ascii(message)
    });
    if (r.ok) return;
    detail += " | texto " + r.status + " " + (await r.text()).slice(0, 120);
  } catch (e) { detail += " | texto " + String(e).slice(0, 120); }
  throw new Error(detail);
}

function cleanAlerts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map(a => ({
    park: String(a && a.park),
    id: String((a && a.id) || "").slice(0, 80),
    name: String((a && a.name) || "").slice(0, 80),
    max: Number(a && a.max)
  })).filter(a => PARKS[a.park] && a.id && a.name && [30, 45, 60].includes(a.max));
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ ok: true, app: "florida-filas" });
    const path = new URL(req.url).pathname;
    let body; try { body = await req.json(); } catch (e) { return reply({ error: "json" }, 400); }
    const topic = String(body && body.topic || "");
    if (!TOPIC_RE.test(topic)) return reply({ error: "topic" }, 400);
    if (path === "/config") {
      const alerts = cleanAlerts(body.alerts);
      await env.FILAS.put("cfg:" + topic, JSON.stringify({ alerts, at: Date.now() }), { expirationTtl: CFG_TTL });
      return reply({ ok: true, n: alerts.length });
    }
    if (path === "/test") {
      if (!(await env.FILAS.get("cfg:" + topic))) return reply({ error: "sem-config" }, 400);
      try { await notify(topic, "Teste de aviso", "Deu certo! Você vai receber aqui quando a fila das suas atrações cair.", ["white_check_mark"]); }
      catch (e) { return reply({ error: "ntfy", detail: String(e.message || e) }, 502); }
      return reply({ ok: true });
    }
    return reply({ error: "rota" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAll(env));
  }
};

const safe = p => p.catch(e => console.log("ntfy falhou:", e.message));

async function checkAll(env) {
  const list = await env.FILAS.list({ prefix: "cfg:" });
  const configs = [];
  for (const k of list.keys) {
    const raw = await env.FILAS.get(k.name);
    if (raw) configs.push({ topic: k.name.slice(4), alerts: (JSON.parse(raw).alerts || []) });
  }
  const parks = [...new Set(configs.flatMap(c => c.alerts.map(a => a.park)))];
  const live = {};
  for (const p of parks) {
    try {
      const r = await fetch(`https://api.themeparks.wiki/v1/entity/${PARKS[p]}/live`);
      const j = await r.json();
      live[p] = new Map((j.liveData || []).map(e => [e.id, e]));
    } catch (e) { /* tenta de novo no próximo minuto */ }
  }
  for (const c of configs) {
    for (const a of c.alerts) {
      const e = live[a.park] && live[a.park].get(a.id);
      if (!e) continue;
      const wait = e.queue && e.queue.STANDBY ? e.queue.STANDBY.waitTime : null;
      const downKey = `down:${c.topic}:${a.id}`;
      if (e.status === "DOWN") { await env.FILAS.put(downKey, "1", { expirationTtl: 6 * 3600 }); continue; }
      if (e.status !== "OPERATING") continue;
      if (await env.FILAS.get(downKey)) {
        await env.FILAS.delete(downKey);
        await safe(notify(c.topic, a.name + " voltou", wait != null ? `Voltou a funcionar com fila de ${wait} min.` : "Voltou a funcionar.", ["arrow_forward"]));
        continue;
      }
      if (typeof wait !== "number" || wait > a.max) continue;
      const sentKey = `sent:${c.topic}:${a.id}`;
      if (await env.FILAS.get(sentKey)) continue;
      await env.FILAS.put(sentKey, "1", { expirationTtl: REPEAT_S });
      await safe(notify(c.topic, a.name + ": fila baixa", `Agora ${wait} min (seu limite: ${a.max} min). Vale ir!`, ["tada"]));
    }
  }
}
