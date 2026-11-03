/* Web Push (padrão dos navegadores) só com Web Crypto: chaves VAPID guardadas no KV e mensagem
 * criptografada em aes128gcm (RFC 8291), que só o aparelho inscrito consegue abrir. */
const b64u = b => { const a = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; for (const x of a) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const deB64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const txt = s => new TextEncoder().encode(s);
const juntar = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

export async function chavesVapid(env) {
  const salvo = await env.SUBS.get("vapid", "json");
  if (salvo) return salvo;
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const v = { publica: b64u(await crypto.subtle.exportKey("raw", par.publicKey)), privada: await crypto.subtle.exportKey("jwk", par.privateKey) };
  await env.SUBS.put("vapid", JSON.stringify(v));
  return (await env.SUBS.get("vapid", "json")) || v;
}

async function hkdf(salt, ikm, info, tam) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, tam * 8));
}

export async function criptografar(p256dh, auth, mensagem) {
  const uaPub = deB64u(p256dh), segredo = deB64u(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(segredo, compartilhado, juntar(txt("WebPush: info\0"), uaPub, asPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, txt("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, txt("Content-Encoding: nonce\0"), 12);
  const chave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chave, juntar(mensagem, new Uint8Array([2]))));
  return juntar(sal, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, cifrado);
}

async function cabecalhoVapid(v, endpoint) {
  const aud = new URL(endpoint).origin;
  const corpo = `${b64u(txt(JSON.stringify({ typ: "JWT", alg: "ES256" })))}.${b64u(txt(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://1tapa.github.io/florida-trip-ai/" })))}`;
  const k = await crypto.subtle.importKey("jwk", v.privada, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, txt(corpo));
  return `vapid t=${corpo}.${b64u(ass)}, k=${v.publica}`;
}

/** Retorna "ok", "sumiu" (inscrição vencida: apagar) ou "erro". */
export async function enviarPush(v, insc, dados, urgencia = "normal") {
  const corpo = await criptografar(insc.p256dh, insc.auth, txt(JSON.stringify(dados)));
  const r = await fetch(insc.endpoint, {
    method: "POST",
    headers: { authorization: await cabecalhoVapid(v, insc.endpoint), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "3600", urgency: urgencia },
    body: corpo
  });
  if (r.ok) return "ok";
  if (r.status === 404 || r.status === 410) return "sumiu";
  console.error("[push]", r.status, (await r.text().catch(() => "")).slice(0, 200));
  return "erro";
}
