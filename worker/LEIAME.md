# Avisos de fila com o celular bloqueado

O app sozinho só consegue avisar com a tela aberta, porque o iPhone congela apps em segundo plano. Este pequeno servidor gratuito (Cloudflare Workers) vigia as filas a cada minuto e manda a notificação pelo app **ntfy**.

Você faz isto **uma vez** (uns 10 minutos). Precisa de um computador com Node.js.

## 1. Publicar o servidor

1. Crie uma conta gratuita em https://dash.cloudflare.com (não pede cartão).
2. No terminal, dentro da pasta `worker` deste repositório:
   ```
   npx wrangler login
   npx wrangler kv namespace create FILAS
   ```
3. O segundo comando mostra um `id`. Abra `wrangler.toml` e troque `COLE_O_ID_AQUI` por ele.
4. Publique:
   ```
   npx wrangler deploy
   ```
5. Ele mostra o endereço, parecido com `https://florida-filas.seunome.workers.dev`. Copie.

## 2. Ligar no app

1. No app: Mais, Guia do parque, role até **Avisos com o celular bloqueado**.
2. Cole o endereço e toque em **Ligar avisos**. O app gera o código do tópico e sincroniza com o outro celular.

## 3. Instalar o ntfy nos dois celulares

1. Instale o app gratuito **ntfy** na App Store.
2. Toque em “+” e assine o tópico mostrado no app (algo como `florida-…`).
3. Nos Ajustes do iPhone, permita notificações para o ntfy.
4. De volta ao guia, toque em **Enviar aviso de teste**.

## 4. Escolher o que vigiar

No plano do dia, toque em **Sem aviso** ao lado da atração até aparecer o limite (30, 45 ou 60 minutos). Pronto: quando a fila cair até o limite, ou uma atração parada voltar, chega a notificação.

## Observações

- Quem souber o código do tópico recebe os avisos (e pode assiná-lo no ntfy). Não compartilhe o código.
- A configuração expira no servidor se o app ficar 14 dias sem abrir; ao abrir o app ela é renovada.
- O servidor só guarda o código do tópico e a lista de atrações vigiadas. O plano gratuito da Cloudflare cobre esse uso com folga.
- A fila vem do ThemeParks.wiki e pode ter atraso ou ficar indisponível; confirme no app oficial do parque.
