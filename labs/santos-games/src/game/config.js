// game/config.js — a "regra do jogo": catálogo de eventos, patrocinadores e rivais.
//
// SANTOS GAMES é uma homenagem direta a California Games (Mega Drive): você escolhe um
// patrocinador, disputa uma sequência de provas de praia curtas e independentes, cada uma com
// sua própria mecânica, e no fim sobe (ou não) ao pódio. Aqui a Califórnia vira a orla de
// Santos e cada prova do original ganha um equivalente caiçara.
//
// Tudo que é "conteúdo" (nomes, locais, textos, thresholds de medalha, cores) mora aqui, para
// que os módulos de gameplay cuidem só de mecânica.

/** Ordem canônica do campeonato — também a ordem exibida no menu de evento único. */
export const EVENT_ORDER = ['surf', 'skate', 'altinha', 'bmx', 'frescobol', 'canoa'];

/**
 * Catálogo de eventos.
 * - `par`: pontuação de referência (o "bom resultado"). Medalhas saem de frações dela.
 * - `judged`: provas com nota de jurados (surf/skate), como no original.
 * - `hint`: linha de controle exibida no briefing e na pausa.
 */
export const EVENTS = {
    surf: {
        id: 'surf',
        name: 'SURFE',
        place: 'QUEBRA-MAR',
        icon: 'wave',
        tint: 'c',
        judged: true,
        par: 620,
        song: 'mar',
        tagline: 'Pegue a série, fique no bolso da onda e assine na parede.',
        brief: [
            'A ondulação entra pelo canto do Quebra-Mar.',
            'Suba e desça a parede para ganhar velocidade,',
            'e assine manobras antes da onda fechar.'
        ],
        hint: 'CIMA/BAIXO SOBE A PAREDE · Z MANOBRA · X TUBO',
        judgeNote: 'Jurados avaliam manobras, tubo e tempo na parede.'
    },
    skate: {
        id: 'skate',
        name: 'SKATE VERT',
        place: 'BOWL DA ORLA',
        icon: 'skate',
        tint: 'x',
        judged: true,
        par: 560,
        song: 'bowl',
        tagline: 'Bombeie o bowl, estoure o coping e caia de pé.',
        brief: [
            'Bowl de concreto embaixo dos prédios tortos.',
            'Bombeie no fundo para ganhar altura e solte',
            'a manobra no ar — mas alinhe a aterrissagem.'
        ],
        hint: 'ESQ/DIR BOMBEIA · Z SOLTA O AR · DIR+Z GIRA · X GRAB',
        judgeNote: 'Jurados avaliam altura, variedade e aterrissagem.'
    },
    altinha: {
        id: 'altinha',
        name: 'ALTINHA',
        place: 'AREIA DO GONZAGA',
        icon: 'ball',
        tint: 'l',
        judged: false,
        par: 480,
        song: 'areia',
        tagline: 'A bola não pode cair. Simples assim.',
        brief: [
            'Roda de altinha na areia fofa do Gonzaga.',
            'Fique embaixo da bola e toque no tempo certo.',
            'Cada parte do corpo vale diferente — encadeie.'
        ],
        hint: 'ESQ/DIR ANDA · Z TOCA · CIMA+Z CABECEIA · BAIXO+Z PÉ',
        judgeNote: ''
    },
    bmx: {
        id: 'bmx',
        name: 'BMX',
        place: 'CICLOVIA DA ORLA',
        icon: 'bike',
        tint: 'A',
        judged: false,
        par: 700,
        song: 'orla',
        tagline: 'Sete quilômetros de jardim, um relógio contra você.',
        brief: [
            'Descida pela ciclovia mais famosa do país.',
            'Salte os obstáculos, use as rampas dos canteiros',
            'e solte manobra no ar sem perder o ritmo.'
        ],
        hint: 'DIR ACELERA · ESQ FREIA · Z SALTA · X MANOBRA NO AR',
        judgeNote: ''
    },
    frescobol: {
        id: 'frescobol',
        name: 'FRESCOBOL',
        place: 'JOSÉ MENINO',
        icon: 'racket',
        tint: '6',
        judged: false,
        par: 520,
        song: 'peteca',
        tagline: 'Sem ganhador, sem perdedor — só a bola no ar.',
        brief: [
            'Frescobol é jogo de cooperação: ninguém marca ponto,',
            'a graça é a troca não cair. Leia a sombra da bola,',
            'posicione-se e devolva no timing — o vento atrapalha.'
        ],
        hint: 'ESQ/DIR POSIÇÃO · Z REBATE · SEGURE Z PARA FORÇA',
        judgeNote: ''
    },
    canoa: {
        id: 'canoa',
        name: 'CANOA HAVAIANA',
        place: 'BAÍA DE SANTOS',
        icon: 'canoe',
        tint: 'b',
        judged: false,
        par: 640,
        song: 'baia',
        tagline: 'Remada no ritmo certo vale mais que remada com raiva.',
        brief: [
            'Largada na frente do Clube, boia de retorno lá longe.',
            'Alterne as remadas no ritmo (Z, X, Z, X) para',
            'manter a cadência e desvie do tráfego da baía.'
        ],
        hint: 'Z E X ALTERNADOS NO TEMPO · CIMA/BAIXO TROCA DE RAIA',
        judgeNote: ''
    }
};

