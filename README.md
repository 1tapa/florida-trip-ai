# Florida · Caderno de viagem

Guia pessoal para a viagem à Flórida (4 a 12 de dezembro de 2026): roteiro dia a dia, checklist com 139 itens separado em fases (Pré-viagem, Magic Kingdom, Universal, Na viagem e Pré-volta), reservas, listas de compras (Leo e Camily), edição manual do roteiro e um concierge com IA.

App estático (PWA): abre sem internet depois da primeira visita e guarda tudo no próprio aparelho (`localStorage`).

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Estrutura da página e ícones |
| `css/app.css` | Visual (Marcellus + Hanken Grotesk, hospedadas em `fonts/`) |
| `js/data.js` | Viagem, roteiro, programação por dia, reservas, comida, outlets |
| `js/checklist-data.js` | 12 áreas e 139 itens, com prioridade, prazo e fonte |
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

## Sincronizar com a namorada (Firebase)

Os dois aparelhos compartilham os mesmos dados (checklist, gastos, compras, reservas, orçamento, mudanças de roteiro e a chave da IA, criptografada). Sem login: vocês usam um código secreto.

**Configuração (uma vez, ~5 min)**
1. Em [console.firebase.google.com](https://console.firebase.google.com), crie um projeto (Analytics desligado).
2. Em *Criação > Firestore Database*, clique em *Criar banco de dados* (modo produção, qualquer região).
3. Na aba *Regras*, cole o texto abaixo e clique em *Publicar*:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /trips/{tripId} {
         allow get, create, update: if true;
         allow list, delete: if false;
       }
     }
   }
   ```
4. Em *Configurações do projeto > Seus apps*, adicione um app Web (`</>`, sem Hosting) e copie o trecho `firebaseConfig`.
5. No app, abra *Mais > Ajustes e backup*, cole a configuração, toque em *Criar código do casal* e depois em *Copiar convite*. Mande o convite para ela e peça para colar em *Já recebeu um convite?*.

**Como funciona**
- Cada item é salvo separadamente e vale a alteração mais recente. Editar coisas diferentes ao mesmo tempo nunca sobrescreve.
- Funciona sem internet: as mudanças são enviadas quando o sinal volta.
- O documento fica em `trips/{SHA-256 do código}`. As regras não permitem listar documentos, então só quem tem o código chega aos dados. Trate o código e o convite como senha.
- A chave da OpenAI é criptografada (AES-GCM) com uma chave derivada do código antes de ir para a nuvem.
- **Login com e-mail e senha** (opcional): em vez de decorar o código, vocês criam um login em *Ajustes*. O código é calculado a partir do e-mail e da senha (PBKDF2, 300 mil voltas), então é o mesmo em qualquer aparelho, sem mexer nas regras do Firestore. Use uma senha longa que só vocês dois conheçam: quem acertar e-mail e senha vê os dados. No aparelho novo, cole o *convite de configuração* (só o Firebase, sem dados) e entre.
- **Backup automático diário**: ao abrir o app, ele guarda uma cópia do dia (7 dias no aparelho; 14 dias rotativos na nuvem, nos documentos `trips/{id}_snap0..13`). Em *Ajustes > Backup automático* dá para ver as cópias e restaurar. O iPhone não permite baixar arquivos sozinho, por isso as cópias ficam no app e na nuvem.
- Apagar todos os dados ou restaurar um backup desliga a sincronização naquele aparelho, para não apagar os dados do outro.

## Publicar

GitHub Pages a partir da raiz da branch `main`. Ao mudar arquivos, aumente `CACHE` em `sw.js`.

## Aviso

Regras de alfândega, preços e horários de parques mudam. Os itens trazem links de fonte; confirme perto da viagem.


## Novidades (hoje, câmbio, parques)

- **Hoje**: durante a viagem mostra o que está acontecendo agora, o que vem a seguir e a linha do tempo do dia.
- **Câmbio**: converte dólar em real com a conta (cotação + R$ 0,20) × 1,06. Acréscimo, imposto e cotação manual são ajustáveis. A cotação vem de open.er-api.com (com AwesomeAPI de reserva) e é a de mercado, sem taxas do banco. Dá para registrar a compra como gasto.
- **Guia do parque** (Magic Kingdom, Universal Studios Florida e Islands of Adventure no dia Park-to-Park): marque imperdíveis, monte a ordem do dia (do fundo para a entrada, da entrada para o fundo ou menor fila agora) e acompanhe as filas ao vivo (ThemeParks.wiki), com tendência medida neste aparelho. As distâncias são aproximadas.
- **Anexos** em Reservas (print ou PDF, até ~650 KB cada), disponíveis offline e sincronizados.
- **Guia do parque** com nomes e descrições em português (o nome original aparece embaixo) e a seção Pausa para comer, com restaurantes rápidos e comidas típicas.
- **Compras** em duas listas (Leo e Camily) e **edição manual de cada dia do roteiro**, com a opção de a IA complementar.
