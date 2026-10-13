# Florida · Caderno de viagem

Guia pessoal para a viagem à Flórida (4 a 12 de dezembro de 2026): roteiro dia a dia, checklist com 137 itens, reservas, orçamento, compras com simulador de imposto e um concierge com IA.

App estático (PWA): abre sem internet depois da primeira visita e guarda tudo no próprio aparelho (`localStorage`).

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Estrutura da página e ícones |
| `css/app.css` | Visual (Marcellus + Hanken Grotesk, hospedadas em `fonts/`) |
| `js/data.js` | Viagem, roteiro, programação por dia, reservas, comida, outlets |
| `js/checklist-data.js` | 12 áreas e 137 itens, com prioridade, prazo e fonte |
| `js/store.js` | Estado, migração da versão anterior e utilitários |
| `js/app.js` | Telas, navegação e eventos |
| `js/ai.js` | Concierge (conversa e alteração do roteiro) |
| `sw.js` | Cache para uso offline |

Para mudar conteúdo, edite `js/data.js` e `js/checklist-data.js`. Não use aspas duplas retas dentro dos textos.

## Concierge de IA

- **Conversar**: responde dúvidas usando o seu roteiro. Não altera nada.
- **Alterar roteiro**: a IA devolve só os dias e itens que mudam; você vê o antes e o depois, aplica e pode desfazer.
- Usa a API da OpenAI direto do navegador, com a sua chave, guardada apenas neste navegador. Use uma chave exclusiva com limite de gasto.
- Sem chave, dá para copiar um texto pronto e colar no ChatGPT.

## Publicar

GitHub Pages a partir da raiz da branch `main`. Ao mudar arquivos, aumente `CACHE` em `sw.js`.

## Aviso

Regras de alfândega, preços e horários de parques mudam. Os itens trazem links de fonte; confirme perto da viagem.
