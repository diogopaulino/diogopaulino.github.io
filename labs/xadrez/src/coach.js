/**
 * Academia — lições, puzzles e o texto do mestre.
 *
 * Cada lição carrega um FEN, explica a regra e (quando há tarefa) espera um
 * lance específico. Puzzles são posições táticas com um único lance-chave.
 */

export const LESSONS = [
    {
        id: 'tabuleiro',
        title: 'As 64 casas',
        kicker: 'Fundamento',
        fen: '8/8/8/8/4P3/8/8/8 w - - 0 1',
        text: 'O tabuleiro tem 8 colunas (a–h, da esquerda das brancas) e 8 fileiras (1–8). A casa h1, no canto direito das brancas, é clara. O peão em e4 já ocupa o centro — o coração de quase toda abertura.',
        tip: 'Toque o peão em e4 e depois a casa e5 para avançá-lo. O centro vale ouro.',
        expect: { from: 'e4', to: 'e5' },
        success: 'Isso. Quem controla o centro restringe as peças rivais e abre linhas para as próprias.'
    },
    {
        id: 'peao',
        title: 'O peão',
        kicker: 'Peças',
        fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
        text: 'O peão só anda para frente: uma casa, ou duas se ainda está na casa inicial. Ele captura na diagonal — nunca para frente. É a única peça que não recua.',
        tip: 'Avance o peão-rei duas casas: e2 → e4. Esse é o lance mais jogado da história.',
        expect: { from: 'e2', to: 'e4' },
        success: 'e4 abre caminhos para o bispo de rei e para a dama. A partida começou de verdade.'
    },
    {
        id: 'peao-captura',
        title: 'Captura do peão',
        kicker: 'Peças',
        fen: '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
        text: 'Peões capturam uma casa na diagonal à frente. Aqui o peão branco em e4 pode tomar o preto em d5. Depois da captura, ele ocupa d5.',
        tip: 'Toque o peão branco e a casa d5. A captura se escreve exd5.',
        expect: { from: 'e4', to: 'd5' },
        success: 'exd5. Note: o peão mudou de coluna. Cadeias de peões nascem dessas trocas.'
    },
    {
        id: 'en-passant',
        title: 'En passant',
        kicker: 'Especiais',
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        text: 'Se um peão inimigo avança duas casas e para ao lado do seu, você pode capturá-lo “de passagem”, como se ele tivesse andado só uma. Só vale no lance imediatamente seguinte.',
        tip: 'O peão em e5 captura en passant em d6, e o peão preto em d5 some.',
        expect: { from: 'e5', to: 'd6' },
        success: 'En passant. A casa de chegada é d6 — atrás de onde o peão preto “passou”.'
    },
    {
        id: 'cavalo',
        title: 'O cavalo',
        kicker: 'Peças',
        fen: '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1',
        text: 'O cavalo salta em L: duas casas em linha e uma perpendicular. É a única peça que atravessa as outras. No desenvolvimento clássico ele vai a c3 ou f3.',
        tip: 'Salte o cavalo de b1 para c3, controlando d5 e e4.',
        expect: { from: 'b1', to: 'c3' },
        success: 'Nc3. Dois cavalos no centro (c3 e f3) são o esqueleto de quase toda abertura aberta.'
    },
    {
        id: 'bispo',
        title: 'O bispo',
        kicker: 'Peças',
        fen: '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
        text: 'O bispo corre nas diagonais e nunca muda de cor de casa. Cada lado tem um bispo claro e um escuro. Diagonais longas atravessam o tabuleiro inteiro.',
        tip: 'Leve o bispo de c1 a a3, na diagonal que aponta para o rei preto.',
        expect: { from: 'c1', to: 'a3' },
        success: 'Ba3. O bispo continua nas casas escuras para sempre — por isso o par de bispos é tão forte.'
    },
    {
        id: 'bispo-centro',
        title: 'Bispo italiano',
        kicker: 'Peças',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        text: 'Na Abertura Italiana o bispo vai a c4, olhando f7 — o ponto mais fraco do preto no começo, defendido só pelo rei.',
        tip: 'Jogue Bc4. O bispo de rei sai, o roque fica mais perto.',
        expect: { from: 'f1', to: 'c4' },
        success: 'Bc4. Nas próximas lições você vai ver por que f7 é tão cobiçado.'
    },
    {
        id: 'torre',
        title: 'A torre',
        kicker: 'Peças',
        fen: '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1',
        text: 'A torre anda em colunas e fileiras. Vale 5 peões. Ela brilha em colunas abertas e na sétima fileira, comendo peões pela base. No início fica presa até o roque.',
        tip: 'Suba a torre pela coluna a até a5.',
        expect: { from: 'a1', to: 'a5' },
        success: 'Ta5. Uma torre na quinta já corta o rei. Duas torres na sétima quase sempre vencem.'
    },
    {
        id: 'dama',
        title: 'A dama',
        kicker: 'Peças',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
        text: 'A dama une torre e bispo — a peça mais poderosa (9 peões). Sair cedo demais é perigoso: o rival desenvolve ganhando tempos atacando-a. Ainda assim, Qf3–Qh5 é o Mate do Pastor.',
        tip: 'Mate do Pastor: jogue Qxf7#. A dama, protegida pelo bispo em c4, captura em f7.',
        expect: { from: 'f3', to: 'f7' },
        success: 'Qxf7#. O rei não pode tomar (o bispo defende f7) nem fugir. Mate em quatro lances — raro entre iguais, mortal contra iniciantes.'
    },
    {
        id: 'rei',
        title: 'O rei',
        kicker: 'Peças',
        fen: '8/8/8/3k4/8/4K3/8/8 w - - 0 1',
        text: 'O rei anda uma casa em qualquer direção. No meio-jogo ele se esconde; no final ele ataca. Dois reis nunca se encostam: a casa ao lado do outro está sempre em xeque.',
        tip: 'Ocupar a oposição: jogue Rd3, ficando de frente ao rei preto com uma casa no meio.',
        expect: { from: 'e3', to: 'd3' },
        success: 'Os reis estão em oposição vertical. Quem tem a vez costuma ser forçado a ceder terreno.'
    },
    {
        id: 'roque',
        title: 'O roque',
        kicker: 'Especiais',
        fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        text: 'O roque, único lance com duas peças, mete o rei na ala e a torre no centro. Condições: rei e torre imóvel, casas vazias no caminho, rei não em xeque e não atravessa casa atacada. Roque pequeno (O-O) vai à ala do rei; o grande (O-O-O), à da dama.',
        tip: 'Roque pequeno: toque o rei e a casa g1 (ou a torre de h1, se preferir pensar no par).',
        expect: { from: 'e1', to: 'g1' },
        success: 'O-O. O rei está em g1, a torre em f1. Segurança e desenvolvimento num só lance.'
    },
    {
        id: 'xeque',
        title: 'Sair do xeque',
        kicker: 'Regras',
        fen: '4k3/8/8/8/8/4q3/8/4K3 w - - 0 1',
        text: 'Xeque é um ataque ao rei. Há três respostas: capturar a peça que ataca, bloquear a linha, ou fugir com o rei. Não vale “ignorar”.',
        tip: 'A dama em e3 dá xeque pela coluna. O rei foge para f1 — fora da coluna e da diagonal da dama.',
        expect: { from: 'e1', to: 'f1' },
        success: 'O rei saiu da coluna e. Bloquear só funciona contra peças que deslizam; contra um cavalo, só capturar ou fugir.'
    },
    {
        id: 'mate-corredor',
        title: 'Mate do corredor',
        kicker: 'Tática',
        fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        text: 'Quando a última fileira do rival está sem fuga (os peões “engaiolam” o rei), uma torre ou dama na oitava dá mate. Chama-se mate do corredor.',
        tip: 'Te8#. A torre invade a oitava e o rei preto não tem casa nem bloqueio.',
        expect: { from: 'e1', to: 'e8' },
        success: 'Te8#. Deixe sempre uma “janelinha” (h3/a3) para o rei escapar desse mate.'
    },
    {
        id: 'abertura',
        title: 'Primeira abertura',
        kicker: 'Estratégia',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        text: 'Três ideias no começo: ocupar o centro (e4/d4), desenvolver cavalos e bispos, e fazer o roque. Não saia com a dama cedo, não mova o mesmo peão duas vezes, não deixe o rei no centro.',
        tip: 'Jogue e4. Depois, nas partidas livres, siga com Cf3 e Bc4 — o começo italiano.',
        expect: { from: 'e2', to: 'e4' },
        success: 'e4. Você já sabe mover cada peça e o porquê do centro. Agora jogue de verdade — o mestre comenta cada lance.'
    }
];

