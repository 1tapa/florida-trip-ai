/* Sincronização entre aparelhos (Firebase Firestore), sem login.
 *
 * - O casal compartilha um código longo. O documento fica em trips/{SHA-256 do código}: o código em si nunca vai ao servidor.
 * - Cada dado (item do checklist, gasto, reserva...) é uma entrada própria { v: JSON, t: horário }. Vale a mais recente por entrada,
 *   então dois aparelhos editando coisas diferentes nunca se sobrescrevem.
 * - A chave da OpenAI vai criptografada (AES-GCM) com uma chave derivada do código.
 * - Funciona offline: o Firestore guarda as alterações e envia quando a internet volta.
 */
(function () {
  const FT = (window.FT = window.FT || {});
  const store = FT.store;
  const LS = "floridaTripAI_sync";
  const CFG = "floridaTripAI_fbcfg";
  const SDK_VERSION = "10.12.2";
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const CODE_LEN = 20;

  let hashId = "", cfg = null, code = "", db = null, ref = null, sdk = null, unsub = null;
  let shadow = null, times = {}, suppress = false, timer = null, first = true, appStarted = false, ready = false;

  const sync = (FT.sync = { status: "off", detail: "", onUI: null, sdkOverride: null });

  /* ---------- persistência local ---------- */
  function load() {
    try { const s = JSON.parse(FT.ls.get(LS) || "null"); if (s && typeof s === "object") { code = normCode(s.code || ""); times = s.times && typeof s.times === "object" ? s.times : {}; } } catch (e) { /* começa limpo */ }
    try { cfg = FT.SYNC_CONFIG || JSON.parse(FT.ls.get(CFG) || "null"); } catch (e) { cfg = FT.SYNC_CONFIG || null; }
    if (cfg && !validCfg(cfg)) cfg = null;
  }
  const persist = () => FT.ls.set(LS, JSON.stringify({ code, times }));
  const validCfg = c => c && typeof c === "object" && ["apiKey", "projectId", "appId"].every(k => typeof c[k] === "string" && c[k]);
  const pickCfg = c => { const o = {}; for (const k of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]) if (typeof c[k] === "string" && c[k]) o[k] = c[k]; return o; };

  /* ---------- código, convite, criptografia ---------- */
  function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z2-7]/g, ""); }
  function fmtCode(c) { return c.match(/.{1,4}/g).join("-"); }
  function genCode() {
    const b = new Uint8Array(CODE_LEN); crypto.getRandomValues(b);
    return Array.from(b, x => ALPHABET[x % 32]).join("");
  }
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

  async function docId(c) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode("florida-trip-ai/id/" + c));
    return Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, "0")).join("");
  }
  async function aesKey(c) {
    const base = await crypto.subtle.importKey("raw", enc.encode(c), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode("florida-trip-ai/key"), iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encrypt(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(code), enc.encode(text));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(o) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, await aesKey(code), unb64(o.ct));
    return new TextDecoder().decode(pt);
  }

  /* Lê a configuração colada do console do Firebase (trecho JavaScript ou JSON). */
  function parseConfig(text) {
    const out = {};
    const re = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)["']?\s*:\s*["']([^"']+)["']/g;
    let m; while ((m = re.exec(String(text)))) out[m[1]] = m[2];
    return validCfg(out) ? out : null;
  }

  /* ---------- dados <-> entradas ---------- */
  function flatten(s) {
    const m = {};
    for (const k of Object.keys(s.checks)) m["check:" + k] = true;
    for (const c of s.custom) m["custom:" + c.id] = c;
    for (const e of s.expenses) m["exp:" + e.id] = e;
    for (const x of s.shopping) m["shop:" + x.id] = x;
    for (const id of Object.keys(s.reservas)) m["res:" + id] = s.reservas[id];
    m.budget = s.budget;
    for (const c of FT.EXPENSE_CATS) m["catb:" + c] = s.catBudgets[c];
    if (s.customs.a != null) m["cust:a"] = s.customs.a;
    if (s.customs.b != null) m["cust:b"] = s.customs.b;
    if (s.contacts.name || s.contacts.phone) m.contact = s.contacts;
    if (s.days && s.plans) m.plan = { days: s.days, plans: s.plans };
    for (const d of s.docs) m["doc:" + d.id] = d;
    if (s.parking) m.parking = s.parking;
    for (const k of Object.keys(s.rides)) m["ride:" + k] = s.rides[k];
    for (const k of Object.keys(s.rideDone)) m["rdone:" + k] = true;
    for (const k of Object.keys(s.rideOrder)) m["rorder:" + k] = s.rideOrder[k];
    m.fx = s.fx;
    return m;
  }

  function applyEntry(s, key, val) {
    const i = key.indexOf(":");
    const type = i < 0 ? key : key.slice(0, i), id = i < 0 ? "" : key.slice(i + 1);
    const swap = (list, item) => { const out = list.filter(x => x.id !== id); if (item && typeof item === "object") out.push(Object.assign({}, item, { id })); return out; };
    switch (type) {
      case "check": if (val) s.checks[id] = true; else delete s.checks[id]; break;
      case "custom": s.custom = swap(s.custom, val); break;
      case "exp": s.expenses = swap(s.expenses, val); break;
      case "shop": s.shopping = swap(s.shopping, val); break;
      case "res": if (val && typeof val === "object") s.reservas[id] = val; else delete s.reservas[id]; break;
      case "budget": if (Number(val) > 0) s.budget = Number(val); break;
      case "catb": if (FT.EXPENSE_CATS.includes(id) && Number(val) >= 0) s.catBudgets[id] = Number(val); break;
      case "cust": if (id === "a" || id === "b") s.customs[id] = val == null ? null : Number(val); break;
      case "contact": if (val && typeof val === "object") s.contacts = val; else s.contacts = { name: "", phone: "" }; break;
      case "doc": s.docs = swap(s.docs, val); break;
      case "parking": s.parking = val && typeof val === "object" ? val : null; break;
      case "ride": if (val) s.rides[id] = val; else delete s.rides[id]; break;
      case "rdone": if (val) s.rideDone[id] = true; else delete s.rideDone[id]; break;
      case "rorder": if (Array.isArray(val)) s.rideOrder[id] = val; else delete s.rideOrder[id]; break;
      case "fx": if (val && typeof val === "object") s.fx = Object.assign({}, s.fx, val); break;
      case "plan": if (val && Array.isArray(val.days) && Array.isArray(val.plans)) { s.days = val.days; s.plans = val.plans; } else { s.days = null; s.plans = null; } break;
    }
  }

  /* O espelho guarda texto (JSON), não os objetos: o app altera objetos no lugar e, com referências, a mudança passaria despercebida. */
  function snapshotOf(state) {
    const m = {}, f = flatten(state);
    for (const k of Object.keys(f)) m[k] = JSON.stringify(f[k]);
    return m;
  }

  function setStatus(status, detail) {
    sync.status = status; sync.detail = detail || "";
    if (sync.onUI) sync.onUI();
  }

  /* ---------- aplicar o que veio da nuvem ---------- */
  function applyRemote(remote) {
    let changed = false;
    const s = store.state;
    for (const [k, ent] of Object.entries(remote)) {
      if (k === "aikey" || !ent || typeof ent.t !== "number" || typeof ent.v !== "string") continue;
      if (ent.t <= (times[k] || 0)) continue;
      let val; try { val = JSON.parse(ent.v); } catch (e) { continue; }
      times[k] = ent.t;
      if (k.startsWith("doc:") && !val && FT.files) FT.files.del(k.slice(4));
      applyEntry(s, k, val);
      changed = true;
    }
    if (remote.aikey) handleKey(remote.aikey);
    if (!changed) { if (FT.files) FT.files.ensure(); return; }
    suppress = true;
    store.state = store.normalize(s);
    store.save();
    suppress = false;
    shadow = snapshotOf(store.state);
    persist();
    if (FT.files) FT.files.ensure();
    const el = document.activeElement;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    if (FT.app && !typing) FT.app.render({ keepScroll: true });
  }

  async function handleKey(ent) {
    if (!ent || typeof ent.t !== "number" || typeof ent.v !== "string" || ent.t <= (times.aikey || 0)) return;
    times.aikey = ent.t; persist();
    try {
      const val = JSON.parse(ent.v);
      if (val === null) FT.ls.del(FT.KEYS.apiKey);
      else FT.ls.set(FT.KEYS.apiKey, await decrypt(val));
      if (FT.app) FT.app.render({ keepScroll: true });
    } catch (e) { /* chave ilegível: ignora */ }
  }

  /* ---------- enviar o que mudou aqui ---------- */
  function put(entries) {
    if (!ref || !Object.keys(entries).length) return;
    Promise.resolve(sdk.setDoc(ref, { e: entries }, { merge: true })).catch(e => setStatus("error", errText(e)));
  }
  const errText = e => (e && e.code === "permission-denied" ? "O Firestore recusou o acesso. Confira se as regras foram publicadas." : "Não foi possível sincronizar agora.");

  function flush() {
    if (!ready || !shadow) return;
    const cur = snapshotOf(store.state), out = {}, now = Date.now();
    for (const k of Object.keys(cur)) if (cur[k] !== shadow[k]) { out[k] = { v: cur[k], t: now }; times[k] = now; }
    for (const k of Object.keys(shadow)) if (!(k in cur)) { out[k] = { v: "null", t: now }; times[k] = now; }
    shadow = cur;
    if (Object.keys(out).length) { persist(); put(out); }
  }

  sync.changed = function () {
    if (!ready || suppress) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  };

  /* Anexos: cada arquivo (até ~650 KB) vira um documento próprio, trips/{hash}_{id}. */
  sync.putFile = function (id, b64) {
    if (!ready || !hashId) return;
    Promise.resolve(sdk.setDoc(sdk.doc(db, "trips", hashId + "_" + id), { d: b64, t: Date.now() })).catch(e => setStatus("error", errText(e)));
  };
  sync.getFile = async function (id) {
    if (!ready || !hashId) return "";
    const snap = await sdk.getDoc(sdk.doc(db, "trips", hashId + "_" + id));
    return snap.exists() ? String(snap.data().d || "") : "";
  };

  sync.pushKey = async function () {
    if (!ready) return;
    const t = Date.now(), k = store.apiKey();
    try {
      const v = k ? JSON.stringify(await encrypt(k)) : "null";
      times.aikey = t; persist();
      put({ aikey: { v, t } });
    } catch (e) { /* sem criptografia disponível: não envia a chave */ }
  };

  /* ---------- conexão ---------- */
  async function loadSdk() {
    if (sync.sdkOverride) return sync.sdkOverride;
    const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/`;
    const [app, fs] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js")]);
    return { app, fs };
  }

  async function start() {
    if (!cfg || !code || appStarted) return;
    appStarted = true; first = true; ready = false;
    setStatus("connecting");
    try {
      const mod = await loadSdk();
      sdk = mod.fs || mod;
      if (mod.makeDb) db = mod.makeDb(cfg);
      else {
        const app = mod.app.initializeApp(cfg, "ft-sync");
        try { db = sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager() }) }); }
        catch (e) { db = sdk.getFirestore(app); }
      }
      hashId = await docId(code);
      ref = sdk.doc(db, "trips", hashId);
      unsub = sdk.onSnapshot(ref, onSnap, e => setStatus("error", errText(e)));
    } catch (e) {
      appStarted = false;
      setStatus("error", "Não foi possível carregar o Firebase. Verifique a internet.");
    }
  }

  function onSnap(snap) {
    const remote = (snap.exists() && snap.data().e) || {};
    if (first) {
      first = false;
      const local = flatten(store.state), def = flatten(store.defaults()), out = {}, now = Date.now();
      for (const k of Object.keys(local)) if (!(k in remote) && JSON.stringify(local[k]) !== JSON.stringify(def[k])) { out[k] = { v: JSON.stringify(local[k]), t: now }; times[k] = now; }
      applyRemote(remote);
      shadow = snapshotOf(store.state);
      ready = true;
      put(out);
      if (FT.files) for (const k of Object.keys(out)) if (k.startsWith("doc:")) FT.files.upload(k.slice(4));
      if (remote.aikey) { /* já tratado em applyRemote */ } else if (store.apiKey()) sync.pushKey();
      persist();
    } else applyRemote(remote);
    const md = snap.metadata || {};
    setStatus(md.hasPendingWrites ? "pending" : md.fromCache && typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "ok");
  }

  function stop() {
    if (unsub) { try { unsub(); } catch (e) { /* já encerrado */ } }
    unsub = null; ref = null; ready = false; appStarted = false; shadow = null; clearTimeout(timer);
  }

  /* ---------- ações da tela ---------- */
  Object.assign(sync, {
    hasConfig: () => !!cfg,
    configure(text) {
      const c = parseConfig(text);
      if (!c) return false;
      cfg = pickCfg(c); FT.ls.set(CFG, JSON.stringify(cfg));
      if (sync.onUI) sync.onUI();
      return true;
    },
    async create() {
      if (!cfg) return false;
      stop(); code = genCode(); times = {}; persist();
      await start();
      return true;
    },
    async join(text) {
      text = String(text || "").trim();
      stop();
      if (text.startsWith("FTRIP1.")) {
        try {
          const o = JSON.parse(unb64url(text.slice(7)));
          if (!validCfg(o.c) || normCode(o.k).length !== CODE_LEN) return false;
          cfg = pickCfg(o.c); FT.ls.set(CFG, JSON.stringify(cfg)); code = normCode(o.k);
        } catch (e) { return false; }
      } else {
        const c = normCode(text);
        if (!cfg || c.length !== CODE_LEN) return false;
        code = c;
      }
      times = {}; persist();
      await start();
      return true;
    },
    invite() { return code && cfg ? "FTRIP1." + b64url(JSON.stringify({ c: cfg, k: code })) : ""; },
    disconnect() { stop(); code = ""; times = {}; persist(); setStatus("off"); },
    flatten, applyEntry, parseConfig, normCode, genCode
  });

  Object.defineProperties(sync, {
    code: { get: () => (code ? fmtCode(code) : "") },
    connected: { get: () => !!code && !!cfg }
  });

  load();
  if (code && cfg) start();
  window.addEventListener("online", () => { if (code && cfg && !appStarted) start(); });
})();
