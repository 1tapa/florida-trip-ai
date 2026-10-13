/* Conteúdo base do guia: viagem, roteiro, reservas, comida e compras.
 * Importante: nenhum texto aqui pode conter aspas duplas retas (use ‘ ’ ou “ ”).
 */
(function () {
  const FT = (window.FT = window.FT || {});

  FT.TRIP = {
    start: "2026-12-04",
    end: "2026-12-12",
    arrive: { code: "MIA", city: "Miami", date: "2026-12-04", time: "06:30" },
    depart: { code: "MCO", city: "Orlando", date: "2026-12-12", time: "18:15" },
    travelers: 2,
    budget: 6000,
    foodPerDay: 110,
    iphones: 2600,
    quota: 1000,
    customsRate: 0.5,
    weather: { lat: 28.292, lon: -81.4076, name: "Kissimmee" }
  };

  FT.LEGS = {
    miami: { name: "Miami e Lauderdale" },
    estrada: { name: "Estrada" },
    orlando: { name: "Orlando e Kissimmee" },
    volta: { name: "Volta" }
  };

  FT.EXPENSE_CATS = ["Alimentação", "Roupas", "Eletrônicos", "Transporte", "Parques", "Outros"];
  FT.CUSTOMS_CATS = ["Roupas", "Eletrônicos"];

  FT.DAYS_DEFAULT = [
    { date: "04", dow: "SEX", leg: "miami", title: "Chegada, iPhone e Miami Beach", where: "MIA → Apple Lincoln Road → Lauderdale-by-the-Sea",
      desc: "Pouso às 06h30, imigração, retirada do Mustang, compra e configuração do iPhone, South Beach e chegada ao hotel.",
      tags: ["Chegada", "Apple", "Praia"], tip: "Priorize carro, iPhone e hotel. Cortar a South Beach é melhor do que dirigir cansado." },
    { date: "05", dow: "SÁB", leg: "miami", title: "Little Havana, Wynwood e Brickell", where: "Miami",
      desc: "Cultura cubana pela manhã, arte urbana à tarde e Brickell e Biscayne Bay no fim do dia.",
      tags: ["Passeio", "Arte", "Gastronomia"], tip: "A semana da Art Basel costuma trazer eventos e trânsito extra em Miami: saia cedo." },
    { date: "06", dow: "DOM", leg: "estrada", title: "Descanso, Sawgrass e estrada para Orlando", where: "Lauderdale-by-the-Sea → Sawgrass Mills → Kissimmee",
      desc: "Manhã leve, compras de oportunidade no Sawgrass e estrada para o Ramada em Kissimmee.",
      tags: ["Outlet", "Estrada"], tip: "É domingo: o Chick-fil-A fecha. Faça o mercado para os parques no caminho do hotel." },
    { date: "07", dow: "SEG", leg: "orlando", title: "Magic Kingdom", where: "Walt Disney World",
      desc: "Dia inteiro no parque: atrações concorridas cedo, atrações clássicas à tarde e show ou ambiente noturno.",
      tags: ["Disney", "Dia inteiro"], tip: "As primeiras horas depois da abertura costumam ter as menores filas." },
    { date: "08", dow: "TER", leg: "orlando", title: "Kennedy Space Center e Disney Springs", where: "Cabo Canaveral → Disney Springs",
      desc: "Dia espacial no Kennedy Space Center e passeio noturno por lojas, decoração e restaurantes no Disney Springs.",
      tags: ["NASA", "Passeio"], tip: "É o dia mais longo do roteiro. Se o cansaço pesar, troque o Disney Springs por um jantar perto do hotel." },
    { date: "09", dow: "QUA", leg: "orlando", title: "Universal Studios Florida", where: "Universal Orlando Resort",
      desc: "Dia inteiro no Universal Studios Florida, priorizando Harry Potter e atrações de alta demanda. O ingresso Park-to-Park é necessário para o Hogwarts Express.",
      tags: ["Universal", "Dia inteiro"], tip: "Defina de quatro a seis atrações prioritárias antes de entrar no parque." },
    { date: "10", dow: "QUI", leg: "orlando", title: "Vineland Outlets e festa de Natal da Disney", where: "Vineland Premium Outlets → Magic Kingdom",
      desc: "Compras pela manhã, descanso no hotel e Mickey’s Very Merry Christmas Party à noite (ingresso separado).",
      tags: ["Compras", "Natal Disney"], tip: "A festa começa às 19h e a entrada antecipada, às 16h: guarde energia para a noite." },
    { date: "11", dow: "SEX", leg: "orlando", title: "International Premium Outlets e malas", where: "Orlando",
      desc: "Completar roupas, tênis e acessórios, voltar cedo ao hotel e organizar as malas.",
      tags: ["Compras", "Organização"], tip: "Compre só o que falta na lista. A última passada serve para fechar, não para recomeçar." },
    { date: "12", dow: "SÁB", leg: "volta", title: "Retorno ao Brasil", where: "Kissimmee → MCO",
      desc: "Café, check-out, abastecimento e devolução do Mustang. Voo às 18h15; planejar chegada ao aeroporto por volta das 15h.",
      tags: ["Check-out", "Aeroporto"], tip: "Com voo às 18h15, a meta é estar no MCO às 15h." }
  ];

  /* Cada bloco: [horário, título, descrição, local opcional para abrir no mapa] */
  FT.PLANS_DEFAULT = [
    { schedule: [
        ["06:30", "Chegada ao MIA", "Imigração, bagagem e procedimentos de entrada. Conte com variação no tempo de liberação.", "Miami International Airport"],
        ["09:00–09:30", "Retirar o Mustang", "Filme a carroceria em 360°, rodas, vidros, interior, painel, combustível e quilometragem. Pergunte sobre pedágios.", "MIA Rental Car Center"],
        ["10:00–11:30", "Apple Lincoln Road", "Confirmar estoque, preço final e regras de trade-in. Transferir fotos, WhatsApp, contatos, bancos e autenticação antes de apagar ou entregar o aparelho antigo.", "Apple Lincoln Road Miami Beach"],
        ["11:30–13:30", "Lincoln Road e almoço", "Passear a pé, tomar café e almoçar sem comprometer o restante do dia.", "Lincoln Road Mall Miami Beach"],
        ["13:30–16:00", "South Beach, Ocean Drive e Art Déco", "Passeio, praia e fotos. Se estiver cansado, escolha só a Ocean Drive e um trecho da praia.", "Ocean Drive South Beach Miami"],
        ["16:00–19:00", "Dirigir para Lauderdale-by-the-Sea", "Check-in ou deixar as malas, praia e pôr do sol se houver energia.", "Lauderdale-by-the-Sea Florida"],
        ["19:30", "Jantar e descanso", "Evitar programar vida noturna pesada depois do voo."]
      ],
      alternatives: [
        ["Se o voo atrasar", "Priorize carro, Apple (se houver estoque ou agendamento) e hotel. Corte a South Beach antes de dirigir cansado."],
        ["Se o iPhone não estiver disponível", "Não compre uma configuração diferente por impulso. Verifique outra Apple Store, como Brickell City Centre ou Florida Mall, conforme rota e estoque."],
        ["O que comprar para a viagem", "Capa e película para o aparelho; água e lanches básicos podem ficar para o mercado do dia 06."]
      ] },

    { schedule: [
        ["08:00", "Café da manhã", "Saia com água, carregador e calçado confortável."],
        ["09:30", "Saída do hotel", "Use navegação atualizada para o trajeto e o estacionamento."],
        ["10:15–12:30", "Little Havana", "Calle Ocho, Domino Park, cafeterias e lojas. Observe os horários das atrações específicas.", "Domino Park Little Havana Miami"],
        ["12:00–13:00", "Almoço cubano", "Escolha uma cafeteria ou restaurante na região; evite atravessar a cidade só para uma refeição."],
        ["13:30–15:30", "Wynwood", "Murais, Wynwood Walls se interessar, lojas e cafés.", "Wynwood Walls Miami"],
        ["16:00–18:30", "Brickell e Downtown/Bayfront", "Brickell City Centre, passeio pela baía e fotos no fim da tarde.", "Brickell City Centre Miami"],
        ["18:30–20:00", "Jantar em Brickell", "Opção para encerrar o dia antes de voltar."],
        ["20:00–21:00", "Retorno ao hotel", "Se estiver cansado, corte Brickell e volte mais cedo."]
      ],
      alternatives: [
        ["Dia de chuva", "Priorize cafés, lojas e áreas cobertas; reduza o tempo em Wynwood e na orla."],
        ["Versão econômica", "Passeios de rua e murais, refeições rápidas e evitar ingressos ou atrações extras."],
        ["Art Basel", "A semana pode gerar eventos e trânsito adicionais; só encaixe um evento específico se confirmar ingresso, horário e localização."]
      ] },

    { schedule: [
        ["08:30–09:30", "Café e descanso", "Manhã propositalmente leve antes da estrada."],
        ["09:30–10:30", "Praia ou piscina e check-out", "Confira o quarto, os carregadores e as compras antes de sair."],
        ["11:00–15:00", "Sawgrass Mills", "Primeira rodada: procure peças-chave e ofertas excepcionais, sem tentar comprar o guarda-roupa inteiro.", "Sawgrass Mills Sunrise Florida"],
        ["15:00", "Saída para Kissimmee", "Ajuste pelo trânsito; use a rota sugerida pelo GPS no dia."],
        ["15:00–19:00", "Estrada e parada curta", "A Florida’s Turnpike é a referência; pare para banheiro, combustível e café se necessário."],
        ["19:00–21:00", "Check-in no Ramada e jantar", "Organize café da manhã, água e lanches para os parques. Prepare a mochila do Magic Kingdom.", "Ramada Kissimmee Florida"],
        ["21:30", "Dormir", "A prioridade é recuperar energia."]
      ],
      alternatives: [
        ["Se o outlet atrasar", "Saia até as 15h no máximo; se estiver muito cansado ou o trânsito estiver ruim, reduza as compras e priorize a chegada segura."],
        ["Mercado para os parques", "Água, frutas resistentes, barras de cereal, crackers, castanhas se não houver alergias, sanduíches simples, lenços, protetor solar e sacos para lixo. Verifique as regras atuais de entrada dos parques."],
        ["Domingo", "O Chick-fil-A fecha aos domingos e alguns estabelecimentos têm horário reduzido: confirme antes de ir."],
        ["Se não quiser Sawgrass", "Vá direto para Kissimmee e faça supermercado perto do hotel. É a opção com mais descanso."]
      ] },

    { schedule: [
        ["06:30", "Acordar e preparar a mochila", "Tênis já amaciado, power bank carregado, documento, ingressos no app, protetor solar e capa de chuva leve."],
        ["07:00", "Café da manhã", "Coma antes de sair e leve lanches permitidos."],
        ["07:15", "Sair para o Walt Disney World", "Considere trânsito, estacionamento, tram e segurança; confira o horário oficial perto da data.", "Magic Kingdom Park Walt Disney World"],
        ["Abertura–12:00", "Atrações de alta demanda", "Priorize conforme interesse e filas: TRON, Seven Dwarfs Mine Train, Tiana’s Bayou Adventure, Space Mountain, Big Thunder Mountain, Jungle Cruise e Peter Pan’s Flight. A ordem depende de filas e disponibilidade."],
        ["12:00–13:00", "Almoço", "Faça pausa fora do pico se possível; hidrate-se."],
        ["13:00–17:00", "Atrações clássicas", "Pirates of the Caribbean, Haunted Mansion, Buzz Lightyear e o que ficou pendente."],
        ["17:00–18:00", "Main Street e castelo", "Reserve tempo para fotos, lojas e iluminação."],
        ["18:00", "Jantar", "Escolha algo com localização conveniente para não cruzar o parque."],
        ["Noite", "Shows, iluminação e últimas atrações", "Não trate horários como garantidos: confira o calendário e a programação oficial para 07/12."]
      ],
      alternatives: [
        ["Lightning Lane", "Compare preço, disponibilidade e atrações incluídas no app. A compra costuma abrir poucos dias antes (em 2024, três dias para quem não está em hotel Disney). Se comprar, escolha de acordo com as prioridades de vocês."],
        ["Chuva", "Use atrações internas e shows; proteja celular e power bank. Algumas atrações externas podem parar temporariamente."],
        ["Cansaço", "Corte atrações secundárias, faça uma pausa sentada e preserve o espetáculo noturno se for prioridade."],
        ["O que levar", "Garrafa reutilizável, snacks permitidos, poncho leve, protetor solar, power bank, cabo curto, curativos e uma muda leve de camiseta."]
      ] },

    { schedule: [
        ["07:30–08:00", "Café da manhã", "Saída cedo para aproveitar o complexo."],
        ["08:30", "Sair para o Kennedy Space Center", "Confirme o endereço de entrada, o estacionamento e o horário de funcionamento oficial.", "Kennedy Space Center Visitor Complex"],
        ["09:30–12:30", "Bus Tour e complexo Apollo/Saturn V", "Comece pelas experiências de maior interesse. O passeio de ônibus usa fila virtual (QR code no local) e leva cerca de três horas: confirme os horários no dia."],
        ["12:30–13:15", "Almoço", "Refeição dentro do complexo para evitar deslocamentos."],
        ["13:15–16:30", "Space Shuttle Atlantis, Gateway e exposições", "Ajuste a ordem conforme os horários e o interesse de vocês."],
        ["16:30", "Saída do KSC", "A viagem de volta pode variar com o trânsito."],
        ["18:00–21:00", "Disney Springs", "Lojas Disney, LEGO, decoração de Natal, passeio e fotos; não exige ingresso de parque.", "Disney Springs Lake Buena Vista"],
        ["21:00–22:00", "Jantar e retorno", "Se o KSC terminar tarde, faça só um passeio curto no Disney Springs."]
      ],
      alternatives: [
        ["Se preferirem menos estrada", "Troque o Kennedy Space Center por uma manhã de descanso, piscina e mercado, e tarde e noite no Disney Springs."],
        ["Se chover", "O KSC tem exposições internas, mas transporte e algumas experiências podem ser afetados. Confira a operação oficial."],
        ["Compras em Disney Springs", "Defina um limite para lembranças; os outlets dos dias 10 e 11 são melhores para roupas e tênis."]
      ] },

    { schedule: [
        ["06:30–07:00", "Acordar e café", "Confira ingresso, aplicativo, bateria, previsão e horário de abertura."],
        ["07:30", "Saída para a Universal Orlando", "Chegue com margem para estacionamento, segurança e caminhada até a entrada.", "Universal Studios Florida"],
        ["Abertura–12:30", "Prioridade: Harry Potter e atrações concorridas", "Diagon Alley, Harry Potter and the Escape from Gringotts, Revenge of the Mummy, Transformers, MEN IN BLACK, The Simpsons e Minion Mayhem, conforme filas e operação."],
        ["12:30–13:30", "Almoço", "Escolha um restaurante perto da área onde estiverem."],
        ["13:30–18:00", "Completar atrações e explorar as áreas", "Reserve tempo para Harry Potter, lojas, fotos e atrações que ficaram pendentes."],
        ["18:00–fechamento", "Últimas atrações", "Consulte o horário oficial do dia; não assuma fechamento às 20h."],
        ["Depois do parque", "Jantar e hotel", "Se estiverem exaustos, refeição rápida no caminho e descanso."]
      ],
      alternatives: [
        ["Hogwarts Express", "Exige ingresso Park-to-Park para alternar entre o Universal Studios Florida e Islands of Adventure. O plano-base é o Universal Studios Florida; se quiserem fazer os dois parques, o dia fica muito mais corrido."],
        ["Express Pass", "Compare o custo para a data e quais atrações aceita. Ele não garante acesso a todas as atrações."],
        ["Se as filas estiverem enormes", "Escolha de quatro a seis atrações prioritárias, use o app oficial para filas e horários e não atravesse o parque repetidamente."],
        ["O que levar", "Água, snacks permitidos, power bank, poncho, protetor solar e uma bolsa pequena; confira as regras de armários e itens proibidos."]
      ] },

    { schedule: [
        ["09:00", "Café da manhã", "Confira o ingresso separado da festa e o horário oficial do outlet."],
        ["10:00–15:00", "Orlando Vineland Premium Outlets", "Foco em roupas principais, marcas e calçados. Compare o preço final e os tamanhos.", "Orlando Vineland Premium Outlets"],
        ["15:00–16:00", "Voltar ao hotel e descansar", "Banho, lanche, trocar de roupa e carregar o celular."],
        ["A partir de 16:00", "Entrada antecipada para a festa", "Quem tem ingresso da festa pode entrar no Magic Kingdom a partir das 16h (confirme as regras oficiais para o dia).", "Magic Kingdom Park Walt Disney World"],
        ["16:00–19:00", "Castelo, decoração, fotos e lojas", "Coma algo antes do pico e escolha as prioridades da festa."],
        ["19:00–00:00", "Mickey’s Very Merry Christmas Party", "Foco em desfile, fogos, personagens, decoração, comidas natalinas e atrações selecionadas. A festa começa às 19h; confirme o horário de término e a programação."],
        ["00:00–00:45", "Saída e retorno ao hotel", "Planeje caminhada e transporte ou estacionamento com paciência."]
      ],
      alternatives: [
        ["Se não comprarem a festa", "Use o dia para Vineland, descanso e um passeio gratuito ou de baixo custo, ou Disney Springs. Não entre na festa sem o ingresso específico."],
        ["Se estiverem cansados", "Reduza o outlet para duas ou três horas e priorize a festa, que é a experiência exclusiva desta noite."],
        ["Compras do outlet", "Faça uma lista por pessoa, prove as peças e guarde os recibos; não comprometa o orçamento reservado para alimentação e para a volta."]
      ] },

    { schedule: [
        ["08:30–09:00", "Café da manhã", "Confira o espaço nas malas e os itens que faltam."],
        ["10:00–12:30", "International Premium Outlets", "Camisetas, polos, camisas, shorts, calças, jeans e moletons.", "Orlando International Premium Outlets"],
        ["12:30–13:30", "Almoço", "Pausa no próprio outlet ou nas proximidades."],
        ["13:30–16:00", "Tênis e calçados", "Compare Nike, Adidas, New Balance, Vans, Skechers e Timberland; confira numeração e política de troca."],
        ["16:00–17:00", "Acessórios e malas", "Cintos, carteira, boné, mochila, óculos e mala extra somente se necessário."],
        ["17:00–18:00", "Última passada", "Compre apenas o que faltou na lista."],
        ["18:30–20:00", "Hotel e organização", "Conferir todos os itens, separar recibos e distribuir o peso nas malas."],
        ["20:00", "Última noite", "Jantar, Disney Springs se houver energia, ou descanso."]
      ],
      alternatives: [
        ["Se já compraram tudo", "Cancele a última passada e use o tempo para descansar ou jantar com calma."],
        ["Se o orçamento apertar", "Priorize peças versáteis, básicos e itens que já estavam na lista. Evite comprar apenas porque está barato."],
        ["Checklist das compras", "Verifique tamanho, defeitos, recibo, política de troca, espaço na mala e limite de bagagem."]
      ] },

    { schedule: [
        ["Manhã", "Café e check-out", "Conferir passaportes, carteira, celulares, carregadores, compras e itens do cofre."],
        ["Até 13:30–14:00", "Saída de Kissimmee", "Para voo às 18h15, esta é uma referência conservadora para chegar ao MCO por volta das 15h; confirme a recomendação da companhia e as condições do trânsito."],
        ["Antes de devolver o carro", "Abastecer e registrar", "Confira a política de combustível, guarde o recibo e fotografe o carro na entrega.", "gas station near Orlando International Airport"],
        ["Por volta de 15:00", "Chegada planejada ao MCO", "Devolução do veículo, deslocamento ao terminal, despacho e segurança.", "Orlando International Airport"],
        ["18:15", "Voo de retorno", "Confirme terminal, companhia, bagagem e portão nos canais oficiais."]
      ],
      alternatives: [
        ["Se houver muito tempo sobrando", "Não planeje uma atração distante; prefira um café ou refeição perto da rota e mantenha margem para o aeroporto."],
        ["Se o trânsito estiver ruim", "Vá direto ao MCO e avise a locadora e a companhia se houver qualquer problema."],
        ["Antes de sair do hotel", "Passaportes, documentos, carteira, celulares, todos os eletrônicos, medicamentos de uso pessoal, recibos e malas."]
      ] }
  ];

  FT.RESERVAS = [
    { id: "voo-ida", icon: "plane", title: "Voo de ida", when: "04/12, chegada ao MIA às 06h30", hint: "Companhia, voo e código da reserva" },
    { id: "voo-volta", icon: "plane", title: "Voo de volta", when: "12/12, saída do MCO às 18h15", hint: "Companhia, voo e código da reserva" },
    { id: "hotel-1", icon: "bed", title: "Hotel em Lauderdale-by-the-Sea", when: "04 a 06/12", hint: "Nome, endereço e código da reserva" },
    { id: "hotel-2", icon: "bed", title: "Ramada em Kissimmee", when: "06 a 12/12", hint: "Endereço e código da reserva" },
    { id: "carro", icon: "car", title: "Carro alugado (Mustang)", when: "Retirada no MIA em 04/12, devolução no MCO em 12/12", hint: "Locadora e número da reserva" },
    { id: "ing-md", icon: "ticket", title: "Magic Kingdom", when: "07/12", hint: "Ingresso vinculado ao My Disney Experience?" },
    { id: "ing-ksc", icon: "ticket", title: "Kennedy Space Center", when: "08/12", hint: "Ingresso com data" },
    { id: "ing-uni", icon: "ticket", title: "Universal Orlando", when: "09/12", hint: "Ingresso (Park-to-Park?)" },
    { id: "ing-festa", icon: "ticket", title: "Festa de Natal no Magic Kingdom", when: "10/12, a partir das 19h", hint: "Ingresso da festa" },
    { id: "seguro", icon: "shield", title: "Seguro-viagem", when: "04 a 12/12", hint: "Seguradora, apólice e telefone 24 horas" }
  ];

  FT.RESERVA_STATUS = ["Pendente", "Confirmado", "Pago"];

  FT.COMIDA = [
    { name: "Denny’s", kind: "Café da manhã", q: "Denny’s", icon: "pancake", note: "Café da manhã americano, panquecas e refeições servidas à mesa. Boa chance de experimentar um diner." },
    { name: "Chick-fil-A", kind: "Almoço rápido", q: "Chick-fil-A", icon: "chicken", note: "Sanduíches de frango e batatas. A rede fecha aos domingos (06/12 é domingo); confirme a unidade." },
    { name: "Wendy’s", kind: "Econômico", q: "Wendy’s", icon: "burger", note: "Hambúrgueres e opções rápidas; útil para uma refeição prática perto do hotel." },
    { name: "Five Guys", kind: "Hamburgueria", q: "Five Guys", icon: "fries", note: "Hambúrgueres e batatas. Planeje como refeição especial: a conta pode subir." },
    { name: "Shake Shack", kind: "Hamburgueria", q: "Shake Shack", icon: "shake", note: "Boa opção para encaixar em um dia de compras, conforme a unidade escolhida." },
    { name: "Walmart ou mercado", kind: "Economia diária", q: "Walmart Supercenter", icon: "cart", note: "Frutas, iogurtes, pão, água e lanches para reduzir o gasto com café da manhã e parques." }
  ];

  FT.OUTLETS = [
    { name: "Sawgrass Mills", day: "06/12", q: "Sawgrass Mills Sunrise Florida", note: "Primeira rodada, no caminho para Orlando. Procure peças-chave e ofertas excepcionais." },
    { name: "Orlando Vineland Premium Outlets", day: "10/12", q: "Orlando Vineland Premium Outlets", note: "Manhã de compras antes da festa de Natal. Foco em roupas principais e calçados." },
    { name: "Orlando International Premium Outlets", day: "11/12", q: "Orlando International Premium Outlets", note: "Última passada. Compare com o Vineland antes de compras maiores." }
  ];

  FT.COMPRAS_PADRAO = ["Dois iPhones", "Roupas e camisetas", "Tênis", "Calças e shorts", "Jaqueta leve", "Acessórios", "Presentes"];

  FT.ESTRATEGIA_COMPRAS = [
    ["Primeiro dia: eletrônicos", "Confirme estoque, preço, imposto e trade-in na loja escolhida."],
    ["Dias de outlet", "Faça uma lista por prioridade e registre preços para comparar entre os outlets."],
    ["Último dia de compras", "Compre apenas o que falta e proteja a reserva do orçamento, inclusive o imposto na volta."]
  ];
})();
