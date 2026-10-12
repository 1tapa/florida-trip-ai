# Florida Trip AI — primeira versão instalável

## O que já funciona
- Interface responsiva com visual próprio para iPhone.
- Roteiro de 4 a 12 de dezembro de 2026, com Magic Kingdom em 7/12 e Universal Studios + Islands of Adventure em 9/12.
- Controle de despesas em USD, orçamento de US$ 6.000.
- Lista de compras e checklist persistentes no dispositivo.
- Exportação dos dados em JSON.
- Consulta de condições meteorológicas atuais de Kissimmee via Open-Meteo quando há conexão.
- Estrutura PWA com modo standalone e cache offline.

## Limites importantes
- Não é um app nativo nem está publicado na App Store.
- A primeira versão não tem IA conversacional ligada a um modelo, trânsito ao vivo, sincronização entre dois celulares, alertas automáticos nem reservas. Essas funções precisam de backend/integrações e podem ter custos.
- A consulta meteorológica mostra condições atuais; não afirma prever o tempo em dezembro com meses de antecedência.
- Preços, horários e endereços devem ser reconfirmados.

## Como colocar no iPhone sem barra do Safari
Um PWA precisa ser servido por HTTPS para ter comportamento instalável confiável. Uma opção é publicar os arquivos num serviço de hospedagem estática HTTPS (por exemplo, GitHub Pages ou Cloudflare Pages), depois abrir a URL no Safari do iPhone → Compartilhar → Adicionar à Tela de Início. Depois, o ícone abre em modo standalone. O primeiro acesso precisa de internet.

## Arquivos
- `index.html`: aplicação
- `manifest.webmanifest`: metadados PWA
- `sw.js`: cache offline básico
- `icon.svg`: ícone

## Privacidade
As despesas e checklists ficam no armazenamento local do navegador/dispositivo. Não insira dados de pagamento ou documentos pessoais.