export const PUZZLES = [
    {
        id: 'pastor',
        title: 'Mate do Pastor',
        level: 'iniciante',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
        text: 'O bispo em c4 e a dama em f3 miram f7. Um lance e a partida acaba.',
        expect: { from: 'f3', to: 'f7' },
        success: 'Qxf7#. Mate clássico de iniciante — agora você também sabe defendê-lo (não jogue e5 e f6 fracos).'
    },
    {
        id: 'corredor',
        title: 'Mate do corredor',
        level: 'iniciante',
        fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        text: 'A oitava fileira está indefesa. A torre precisa só entrar.',
        expect: { from: 'e1', to: 'e8' },
        success: 'Te8#. Lembre-se de abrir a janelinha (h3) nas suas partidas.'
    },
    {
        id: 'garfo',
        title: 'Garfo de cavalo',
        level: 'iniciante',
        fen: 'q3k3/8/4N3/8/8/8/8/4K3 w - - 0 1',
        text: 'O cavalo ataca duas peças ao mesmo tempo. Rei e dama estão no desenho do L a partir de c7.',
        expect: { from: 'e6', to: 'c7' },
        success: 'Cc7+. O rei sai do xeque e a dama cai no lance seguinte. Garfo é a tática mais comum do cavalo.'
    },
    {
        id: 'cravada',
        title: 'Cravada',
        level: 'praticante',
        fen: '4k3/8/2q5/1B6/8/8/8/4K3 w - - 0 1',
        text: 'A dama preta está na mesma diagonal do rei. O bispo ataca a dama — e ela não pode fugir sem deixar o rei em xeque. Isso é uma cravada absoluta.',
        expect: { from: 'b5', to: 'c6' },
        success: 'Bxc6. A dama não pode recapturar: sairia da diagonal e o rei ficaria em xeque. Cravada.'
    },
    {
        id: 'espeto',
        title: 'Espeto',
        level: 'praticante',
        fen: 'r6k/8/3N4/8/8/8/8/4R2K w - - 0 1',
        text: 'O espeto ataca a peça mais valiosa na frente; quando ela foge, a de trás cai. Rei e torre na oitava — o cavalo defende e8.',
        expect: { from: 'e1', to: 'e8' },
        success: 'Te8+. O rei sai do xeque e a torre de a8 cai no lance seguinte. Espeto na oitava.'
    },
    {
        id: 'promocao',
        title: 'Promoção',
        level: 'iniciante',
        fen: '3k4/4P3/8/8/8/8/8/4K3 w - - 0 1',
        text: 'Peão na sétima. Ao chegar na oitava ele vira dama, torre, bispo ou cavalo. Quase sempre dama.',
        expect: { from: 'e7', to: 'e8', promo: 'q' },
        success: 'e8=D+. Um peão que promove vale uma dama nova — por isso finais de peão decidem partidas.'
    },
    {
        id: 'descoberto',
        title: 'Xeque descoberto',
        level: 'praticante',
        fen: '4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1',
        text: 'Quando uma peça sai da linha de outra, a de trás ataca de surpresa. Se a de trás dá xeque, a da frente pode capturar à vontade.',
        expect: { from: 'e2', to: 'a6' },
        success: 'Ba6+. O rei está em xeque da torre. O bispo saiu da coluna e ainda ataca. Descoberta.'
    },
    {
        id: 'sufocado',
        title: 'Mate sufocado',
        level: 'clube',
        fen: '6rk/6pp/8/4N3/8/8/8/4K3 w - - 0 1',
        text: 'O rei preto está preso pelos próprios peões e pela torre. O cavalo é a única peça que chega nessa casa. Mate sufocado — o mais elegante do xadrez.',
        expect: { from: 'e5', to: 'f7' },
        success: 'Cf7#. O rei não captura o cavalo: as próprias peças tapam todas as casas. Um clássico de Morphy.'
    }
];