/**
 * Patrocinadores — homenagem à tela de sponsor do California Games.
 * Cada um pinta o uniforme do atleta e dá um bônus modesto (+12%) na sua prova afim,
 * o que cria uma decisão real na hora de escolher sem desbalancear o campeonato.
 */
export const SPONSORS = [
    {
        id: 'caicara',
        name: 'CAIÇARA SURF CO.',
        motto: 'Prancha feita no fundo de quintal desde 1978.',
        boon: 'surf',
        kit: { shirt: 'c', trim: 'y' },
        logo: 'wave'
    },
    {
        id: 'canal3',
        name: 'CANAL 3 SKATE',
        motto: 'O concreto do canal ensinou todo mundo a cair.',
        boon: 'skate',
        kit: { shirt: 'x', trim: 'z' },
        logo: 'skate'
    },
    {
        id: 'pastel',
        name: 'PASTEL DO GONZAGA',
        motto: 'Massa fina, recheio honesto, caldo de cana gelado.',
        boon: 'altinha',
        kit: { shirt: '7', trim: 'B' },
        logo: 'ball'
    },
    {
        id: 'orlabikes',
        name: 'ORLA BIKES',
        motto: 'Aluguel por hora, câmbio sempre engasgando.',
        boon: 'bmx',
        kit: { shirt: 'k', trim: 'A' },
        logo: 'bike'
    },
    {
        id: 'mareAlta',
        name: 'SORVETES MARÉ ALTA',
        motto: 'Três bolas, casquinha, e a tarde não acaba mais.',
        boon: 'frescobol',
        kit: { shirt: 'G', trim: 'E' },
        logo: 'racket'
    },
    {
        id: 'clubexv',
        name: 'CLUBE XV DE REMO',
        motto: 'Rema junto ou não rema.',
        boon: 'canoa',
        kit: { shirt: 'C', trim: 'E' },
        logo: 'canoe'
    }
];

/** Bônus do patrocinador aplicado ao score bruto de um evento. */
export const SPONSOR_BOON = 0.12;

/**
 * Rivais do campeonato. Cada um tem um "perfil" (força relativa por evento, 0..1) e uma
 * variância — o que faz o pódio final mudar de run pra run sem virar sorteio puro.
 */
export const RIVALS = [
    { id: 'tiao', name: 'TIÃO PONTA', skill: { surf: 0.95, skate: 0.55, altinha: 0.70, bmx: 0.60, frescobol: 0.75, canoa: 0.80 }, spread: 0.16 },
    { id: 'nega', name: 'NEGA LÚ', skill: { surf: 0.62, skate: 0.92, altinha: 0.80, bmx: 0.86, frescobol: 0.58, canoa: 0.60 }, spread: 0.14 },
    { id: 'zeca', name: 'ZECA CANAL', skill: { surf: 0.70, skate: 0.74, altinha: 0.95, bmx: 0.66, frescobol: 0.88, canoa: 0.55 }, spread: 0.18 },
    { id: 'duda', name: 'DUDA MARÉ', skill: { surf: 0.78, skate: 0.66, altinha: 0.62, bmx: 0.74, frescobol: 0.70, canoa: 0.96 }, spread: 0.15 }
];

/** Nome do atleta do jogador no placar. */
export const PLAYER_NAME = 'VOCÊ';

/**
 * Faixas de medalha, como fração do `par` do evento.
 * Deliberadamente generosas no bronze e duras no ouro: o California Games premiava a
 * tentativa, mas guardava o ouro pra quem entendeu a mecânica.
 */
export const MEDAL_CUTS = { gold: 1.0, silver: 0.72, bronze: 0.45 };

export function medalFor(eventId, score) {
    const ev = EVENTS[eventId];
    if (!ev) return null;
    const ratio = score / ev.par;
    if (ratio >= MEDAL_CUTS.gold) return 'gold';
    if (ratio >= MEDAL_CUTS.silver) return 'silver';
    if (ratio >= MEDAL_CUTS.bronze) return 'bronze';
    return null;
}

export const MEDAL_LABEL = { gold: 'OURO', silver: 'PRATA', bronze: 'BRONZE' };
export const MEDAL_COLOR = { gold: '8', silver: 'q', bronze: '6' };

/** Pontos de campeonato por colocação na prova (estilo tabela de pontos). */
export const PLACE_POINTS = [10, 7, 5, 3, 1];
