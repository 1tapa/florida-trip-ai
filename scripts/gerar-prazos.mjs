/* Gera worker/prazos.json a partir de js/checklist-data.js (só id, prioridade, prazo e título).
 * Rode depois de mudar prazos no checklist:  node scripts/gerar-prazos.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../js/checklist-data.js", import.meta.url), "utf8"), ctx);
const lista = (ctx.window.FT.CHECKLIST || []).filter(i => i.due).map(i => ({ id: i.id, pri: i.pri, due: i.due, title: i.title }));
writeFileSync(new URL("../worker/prazos.json", import.meta.url), JSON.stringify(lista, null, 1) + "\n");
console.log(lista.length + " itens com prazo em worker/prazos.json");