export const OPENING_NOTES = {
    e4: 'Peão do rei — abre bispo e dama, luta imediata pelo centro.',
    d4: 'Peão da dama — jogo mais fechado, estruturas sólidas.',
    c4: 'Inglesa — pressiona d5 sem ocupar o centro com o peão-rei.',
    Nf3: 'Reti / desenvolvimento — controla d4 e e5, adia o plano.',
    Nc3: 'Desenvolve e defende e4/d5. Comum na Vienense e na dama.',
    Bc4: 'Italiana — mira f7, o ponto mais fraco do preto.',
    Bb5: 'Ruy López — pressiona o cavalo que defende e5.',
    e5: 'Resposta clássica a e4. Simetria e luta pelo centro.',
    c5: 'Siciliana — contra e4, luta assimétrica pela dama.',
    e6: 'Francesa — sólida, contra-ataca d5 depois.',
    c6: 'Caro-Kann — como a francesa, mas o bispo de c8 fica livre.',
    d5: 'Escandinava (após e4) ou resposta clássica a d4.',
    Nf6: 'Índia — flexível, impede e4 fácil.',
    O: 'Roque. Rei a salvo, torre ao centro.'
};

const STORAGE_KEY = 'xadrez-progress';

export function loadProgress() {
    try {
        return {
            lessons: [],
            puzzles: [],
            ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        };
    } catch {
        return { lessons: [], puzzles: [] };
    }
}

