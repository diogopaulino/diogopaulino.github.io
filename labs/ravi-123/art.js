/* ==========================================================================
   Ravi 1·2·3 — motor de pixel art
   --------------------------------------------------------------------------
   Duas técnicas convivem aqui:
     1. Pixel maps (strings) para personagens e bichos, onde o traço importa.
     2. Uma mini-DSL de desenho (rect/circ/line/poly) para veículos, objetos
        e cenários — mantém tudo em grade inteira, então continua pixel art,
        mas sem 32 caracteres contados à mão por linha.
   Tudo é renderizado em canvas pequeno e escalado com image-rendering:pixelated.
   ========================================================================== */

window.Art = (function () {
  'use strict';

  /* ---------------------------------------------------------------- paleta */

  var C = {
    black: '#101018',
    ink: '#241a08',
    white: '#ffffff',
    cream: '#f4ecd8',

    red: '#d81e26',
    redLt: '#ff5a5a',
    redDk: '#8e1218',
    blue: '#2244cc',
    blueLt: '#5a9bff',
    blueDk: '#14276e',
    cyan: '#22c0d0',
    green: '#22a03c',
    greenLt: '#5fd870',
    greenDk: '#135c24',
    yellow: '#ffd21e',
    yellowLt: '#fff09a',
    orange: '#ff8a1e',
    orangeDk: '#c05a00',
    pink: '#ff5ab4',
    pinkLt: '#ffb0dc',
    purple: '#7c3ec8',
    purpleLt: '#b98cf0',
    brown: '#8b5a2b',
    brownLt: '#c08a4e',
    brownDk: '#4e3116',
    gray: '#9aa0ac',
    grayLt: '#d6dae2',
    grayDk: '#4c525e',
    silver: '#c8cede'
  };

  /* --------------------------------------------------- DSL de desenho puro */

  function surface(w, h) {
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;

    var api = {
      cv: cv,
      ctx: g,
      w: w,
      h: h,
      rect: function (x, y, ww, hh, col) {
        g.fillStyle = col;
        g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
        return api;
      },
      px: function (x, y, col) {
        return api.rect(x, y, 1, 1, col);
      },
      /* Círculo cheio por varredura de linhas — bordas em degrau, como deve ser. */
      circ: function (cx, cy, r, col) {
        g.fillStyle = col;
        for (var dy = -r; dy <= r; dy++) {
          var dx = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
          g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
        }
        return api;
      },
      ring: function (cx, cy, r, th, col) {
        g.fillStyle = col;
        for (var dy = -r; dy <= r; dy++) {
          var outer = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
          var innerR = r - th;
          var inner = Math.abs(dy) <= innerR
            ? Math.round(Math.sqrt(Math.max(0, innerR * innerR - dy * dy)))
            : -1;
          if (inner < 0) {
            g.fillRect(Math.round(cx - outer), Math.round(cy + dy), outer * 2 + 1, 1);
          } else {
            g.fillRect(Math.round(cx - outer), Math.round(cy + dy), outer - inner, 1);
            g.fillRect(Math.round(cx + inner + 1), Math.round(cy + dy), outer - inner, 1);
          }
        }
        return api;
      },
      ellipse: function (cx, cy, rx, ry, col) {
        g.fillStyle = col;
        for (var dy = -ry; dy <= ry; dy++) {
          var t = 1 - (dy * dy) / (ry * ry);
          if (t < 0) continue;
          var dx = Math.round(rx * Math.sqrt(t));
          g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
        }
        return api;
      },
      line: function (x0, y0, x1, y1, col) {
        x0 = Math.round(x0); y0 = Math.round(y0);
        x1 = Math.round(x1); y1 = Math.round(y1);
        var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        var err = dx + dy;
        g.fillStyle = col;
        for (;;) {
          g.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          var e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return api;
      },
      poly: function (pts, col) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fill();
        return api;
      },
      /* Xadrez estilo EGA: a transição de cor mais honesta dos anos 90. */
      dither: function (x, y, ww, hh, col, step) {
        step = step || 2;
        g.fillStyle = col;
        for (var yy = 0; yy < hh; yy++) {
          for (var xx = 0; xx < ww; xx++) {
            if (((x + xx) + (y + yy)) % step === 0) g.fillRect(x + xx, y + yy, 1, 1);
          }
        }
        return api;
      },
      sprite: function (key, x, y) {
        var s = get(key);
        if (!s.img.complete || !s.img.naturalWidth) return api;
        g.drawImage(s.img, Math.round(x), Math.round(y));
        return api;
      }
    };
    return api;
  }

  /* --------------------------------------------- renderer de pixel map     */

  function fromMap(rows, map) {
    var w = rows[0].length, h = rows.length;
    var s = surface(w, h);
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < w; x++) {
        var col = map[row[x]];
        if (col) s.px(x, y, col);
      }
    }
    return s.cv;
  }

  /* ------------------------------------------------------- personagens     */

  /* Cabeças 16x9 — cada penteado enquadra o rosto de um jeito. */
  var HEADS = {
    curly: [
      '...H.HH.HH.H....',
      '..HHHHHHHHHHHH..',
      '.HHhHHHHHHhHHHH.',
      '.HHHKKKKKKKKHHH.',
      '.HHKKKKKKKKKKHH.',
      '..HKK0KKKK0KKH..',
      '..HKKKKkkKKKKH..',
      '...KKK0000KKK...',
      '....KKKKKKKK....'
    ],
    straight: [
      '....HHHHHHHH....',
      '..HHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHH.',
      '.HHKKKKKKKKKKHH.',
      '..HKK0KKKK0KKH..',
      '..HKKKKkkKKKKH..',
      '...KKK0000KKK...',
      '....KKKKKKKK....'
    ],
    afro: [
      '...HHHHHHHHHH...',
      '.HHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHH',
      'HHHHKKKKKKKKHHHH',
      'HHHKKKKKKKKKKHHH',
      'HH.KK0KKKK0KK.HH',
      '...KKKKkkKKKK...',
      '...KKK0000KKK...',
      '....KKKKKKKK....'
    ],
    ponytail: [
      '....HHHHHHHH....',
      '..HHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHHH',
      '.HHHKKKKKKKKHHHH',
      '.HHKKKKKKKKKKHHH',
      '..HKK0KKKK0KKHHH',
      '..HKKKKkkKKKKH..',
      '...KKK0000KKK...',
      '....KKKKKKKK....'
    ],
    braids: [
      '....HHHHHHHH....',
      '..HHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHH.',
      'HHHHKKKKKKKKHHHH',
      'HhHKKKKKKKKKKHhH',
      'HhHKK0KKKK0KKHhH',
      'HhHKKKKkkKKKKHhH',
      '.H.KKK0000KKK.H.',
      '....KKKKKKKK....'
    ],
    cap: [
      '....CCCCCCCC....',
      '..CCCCCCCCCCCC..',
      '.CCCCCCCCCCCCCC.',
      '.CCCCCCCCCCCCCCC',
      '.HHKKKKKKKKKKHH.',
      '..HKK0KKKK0KKH..',
      '..HKKKKkkKKKKH..',
      '...KKK0000KKK...',
      '....KKKKKKKK....'
    ]
  };

  /* Corpos 16x13 — braços ao lado (idle) ou pra cima (comemorando). */
  var BODY_IDLE = [
    '......KKKK......',
    '..KTTTTTTTTTTK..',
    '..KTttttttttTK..',
    '..KTTTTTTTTTTK..',
    '..KTTTTTTTTTTK..',
    '...TTTTTTTTTT...',
    '...PPPPPPPPPP...',
    '...PPPPPPPPPP...',
    '...PPPP..PPPP...',
    '....KK....KK....',
    '....KK....KK....',
    '...SSSS..SSSS...',
    '...SSSS..SSSS...'
  ];

  var BODY_CHEER = [
    '.K....KKKK....K.',
    '.K.TTTTTTTTTT.K.',
    '...TttttttttT...',
    '...TTTTTTTTTT...',
    '...TTTTTTTTTT...',
    '...TTTTTTTTTT...',
    '...PPPPPPPPPP...',
    '...PPPPPPPPPP...',
    '...PPPP..PPPP...',
    '....KK....KK....',
    '....KK....KK....',
    '...SSSS..SSSS...',
    '...SSSS..SSSS...'
  ];

  /* Elenco. Ravi é o primeiro: cabelo cacheado, camiseta listrada. */
  var KIDS = {
    ravi:  { name: 'Ravi',  hair: 'curly',    H: '#5a3418', h: '#3a2010', K: '#fcdbad', k: '#dca77c', T: C.yellow, t: C.red,    P: C.blue,   S: C.white,  C: C.red },
    bia:   { name: 'Bia',   hair: 'braids',   H: '#3a2010', h: '#1f1108', K: '#8a5a32', k: '#5c3a1e', T: C.pink,   t: C.white,  P: C.purple, S: C.red,    C: C.pink },
    leo:   { name: 'Léo',   hair: 'cap',      H: '#c07a2a', h: '#8a5216', K: '#f0c89a', k: '#c89a68', T: C.green,  t: C.yellow, P: C.brown,  S: C.blue,   C: C.blue },
    manu:  { name: 'Manu',  hair: 'afro',     H: '#2b1a10', h: '#140a06', K: '#7a4a26', k: '#4e2f16', T: C.cyan,   t: C.white,  P: C.red,    S: C.yellow, C: C.cyan },
    teo:   { name: 'Téo',   hair: 'straight', H: '#e8c34a', h: '#b8902a', K: '#f6dcbe', k: '#d0ab86', T: C.purple, t: C.pinkLt, P: C.greenDk, S: C.white, C: C.purple },
    nina:  { name: 'Nina',  hair: 'ponytail', H: '#b42a2a', h: '#7a1616', K: '#eec49a', k: '#c09468', T: C.orange, t: C.white,  P: C.cyan,   S: C.pink,   C: C.orange }
  };

  function kidMap(cfg) {
    return {
      '.': null,
      '0': C.black,
      '1': C.white,
      'H': cfg.H, 'h': cfg.h, 'C': cfg.C,
      'K': cfg.K, 'k': cfg.k,
      'T': cfg.T, 't': cfg.t,
      'P': cfg.P, 'S': cfg.S
    };
  }

  function buildKid(id, pose) {
    var cfg = KIDS[id] || KIDS.ravi;
    var body = pose === 'cheer' ? BODY_CHEER : BODY_IDLE;
    return fromMap(HEADS[cfg.hair].concat(body), kidMap(cfg));
  }

  function buildFace(id) {
    var cfg = KIDS[id] || KIDS.ravi;
    return fromMap(HEADS[cfg.hair], kidMap(cfg));
  }

  /* ------------------------------------------------------------- animais   */

  var ANIMALS = {
    dog: {
      name: 'Fumaça', kind: 'cachorro', treat: 'bone', treatName: 'ossinhos',
      rows: [
        '..nn........nn..',
        '.nnnn......nnnn.',
        '.nnnnnnnnnnnnnn.',
        '.nNNNNNNNNNNNNn.',
        '.nN0NNNNNNNN0Nn.',
        '.nNNNNN00NNNNNn.',
        '.nNNNN0000NNNNn.',
        '..nnNNNNNNNNnn..',
        '....nnnnnnnn....',
        '...nnnnnnnnnn...',
        '..nnnnnnnnnnnn..',
        '..nnnn1111nnnn..',
        '..nnnnnnnnnnnn..',
        '..1111....1111..'
      ],
      map: { '.': null, '0': C.black, '1': '#f0ece0', 'n': '#7a7f8c', 'N': '#aab0bd' }
    },
    cat: {
      name: 'Mel', kind: 'gata', treat: 'fish', treatName: 'peixinhos',
      rows: [
        '..o..........o..',
        '.ooo........ooo.',
        '.oooo......oooo.',
        '.oooooooooooooo.',
        '.oo0oooooooo0oo.',
        '.oooooo00oooooo.',
        '.ooo0oo00oo0ooo.',
        '..oooooooooooo..',
        '....oooooooo....',
        '...oooooooooo...',
        '..oooooooooooo..',
        '..oooo1111oooo..',
        '..oooooooooooo..',
        '..oooo....oooo..'
      ],
      map: { '.': null, '0': C.black, '1': '#fff2d8', 'o': '#e8922a' }
    },
    parrot: {
      name: 'Zé', kind: 'papagaio', treat: 'seed', treatName: 'sementes',
      rows: [
        '.....rrrr.......',
        '....ggggggg.....',
        '...ggggggggg....',
        '...gg0gggg0gg...',
        '...ggggyygggg...',
        '....ggyyyygg....',
        '...gggggggggg...',
        '..gggbbbbbbggg..',
        '..ggbbbbbbbbgg..',
        '..ggbbbbbbbbgg..',
        '...gbbbbbbbbg...',
        '....rrrrrrrr....',
        '.....yy..yy.....',
        '....yyy..yyy....'
      ],
      map: { '.': null, '0': C.black, 'g': '#2fae3c', 'b': '#2f6ede', 'r': '#e03028', 'y': '#ffc61e' }
    },
    turtle: {
      name: 'Tuca', kind: 'tartaruga', treat: 'leaf', treatName: 'folhinhas',
      rows: [
        '....gggggggg....',
        '..gggggggggggg..',
        '.gGGggGGggGGggg.',
        'GGgGGggGGggGGgg.',
        'G0gggGGggGGggGg.',
        'GGggGGggGGggGgg.',
        '..gggggggggggg..',
        '...gggggggggg...',
        '..GG......GG....'
      ],
      map: { '.': null, '0': C.black, 'g': '#2f7a2a', 'G': '#7fc34a' }
    },
    monkey: {
      name: 'Bento', kind: 'macaco', treat: 'banana', treatName: 'bananas',
      rows: [
        '..n..........n..',
        '.nnn........nnn.',
        '.nnnnnnnnnnnnnn.',
        '.nnNNNNNNNNNNnn.',
        '.nnN0NNNNNN0Nnn.',
        '.nnNNNNNNNNNNnn.',
        '.nnNN0NNNN0NNnn.',
        '..nNNN0000NNNn..',
        '...nnnnnnnnnn...',
        '..nnnnnnnnnnnn..',
        '..nnnnNNNNnnnn..',
        '..nnnnNNNNnnnn..',
        '..nnnnnnnnnnnn..',
        '..nnn......nnn..'
      ],
      map: { '.': null, '0': C.black, 'n': '#7a4a22', 'N': '#c08a4e' }
    }
  };

  function buildAnimal(id) {
    var a = ANIMALS[id];
    return fromMap(a.rows, a.map);
  }

  /* ------------------------------------------------------------ veículos   */

  function wheel(s, cx, cy, r) {
    s.circ(cx, cy, r, C.black);
    s.circ(cx, cy, r - 2, C.grayDk);
    s.circ(cx, cy, Math.max(1, r - 4), C.silver);
    s.px(cx, cy, C.grayDk);
  }

  var VEHICLES = {
    bike: {
      name: 'Bicicleta', seats: 2, speed: 4, desc: 'Rápida e leve',
      build: function () {
        var s = surface(40, 26);
        wheel(s, 8, 17, 8);
        wheel(s, 31, 17, 8);
        s.line(8, 17, 18, 17, C.red).line(18, 17, 14, 8, C.red).line(14, 8, 8, 17, C.red);
        s.line(18, 17, 26, 8, C.red).line(14, 8, 26, 8, C.red).line(26, 8, 31, 17, C.red);
        s.rect(11, 6, 7, 2, C.black);       /* selim */
        s.rect(25, 4, 2, 5, C.grayDk);      /* guidão */
        s.rect(23, 3, 7, 2, C.black);
        s.circ(19, 17, 3, C.yellow);        /* coroa */
        return s.cv;
      }
    },
    cart: {
      name: 'Carrinho de rolimã', seats: 3, speed: 3, desc: 'Clássico de ladeira',
      build: function () {
        var s = surface(44, 26);
        s.rect(4, 12, 36, 7, C.brown);
        s.rect(4, 12, 36, 2, C.brownLt);
        s.rect(6, 5, 4, 8, C.brownDk);      /* encosto */
        s.rect(6, 4, 10, 3, C.brownDk);
        s.rect(30, 8, 3, 5, C.grayDk);      /* volante-corda */
        s.rect(27, 6, 9, 2, C.black);
        s.rect(8, 19, 28, 2, C.brownDk);
        wheel(s, 10, 21, 5);
        wheel(s, 34, 21, 5);
        s.rect(14, 8, 12, 4, C.red);        /* caixote pintado */
        s.rect(15, 9, 10, 2, C.yellow);
        return s.cv;
      }
    },
    kombi: {
      name: 'Kombi da Festa', seats: 5, speed: 2, desc: 'Lenta, mas cabe todo mundo',
      build: function () {
        var s = surface(52, 30);
        s.rect(3, 6, 46, 16, C.cyan);
        s.rect(3, 6, 46, 3, '#7fe4ee');
        s.rect(3, 16, 46, 6, C.white);
        s.rect(3, 5, 46, 2, C.black);
        s.rect(2, 6, 2, 16, C.black);
        s.rect(48, 6, 2, 16, C.black);
        s.rect(6, 9, 11, 6, '#bfe9ff');     /* janelas */
        s.rect(19, 9, 11, 6, '#bfe9ff');
        s.rect(33, 9, 12, 6, '#bfe9ff');
        s.rect(3, 22, 46, 2, C.grayDk);
        s.rect(45, 12, 5, 3, C.yellow);     /* farol */
        wheel(s, 13, 24, 5);
        wheel(s, 39, 24, 5);
        s.rect(20, 2, 12, 4, C.red);        /* bagageiro com presentes */
        s.rect(22, 0, 3, 3, C.pink);
        s.rect(27, 0, 3, 3, C.yellow);
        return s.cv;
      }
    },
    rocket: {
      name: 'Foguete de papelão', seats: 4, speed: 5, desc: 'Feito em casa. Voa mesmo!',
      build: function () {
        var s = surface(50, 28);
        s.poly([[46, 14], [30, 6], [30, 22]], C.red);
        s.rect(8, 6, 24, 17, '#d8cba8');    /* corpo de papelão */
        s.rect(8, 6, 24, 3, '#efe4c8');
        s.rect(8, 20, 24, 3, '#b8a780');
        s.poly([[10, 6], [4, 2], [4, 12]], C.blue);
        s.poly([[10, 23], [4, 27], [4, 17]], C.blue);
        s.circ(22, 14, 5, C.black);
        s.circ(22, 14, 4, '#bfe9ff');       /* escotilha */
        s.rect(12, 11, 4, 7, C.yellow);
        s.rect(0, 12, 5, 5, C.orange);      /* fogo */
        s.rect(0, 13, 3, 3, C.yellow);
        wheel(s, 14, 25, 3);
        wheel(s, 28, 25, 3);
        return s.cv;
      }
    }
  };

  /* --------------------------------------------------------------- itens   */

  var ITEMS = {
    /* petiscos dos bichos */
    bone: function () {
      var s = surface(14, 10);
      s.rect(3, 4, 8, 3, '#f2ead2');
      s.circ(3, 4, 2, '#f2ead2').circ(3, 7, 2, '#f2ead2');
      s.circ(11, 4, 2, '#f2ead2').circ(11, 7, 2, '#f2ead2');
      s.rect(4, 5, 6, 1, '#d5c9a8');
      return s.cv;
    },
    fish: function () {
      var s = surface(14, 10);
      s.ellipse(6, 5, 5, 3, '#5aa8d8');
      s.poly([[11, 5], [14, 2], [14, 8]], '#3f88b8');
      s.px(3, 4, C.black);
      s.rect(4, 6, 4, 1, '#3f88b8');
      return s.cv;
    },
    seed: function () {
      var s = surface(12, 10);
      s.ellipse(4, 5, 2, 3, '#8b5a2b');
      s.ellipse(8, 6, 2, 3, '#a8703a');
      s.px(4, 4, '#c99a5a').px(8, 5, '#c99a5a');
      return s.cv;
    },
    leaf: function () {
      var s = surface(13, 11);
      s.ellipse(6, 5, 5, 4, '#4fae3a');
      s.line(2, 8, 10, 3, '#2f7a2a');
      s.line(6, 5, 4, 3, '#2f7a2a');
      return s.cv;
    },
    banana: function () {
      var s = surface(13, 12);
      s.poly([[2, 2], [5, 9], [11, 10], [11, 7], [6, 6], [4, 1]], C.yellow);
      s.line(2, 2, 4, 1, '#c09a10');
      s.rect(10, 9, 2, 2, '#8b6a10');
      return s.cv;
    },

    /* mercado */
    cake: function () {
      var s = surface(20, 16);
      s.rect(2, 8, 16, 6, '#e8b46a');
      s.rect(2, 6, 16, 3, C.pinkLt);
      s.rect(2, 13, 16, 2, '#c08a4e');
      s.rect(3, 5, 3, 2, C.pinkLt).rect(8, 5, 3, 2, C.pinkLt).rect(13, 5, 3, 2, C.pinkLt);
      s.rect(9, 1, 2, 4, C.white);
      s.circ(10, 1, 1, C.orange);
      s.rect(1, 8, 1, 6, C.brownDk).rect(18, 8, 1, 6, C.brownDk);
      return s.cv;
    },
    soda: function () {
      var s = surface(12, 18);
      s.rect(4, 0, 4, 3, '#3a6a2a');
      s.rect(3, 3, 6, 4, '#7fc34a');
      s.rect(2, 6, 8, 11, C.orange);
      s.rect(2, 9, 8, 4, C.white);
      s.rect(3, 10, 6, 2, C.red);
      s.rect(2, 16, 8, 1, '#c05a00');
      s.rect(2, 6, 1, 11, '#ffb060');
      return s.cv;
    },
    chips: function () {
      var s = surface(16, 16);
      s.rect(2, 2, 12, 12, C.blue);
      s.rect(2, 2, 12, 2, '#7fa8ff');
      s.rect(2, 12, 12, 2, C.blueDk);
      s.rect(4, 6, 8, 5, C.yellow);
      s.rect(5, 7, 6, 3, C.orange);
      s.rect(2, 0, 3, 3, C.blueDk).rect(11, 0, 3, 3, C.blueDk);
      return s.cv;
    },
    brigadeiro: function () {
      var s = surface(12, 11);
      s.rect(1, 5, 10, 5, '#8a5a30');
      s.rect(1, 9, 10, 1, '#5c3a1a');
      s.circ(6, 5, 4, '#3a2416');
      s.px(4, 3, '#6a4a2a').px(8, 4, '#6a4a2a').px(6, 2, '#6a4a2a').px(5, 6, '#6a4a2a').px(8, 7, '#6a4a2a');
      return s.cv;
    },
    candle: function () {
      var s = surface(8, 16);
      s.rect(2, 5, 4, 11, C.pink);
      s.rect(2, 7, 4, 2, C.white);
      s.rect(2, 11, 4, 2, C.white);
      s.rect(3, 3, 2, 2, C.white);
      s.ellipse(4, 1, 2, 2, C.orange);
      s.px(4, 1, C.yellow);
      return s.cv;
    },
    coin: function () {
      var s = surface(12, 12);
      s.circ(6, 6, 5, '#c08a10');
      s.circ(6, 6, 4, C.yellow);
      s.circ(6, 6, 2, '#e8b420');
      s.px(4, 4, C.yellowLt);
      return s.cv;
    },

    /* brinquedos */
    teddy: function () {
      var s = surface(16, 18);
      s.circ(4, 4, 3, '#a8703a').circ(12, 4, 3, '#a8703a');
      s.circ(8, 6, 5, C.brownLt);
      s.px(6, 5, C.black).px(10, 5, C.black);
      s.rect(7, 7, 2, 2, '#5c3a1a');
      s.ellipse(8, 13, 5, 4, C.brownLt);
      s.ellipse(8, 13, 3, 2, '#e8c89a');
      s.circ(2, 12, 2, '#a8703a').circ(14, 12, 2, '#a8703a');
      s.circ(4, 17, 2, '#a8703a').circ(12, 17, 2, '#a8703a');
      return s.cv;
    },
    ball: function () {
      var s = surface(16, 16);
      s.circ(8, 8, 7, C.white);
      s.ring(8, 8, 7, 1, C.black);
      s.poly([[8, 4], [11, 6], [10, 10], [6, 10], [5, 6]], C.black);
      s.px(3, 5, C.black).px(13, 5, C.black).px(4, 12, C.black).px(12, 12, C.black);
      return s.cv;
    },
    robot: function () {
      var s = surface(16, 18);
      s.rect(3, 0, 2, 3, C.grayDk);
      s.circ(4, 0, 1, C.red);
      s.rect(2, 3, 12, 6, C.silver);
      s.rect(2, 3, 12, 1, C.white);
      s.rect(4, 5, 3, 2, C.cyan).rect(9, 5, 3, 2, C.cyan);
      s.rect(5, 8, 6, 1, C.grayDk);
      s.rect(3, 10, 10, 6, C.blue);
      s.rect(5, 11, 6, 3, C.yellow);
      s.rect(0, 10, 3, 2, C.silver).rect(13, 10, 3, 2, C.silver);
      s.rect(4, 16, 3, 2, C.grayDk).rect(9, 16, 3, 2, C.grayDk);
      return s.cv;
    },
    toycar: function () {
      var s = surface(18, 12);
      s.rect(2, 5, 14, 4, C.red);
      s.rect(5, 2, 8, 4, C.redLt);
      s.rect(6, 3, 6, 2, '#bfe9ff');
      s.rect(2, 8, 14, 1, C.redDk);
      s.rect(15, 5, 2, 2, C.yellow);
      wheel(s, 5, 10, 2);
      wheel(s, 13, 10, 2);
      return s.cv;
    },
    top: function () {
      var s = surface(14, 16);
      s.poly([[2, 4], [12, 4], [7, 14]], C.purple);
      s.poly([[4, 4], [10, 4], [7, 10]], C.pink);
      s.rect(2, 2, 10, 3, C.yellow);
      s.rect(6, 0, 2, 3, C.grayDk);
      s.px(7, 15, C.grayDk);
      return s.cv;
    },
    scrap: function () {
      var s = surface(14, 12);
      s.poly([[1, 7], [5, 2], [9, 6], [13, 3], [12, 11], [2, 11]], C.grayDk);
      s.rect(4, 7, 3, 2, C.gray);
      s.rect(8, 8, 3, 2, C.gray);
      s.px(3, 4, C.gray).px(11, 5, C.gray);
      return s.cv;
    },

    /* festa */
    gift: function () {
      var s = surface(16, 16);
      s.rect(1, 5, 14, 11, C.purple);
      s.rect(1, 5, 14, 2, C.purpleLt);
      s.rect(6, 5, 4, 11, C.yellow);
      s.rect(1, 8, 14, 2, C.yellow);
      s.circ(5, 3, 3, C.yellow).circ(11, 3, 3, C.yellow);
      s.circ(5, 3, 1, C.orange).circ(11, 3, 1, C.orange);
      return s.cv;
    },
    star: function () {
      var s = surface(14, 14);
      s.poly([[7, 0], [9, 5], [14, 5], [10, 8], [12, 13], [7, 10], [2, 13], [4, 8], [0, 5], [5, 5]], C.yellow);
      s.px(6, 4, C.yellowLt).px(7, 5, C.yellowLt).px(5, 6, C.yellowLt);
      return s.cv;
    },
    heart: function () {
      var s = surface(12, 11);
      s.circ(3, 3, 3, C.pink).circ(8, 3, 3, C.pink);
      s.poly([[0, 4], [11, 4], [6, 10]], C.pink);
      s.px(2, 2, C.pinkLt).px(3, 1, C.pinkLt);
      return s.cv;
    },
    /* Seta "clique aqui" — o convite visual das telas de exploração. */
    marker: function () {
      var s = surface(16, 20);
      s.rect(5, 0, 6, 9, C.black);
      s.rect(6, 1, 4, 8, C.yellow);
      s.poly([[0, 8], [15, 8], [8, 19]], C.black);
      s.poly([[3, 10], [12, 10], [8, 16]], C.yellow);
      s.rect(6, 2, 2, 4, C.yellowLt);
      return s.cv;
    },
    note: function () {
      var s = surface(12, 14);
      s.rect(7, 0, 2, 10, C.white);
      s.rect(7, 0, 5, 2, C.white);
      s.ellipse(4, 11, 4, 3, C.white);
      return s.cv;
    }
  };

  /* Balões e bolo levam parâmetro, então têm fábrica própria. */
  function buildBalloon(color) {
    var s = surface(16, 26);
    s.ellipse(8, 9, 7, 9, color);
    s.ellipse(5, 6, 2, 3, 'rgba(255,255,255,0.55)');
    s.poly([[6, 17], [10, 17], [8, 20]], color);
    s.line(8, 19, 8, 25, '#f0e6c8');
    s.line(8, 22, 6, 24, '#f0e6c8');
    return s.cv;
  }

  function buildBigCake(candles) {
    var n = Math.max(0, Math.min(9, parseInt(candles, 10) || 0));
    var s = surface(56, 44);
    /* prato */
    s.ellipse(28, 41, 26, 3, C.silver);
    /* base do bolo */
    s.rect(6, 26, 44, 14, '#c88a4e');
    s.rect(6, 26, 44, 3, '#e8b46a');
    s.rect(6, 24, 44, 4, C.pinkLt);
    for (var i = 0; i < 8; i++) s.rect(8 + i * 6, 27, 3, 3, C.pinkLt);
    /* andar de cima */
    s.rect(14, 14, 28, 12, '#d89a5a');
    s.rect(14, 12, 28, 4, C.white);
    for (var j = 0; j < 5; j++) s.rect(16 + j * 6, 15, 3, 3, C.white);
    s.rect(14, 18, 28, 2, C.red);
    /* velinhas — a contagem é o coração do jogo */
    var startX = 28 - (n - 1) * 3;
    for (var k = 0; k < n; k++) {
      var cx = startX + k * 6;
      s.rect(cx - 1, 4, 3, 9, k % 2 ? C.cyan : C.pink);
      s.rect(cx - 1, 6, 3, 2, C.white);
      s.ellipse(cx, 2, 2, 3, C.orange);
      s.px(cx, 2, C.yellow);
      s.px(cx, 1, C.yellowLt);
    }
    return s.cv;
  }

  function buildBigCakeOut(candles) {
    var n = Math.max(0, Math.min(9, parseInt(candles, 10) || 0));
    var s = surface(56, 44);
    s.ellipse(28, 41, 26, 3, C.silver);
    s.rect(6, 26, 44, 14, '#c88a4e');
    s.rect(6, 26, 44, 3, '#e8b46a');
    s.rect(6, 24, 44, 4, C.pinkLt);
    for (var i = 0; i < 8; i++) s.rect(8 + i * 6, 27, 3, 3, C.pinkLt);
    s.rect(14, 14, 28, 12, '#d89a5a');
    s.rect(14, 12, 28, 4, C.white);
    for (var j = 0; j < 5; j++) s.rect(16 + j * 6, 15, 3, 3, C.white);
    s.rect(14, 18, 28, 2, C.red);
    var startX = 28 - (n - 1) * 3;
    for (var k = 0; k < n; k++) {
      var cx = startX + k * 6;
      s.rect(cx - 1, 4, 3, 9, k % 2 ? C.cyan : C.pink);
      s.rect(cx - 1, 6, 3, 2, C.white);
      s.px(cx, 3, C.grayDk);
      s.px(cx, 1, C.gray);   /* fumacinha */
      s.px(cx + 1, 0, C.gray);
    }
    return s.cv;
  }

  /* -------------------------------------------------------- cenário/props  */

  var PROPS = {
    house: function (arg) {
      var parts = (arg || 'red').split(',');
      var wallCol = { red: '#e07a6a', blue: '#7aa8e0', green: '#8ac87a', yellow: '#e8c86a', pink: '#e89ac0', purple: '#a08ad8' }[parts[0]] || '#e07a6a';
      var roofCol = { red: '#8e3a2a', blue: '#3a5a8e', green: '#3a7a3a', yellow: '#a8862a', pink: '#a04a78', purple: '#5a3a8e' }[parts[0]] || '#8e3a2a';
      var s = surface(52, 54);
      s.poly([[26, 2], [51, 20], [1, 20]], roofCol);
      s.poly([[26, 5], [44, 18], [8, 18]], 'rgba(255,255,255,0.16)');   /* brilho do telhado */
      s.rect(3, 20, 46, 32, wallCol);
      s.rect(3, 20, 46, 2, C.black);
      s.rect(3, 20, 3, 32, 'rgba(0,0,0,0.18)');
      s.rect(46, 20, 3, 32, 'rgba(0,0,0,0.18)');
      /* porta */
      s.rect(20, 34, 13, 18, C.brownDk);
      s.rect(21, 35, 11, 16, C.brown);
      s.px(30, 43, C.yellow).px(30, 44, C.yellow);
      /* janela */
      s.rect(7, 26, 12, 11, C.white);
      s.rect(8, 27, 10, 9, '#bfe9ff');
      s.rect(12, 27, 1, 9, C.white);
      s.rect(8, 31, 10, 1, C.white);
      s.rect(34, 26, 12, 11, C.white);
      s.rect(35, 27, 10, 9, '#bfe9ff');
      s.rect(39, 27, 1, 9, C.white);
      s.rect(35, 31, 10, 1, C.white);
      /* chaminé */
      s.rect(38, 4, 6, 10, '#8a6a5a');
      s.rect(38, 3, 6, 2, '#6a4a3a');
      return s.cv;
    },
    tree: function () {
      var s = surface(38, 52);
      s.rect(16, 30, 6, 22, C.brownDk);
      s.rect(17, 30, 3, 22, C.brown);
      s.circ(19, 18, 14, '#2f7a2a');
      s.circ(11, 24, 9, '#2f7a2a');
      s.circ(28, 24, 9, '#2f7a2a');
      s.circ(15, 13, 8, '#4fae3a');
      s.circ(24, 17, 7, '#4fae3a');
      s.px(13, 10, '#7fd85a').px(22, 14, '#7fd85a');
      return s.cv;
    },
    bush: function () {
      var s = surface(28, 16);
      s.circ(8, 10, 7, '#2f7a2a');
      s.circ(18, 9, 8, '#2f7a2a');
      s.circ(13, 12, 6, '#4fae3a');
      s.px(6, 6, '#7fd85a').px(19, 5, '#7fd85a');
      return s.cv;
    },
    cloud: function () {
      var s = surface(40, 18);
      s.circ(10, 11, 6, C.white);
      s.circ(20, 8, 8, C.white);
      s.circ(30, 12, 6, C.white);
      s.rect(8, 11, 24, 6, C.white);
      s.circ(20, 8, 6, '#f4f8ff');
      return s.cv;
    },
    sun: function () {
      var s = surface(34, 34);
      s.circ(17, 17, 11, C.yellow);
      s.circ(17, 17, 8, C.yellowLt);
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        s.line(17 + Math.cos(a) * 13, 17 + Math.sin(a) * 13, 17 + Math.cos(a) * 16, 17 + Math.sin(a) * 16, C.yellow);
      }
      return s.cv;
    },
    table: function () {
      var s = surface(70, 30);
      s.rect(0, 4, 70, 8, C.pinkLt);
      s.rect(0, 4, 70, 2, C.white);
      s.rect(0, 12, 70, 3, C.pink);
      for (var i = 0; i < 9; i++) s.poly([[i * 8 + 2, 15], [i * 8 + 8, 15], [i * 8 + 5, 20]], C.pink);
      s.rect(6, 12, 4, 18, C.brownDk);
      s.rect(60, 12, 4, 18, C.brownDk);
      return s.cv;
    },
    banner: function () {
      var s = surface(120, 26);
      s.line(0, 3, 60, 9, '#d8cba8');
      s.line(60, 9, 119, 3, '#d8cba8');
      var cols = [C.red, C.yellow, C.green, C.blue, C.pink, C.orange, C.cyan, C.purple];
      for (var i = 0; i < 10; i++) {
        var x = 6 + i * 11;
        var y = 4 + Math.round(Math.sin(i / 9 * Math.PI) * 6);
        s.poly([[x, y], [x + 9, y], [x + 4, y + 13]], cols[i % cols.length]);
      }
      return s.cv;
    },
    shelfBox: function (arg) {
      var s = surface(20, 14);
      s.rect(0, 0, 20, 14, arg || C.orange);
      s.rect(0, 0, 20, 2, 'rgba(255,255,255,0.4)');
      s.rect(0, 11, 20, 3, 'rgba(0,0,0,0.25)');
      s.rect(3, 4, 14, 5, C.white);
      return s.cv;
    },
    cart: function () {
      var s = surface(34, 26);
      s.line(2, 2, 8, 2, C.grayDk).line(8, 2, 10, 8, C.grayDk);
      s.rect(9, 7, 22, 2, C.grayDk);
      s.poly([[10, 9], [31, 9], [28, 19], [13, 19]], C.silver);
      s.poly([[12, 11], [29, 11], [27, 17], [14, 17]], C.grayLt);
      s.rect(13, 19, 15, 2, C.grayDk);
      wheel(s, 15, 23, 3);
      wheel(s, 27, 23, 3);
      return s.cv;
    },
    conveyorBox: function () {
      var s = surface(24, 10);
      s.rect(0, 0, 24, 10, C.grayDk);
      s.rect(0, 0, 24, 2, C.gray);
      return s.cv;
    },
    lever: function (on) {
      var s = surface(20, 30);
      s.rect(4, 20, 12, 10, C.grayDk);
      s.rect(5, 21, 10, 3, C.gray);
      if (on === 'on') {
        s.line(10, 20, 16, 8, C.grayDk);
        s.circ(16, 6, 4, C.green);
      } else {
        s.line(10, 20, 4, 8, C.grayDk);
        s.circ(4, 6, 4, C.red);
      }
      return s.cv;
    },
    gear: function () {
      var s = surface(24, 24);
      s.circ(12, 12, 10, C.grayDk);
      s.circ(12, 12, 7, C.gray);
      s.circ(12, 12, 3, C.grayDk);
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        s.rect(12 + Math.cos(a) * 10 - 2, 12 + Math.sin(a) * 10 - 2, 4, 4, C.grayDk);
      }
      return s.cv;
    },
    confettiBit: function (col) {
      var s = surface(4, 6);
      s.rect(0, 0, 4, 6, col || C.pink);
      return s.cv;
    }
  };

  /* -------------------------------------------------------- ícones de HUD  */

  var ICONS = {
    iconStar: function () { return ITEMS.star(); },
    iconFriend: function () {
      var s = surface(14, 14);
      s.circ(7, 5, 4, '#c88a5a');
      s.circ(7, 3, 4, '#5a3418');
      s.px(5, 5, C.black).px(9, 5, C.black);
      s.poly([[2, 14], [12, 14], [10, 9], [4, 9]], C.yellow);
      return s.cv;
    },
    iconPaw: function () {
      var s = surface(14, 14);
      s.circ(7, 9, 4, C.brownLt);
      s.circ(3, 4, 2, C.brownLt);
      s.circ(7, 2, 2, C.brownLt);
      s.circ(11, 4, 2, C.brownLt);
      return s.cv;
    },
    iconToy: function () { return ITEMS.ball(); },
    iconCart: function () { return PROPS.cart(); }
  };

  /* ------------------------------------------------------------ registro   */

  var factories = {};
  var cache = {};

  function def(key, fn) { factories[key] = fn; }

  Object.keys(ITEMS).forEach(function (k) { def(k, ITEMS[k]); });
  Object.keys(PROPS).forEach(function (k) { def(k, PROPS[k]); });
  Object.keys(ICONS).forEach(function (k) { def(k, ICONS[k]); });
  Object.keys(VEHICLES).forEach(function (k) { def('vehicle:' + k, VEHICLES[k].build); });
  Object.keys(ANIMALS).forEach(function (k) { def('animal:' + k, function () { return buildAnimal(k); }); });

  def('kid', function (arg) {
    var parts = (arg || 'ravi').split(',');
    return buildKid(parts[0], parts[1]);
  });
  def('face', function (arg) { return buildFace(arg || 'ravi'); });
  def('balloon', function (arg) { return buildBalloon(arg || C.red); });
  def('bigcake', function (arg) { return buildBigCake(arg); });
  def('bigcakeout', function (arg) { return buildBigCakeOut(arg); });

  /**
   * Devolve { url, img, w, h } para uma chave de sprite.
   * Chaves paramétricas usam "nome:argumento" (ex.: "balloon:#ff0000").
   */
  function get(key) {
    if (cache[key]) return cache[key];

    var fn = factories[key];
    var arg = null;
    if (!fn) {
      var i = key.indexOf(':');
      if (i > 0) {
        fn = factories[key.slice(0, i)];
        arg = key.slice(i + 1);
      }
    }
    if (!fn) {
      console.warn('[Art] sprite desconhecido:', key);
      fn = function () { return surface(8, 8).rect(0, 0, 8, 8, C.pink).cv; };
    }

    var cv = fn(arg);
    var url = cv.toDataURL();
    var img = new Image();
    img.src = url;
    var rec = { url: url, img: img, w: cv.width, h: cv.height };
    cache[key] = rec;
    return rec;
  }

  /* ------------------------------------------------------------ cenários   */

  /* O canvas de fundo é 320x240 e sobe 2x na tela lógica de 640x480. */
  function skyDay(s, top, bottom) {
    s.rect(0, 0, 320, 150, top);
    s.dither(0, 96, 320, 30, bottom, 2);
    s.rect(0, 126, 320, 24, bottom);
  }

  var SCENES = {
    /* Quarto do Ravi na manhã do aniversário */
    bedroom: function (s) {
      s.rect(0, 0, 320, 240, '#7fc8d8');
      s.rect(0, 0, 320, 175, '#8ad4e4');
      for (var i = 0; i < 320; i += 24) s.rect(i, 0, 12, 175, '#7ac4d6');
      s.rect(0, 172, 320, 6, C.brownDk);
      s.rect(0, 178, 320, 62, '#b8864e');
      for (var j = 0; j < 320; j += 40) s.rect(j, 178, 2, 62, '#9a6c3a');
      /* janela com sol */
      s.rect(28, 30, 74, 62, C.white);
      s.rect(32, 34, 66, 54, '#bfe9ff');
      s.rect(63, 34, 4, 54, C.white);
      s.rect(32, 58, 66, 4, C.white);
      s.circ(84, 48, 9, C.yellow);
      s.rect(24, 26, 82, 6, '#e0c07a');
      /* cama */
      s.rect(196, 120, 108, 20, '#d84a6a');
      s.rect(196, 138, 108, 30, '#c03a58');
      s.rect(200, 108, 30, 16, C.white);
      s.rect(288, 96, 12, 76, C.brownDk);
      s.rect(192, 110, 10, 62, C.brownDk);
      /* tapete */
      s.ellipse(120, 214, 68, 16, '#e0a83a');
      s.ellipse(120, 214, 50, 11, '#f0c86a');
      s.ellipse(120, 214, 30, 6, '#e0a83a');
      /* pôster + caixa de brinquedos */
      s.rect(130, 34, 46, 38, C.cream);
      s.rect(134, 38, 38, 30, C.purple);
      s.circ(153, 53, 10, C.yellow);
      s.rect(0, 140, 40, 32, C.orange);
      s.rect(0, 140, 40, 4, '#ffb060');
    },

    /* Garagem: onde o veículo é escolhido */
    garage: function (s) {
      s.rect(0, 0, 320, 240, '#9aa0ac');
      s.rect(0, 0, 320, 40, '#6a707c');
      for (var i = 0; i < 320; i += 16) s.rect(i, 0, 8, 40, '#5c626e');
      s.rect(0, 40, 320, 4, C.grayDk);
      s.rect(0, 152, 320, 6, C.grayDk);
      s.rect(0, 158, 320, 82, '#7a808c');
      s.dither(0, 158, 320, 82, '#6a707c', 3);
      /* portão aberto */
      s.rect(20, 44, 120, 108, '#5c626e');
      s.rect(26, 50, 108, 96, '#3a4048');
      s.rect(26, 50, 108, 10, '#8ad4e4');
      /* bancada com ferramentas */
      s.rect(190, 96, 120, 8, C.brown);
      s.rect(190, 104, 120, 40, '#6a4a2a');
      s.rect(200, 76, 4, 20, C.grayDk);
      s.rect(214, 72, 4, 24, C.grayDk);
      s.rect(228, 80, 10, 16, C.red);
      s.rect(252, 74, 24, 22, C.yellow);
      s.rect(256, 78, 16, 6, C.white);
      /* mancha de óleo */
      s.ellipse(120, 210, 34, 8, '#5c626e');
    },

    /* Rua dos amigos */
    street: function (s) {
      skyDay(s, '#5ab4e8', '#a8dcf4');
      s.rect(0, 150, 320, 22, '#4fae3a');
      s.dither(0, 150, 320, 12, '#7fd85a', 2);
      s.rect(0, 172, 320, 40, '#8a8f9a');   /* asfalto */
      s.rect(0, 170, 320, 3, '#d8dae0');
      s.rect(0, 210, 320, 30, '#c8b48a');   /* calçada */
      s.rect(0, 208, 320, 3, '#e0d0a8');
      for (var i = 0; i < 320; i += 34) s.rect(i, 210, 2, 30, '#b09a72');
      for (var j = 8; j < 320; j += 48) s.rect(j, 190, 20, 3, C.white);
    },

    /* Parque dos animais */
    park: function (s) {
      skyDay(s, '#4fa8e8', '#b0e4f8');
      s.rect(0, 138, 320, 102, '#4fae3a');
      s.dither(0, 138, 320, 20, '#7fd85a', 2);
      s.dither(0, 190, 320, 50, '#3f9a2e', 3);
      /* lago */
      s.ellipse(258, 196, 58, 20, '#3f88b8');
      s.ellipse(258, 194, 50, 15, '#5aa8d8');
      s.ellipse(240, 190, 12, 4, '#8ac8e8');
      /* cerca */
      for (var i = 0; i < 320; i += 20) {
        s.rect(i, 120, 4, 24, C.brown);
        s.poly([[i, 120], [i + 4, 120], [i + 2, 116]], C.brownLt);
      }
      s.rect(0, 126, 320, 3, C.brownLt);
      s.rect(0, 136, 320, 3, C.brownLt);
      /* caminho de terra */
      s.ellipse(90, 224, 80, 14, '#c8a06a');
    },

    /* Mercado do Seu Zé */
    market: function (s) {
      s.rect(0, 0, 320, 240, '#e8dcc0');
      s.rect(0, 0, 320, 26, '#c8b48a');
      for (var i = 0; i < 320; i += 40) {
        s.rect(i + 6, 4, 28, 14, '#f4ecd8');
        s.rect(i + 6, 4, 28, 4, '#ffffff');
      }
      s.rect(0, 26, 320, 4, C.brownDk);
      /* piso xadrez */
      s.rect(0, 196, 320, 44, '#d8d2c4');
      for (var y = 0; y < 3; y++) {
        for (var x = 0; x < 20; x++) {
          if ((x + y) % 2 === 0) s.rect(x * 16, 196 + y * 15, 16, 15, '#b8b2a4');
        }
      }
      /* três prateleiras */
      [70, 122, 174].forEach(function (sy) {
        s.rect(14, sy, 292, 6, C.brownDk);
        s.rect(14, sy, 292, 2, C.brownLt);
        s.rect(14, sy + 6, 292, 3, 'rgba(0,0,0,0.22)');
      });
      s.rect(10, 40, 6, 160, '#6a4a2a');
      s.rect(304, 40, 6, 160, '#6a4a2a');
      /* caixa registradora ao fundo */
      s.rect(236, 30, 70, 34, '#a8703a');
      s.rect(240, 34, 62, 26, '#c8a06a');
    },

    /* Fábrica de brinquedos */
    factory: function (s) {
      s.rect(0, 0, 320, 240, '#5c626e');
      s.rect(0, 0, 320, 120, '#4c525e');
      /* telhado dentado com claraboias */
      for (var i = 0; i < 6; i++) {
        s.poly([[i * 56, 34], [i * 56 + 28, 6], [i * 56 + 56, 34]], '#3a404a');
        s.poly([[i * 56 + 6, 32], [i * 56 + 28, 12], [i * 56 + 30, 32]], '#7fa8d8');
      }
      s.rect(0, 34, 320, 4, '#2a3038');
      /* canos */
      s.rect(0, 46, 320, 8, '#7a808c');
      s.rect(0, 46, 320, 2, '#9aa0ac');
      for (var j = 20; j < 320; j += 60) s.rect(j, 44, 8, 12, '#5c626e');
      /* parede + azulejo */
      s.rect(0, 60, 320, 100, '#6a707c');
      s.dither(0, 60, 320, 100, '#767c88', 3);
      /* chão */
      s.rect(0, 190, 320, 50, '#4c525e');
      s.rect(0, 188, 320, 3, '#8a909c');
      for (var k = 0; k < 320; k += 24) s.rect(k, 190, 2, 50, '#3f444e');
      /* faixa de alerta */
      s.rect(0, 182, 320, 6, C.yellow);
      for (var m = 0; m < 320; m += 12) s.poly([[m, 182], [m + 6, 182], [m, 188]], C.black);
    },

    /* Salão da festa */
    hall: function (s) {
      s.rect(0, 0, 320, 240, '#f0c8e0');
      s.rect(0, 0, 320, 168, '#f8d8ea');
      for (var i = 0; i < 320; i += 32) {
        s.rect(i, 0, 16, 168, '#f0c0dc');
      }
      s.rect(0, 100, 320, 4, C.pink);
      s.rect(0, 166, 320, 5, '#c08aa8');
      s.rect(0, 171, 320, 69, '#c8a06a');
      for (var j = 0; j < 320; j += 28) s.rect(j, 171, 2, 69, '#a8804a');
      s.dither(0, 200, 320, 40, '#b8905a', 4);
      /* janelas laterais */
      s.rect(16, 40, 44, 44, C.white);
      s.rect(20, 44, 36, 36, '#bfe9ff');
      s.rect(260, 40, 44, 44, C.white);
      s.rect(264, 44, 36, 36, '#bfe9ff');
    },

    /* Festa acontecendo: mesmo salão, luzes baixas e brilho */
    party: function (s) {
      SCENES.hall(s);
      s.rect(0, 0, 320, 240, 'rgba(40,10,60,0.28)');
      /* holofotes */
      s.poly([[40, 0], [90, 0], [130, 170], [10, 170]], 'rgba(255,220,120,0.20)');
      s.poly([[230, 0], [280, 0], [310, 170], [190, 170]], 'rgba(120,200,255,0.20)');
      /* globo espelhado */
      s.circ(160, 22, 14, C.silver);
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < 6; j++) {
          if ((i + j) % 2) s.rect(148 + i * 4, 10 + j * 4, 4, 4, '#eef2ff');
        }
      }
      s.rect(159, 0, 2, 8, C.grayDk);
    },

    /* Estrada usada nas viagens entre cenários */
    road: function (s) {
      skyDay(s, '#4fa8e8', '#b0e4f8');
      s.rect(0, 150, 320, 26, '#4fae3a');
      s.dither(0, 150, 320, 14, '#7fd85a', 2);
      s.rect(0, 176, 320, 64, '#8a8f9a');
      s.rect(0, 174, 320, 3, '#d8dae0');
      s.dither(0, 200, 320, 40, '#7a808c', 4);
    }
  };

  function paint(ctx, sceneName) {
    var s = {
      rect: function (x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); return s; },
      px: function (x, y, col) { return s.rect(x, y, 1, 1, col); },
      circ: function (cx, cy, r, col) {
        ctx.fillStyle = col;
        for (var dy = -r; dy <= r; dy++) {
          var dx = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
          ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
        }
        return s;
      },
      ellipse: function (cx, cy, rx, ry, col) {
        ctx.fillStyle = col;
        for (var dy = -ry; dy <= ry; dy++) {
          var t = 1 - (dy * dy) / (ry * ry);
          if (t < 0) continue;
          var dx = Math.round(rx * Math.sqrt(t));
          ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
        }
        return s;
      },
      poly: function (pts, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fill();
        return s;
      },
      line: function (x0, y0, x1, y1, col) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        var err = dx + dy;
        ctx.fillStyle = col;
        for (;;) {
          ctx.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          var e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return s;
      },
      dither: function (x, y, w, h, col, step) {
        step = step || 2;
        ctx.fillStyle = col;
        for (var yy = 0; yy < h; yy++) {
          for (var xx = 0; xx < w; xx++) {
            if (((x + xx) + (y + yy)) % step === 0) ctx.fillRect(x + xx, y + yy, 1, 1);
          }
        }
        return s;
      }
    };

    ctx.clearRect(0, 0, 320, 240);
    (SCENES[sceneName] || SCENES.street)(s);
  }

  /* --------------------------------------------------------------- público */

  return {
    C: C,
    KIDS: KIDS,
    ANIMALS: ANIMALS,
    VEHICLES: VEHICLES,
    get: get,
    paint: paint,
    surface: surface
  };
})();
