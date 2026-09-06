/**
 * Academia de Poker — lições e dicas ao vivo.
 */

export const LESSONS = [
    {
        id: 'objetivo',
        title: 'O que é Texas Hold\'em',
        kicker: 'Fundamento',
        text: 'Texas Hold\'em é o poker mais jogado no mundo. Cada jogador recebe 2 cartas fechadas (hole cards). Depois saem 5 cartas comunitárias no centro. Você monta a melhor mão de 5 cartas usando qualquer combinação das 7.',
        tip: 'Objetivo: ganhar fichas. Dá para vencer sem mostrar a mão — se todos desistirem (fold), o pot é seu.',
        quiz: {
            prompt: 'Quantas cartas comunitárias o board tem no total?',
            options: ['3', '5', '7'],
            answer: 1,
            success: 'Cinco: flop (3) + turn (1) + river (1).'
        }
    },
    {
        id: 'ranking',
        title: 'Ranking das mãos',
        kicker: 'Fundamento',
        text: 'Do mais forte ao mais fraco: Royal flush → Straight flush → Quadra → Full house → Flush → Sequência → Trinca → Dois pares → Par → Carta alta. Empate: comparam-se os kickers.',
        tip: 'Decore a ordem. Em dúvida no jogo, o mestre mostra a categoria da sua mão atual.',
        quiz: {
            prompt: 'O que vence: flush ou full house?',
            options: ['Flush', 'Full house', 'Empate'],
            answer: 1,
            success: 'Full house (trinca + par) está acima do flush no ranking.'
        }
    },
    {
        id: 'blinds',
        title: 'Blinds e o botão',
        kicker: 'Apostas',
        text: 'Antes de qualquer carta, dois jogadores pagam blinds (apostas obrigatórias): small blind e big blind. O botão marca o dealer. Em heads-up (1×1), o botão paga o small blind e age primeiro pré-flop.',
        tip: 'Blinds forçam ação — sem eles, todos poderiam esperar a mão perfeita para sempre.',
        quiz: {
            prompt: 'No heads-up, quem paga o small blind?',
            options: ['O big blind', 'O botão (dealer)', 'Sempre o herói'],
            answer: 1,
            success: 'No HU o botão é SB e age primeiro pré-flop; pós-flop o BB age primeiro.'
        }
    },
    {
        id: 'ruas',
        title: 'As quatro ruas',
        kicker: 'Apostas',
        text: 'Pré-flop: só as 2 hole cards. Flop: 3 cartas no board. Turn: a 4ª. River: a 5ª. Em cada rua há uma rodada de apostas — fold, check, bet, call ou raise.',
        tip: 'Check = passar a vez sem apostar (só se ninguém apostou ainda). Fold = desistir da mão e do pot.',
        quiz: {
            prompt: 'Quando você pode dar check?',
            options: [
                'Sempre',
                'Só se não há aposta para pagar',
                'Só no river'
            ],
            answer: 1,
            success: 'Check só existe quando não há aposta aberta. Se alguém apostou, você fold, call ou raise.'
        }
    },
    {
        id: 'pot-odds',
        title: 'Pot odds',
        kicker: 'Matemática',
        text: 'Pot odds = quanto você precisa pagar ÷ (pote + call). Ex.: pote 90, call 10 → 10/100 = 10%. Se sua chance de ganhar (equity) for maior que 10%, o call é +EV a longo prazo.',
        tip: 'Fórmula: equity > toCall / (pot + toCall). O mestre mostra isso quando você enfrentar uma aposta.',
        quiz: {
            prompt: 'Pote 80, call 20. Qual a pot odd?',
            options: ['20%', '25%', '50%'],
            answer: 0,
            success: '20 / (80+20) = 20%. Você precisa de ~20% de equity para um call zero.'
        }
    },
    {
        id: 'posicao',
        title: 'Posição',
        kicker: 'Estratégia',
        text: 'Agir por último é vantagem: você viu o que o rival fez. Em heads-up, pós-flop o botão age por último — posição favorável. Pré-flop o SB (botão) age primeiro.',
        tip: 'Com posição, dá para bluffar mais e controlar o tamanho do pot.',
        quiz: {
            prompt: 'Por que posição é boa?',
            options: [
                'Você paga menos blinds',
                'Você age depois de ver a ação do rival',
                'Suas cartas ficam melhores'
            ],
            answer: 1,
            success: 'Informação. Poker é um jogo de decisões sob incerteza — ver a ação rival reduz incerteza.'
        }
    },
    {
        id: 'preflop',
        title: 'Mãos iniciais',
        kicker: 'Estratégia',
        text: 'Pares altos (AA–TT), Ás com figura (AK, AQ) e conectores do mesmo naipe (JTs, 98s) são fortes. Mãos lixo (72o, 83o) quase sempre se descartam — sobretudo fora de posição.',
        tip: 'Iniciante: jogue apertado. Menos mãos, mas melhores. A disciplina vence o “eu senti”.',
        quiz: {
            prompt: 'Qual mão é a mais forte pré-flop?',
            options: ['AKo', '72o', 'AA'],
            answer: 2,
            success: 'Par de ases é a melhor mão inicial. AKo é forte, mas ainda perde ~18% do tempo vs AA.'
        }
    },
    {
        id: 'cbet',
        title: 'Continuation bet',
        kicker: 'Estratégia',
        text: 'Se você foi o último a aumentar pré-flop, no flop costuma “continuar” com uma aposta (c-bet) — mesmo sem ter acertado o board. O rival folda mãos médias com frequência.',
        tip: 'Não c-bete sempre em boards perigosos (ex.: três do mesmo naipe). A IA também usa isso.',
        quiz: {
            prompt: 'C-bet significa…',
            options: [
                'Apostar no flop após ter raisado pré-flop',
                'Ir all-in no river',
                'Desistir no turn'
            ],
            answer: 0,
            success: 'Continuation bet: você representa força mantendo a iniciativa da mão.'
        }
    },
    {
        id: 'showdown',
        title: 'Showdown',
        kicker: 'Fundamento',
        text: 'Se alguém chega ao river e a aposta é paga (ou todos dão check), as cartas abrem. A melhor mão de cinco cartas leva o pot. Empate divide o pot.',
        tip: 'Você não é obrigado a chegar ao showdown. Foldar uma mão segunda é habilidade — não covardia.',
        quiz: {
            prompt: 'No showdown, quantas cartas entram na melhor mão?',
            options: [
                'Sempre as 2 hole + 3 do board',
                'Qualquer 5 entre as 7 disponíveis',
                'Só as 5 do board'
            ],
            answer: 1,
            success: 'Qualquer combinação de 5 entre hole (2) + board (5). Dá para usar 0, 1 ou 2 hole cards.'
        }
    },
    {
        id: 'bankroll',
        title: 'Gestão de fichas',
        kicker: 'Mentalidade',
        text: 'Não vá all-in por tédio. Preserve stack para mãos fortes. Em stacks curtos (<10 BB) all-in com mão decente é correto — all-in com 72o é doação.',
        tip: 'Varie: às vezes check com mão forte (slow play), às vezes bluff. Previsibilidade é explorável.',
        quiz: {
            prompt: 'Com stack de 8 big blinds e AK, o quê costuma ser correto?',
            options: [
                'Fold',
                'Empurrar all-in / jogar por stack',
                'Só limpar (call) sempre'
            ],
            answer: 1,
            success: 'Stack curto: commit com mãos fortes. Não há room para jogar “pequeno”.'
        }
    }
];

