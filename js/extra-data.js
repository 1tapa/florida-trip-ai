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
      id: "usf", name: "Universal Studios Florida", day: 9,
      note: "O Hogwarts Express exige ingresso Park-to-Park. Algumas atrações têm restrição de altura e itens soltos: confira no app oficial.",
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
        ["usf-simpsons", "The Simpsons Ride", "Simulador", 0, "Simulador com movimentos fortes.", 4]
      ]
    }
  ];

  /* Frases: [português, inglês] */
  FT.FRASES = [
    { id: "aero", name: "Aeroporto e imigração", list: [
      ["Vim a passeio por nove dias.", "I’m here on vacation for nine days."],
      ["Vou ficar em hotéis em Fort Lauderdale e Kissimmee.", "I’ll be staying at hotels in Fort Lauderdale and Kissimmee."],
      ["Estou viajando com a minha namorada.", "I’m traveling with my girlfriend."],
      ["Esta é a minha passagem de volta.", "This is my return ticket."],
      ["Onde fica a retirada de bagagem?", "Where is the baggage claim?"],
      ["Minha mala não chegou.", "My bag didn’t arrive."],
      ["Onde fica o balcão da locadora de carros?", "Where is the rental car counter?"]
    ] },
    { id: "carro", name: "Carro e estrada", list: [
      ["Tenho reserva em nome de…", "I have a reservation under the name…"],
      ["O carro já tem algum arranhão? Posso registrar?", "Does the car have any damage already? Can I document it?"],
      ["Como funciona o pedágio eletrônico neste carro?", "How does the electronic toll work with this car?"],
      ["Onde devo devolver o carro e abastecer antes?", "Where do I return the car, and where should I refill before?"],
      ["Onde fica o posto de gasolina mais próximo?", "Where is the nearest gas station?"],
      ["Preciso de ajuda: o carro não liga.", "I need help: the car won’t start."]
    ] },
    { id: "hotel", name: "Hotel", list: [
      ["Tenho reserva para duas pessoas.", "I have a reservation for two people."],
      ["Posso fazer check-in mais cedo ou deixar as malas?", "Can I check in early, or leave my bags?"],
      ["Qual é a senha do Wi-Fi?", "What’s the Wi-Fi password?"],
      ["O ar-condicionado não está funcionando.", "The air conditioning isn’t working."],
      ["Preciso de mais toalhas, por favor.", "I need more towels, please."],
      ["Podemos fazer o check-out mais tarde?", "Can we have a late check-out?"],
      ["Vocês têm cofre no quarto?", "Is there a safe in the room?"]
    ] },
    { id: "comer", name: "Restaurantes", list: [
      ["Uma mesa para dois, por favor.", "A table for two, please."],
      ["Posso ver o cardápio?", "Can I see the menu?"],
      ["Eu quero este, por favor.", "I’ll have this one, please."],
      ["Sem gelo, por favor.", "No ice, please."],
      ["Pode trazer a conta, por favor?", "Could we have the check, please?"],
      ["Essa gorjeta já está incluída?", "Is the tip already included?"],
      ["Eu tenho alergia a… Isso contém…?", "I’m allergic to… Does this contain…?"],
      ["Pode embalar para viagem?", "Can I get this to go?"]
    ] },
    { id: "compras", name: "Compras", list: [
      ["Quanto custa este?", "How much is this?"],
      ["Tem outro tamanho ou outra cor?", "Do you have another size or color?"],
      ["Onde ficam os provadores?", "Where are the fitting rooms?"],
      ["O preço já inclui o imposto?", "Does the price include tax?"],
      ["Posso pagar com cartão brasileiro?", "Can I pay with a Brazilian card?"],
      ["Em dólar, por favor.", "In US dollars, please."],
      ["Posso devolver ou trocar se não servir?", "Can I return or exchange it if it doesn’t fit?"],
      ["Pode guardar a nota fiscal na sacola?", "Could you put the receipt in the bag?"]
    ] },
    { id: "apple", name: "Loja da Apple", list: [
      ["Eu quero comprar dois iPhones.", "I’d like to buy two iPhones."],
      ["Vocês têm este modelo em estoque?", "Do you have this model in stock?"],
      ["Este aparelho é desbloqueado e aceita chip e eSIM do Brasil?", "Is this phone unlocked, and does it work with a Brazilian SIM and eSIM?"],
      ["Vocês aceitam o meu aparelho antigo na troca?", "Do you accept my old phone as a trade-in?"],
      ["Pode me ajudar a transferir os dados?", "Can you help me transfer my data?"],
      ["Preciso da nota fiscal em meu nome.", "I need the receipt under my name."]
    ] },
    { id: "parques", name: "Parques", list: [
      ["Onde fica a entrada desta atração?", "Where is the entrance to this ride?"],
      ["Quanto tempo de fila?", "How long is the wait?"],
      ["Onde posso guardar as nossas coisas?", "Where can we store our belongings?"],
      ["Onde fica o banheiro mais próximo?", "Where is the nearest restroom?"],
      ["Perdemos o nosso ingresso no aplicativo.", "We lost our ticket in the app."],
      ["Onde fica o ponto de encontro do estacionamento?", "Where is the parking lot shuttle stop?"]
    ] },
    { id: "urgencia", name: "Ajuda e emergência", list: [
      ["Preciso de ajuda, por favor.", "I need help, please."],
      ["Chame uma ambulância.", "Call an ambulance."],
      ["Perdi o meu passaporte.", "I lost my passport."],
      ["Roubaram a minha carteira.", "My wallet was stolen."],
      ["Preciso de um médico.", "I need a doctor."],
      ["Onde fica o hospital mais próximo?", "Where is the nearest hospital?"],
      ["Tenho seguro-viagem. Aqui está a apólice.", "I have travel insurance. Here is the policy."]
    ] }
  ];
})();
