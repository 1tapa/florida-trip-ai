/* Conteúdo extra: prioridades por parque e frases úteis em inglês.
 * Importante: nenhum texto aqui pode conter aspas duplas retas (use ‘ ’ ou “ ”).
 * Atrações abrem, fecham e mudam de nome: confirme sempre no app oficial do parque.
 */
(function () {
  const FT = (window.FT = window.FT || {});

  /* Cada atração: [id, nome, tipo, alta demanda (1/0), observação, distância aproximada da entrada (0 a 5), apelido para casar com a fila ao vivo (opcional)]. */
  FT.PARQUES = [
    {
      id: "mk", name: "Magic Kingdom", day: 7,
      note: "Atrações de alta demanda costumam ter as menores filas logo depois da abertura. Confira no app My Disney Experience.",
      rides: [
        ["mk-tron", "TRON Lightcycle / Run", "Emoção", 1, "Montanha-russa coberta; vá logo na abertura.", 2],
        ["mk-7d", "Seven Dwarfs Mine Train", "Emoção leve", 1, "Fila grande o dia todo; a manhã é o melhor horário.", 5, "seven dwarfs|sete anoes"],
        ["mk-tiana", "Tiana’s Bayou Adventure", "Aquática", 1, "Passeio de barco com descida final; pode molhar.", 3],
        ["mk-space", "Space Mountain", "Emoção", 1, "Montanha-russa no escuro.", 2],
        ["mk-btmr", "Big Thunder Mountain Railroad", "Emoção leve", 0, "Boa para o meio da tarde.", 3, "big thunder"],
        ["mk-jungle", "Jungle Cruise", "Clássico", 0, "Passeio de barco com guia.", 2],
        ["mk-peter", "Peter Pan’s Flight", "Clássico", 1, "Fila longa para um passeio curto.", 4],
        ["mk-pirates", "Pirates of the Caribbean", "Clássico", 0, "Passeio de barco coberto; costuma andar rápido.", 2],
        ["mk-haunted", "Haunted Mansion", "Clássico", 0, "Fila coberta e que anda bem.", 3],
        ["mk-buzz", "Buzz Lightyear’s Space Ranger Spin", "Família", 0, "Competição de tiro ao alvo.", 2],
        ["mk-philhar", "Mickey’s PhilharMagic", "Show 3D", 0, "Cinema 3D com ar-condicionado: bom para descansar.", 4],
        ["mk-small", "it’s a small world", "Clássico", 0, "Passeio tranquilo e coberto.", 4],
        ["mk-under", "Under the Sea: Journey of the Little Mermaid", "Família", 0, "Passeio curto, fila variável.", 5, "little mermaid"],
        ["mk-dumbo", "Dumbo the Flying Elephant", "Família", 0, "Fila costuma ser longa para a duração.", 4],
        ["mk-tiki", "Walt Disney’s Enchanted Tiki Room", "Show", 0, "Show curto e com ar-condicionado.", 2],
        ["mk-tea", "Mad Tea Party", "Giratória", 0, "Xícaras giratórias; evite logo após comer.", 4]
      ]
    },
    {
      id: "usf", name: "Universal Studios Florida", short: "Universal Studios", day: 9,
      note: "Dia de Park-to-Park: os dois parques no mesmo dia. O Hogwarts Express (King’s Cross) liga este parque ao Islands of Adventure e só funciona com o ingresso Park-to-Park. Confira restrições de altura e itens soltos no app oficial.",
      rides: [
        ["usf-gring", "Harry Potter and the Escape from Gringotts", "Emoção", 1, "Atração mais concorrida do parque; vá cedo.", 5],
        ["usf-express", "Hogwarts Express (King’s Cross)", "Passeio", 0, "Só com ingresso Park-to-Park; leva ao outro parque.", 5, "hogwarts express"],
        ["usf-mummy", "Revenge of the Mummy", "Emoção", 1, "Montanha-russa coberta.", 3],
        ["usf-rip", "Hollywood Rip Ride Rockit", "Emoção", 1, "Montanha-russa com subida vertical; guarde tudo no armário.", 1],
        ["usf-mib", "Men in Black Alien Attack", "Família", 0, "Competição de tiro ao alvo.", 4, "men in black"],
        ["usf-trans", "Transformers: The Ride 3-D", "Simulador", 1, "Mistura de cenário e telas 3D.", 2, "transformers"],
        ["usf-minion", "Despicable Me Minion Mayhem", "Simulador", 0, "Simulador leve e divertido.", 1],
        ["usf-jimmy", "Race Through New York Starring Jimmy Fallon", "Simulador", 0, "Corrida em simulador; boa para a tarde.", 2],
        ["usf-et", "E.T. Adventure", "Clássico", 0, "Passeio tranquilo e clássico.", 4],
        ["usf-simpsons", "The Simpsons Ride", "Simulador", 0, "Simulador com movimentos fortes.", 4],
        ["usf-ffs", "Fast & Furious: Supercharged", "Simulador", 0, "Passeio com telas e carros; costuma ter fila moderada.", 3, "fast furious|supercharged"]
      ]
    },
    {
      id: "ioa", name: "Universal Islands of Adventure", short: "Islands of Adventure", day: 9,
      note: "Segundo parque do dia Park-to-Park. Hagrid’s e VelociCoaster têm as maiores filas: vá a eles primeiro. O Hogwarts Express (Hogsmeade) leva ao Universal Studios Florida. Confira alturas e armários no app oficial.",
      rides: [
        ["ioa-velo", "Jurassic World VelociCoaster", "Emoção", 1, "Montanha-russa intensa e muito concorrida; guarde tudo no armário.", 5, "velocicoaster"],
        ["ioa-hagrid", "Hagrid’s Magical Creatures Motorbike Adventure", "Emoção", 1, "A atração mais disputada do parque; vá logo na abertura.", 5, "hagrid"],
        ["ioa-fj", "Harry Potter and the Forbidden Journey", "Simulador", 1, "Castelo de Hogwarts; fila longa, mas o percurso interno é um espetáculo.", 5, "forbidden journey"],
        ["ioa-hulk", "The Incredible Hulk Coaster", "Emoção", 1, "Largada rápida; guarde tudo no armário.", 3, "incredible hulk|hulk"],
        ["ioa-kong", "Skull Island: Reign of Kong", "Passeio", 1, "Veículo com telas e cenários grandes.", 2, "kong"],
        ["ioa-spidey", "The Amazing Adventures of Spider-Man", "Simulador", 0, "Clássico em 3D; fila costuma andar bem.", 3, "spider man|spiderman"],
        ["ioa-jp", "Jurassic Park River Adventure", "Aquática", 0, "Você sai molhado; veja o clima antes.", 2, "jurassic park river"],
        ["ioa-rapids", "Popeye & Bluto’s Bilge-Rat Barges", "Aquática", 0, "Rafting em que quase todos se molham; boa para a tarde quente.", 4, "popeye|bilge rat"],
        ["ioa-ripsaw", "Dudley Do-Right’s Ripsaw Falls", "Aquática", 0, "Descida com mergulho final; molha bastante.", 4, "ripsaw|dudley"],
        ["ioa-flight", "Flight of the Hippogriff", "Família", 0, "Montanha-russa curta e tranquila; boa para quem não curte emoção forte.", 5, "hippogriff"],
        ["ioa-express", "Hogwarts Express (Hogsmeade)", "Passeio", 0, "Só com ingresso Park-to-Park; leva ao Universal Studios Florida.", 5, "hogwarts express"]
      ]
    }
  ];
})();
