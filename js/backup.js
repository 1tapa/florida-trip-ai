/* Backup automático diário.
 * - Neste aparelho: uma cópia por dia, guardada por 7 dias (funciona sem sincronização).
 * - Na nuvem (se a sincronização estiver ligada): uma cópia por dia, 14 dias rotativos.
 * O iPhone não deixa um site baixar arquivos sozinho; por isso as cópias ficam dentro do app e na nuvem do casal. */
(function () {
  const FT = (window.FT = window.FT || {});
  const LSK = "floridaTripAI_daily", LAST = "floridaTripAI_lastcloud", KEEP = 7;
  const bk = (FT.backup = { onUI: null });

  const read = () => { try { const a = JSON.parse(FT.ls.get(LSK) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const json = () => JSON.stringify(FT.store.state);

  bk.local = () => read().sort((a, b) => b.day.localeCompare(a.day));

  /* Cria a cópia de hoje se ainda não existir (e atualiza se já existir, para refletir o dia inteiro). */
  bk.runLocal = function () {
    const day = FT.u.today(), list = read().filter(x => x.day !== day);
    list.push({ day, t: Date.now(), d: json() });
    list.sort((a, b) => b.day.localeCompare(a.day));
    let keep = list.slice(0, KEEP);
    for (;;) { try { FT.ls.set(LSK, JSON.stringify(keep)); break; } catch (e) { if (keep.length <= 1) break; keep = keep.slice(0, keep.length - 1); } }
    if (bk.onUI) bk.onUI();
  };

  bk.runCloud = async function (force) {
    const y = FT.sync, day = FT.u.today();
    if (!y || y.status === "off" || !y.connected) return false;
    if (!force && FT.ls.get(LAST) === day) return false;
    const ok = await y.putSnapshot(day, json());
    if (ok) { FT.ls.set(LAST, day); if (bk.onUI) bk.onUI(); }
    return ok;
  };

  bk.run = function () { bk.runLocal(); bk.runCloud(false); };

  /* Pontos disponíveis para restaurar: nuvem + aparelho, do mais novo para o mais antigo. */
  bk.points = async function () {
    const cloud = FT.sync && FT.sync.connected ? await FT.sync.listSnapshots() : [];
    const pts = cloud.map(x => ({ src: "nuvem", day: x.day, t: x.t, d: x.d }));
    for (const x of bk.local()) if (!pts.some(p => p.day === x.day)) pts.push({ src: "aparelho", day: x.day, t: x.t, d: x.d });
    return pts.sort((a, b) => b.t - a.t);
  };

  bk.restore = function (d) {
    const raw = JSON.parse(d);
    if (!raw || typeof raw !== "object" || raw.v !== 2) throw new Error("formato");
    FT.store.replace(raw);
    if (FT.sync && FT.sync.connected && FT.sync.changed) FT.sync.changed();
  };

  /* Roda ao abrir, ao voltar para o app e quando a sincronização fica pronta. */
  function start() {
    bk.run();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") bk.run(); });
    if (FT.sync) { const prev = FT.sync.onReady; FT.sync.onReady = () => { if (prev) prev(); bk.runCloud(false); }; }
  }
  start();
})();
