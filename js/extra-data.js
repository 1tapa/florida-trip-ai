/* Conteúdo extra: prioridades por parque e frases úteis em inglês.
 * Importante: nenhum texto aqui pode conter aspas duplas retas (use ‘ ’ ou “ ”).
 * Atrações abrem, fecham e mudam de nome: confirme sempre no app oficial do parque.
 */
(function () {
  const FT = (window.FT = window.FT || {});

  /* Cada atração: [id, nome em português, tipo, alta demanda (1/0), descrição, distância aproximada da entrada (0 a 5), apelidos para casar com a fila ao vivo (opcional), nome original em inglês]. Lugares para comer: [nome, Rápido ou Típico, área, descrição]. */
  FT.PARQUES = [
    {
      id: "mk", name: "Magic Kingdom", day: 7,
      note: "Atrações de alta demanda costumam ter as menores filas logo depois da abertura. Confira no app My Disney Experience.",
      rides: [
        ["mk-tron","TRON: Corrida de Lightcycle","Emoção",1,"Montanha-russa em moto de luz, com largada em alta velocidade e cenário futurista. Fila disputada: vá na abertura.",2,"","TRON Lightcycle / Run"],
        ["mk-7d","Trem da Mina dos Sete Anões","Emoção leve",1,"Montanha-russa leve em vagonetes que balançam pela mina da Branca de Neve. Boa para a família; fila grande o dia todo.",5,"seven dwarfs|sete anoes","Seven Dwarfs Mine Train"],
        ["mk-tiana","Aventura no Bayou da Tiana","Aquática",1,"Passeio de barco pelo pântano de A Princesa e o Sapo, com músicas e uma descida final. Pode molhar.",3,"","Tiana’s Bayou Adventure"],
        ["mk-space","Montanha Espacial","Emoção",1,"Montanha-russa no escuro, com curvas rápidas e efeito de viagem pelo espaço.",2,"","Space Mountain"],
        ["mk-btmr","Trem da Montanha do Trovão","Emoção leve",0,"Montanha-russa em tema de mineração no Velho Oeste, com curvas e descidas moderadas. Boa para a tarde.",3,"big thunder","Big Thunder Mountain Railroad"],
        ["mk-jungle","Cruzeiro na Selva","Clássico",0,"Passeio de barco com guia piadista por rios de selva com animais mecânicos.",2,"","Jungle Cruise"],
        ["mk-peter","Voo do Peter Pan","Clássico",1,"Voo em galeões sobre Londres e a Terra do Nunca. Fila longa para um passeio curto.",4,"","Peter Pan’s Flight"],
        ["mk-pirates","Piratas do Caribe","Clássico",0,"Passeio de barco coberto por cenas de piratas, com cenários grandes. Costuma andar rápido.",2,"","Pirates of the Caribbean"],
        ["mk-haunted","Mansão Assombrada","Clássico",0,"Passeio por uma mansão cheia de fantasmas e humor sombrio, sem susto forte. A fila é coberta e anda bem.",3,"","Haunted Mansion"],
        ["mk-buzz","Buzz Lightyear: Patrulheiro Espacial","Família",0,"Passeio interativo em que você atira laser em alvos e soma pontos.",2,"","Buzz Lightyear’s Space Ranger Spin"],
        ["mk-philhar","PhilharMagic do Mickey","Show 3D",0,"Cinema 3D com personagens Disney e efeitos de vento e cheiro. Tem ar-condicionado: bom para descansar.",4,"","Mickey’s PhilharMagic"],
        ["mk-small","It’s a small world (Um Pequeno Mundo)","Clássico",0,"Passeio calmo de barco, com bonecos cantando pelo mundo. Coberto e refrescante.",4,"","it’s a small world"],
        ["mk-under","Sob o Mar: A Jornada da Pequena Sereia","Família",0,"Passeio em conchas pelo filme A Pequena Sereia, com as músicas famosas.",5,"little mermaid","Under the Sea: Journey of the Little Mermaid"],
        ["mk-dumbo","Dumbo, o Elefante Voador","Família",0,"Carrossel de elefantes que sobem e descem. É para crianças e a fila costuma ser longa.",4,"","Dumbo the Flying Elephant"],
        ["mk-tiki","Sala Tiki Encantada de Walt Disney","Show",0,"Show curto de pássaros e flores animatrônicos, com ar-condicionado.",2,"","Walt Disney’s Enchanted Tiki Room"],
        ["mk-tea","Xícaras Malucas (Mad Tea Party)","Giratória",0,"Xícaras giratórias que você controla. Evite logo depois de comer.",4,"","Mad Tea Party"]
      ],
      eat: [
        ["Pecos Bill Tall Tale Inn and Cafe","Rápido","Frontierland","Hambúrgueres, burritos e uma barra de acompanhamentos. Salão grande."],
        ["Cosmic Ray’s Starlight Café","Rápido","Tomorrowland","Hambúrguer, frango e saladas, com vários balcões. Anda rápido e tem ar-condicionado."],
        ["Columbia Harbour House","Rápido","Liberty Square","Peixe com batata, sanduíche de frango e sopas. O salão do andar de cima costuma ter menos gente."],
        ["Casey’s Corner","Rápido","Main Street","Cachorro-quente e batata frita, perto da entrada."],
        ["Aloha Isle","Típico","Adventureland","Dole Whip, o sorvete de abacaxi clássico do parque."],
        ["Gaston’s Tavern","Típico","Fantasyland","Rolinho de canela gigante e o LeFou’s Brew, suco de maçã com espuma."],
        ["Sleepy Hollow Refreshments","Típico","Liberty Square","Waffles e funnel cake para um lanche doce."],
        ["Carrinhos de pretzel e sorvete do Mickey","Típico","Pelo parque","Pretzel e sorvete com formato do Mickey, para tirar foto."]
      ]
    },
    {
      id: "usf", name: "Universal Studios Florida", short: "Universal Studios", day: 9,
      note: "Dia de Park-to-Park: os dois parques no mesmo dia. O Hogwarts Express (King’s Cross) liga este parque ao Islands of Adventure e só funciona com o ingresso Park-to-Park. Confira restrições de altura e itens soltos no app oficial.",
      rides: [
        ["usf-gring","Fuga de Gringotts","Emoção",1,"Montanha-russa coberta no banco dos bruxos de Harry Potter, com telas 3D, fogo e dragão. A mais disputada do parque: vá cedo.",5,"","Harry Potter and the Escape from Gringotts"],
        ["usf-express","Expresso de Hogwarts (King’s Cross)","Passeio",0,"Trem com cenas de Harry Potter nas janelas que liga ao Islands of Adventure. Só com ingresso Park-to-Park.",5,"hogwarts express","Hogwarts Express (King’s Cross)"],
        ["usf-mummy","A Vingança da Múmia","Emoção",1,"Montanha-russa coberta no escuro, com lançamento e efeitos de fogo.",3,"","Revenge of the Mummy"],
        ["usf-rip","Rip Ride Rockit (montanha-russa de Hollywood)","Emoção",1,"Montanha-russa com subida vertical e música escolhida por você. Guarde tudo no armário.",1,"","Hollywood Rip Ride Rockit"],
        ["usf-mib","MEN IN BLACK: Ataque Alienígena","Família",0,"Passeio em que você atira em alienígenas e compete por pontos.",4,"men in black","Men in Black Alien Attack"],
        ["usf-trans","Transformers: O Passeio 3D","Simulador",1,"Simulador com telas 3D e cenários reais, no meio da batalha dos robôs.",2,"transformers","Transformers: The Ride 3-D"],
        ["usf-minion","Meu Malvado Favorito: Minion Mayhem","Simulador",0,"Simulador leve e divertido em que você vira um minion.",1,"","Despicable Me Minion Mayhem"],
        ["usf-jimmy","Corrida por Nova York com Jimmy Fallon","Simulador",0,"Simulador de corrida com cenas bobas do apresentador. Boa para a tarde.",2,"","Race Through New York Starring Jimmy Fallon"],
        ["usf-et","Aventura do E.T.","Clássico",0,"Passeio clássico em bicicleta voadora até o planeta do E.T.",4,"","E.T. Adventure"],
        ["usf-simpsons","Os Simpsons: O Passeio","Simulador",0,"Simulador com movimentos fortes, dentro de um parque de diversões dos Simpsons.",4,"","The Simpsons Ride"],
        ["usf-ffs","Velozes e Furiosos: Supercharged","Simulador",0,"Passeio com telas e carros em perseguições em alta velocidade.",3,"fast furious|supercharged","Fast & Furious: Supercharged"]
      ],
      eat: [
        ["The Leaky Cauldron","Rápido","Diagon Alley","Comida britânica, como fish and chips e torta do pastor, no ambiente do filme."],
        ["Fast Food Boulevard","Rápido","Springfield","Vários balcões juntos (hambúrguer, frango, rosquinhas), bom quando cada um quer uma coisa."],
        ["Louie’s Italian Restaurant","Rápido","New York","Pizza e massas em balcão."],
        ["Mel’s Drive-In","Rápido","Hollywood","Hambúrguer e batata frita em estilo anos 50."],
        ["Bumblebee Man’s Taco Truck","Rápido","Springfield","Tacos rápidos para um almoço leve."],
        ["The Leaky Cauldron e carrinho Fountain of Fair Fortune","Típico","Diagon Alley","Cerveja amanteigada (Butterbeer), gelada ou comum, a bebida típica de Harry Potter."],
        ["Florean Fortescue’s Ice-Cream Parlour","Típico","Diagon Alley","Sorvetes com sabores diferentes, como manteiga de amendoim."],
        ["Moe’s Tavern","Típico","Springfield","Duff Beer, a cerveja dos Simpsons, e drinks temáticos."],
        ["Lard Lad Donuts","Típico","Springfield","Rosquinha rosa gigante, ótima para foto."]
      ]
    },
    {
      id: "ioa", name: "Universal Islands of Adventure", short: "Islands of Adventure", day: 9,
      note: "Segundo parque do dia Park-to-Park. Hagrid’s e VelociCoaster têm as maiores filas: vá a eles primeiro. O Hogwarts Express (Hogsmeade) leva ao Universal Studios Florida. Confira alturas e armários no app oficial.",
      rides: [
        ["ioa-velo","VelociCoaster","Emoção",1,"Montanha-russa de velocidade, com inversões e passagem perto de raptors. Intensa; guarde tudo no armário.",5,"velocicoaster","Jurassic World VelociCoaster"],
        ["ioa-hagrid","Aventura de Moto do Hagrid: Criaturas Mágicas","Emoção",1,"Montanha-russa de moto com lançamentos e cenários da Floresta Proibida. A fila mais disputada: vá na abertura.",5,"hagrid","Hagrid’s Magical Creatures Motorbike Adventure"],
        ["ioa-fj","Harry Potter e a Viagem Proibida","Simulador",1,"Simulador pelo castelo de Hogwarts, com voo, dragão e aranhas. A fila interna já é um espetáculo.",5,"forbidden journey","Harry Potter and the Forbidden Journey"],
        ["ioa-hulk","Montanha-russa Incrível Hulk","Emoção",1,"Largada em lançamento e várias inversões. Guarde tudo no armário.",3,"incredible hulk|hulk","The Incredible Hulk Coaster"],
        ["ioa-kong","Ilha da Caveira: O Reinado de Kong","Passeio",1,"Veículo grande com telas 3D e um King Kong gigante, em tamanho real.",2,"kong","Skull Island: Reign of Kong"],
        ["ioa-spidey","As Aventuras Incríveis do Homem-Aranha","Simulador",0,"Passeio 3D pela cidade com os vilões da Marvel. Clássico, com fila que anda bem.",3,"spider man|spiderman","The Amazing Adventures of Spider-Man"],
        ["ioa-jp","Aventura no Rio de Jurassic Park","Aquática",0,"Passeio de barco entre dinossauros, com descida final que molha. Veja o clima antes.",2,"jurassic park river","Jurassic Park River Adventure"],
        ["ioa-rapids","Popeye e Bluto: Barcas do Rio","Aquática",0,"Rafting em corredeiras em que quase todos se molham. Boa para a tarde quente.",4,"popeye|bilge rat","Popeye & Bluto’s Bilge-Rat Barges"],
        ["ioa-ripsaw","Cataratas do Dudley Do-Right","Aquática",0,"Descida em tronco com mergulho final. Molha bastante.",4,"ripsaw|dudley","Dudley Do-Right’s Ripsaw Falls"],
        ["ioa-flight","Voo do Hipogrifo","Família",0,"Montanha-russa curta e leve em Hogsmeade. Boa para quem não curte emoção forte.",5,"hippogriff","Flight of the Hippogriff"],
        ["ioa-express","Expresso de Hogwarts (Hogsmeade)","Passeio",0,"Trem com cenas de Harry Potter nas janelas que leva ao Universal Studios. Só com ingresso Park-to-Park.",5,"hogwarts express","Hogwarts Express (Hogsmeade)"]
      ],
      eat: [
        ["Three Broomsticks","Rápido","Hogsmeade","Frango assado, costelas e fish and chips, em balcão grande e com ambiente de Harry Potter."],
        ["Cafe 4","Rápido","Marvel Super Hero Island","Pizza, frango empanado e saladas."],
        ["Thunder Falls Terrace","Rápido","Jurassic Park","Frango, costela e salada, perto das atrações aquáticas."],
        ["Blondie’s","Rápido","Toon Lagoon","Sanduíches gigantes no estilo do Dagwood."],
        ["Comic Strip Café","Rápido","Toon Lagoon","Vários balcões (pizza, hambúrguer e comida asiática)."],
        ["Carrinhos de Butterbeer e Hog’s Head","Típico","Hogsmeade","Cerveja amanteigada gelada, congelada ou quente. Os carrinhos costumam ter fila menor que a do restaurante."],
        ["Carrinhos de suco de abóbora","Típico","Hogsmeade","Pumpkin Juice, a bebida doce dos filmes."],
        ["Honeydukes","Típico","Hogsmeade","Doces de Harry Potter, como sapos de chocolate e feijõezinhos de todos os sabores."]
      ]
    }
  ];
})();
