/* Checklist da viagem.
 *
 * Cada item: [id, prioridade, prazo, dia, título, detalhe, link?]
 *   prioridade: e = essencial, i = importante, o = opcional
 *   prazo:      'AAAA-MM-DD' ou '' (se tiver dia, o prazo é a data do dia)
 *   dia:        0 = sem dia fixo; 4–12 = dia de dezembro de 2026 em que o item acontece;
 *               13 = depois da viagem
 *   link:       [rótulo, url] opcional (fonte ou página oficial)
 *
 * Importante: nenhum texto aqui pode conter aspas duplas retas (use ‘ ’ ou “ ”).
 */
(function () {
  const FT = (window.FT = window.FT || {});

  FT.CATS = [
    { id: "docs", name: "Documentos e entrada nos EUA", short: "Documentos", icon: "passport", intro: "O que a imigração, a locadora e as companhias vão pedir." },
    { id: "voos", name: "Voos e aeroporto", short: "Voos", icon: "plane", intro: "Chegada a Miami às 06h30 e saída de Orlando às 18h15." },
    { id: "dinheiro", name: "Dinheiro e cartões", short: "Dinheiro", icon: "wallet", intro: "Como pagar, quanto isso custa e como não ficar sem acesso ao dinheiro." },
    { id: "tech", name: "Celular, internet e iPhones", short: "Tecnologia", icon: "phone", intro: "A compra dos iPhones é o ponto mais delicado da viagem." },
    { id: "carro", name: "Carro alugado e estrada", short: "Carro", icon: "car", intro: "Retirada no MIA, devolução no MCO e pedágios eletrônicos." },
    { id: "hoteis", name: "Hotéis", short: "Hotéis", icon: "bed", intro: "Lauderdale-by-the-Sea (4 a 6/12) e Kissimmee (6 a 12/12)." },
    { id: "parques", name: "Parques e ingressos", short: "Parques", icon: "ticket", intro: "Magic Kingdom, Kennedy Space Center, Universal e a festa de Natal." },
    { id: "compras", name: "Compras e alfândega", short: "Compras", icon: "bag", intro: "Outlets, lista por pessoa e o imposto na volta ao Brasil." },
    { id: "saude", name: "Saúde e seguro-viagem", short: "Saúde", icon: "cross", intro: "Atendimento médico nos EUA é caro: não viaje sem cobertura." },
    { id: "mala", name: "Mala e roupas", short: "Mala", icon: "suitcase", intro: "Dezembro é ameno, mas a noite esfria e a chuva é rápida." },
    { id: "seguranca", name: "Segurança e contatos", short: "Segurança", icon: "shield", intro: "Pequenos cuidados que evitam os problemas mais comuns." },
    { id: "dias", name: "Embarque, estadia e volta", short: "Dias-chave", icon: "calendar", intro: "Lembretes para os momentos em que é fácil esquecer algo." }
  ];

  const L = {
    toll: ["Visitor Toll Pass (Orlando)", "https://www.visitorlando.com/visitor-toll-pass/"],
    iof: ["IOF em compras no exterior", "https://arqfinance.com/articles/tabela-atualizada-iof-cartao-credito/"],
    festa: ["Datas e preços da festa de Natal 2026", "https://wdwnt.com/2026/06/mickeys-very-merry-christmas-party-2026-dates-details-confirmed-entertainment/"],
    ll: ["Como funciona a compra do Lightning Lane", "https://www.kennythepirate.com/2024/07/24/full-guide-purchasing-the-new-lightning-lane-multi-pass/"],
    ksc: ["Kennedy Space Center: horários e dicas", "https://www.kennedyspacecenter.com/info/plan-your-visit/holiday-information-and-tips/"],
    uni: ["Hogwarts Express e Park-to-Park", "https://www.universalorlando.com/web/en/us/things-to-do/rides-attractions/hogwarts-express-hogsmeade-station/index.html"],
    receita: ["Receita Federal: viajantes e bagagem", "https://www.gov.br/receitafederal/pt-br"],
    mre: ["Itamaraty: consulados", "https://www.gov.br/mre/pt-br"],
    disney: ["Walt Disney World (site oficial)", "https://disneyworld.disney.go.com/"]
  };

  const R = {
    docs: [
      ["doc-passaporte", "e", "2026-10-19", 0, "Conferir a validade dos dois passaportes",
        "Precisam estar válidos durante toda a estadia, e muitas companhias aéreas recomendam pelo menos seis meses de validade restante. Se algum vence antes de junho de 2027, renove agora: o agendamento na Polícia Federal pode demorar semanas."],
      ["doc-visto", "e", "2026-10-19", 0, "Conferir o visto americano dos dois",
        "Brasileiros entram com visto (B1/B2); o ESTA não se aplica. Veja a validade e em qual passaporte o visto está colado: se for um passaporte antigo, leve os dois."],
      ["doc-nomes", "e", "2026-10-26", 0, "Comparar o nome nas passagens com o do passaporte",
        "Qualquer diferença (nome do meio, abreviação, ordem) pode impedir o embarque. Peça a correção à companhia ou à agência agora."],
      ["doc-cnh", "e", "2026-11-13", 0, "Separar a CNH física dentro da validade",
        "A locadora costuma aceitar a CNH brasileira junto com o passaporte. A Permissão Internacional para Dirigir (PID), emitida pelo Detran, é uma garantia extra: pergunte à locadora se ela exige."],
      ["doc-copias", "e", "2026-11-27", 0, "Salvar cópias digitais de todos os documentos",
        "Passaportes, vistos, CNH, apólice do seguro e vouchers: no celular (disponíveis offline), no e-mail e na nuvem. Leve uma cópia impressa separada dos originais."],
      ["doc-imigracao", "e", "2026-11-27", 0, "Preparar as respostas da imigração (CBP)",
        "Tenha à mão o endereço do primeiro hotel, a data do voo de volta e o motivo da viagem (turismo). Declare com clareza o que está trazendo, inclusive comida: as regras para frutas frescas e carnes são rígidas."],
      ["doc-impressos", "i", "2026-12-01", 0, "Imprimir os vouchers e confirmações",
        "Voos, hotéis, carro, ingressos e seguro. Com tudo no celular, uma bateria descarregada na imigração ou na locadora vira problema."],
      ["doc-dinheiro", "i", "2026-12-03", 0, "Declarar dinheiro em espécie acima do limite",
        "Valores acima de US$ 10.000 na entrada nos EUA e acima de R$ 10 mil na saída do Brasil precisam ser declarados."]
    ],

    voos: [
      ["voo-reconfirmar", "e", "2026-11-13", 0, "Reconfirmar os dois voos",
        "Ida: chegada ao MIA em 04/12 às 06h30. Volta: saída do MCO em 12/12 às 18h15. Confira horário, terminal e conexões no app da companhia e anote o código da reserva na aba Reservas."],
      ["voo-bagagem", "e", "2026-11-13", 0, "Conferir franquia de bagagem e regras de peso",
        "Veja quantas malas e quantos quilos cada passageiro pode despachar, o custo de uma mala extra e a franquia de mão. Você vai voltar com compras: decida agora como levará esse peso."],
      ["voo-assentos", "o", "2026-11-13", 0, "Marcar assentos lado a lado",
        "Alguns assentos têm taxa; avalie se vale a pena para o voo longo."],
      ["voo-chegada", "i", "2026-11-27", 0, "Planejar as primeiras horas em Miami",
        "Imigração, bagagem e locadora podem levar de duas a três horas. O quarto só costuma liberar à tarde: veja o item de guarda de malas em Hotéis."],
      ["voo-transporte", "i", "2026-12-02", 0, "Combinar o transporte até o aeroporto",
        "Chegue com pelo menos três horas de antecedência em voo internacional e deixe folga para o trânsito."],
      ["voo-fuso", "o", "2026-12-02", 0, "Ajustar o relógio para o fuso da Flórida",
        "Em dezembro a Flórida fica duas horas atrás de Brasília. Se o celular não mudar sozinho, ajuste o horário."],
      ["voo-checkin", "e", "2026-12-03", 0, "Fazer o check-in online e salvar os cartões de embarque",
        "Normalmente abre de 24 a 48 horas antes (confirme com a companhia). Salve os cartões de embarque na Carteira do celular e imprima uma cópia."],
      ["voo-mao", "e", "2026-12-03", 0, "Organizar a bagagem de mão",
        "Documentos, remédios, eletrônicos, power bank (baterias de lítio nunca vão despachadas), uma troca de roupa e carregadores. Líquidos em frascos de até 100 ml dentro de um saco transparente."]
    ],

    dinheiro: [
      ["din-cartoes", "e", "2026-10-30", 0, "Escolher os cartões da viagem",
        "Leve pelo menos dois, de bancos ou bandeiras diferentes, e guarde em lugares separados. O cartão da locadora precisa ser de crédito e estar no nome do motorista."],
      ["din-orcamento", "e", "2026-10-30", 0, "Revisar o orçamento e a reserva para a alfândega",
        "Abra a aba Orçamento, ajuste os valores previstos por categoria e inclua o imposto sobre as compras na volta (simulador de alfândega)."],
      ["din-limite", "e", "2026-11-13", 0, "Conferir o limite e liberar o uso no exterior",
        "A locadora e o hotel bloqueiam uma caução no cartão, e os iPhones consomem muito limite. Peça aumento temporário, se precisar, e ative o uso internacional no app do banco."],
      ["din-custos", "i", "2026-11-13", 0, "Comparar o custo de cada forma de pagamento",
        "O IOF em compras internacionais com cartão está em 3,5% desde julho de 2025 (confirme se mudou), além do câmbio aplicado pelo banco. Compare cartão do banco, conta global ou cartão pré-pago em dólar e dinheiro.", L.iof],
      ["din-dolar", "i", "2026-11-27", 0, "Pagar sempre em dólar nas maquininhas",
        "Se a maquininha oferecer cobrar em reais, recuse: a conversão feita pelo estabelecimento costuma ter câmbio pior."],
      ["din-especie", "i", "2026-11-27", 0, "Levar algum dinheiro em espécie",
        "Algumas centenas de dólares em notas pequenas para gorjetas, estacionamento e imprevistos. Dinheiro não resolve pedágios na Flórida, que são eletrônicos."],
      ["din-gorjeta", "i", "2026-11-27", 0, "Entender a gorjeta (tip)",
        "Em restaurantes com atendimento à mesa o padrão é de 18% a 22% sobre a conta; confira se já foi incluída (comum para grupos grandes). Em fast-food não se dá gorjeta."],
      ["din-imposto", "i", "2026-11-27", 0, "Lembrar que o preço da etiqueta não inclui imposto",
        "O imposto de venda da Flórida (entre 6,5% e 7,5%, conforme o condado) é somado no caixa. Considere isso na conta dos iPhones."],
      ["din-alertas", "o", "2026-11-27", 0, "Ativar alertas de compra no app do banco",
        "Uma notificação a cada transação ajuda a perceber fraude na hora e a acompanhar o orçamento."],
      ["din-carteira", "o", "2026-12-01", 0, "Adicionar os cartões à Carteira do iPhone",
        "O pagamento por aproximação é aceito na maior parte dos lugares e evita puxar o cartão físico."]
    ],

    tech: [
      ["tec-modelo", "i", "2026-11-13", 0, "Escolher modelo, cor e capacidade dos iPhones",
        "Anote o preço final com imposto da Flórida e compare com o preço no Brasil. Veja se o trade-in compensa antes de decidir."],
      ["tec-esim", "e", "2026-11-13", 0, "Confirmar na operadora que o modelo dos EUA funciona no Brasil",
        "iPhones vendidos nos EUA não têm bandeja de chip (só eSIM). Pergunte à operadora (Vivo, Claro, TIM…) se ativa eSIM nesse modelo, como transferir a linha e o que muda no plano atual."],
      ["tec-tradein", "e", "2026-11-13", 0, "Entender o trade-in com aparelhos brasileiros",
        "Confira se a Apple aceita o seu modelo, em qual estado e por quanto. Leve o aparelho carregado e com os acessórios."],
      ["tec-garantia", "i", "2026-11-20", 0, "Verificar a garantia de um iPhone comprado nos EUA",
        "Pergunte à Apple como funcionam a garantia e o serviço no Brasil para aparelhos comprados fora, e guarde a nota fiscal."],
      ["tec-2fa", "e", "2026-11-20", 0, "Preparar bancos e autenticações antes da troca",
        "Apps de banco, e-mail e WhatsApp podem pedir código por SMS ou aplicativo autenticador. Migre os autenticadores, deixe o chip brasileiro à mão e saiba como reativar o token do banco em um aparelho novo."],
      ["tec-internet", "e", "2026-11-20", 0, "Resolver a internet nos EUA",
        "Escolha entre pacote de roaming da operadora, eSIM de dados para os EUA ou chip americano. Instale e teste antes de embarcar, e mantenha o chip brasileiro ativo para receber SMS do banco."],
      ["tec-backup", "e", "2026-11-27", 0, "Fazer backup completo dos iPhones atuais",
        "iCloud ou computador. Repita na véspera de comprar os novos, para a transferência levar as fotos e os apps mais recentes."],
      ["tec-whatsapp", "i", "2026-11-27", 0, "Garantir o backup do WhatsApp",
        "Ative o backup das conversas e confirme que ele terminou. Na troca de aparelho, a transferência direta é a forma mais segura."],
      ["tec-apps", "i", "2026-11-27", 0, "Instalar os aplicativos da viagem",
        "Companhia aérea, locadora, hotéis, Google Maps, My Disney Experience, Universal Orlando e Kennedy Space Center. Entre em cada um e teste o login antes de viajar."],
      ["tec-adaptador", "i", "2026-11-27", 0, "Comprar adaptadores de tomada",
        "As tomadas dos EUA têm dois pinos chatos (tipo A/B) e 120 V. O plugue brasileiro não encaixa: leve dois ou três adaptadores e confira se os carregadores são bivolt."],
      ["tec-powerbank", "i", "2026-11-27", 0, "Separar um power bank e cabos curtos",
        "Dias de parque gastam muita bateria. Power banks (lítio) vão na bagagem de mão, nunca despachados."],
      ["tec-mapas", "i", "2026-11-27", 0, "Baixar mapas offline",
        "Miami, Orlando e o caminho da Florida’s Turnpike no Google Maps, para não depender do sinal nos parques e na estrada."],
      ["tec-airtag", "o", "2026-11-27", 0, "Colocar um rastreador na mala",
        "Ajuda a localizar bagagem extraviada, útil na volta com compras caras."],
      ["tec-apple-reserva", "e", "2026-12-01", 0, "Reservar a retirada na Apple Store (Lincoln Road)",
        "Reserve o modelo para o horário em que você estará lá e confirme o horário de abertura da loja. Leve passaporte e o cartão de pagamento."],
      ["tec-carro", "i", "2026-12-01", 0, "Levar suporte de celular e cabo para o carro",
        "Facilita o GPS na estrada. Verifique se o carro alugado tem entrada USB ou CarPlay."],
      ["tec-espaco", "o", "2026-12-01", 0, "Liberar espaço de armazenamento nos celulares",
        "Fotos e vídeos de parque ocupam muito. Apague o que não precisa antes de viajar."],
      ["tec-capa", "o", "2026-12-01", 0, "Decidir onde comprar capa e película dos novos iPhones",
        "Na própria loja da Apple o preço costuma ser maior. Compare e leve pronto, se quiser."],
      ["tec-transferir", "e", "", 4, "Transferir tudo e conferir o aparelho novo antes de entregar o antigo",
        "Confira WhatsApp, fotos, contatos, apps de banco e autenticadores. Só então entregue o aparelho antigo no trade-in."],
      ["tec-buscar", "e", "", 4, "Desativar o Buscar iPhone e sair do Apple ID no aparelho antigo",
        "É obrigatório para o trade-in. Faça só depois de confirmar que a transferência terminou."]
    ],

    carro: [
      ["car-reserva", "e", "2026-10-30", 0, "Conferir a reserva do carro",
        "Retirada no MIA em 04/12 e devolução no MCO em 12/12. Confira a categoria (o Mustang é garantido ou ‘ou similar’?), o horário de retirada e a taxa de devolução em outra cidade (one-way)."],
      ["car-motoristas", "i", "2026-11-13", 0, "Definir quem dirige e conferir as exigências",
        "Todo motorista precisa constar no contrato. Verifique a taxa de condutor adicional e, se alguém tiver menos de 25 anos, a taxa de condutor jovem."],
      ["car-seguro", "e", "2026-11-13", 0, "Decidir a cobertura do seguro",
        "Entenda o que o seguro do cartão e o seguro-viagem cobrem nos EUA (danos ao carro, terceiros, roubo) e o que a locadora oferece. Peça a confirmação da cobertura por escrito antes de recusar o seguro da locadora."],
      ["car-pedagio", "e", "2026-11-20", 0, "Resolver os pedágios",
        "Os pedágios na Flórida Central são eletrônicos e não aceitam dinheiro. O Visitor Toll Pass é gratuito para quem aluga no aeroporto de Orlando (MCO) e faz a viagem de ida e volta por ele; como o seu carro sai de Miami, provavelmente não se aplica. Pergunte à locadora como funciona o programa de pedágio (taxa diária, teto, como recusar) e compare.", L.toll],
      ["car-caucao", "e", "2026-11-27", 0, "Garantir limite para a caução da locadora",
        "A locadora bloqueia um valor no cartão de crédito do motorista principal. Pergunte o valor e confira se o limite comporta, junto com hotéis e compras."],
      ["car-regras", "i", "2026-11-27", 0, "Rever as regras de direção na Flórida",
        "Dirige-se pela direita, como no Brasil. Os limites são em milhas por hora (1 mph equivale a cerca de 1,6 km/h). A conversão à direita no sinal vermelho é permitida após parada total, onde não houver placa proibindo. Celular na mão e cinto de segurança rendem multa."],
      ["car-estacionamento", "i", "2026-11-27", 0, "Somar o custo de estacionamento",
        "Parques e alguns hotéis cobram estacionamento (o valor varia por local). Inclua no orçamento. No Kennedy Space Center, o estacionamento custava US$ 15 em 2025."],
      ["car-retirada", "e", "", 4, "Ir ao centro de locação do MIA",
        "A retirada costuma ser no Rental Car Center, fora dos terminais (acesso pelo MIA Mover). Reserve tempo extra e tenha passaporte, CNH e o cartão do motorista à mão."],
      ["car-inspecao", "e", "", 4, "Inspecionar e filmar o carro antes de sair",
        "Filme a carroceria em 360°, rodas, vidros, interior, painel (combustível e quilometragem) e peça para registrar qualquer avaria no contrato."],
      ["car-descanso", "i", "", 4, "Descansar antes de dirigir após o voo",
        "Voo noturno e imigração cansam. Se estiver com sono, pare, tome um café e deixe a direção para quem estiver mais descansado."],
      ["car-rota6", "i", "", 6, "Conferir a rota Lauderdale → Kissimmee",
        "Cerca de três horas sem paradas pela Florida’s Turnpike, mais trânsito. Saia até as 15h, programe uma parada e use o GPS com mapas baixados."],
      ["car-abastecer", "i", "", 12, "Abastecer antes de devolver o carro",
        "Confira a política de combustível do contrato, abasteça perto do MCO e guarde o recibo."],
      ["car-devolucao", "e", "", 12, "Fotografar o carro na devolução",
        "Faça fotos de todos os lados e do painel (combustível e quilometragem) e guarde o recibo de fechamento do contrato."]
    ],

    hoteis: [
      ["hot-conf-1", "e", "2026-11-13", 0, "Confirmar o hotel em Lauderdale-by-the-Sea (4 a 6/12)",
        "Confira datas, tipo de quarto, política de cancelamento e as taxas obrigatórias pagas no check-in."],
      ["hot-conf-2", "e", "2026-11-13", 0, "Confirmar o Ramada em Kissimmee (6 a 12/12)",
        "Confira datas, quarto, taxas e cancelamento. Veja também a distância e o tempo de carro até cada parque."],
      ["hot-taxas", "i", "2026-11-20", 0, "Perguntar sobre taxas extras",
        "Muitos hotéis na Flórida cobram taxa diária obrigatória (resort fee) e estacionamento, pagas no check-in e nem sempre incluídas no valor da reserva."],
      ["hot-early", "e", "2026-11-27", 0, "Pedir check-in antecipado ou guarda de malas para 04/12",
        "Você chega a Miami às 06h30 e o quarto costuma liberar à tarde. Escreva ao hotel e guarde a resposta por e-mail."],
      ["hot-cartao", "i", "2026-11-27", 0, "Ter cartão e documento para o check-in",
        "O hotel pode bloquear uma caução no cartão. Leve o mesmo cartão usado na reserva, quando exigido."],
      ["hot-cozinha", "o", "2026-11-27", 0, "Verificar geladeira e micro-ondas no quarto",
        "Ajuda a economizar em café da manhã e lanches comprados no mercado."],
      ["hot-endereco", "i", "2026-12-01", 0, "Salvar endereço e telefone dos hotéis offline",
        "Para mostrar na imigração, ao motorista de aplicativo ou ao GPS quando não houver sinal."],
      ["hot-checkout", "i", "", 12, "Fazer o check-out e conferir o quarto",
        "Passaportes, carteiras, celulares, carregadores, itens do cofre, banheiro e tomadas."]
    ],

    parques: [
      ["par-festa-ingresso", "e", "2026-10-19", 0, "Garantir o ingresso da festa de Natal (10/12)",
        "A Mickey’s Very Merry Christmas Party exige ingresso próprio. 10/12 está entre as noites de festa de 2026 (início às 19h, entrada a partir das 16h para quem tem ingresso). Preços divulgados: de US$ 189 a US$ 229 por pessoa, mais imposto, conforme a data, e algumas datas já esgotaram.", L.festa],
      ["par-md-restaurante", "o", "2026-10-19", 0, "Ver reserva de restaurante nos parques",
        "Se quiser jantar com reserva, veja a disponibilidade no app: as reservas costumam abrir com cerca de 60 dias de antecedência (confirme)."],
      ["par-md-ingresso", "e", "2026-10-26", 0, "Confirmar o ingresso do Magic Kingdom (07/12)",
        "O ingresso vale para um parque e uma data. Vincule-o ao My Disney Experience dos dois e confira se há exigência de reserva de parque para o dia.", L.disney],
      ["par-uni-ingresso", "e", "2026-10-26", 0, "Confirmar o ingresso Park-to-Park da Universal (os 2 parques em 09/12)",
        "O dia 9 usa Islands of Adventure e Universal Studios Florida juntos, com o Hogwarts Express entre eles. Confira que o ingresso é Park-to-Park para a data e para as duas pessoas.", L.uni],
      ["par-md-app", "i", "2026-11-20", 0, "Criar conta e vincular ingressos no My Disney Experience",
        "Faça isso com antecedência: o app mostra horários e filas e permite pedir comida pelo celular."],
      ["par-uni-app", "i", "2026-11-20", 0, "Instalar o app da Universal e vincular os ingressos",
        "Use para horários, filas e mapa do parque."],
      ["par-ksc-ingresso", "e", "2026-11-20", 0, "Comprar o ingresso do Kennedy Space Center (08/12)",
        "Compre com data. Chegue na abertura: o passeio de ônibus até o Apollo/Saturn V Center usa fila virtual (QR code no local) e leva cerca de três horas.", L.ksc],
      ["par-uni-express", "i", "2026-11-27", 0, "Comparar o Express Pass da Universal",
        "Veja o preço para a data, quais atrações aceita e se compensa. Ele não garante acesso a todas as atrações."],
      ["par-regras", "i", "2026-11-27", 0, "Ler as regras de entrada de cada parque",
        "Tamanho de mochila, comida e bebida, armários, selfie stick e itens proibidos mudam: confirme no site oficial de cada parque."],
      ["par-prioridades", "i", "2026-12-01", 0, "Definir as atrações prioritárias de cada dia",
        "Escolha de quatro a seis por parque e salve a lista no celular: com filas longas, é o que mantém o dia sob controle."],
      ["par-festa-regras", "i", "2026-12-03", 0, "Entender como funciona a noite da festa",
        "Quem não tem ingresso da festa costuma precisar sair mais cedo do Magic Kingdom; quem tem pode entrar a partir das 16h. Confirme os horários no app e deixe o ingresso salvo no celular."],
      ["par-md-ll", "i", "2026-12-04", 0, "Decidir sobre o Lightning Lane",
        "É um serviço pago para reduzir filas, comprado pelo app. Em 2024, quem não se hospedava em hotel Disney podia comprar com três dias de antecedência (para 07/12, a partir de 04/12): confira a regra atual e escolha as atrações prioritárias.", L.ll],
      ["par-md-dia", "i", "", 7, "Conferir o horário do parque e o plano do dia",
        "Abra o My Disney Experience antes de sair, confirme horários de abertura e shows e carregue o celular."],
      ["par-agua", "i", "", 7, "Levar garrafa reutilizável",
        "Nos balcões de serviço rápido costuma ser possível pedir copo de água gelada sem custo (confirme)."],
      ["par-ksc-horario", "i", "", 8, "Conferir horário e lançamentos do dia no Kennedy Space Center",
        "Em dezembro de 2025 o complexo funcionava das 9h às 19h; confirme os horários de 2026. Lançamentos de foguete na região podem alterar o trânsito.", L.ksc],
      ["par-uni-dia", "i", "", 9, "Conferir o horário dos dois parques da Universal e o plano do dia",
        "Não presuma o horário de fechamento: veja o calendário oficial do dia."],
      ["par-festa-dia", "i", "", 10, "Levar o ingresso da festa e um agasalho leve",
        "Mantenha o ingresso no celular, com bateria, e leve uma peça leve para a noite."]
    ],

    compras: [
      ["com-lista", "i", "2026-11-13", 0, "Fechar a lista de compras por pessoa",
        "Itens, tamanhos, prioridade e orçamento. Salve fotos e links dos produtos para comparar preço na hora."],
      ["com-cota", "e", "2026-11-13", 0, "Calcular o imposto na volta (cota de isenção)",
        "Segundo as regras divulgadas, a cota por pessoa em viagem aérea é de US$ 1.000 e o que passar dela paga 50% de imposto. Dois iPhones mais roupas passam disso com facilidade: use o simulador na aba Orçamento e confirme os valores vigentes no site da Receita.", L.receita],
      ["com-tamanhos", "i", "2026-11-20", 0, "Anotar medidas e a conversão de tamanhos",
        "Os tamanhos americanos variam por marca. Anote suas medidas, veja a tabela de cada marca e salve no celular."],
      ["com-govbr", "o", "2026-11-27", 0, "Ter uma conta Gov.br prata ou ouro",
        "Ela preenche automaticamente seus dados na declaração de bagagem (e-DBV) da Receita Federal."],
      ["com-ordem", "i", "2026-11-27", 0, "Seguir a ordem de compras",
        "Eletrônicos no primeiro dia, Sawgrass em 06/12, Vineland em 10/12 e International Premium em 11/12. Guarde uma reserva de orçamento para o último dia."],
      ["com-mala", "e", "2026-11-27", 0, "Reservar espaço e peso para o que vai comprar",
        "Leve uma mala dobrável ou deixe parte da mala vazia, e pese antes de voltar. Confira o custo de mala extra na companhia."],
      ["com-vip", "o", "2026-11-27", 0, "Cadastrar-se no clube VIP dos Premium Outlets",
        "Os outlets costumam oferecer cupons para quem se cadastra. Confira no site oficial antes de ir."],
      ["com-presentes", "o", "2026-11-27", 0, "Fechar a lista de presentes para a família",
        "Entram na mesma cota de isenção: some ao orçamento."],
      ["com-horarios", "i", "2026-12-01", 0, "Conferir os horários dos outlets",
        "Os horários variam por loja e por dia. Confirme Sawgrass Mills, Vineland e International Premium Outlets."],
      ["com-notas", "e", "", 4, "Guardar notas fiscais e caixas",
        "Notas e caixas comprovam preço e origem. Fotografe os recibos e guarde tudo em uma pasta."],
      ["com-mercado", "i", "", 6, "Fazer mercado antes dos parques",
        "Água, frutas resistentes, barras de cereal, sanduíches simples, lenços, protetor solar e sacos para lixo. Confirme as regras de comida de cada parque."],
      ["com-troca", "i", "", 10, "Conferir a política de troca antes de pagar",
        "Os prazos variam por loja. Prove as peças e guarde recibo e etiquetas."],
      ["com-edbv", "e", "", 12, "Preencher a e-DBV (declaração de bagagem)",
        "A Receita permite preencher pelo celular com até 30 dias de antecedência ou durante o voo de volta. Declare tudo que passar da cota; o registro automático libera declarações de baixo risco.", L.receita]
    ],

    saude: [
      ["sau-seguro", "e", "2026-10-26", 0, "Contratar o seguro-viagem",
        "Atendimento médico nos EUA é muito caro. Escolha cobertura médica alta, atendimento 24 horas em português, assistência para bagagem e cancelamento, e leia as exclusões (doenças preexistentes, esportes)."],
      ["sau-remedios", "e", "2026-11-20", 0, "Separar medicamentos de uso pessoal",
        "Na embalagem original, com receita (de preferência com o princípio ativo também em inglês), na bagagem de mão. Medicamentos controlados têm regras próprias: confira antes."],
      ["sau-apolice", "i", "2026-11-27", 0, "Salvar a apólice e o telefone de atendimento",
        "Deixe no celular (offline) e impresso. Anote o número 24 horas da seguradora e como solicitar reembolso."],
      ["sau-emergencia", "i", "2026-11-27", 0, "Saber como agir em uma emergência",
        "Ligue 911. Avise a seguradora o quanto antes e guarde todos os recibos e relatórios médicos para o reembolso."],
      ["sau-sol", "i", "2026-11-27", 0, "Levar proteção solar",
        "Protetor com FPS alto, boné e óculos. O sol da Flórida é forte mesmo em dezembro, e os parques têm pouca sombra."],
      ["sau-kit", "i", "2026-11-27", 0, "Montar um kit básico",
        "Analgésico, antitérmico, antialérgico, antidiarreico, antiácido, soro, curativos para bolhas e repelente."],
      ["sau-alergias", "i", "2026-11-27", 0, "Anotar alergias e restrições em inglês",
        "Deixe no celular um texto curto com alergias, remédios em uso e contatos de emergência."],
      ["sau-pes", "i", "2026-11-27", 0, "Prevenir bolhas",
        "Meias confortáveis, tênis já amaciado e curativos específicos. Os dias de parque somam muitos quilômetros a pé."],
      ["sau-hidratar", "i", "", 7, "Hidratar e fazer pausas no parque",
        "Beba água, coma em horários regulares e sente à sombra algumas vezes no dia."]
    ],

    mala: [
      ["mal-tenis", "i", "2026-11-27", 0, "Amaciar o tênis e levar dois pares",
        "Caminhe com ele nas semanas anteriores. Alternar os pares ajuda nos dias de parque."],
      ["mal-extra", "e", "2026-11-27", 0, "Garantir mala extra ou espaço para voltar",
        "Mala dobrável, sacos a vácuo e uma balança de bagagem."],
      ["mal-cadeado", "o", "2026-11-27", 0, "Comprar cadeado com trava TSA",
        "Se a mala for aberta na inspeção, um cadeado comum pode ser cortado."],
      ["mal-clima", "i", "2026-12-01", 0, "Ver a previsão na semana anterior e ajustar a mala",
        "Em dezembro as médias são amenas, mas frentes frias derrubam a temperatura à noite, e as pancadas de chuva são rápidas."],
      ["mal-roupas", "e", "2026-12-01", 0, "Separar roupas para nove dias, em camadas",
        "Camisetas, shorts e calças leves, um moletom ou jaqueta leve para a noite e roupa de banho para praia e piscina. Conte com lavanderia para repetir peças."],
      ["mal-mochila", "i", "2026-12-01", 0, "Escolher a mochila pequena dos parques",
        "Confira o tamanho permitido de bolsas em cada parque."],
      ["mal-nec", "i", "2026-12-01", 0, "Montar a nécessaire",
        "Líquidos em frascos de até 100 ml na bagagem de mão. O restante vai despachado."],
      ["mal-chuva", "i", "2026-12-01", 0, "Levar poncho leve e saquinhos para o celular",
        "Pancadas rápidas são comuns e os parques têm poucas áreas cobertas."],
      ["mal-garrafa", "i", "2026-12-01", 0, "Levar uma garrafa reutilizável",
        "Economiza e facilita a hidratação nos parques."],
      ["mal-jantar", "o", "2026-12-01", 0, "Levar uma ou duas roupas mais arrumadas",
        "Para jantares em restaurantes mais caprichados."],
      ["mal-natal", "o", "2026-12-01", 0, "Pensar em algo natalino para a festa do dia 10",
        "Opcional, mas combina com a noite."],
      ["mal-secador", "o", "2026-12-01", 0, "Conferir a voltagem de secador e chapinha",
        "Os EUA usam 120 V. Aparelhos de 220 V não funcionam bem; veja se há secador no hotel."],
      ["mal-pesar", "i", "2026-12-02", 0, "Pesar as malas antes de sair de casa",
        "Deixe margem para o que vai comprar e confira o limite de peso da companhia."]
    ],

    seguranca: [
      ["seg-golpes", "i", "2026-11-27", 0, "Comprar ingressos só nos canais oficiais",
        "Desconfie de ofertas muito baratas na rua ou em sites desconhecidos, e de ligações pedindo pagamento ou dados do cartão."],
      ["seg-bloqueio", "e", "2026-11-27", 0, "Salvar o telefone de bloqueio de cada cartão",
        "Anote o número de bloqueio internacional de cada banco e confirme que funciona do exterior."],
      ["seg-consulado", "i", "2026-11-27", 0, "Salvar o contato do Consulado-Geral do Brasil em Miami",
        "Confirme o telefone e o endereço no site oficial do Itamaraty.", L.mre],
      ["seg-wifi", "o", "2026-11-27", 0, "Evitar Wi-Fi público para banco",
        "Use dados móveis para acessar contas e fazer transferências."],
      ["seg-carro", "e", "2026-12-03", 0, "Não deixar nada à vista no carro",
        "Guarde compras, bolsas e eletrônicos no porta-malas antes de chegar ao destino. Furtos em carros de turistas acontecem em estacionamentos de praias, outlets e atrações."],
      ["seg-dividir", "i", "2026-12-03", 0, "Dividir cartões e dinheiro entre os dois",
        "Se um cartão ou uma carteira se perder, o outro continua funcionando."],
      ["seg-familiar", "i", "2026-12-03", 0, "Deixar o roteiro com alguém no Brasil",
        "Envie voos, hotéis, telefone do seguro e o roteiro dia a dia."],
      ["seg-localizacao", "o", "2026-12-03", 0, "Ativar o compartilhamento de localização entre vocês",
        "Facilita se alguém se perder em um parque lotado."],
      ["seg-cofre", "i", "", 7, "Usar o cofre do hotel nos dias de parque",
        "Deixe passaportes e eletrônicos que não vai usar e leve só as cópias digitais."]
    ],

    dias: [
      ["dia-vespera", "e", "2026-12-03", 0, "Véspera: conferir tudo uma última vez",
        "Check-in feito, cartões de embarque salvos, malas pesadas, eletrônicos carregados, documentos na mochila e impressos separados."],
      ["dia-casa", "i", "2026-12-03", 0, "Deixar a casa em ordem",
        "Contas pagas, lixo fora, chaves com alguém de confiança e aparelhos desligados."],
      ["dia-chegada", "i", "", 4, "Na imigração e na chegada",
        "Passaporte e visto à mão, endereço do hotel e data de volta. Depois, siga para a locadora, ative a internet e avise a família que chegou."],
      ["dia-malas", "i", "", 11, "Última noite: organizar as malas",
        "Separe recibos, pese as malas, carregue tudo e deixe documentos e carregadores na mochila."],
      ["dia-mco", "e", "", 12, "Chegar ao MCO por volta das 15h",
        "Devolva o carro, vá ao terminal, despache as malas e passe pela segurança com folga. O voo sai às 18h15."],
      ["dia-brasil", "i", "", 12, "Ao chegar ao Brasil: ter a declaração e as notas à mão",
        "Se a e-DBV indicar tributos, siga as orientações da Receita no desembarque."],
      ["dia-imposto", "e", "2026-12-14", 13, "Pagar o imposto da alfândega, se houver",
        "Se a declaração indicar tributos, pague dentro do prazo informado pela Receita."],
      ["dia-faturas", "i", "2026-12-20", 13, "Conferir as faturas dos cartões",
        "Procure cobranças da locadora (pedágios, taxas) e do hotel, e confirme que as cauções foram liberadas."],
      ["dia-backup", "o", "2026-12-14", 13, "Fazer backup das fotos da viagem",
        "Copie para a nuvem ou para o computador."],
      ["dia-notas", "o", "2026-12-14", 13, "Guardar notas fiscais e garantias",
        "Principalmente dos iPhones."]
    ]
  };

  // Itens do checklist antigo (14 linhas) -> ids novos, para não perder o que já foi marcado.
  FT.LEGACY_CHECKS = {
    "PRÉ-VIAGEM: Confirmar voo de chegada ao MIA e retorno pelo MCO": ["voo-reconfirmar"],
    "PRÉ-VIAGEM: Confirmar aluguel com retirada no MIA e devolução no MCO": ["car-reserva"],
    "PRÉ-VIAGEM: Confirmar check-in antecipado ou guarda de malas no primeiro hotel": ["hot-early"],
    "PRÉ-VIAGEM: Confirmar reservas dos dois hotéis": ["hot-conf-1", "hot-conf-2"],
    "COMPRAS: Confirmar horário e estoque dos iPhones na loja escolhida": ["tec-apple-reserva"],
    "COMPRAS: Confirmar regras de trade-in para aparelhos brasileiros": ["tec-tradein"],
    "PRÉ-VIAGEM: Confirmar eSIM e compatibilidade com operadora brasileira": ["tec-esim"],
    "PARQUE: Confirmar ingresso Magic Kingdom para 7/12": ["par-md-ingresso"],
    "PARQUE: Confirmar ingresso Park-to-Park Universal para 9/12": ["par-uni-ingresso"],
    "PARQUE: Instalar os apps oficiais Disney e Universal": ["par-md-app", "par-uni-app"],
    "PRÉ-VIAGEM: Conferir seguro-viagem, documentos e cartões": ["sau-seguro"],
    "COMPRAS: Conferir limites de bagagem e espaço para compras": ["voo-bagagem"],
    "COMPRAS: Conferir horários especiais de outlets e restaurantes": ["com-horarios"],
    "PARQUE: Comprar água, café da manhã e lanches permitidos para os parques": ["com-mercado"]
  };

  // Prefixos das listas antigas geradas pela IA -> categoria nova.
  FT.LEGACY_PREFIX_CAT = {
    "PRÉ-VIAGEM": "docs", "DOCUMENTOS": "docs", "ROUPAS": "mala", "ELETRÔNICOS": "tech",
    "SAÚDE": "saude", "CARRO": "carro", "PARQUES": "parques", "PARQUE": "parques", "COMPRAS": "compras"
  };

  FT.CHECKLIST = [];
  for (const cat of FT.CATS) {
    for (const row of R[cat.id] || []) {
      const [id, pri, due, day, title, detail, link] = row;
      FT.CHECKLIST.push({
        id, cat: cat.id, pri, day,
        due: due || (day >= 4 && day <= 12 ? "2026-12-" + String(day).padStart(2, "0") : ""),
        title, detail, link: link || null
      });
    }
  }
})();