export const HAND_RANK_CHART = [
    { name: 'Royal flush', example: 'A♠ K♠ Q♠ J♠ T♠', cat: 9 },
    { name: 'Straight flush', example: '9♥ 8♥ 7♥ 6♥ 5♥', cat: 8 },
    { name: 'Quadra', example: 'K♦ K♣ K♥ K♠ 2♣', cat: 7 },
    { name: 'Full house', example: 'Q♠ Q♥ Q♦ 7♣ 7♥', cat: 6 },
    { name: 'Flush', example: 'A♦ J♦ 8♦ 4♦ 2♦', cat: 5 },
    { name: 'Sequência', example: 'T♣ 9♦ 8♠ 7♥ 6♣', cat: 4 },
    { name: 'Trinca', example: '8♠ 8♥ 8♦ K♣ 3♥', cat: 3 },
    { name: 'Dois pares', example: 'A♠ A♦ 5♣ 5♥ 9♦', cat: 2 },
    { name: 'Par', example: 'J♣ J♥ A♠ 8♦ 3♣', cat: 1 },
    { name: 'Carta alta', example: 'A♠ K♦ 9♣ 5♥ 2♠', cat: 0 }
];

/**
 * Dica contextual durante a partida.
 */
export function liveTip(match, legal) {
    const h = match.hand;
    if (!h) return { title: 'Mesa', text: 'Inicie uma mão para receber dicas ao vivo.' };

    const hero = match.heroSeat;
    const toCall = Math.max(0, h.currentBet - h.streetContrib[hero]);
    const streetLabel = {
        preflop: 'Pré-flop',
        flop: 'Flop',
        turn: 'Turn',
        river: 'River',
        showdown: 'Showdown',
        done: 'Fim da mão'
    }[h.street] || h.street;

    if (h.street === 'done') {
        const r = match.lastResult;
        if (!r) return { title: 'Mão encerrada', text: 'Prepare a próxima.' };
        if (r.reason === 'fold') {
            return {
                title: 'Pot sem showdown',
                text: 'Alguém foldou. Nem sempre a melhor mão vence — pressão e posição importam.'
            };
        }
        const mine = r.hands?.[hero];
        return {
            title: 'Showdown',
            text: mine
                ? `Sua mão: ${mine.name}. Compare kickers quando a categoria empatar.`
                : 'Cartas abertas — a melhor combinação de cinco leva o pot.'
        };
    }

    if (h.toAct !== hero) {
        return {
            title: `${streetLabel} · aguardando`,
            text: 'A IA está pensando. Observe o tamanho da aposta em relação ao pote — isso revela força ou blefe.'
        };
    }

    if (h.street === 'preflop') {
        return {
            title: 'Pré-flop',
            text: toCall > 0
                ? `Há ${toCall} para pagar. Pares altos e Ás-figura costumam call/raise; mãos lixo foldam.`
                : 'Sem aposta extra. Com mão forte, considere raise para construir o pot e tomar a iniciativa.'
        };
    }

    if (toCall > 0) {
        const odds = toCall / (h.pot + toCall);
        const pct = Math.round(odds * 100);
        return {
            title: `Pot odds ~${pct}%`,
            text: `Call ${toCall} num pote de ${h.pot}. Você precisa de cerca de ${pct}% de chance de ganhar para o call ser equilibrado.`,
            potOdds: odds
        };
    }

    const hasBet = legal?.some((a) => a.type === 'bet');
    return {
        title: streetLabel,
        text: hasBet
            ? 'Ninguém apostou. Check controla o pot; bet extrai valor ou faz foldar mãos melhores.'
            : 'Escolha sua ação. Lembre: fold também é uma jogada vencedora a longo prazo.'
    };
}

export function lessonById(id) {
    return LESSONS.find((l) => l.id === id) || LESSONS[0];
}
