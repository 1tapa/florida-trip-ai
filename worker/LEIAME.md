# Avisos no celular (Worker da Cloudflare)

Envia dois tipos de aviso para os celulares inscritos pelo app (Ajustes → Avisos no celular):

- **Filas e atrações dos parques**: a cada 5 minutos, de 3 a 12/12/2026, das 8h às 23h (horário de Orlando), confere as atrações que a pessoa escolheu vigiar (dados do [Queue-Times.com](https://queue-times.com/)). Avisa quando a fila fica igual ou menor que o tempo escolhido e quando uma atração fechada reabre.
- **Prazos do checklist**: um resumo por dia às 9h (Brasília): o que vence hoje, o que vence em 3 dias e, às segundas e quintas, quantos estão atrasados. O que já foi marcado como feito não gera aviso.

O servidor guarda só: o endereço de envio de cada aparelho, as chaves dele, os ids do checklist já feitos e as atrações vigiadas. Nada do roteiro, das reservas ou dos documentos.

## Publicar (uma vez)

1. `cd worker && npx wrangler deploy` (conta Cloudflare já logada; o armazenamento KV `SUBS` é criado sozinho).
2. Copie o endereço que o Wrangler mostra (algo como `https://florida-trip-push.SEU-USUARIO.workers.dev`).
3. No app: Ajustes → Avisos no celular → cole o endereço → **Ligar avisos** → **Enviar aviso de teste**.

Se mudar prazos no checklist, rode `node scripts/gerar-prazos.mjs` na raiz e publique de novo.

## Segurança

- Só aceita pedidos do site `https://1tapa.github.io` e só envia para os serviços de push dos navegadores (Google, Apple, Mozilla, Microsoft).
- Máximo de 20 aparelhos. Inscrições vencem sozinhas depois de 90 dias sem abrir o app.