export function saveProgress(progress) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch { /* privado */ }
}

export function commentOnMove(san, { check, mate, captured, hangingAfter, castle, promo, opening }) {
    if (mate) return 'Xeque-mate. A partida acabou — o rei não tem fuga, bloqueio nem captura.';
    if (check) return `${san} dá xeque. O rival precisa sair agora: capturar, bloquear ou fugir.`;
    if (castle) return `${san}. Rei à ala, torre ao centro — segurança e desenvolvimento juntos.`;
    if (promo) return `${san}. O peão virou peça maior. Finais nascem desses passos.`;
    if (captured) {
        const names = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
        return `${san} captura ${names[captured.t] || 'a peça'}. Troque quando o valor favorece você.`;
    }
    if (hangingAfter) return `${san} — cuidado: essa peça ficou desprotegida. O rival pode tomá-la de graça.`;
    const key = san.replace(/[+#x]/g, '').slice(0, 3);
    if (opening && OPENING_NOTES[san.replace(/[+#]/g, '')]) {
        return OPENING_NOTES[san.replace(/[+#]/g, '')];
    }
    if (OPENING_NOTES[key]) return OPENING_NOTES[key];
    if (san.startsWith('O')) return OPENING_NOTES.O;
    return `${san}. Peças para o centro, rei a salvo, torres em colunas abertas.`;
}

export function describeSquare(index, game) {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = names[index & 7];
    const rank = (index >> 3) + 1;
    const dark = ((index & 7) + (index >> 3)) % 2 === 0;
    const p = game.board[index];
    let line = `Casa ${file}${rank}, ${dark ? 'escura' : 'clara'}.`;
    if (p) {
        const color = p.c === 'w' ? 'branco' : 'preto';
        line += ` ${PIECE_LABEL[p.t]} ${color}. ${HOW[p.t]}`;
    }
    return line;
}

const PIECE_LABEL = {
    p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Dama', k: 'Rei'
};

const HOW = {
    p: 'Anda para frente, captura na diagonal.',
    n: 'Salta em L e pode pular peças.',
    b: 'Diagonais, sempre na mesma cor de casa.',
    r: 'Colunas e fileiras, a peça das colunas abertas.',
    q: 'A peça mais forte: qualquer linha reta.',
    k: 'Uma casa em qualquer direção. Proteja-o.'
};

export { PIECE_LABEL, HOW };
