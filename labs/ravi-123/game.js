/* ==========================================================================
   Ravi 1·2·3: A Grande Festa Surpresa
   --------------------------------------------------------------------------
   Aventura point-and-click no molde dos CD-ROMs educativos de 1991: cada
   fase esconde um exercício de contagem, e a resposta certa faz a história
   andar. O jogo inteiro roda num espaço lógico de 640x480.
   ========================================================================== */

(function () {
  'use strict';

  var W = 640, H = 480;
  var SCALE = 2;              /* 1 pixel de arte = 2 pixels lógicos */
  var GROUND = 424;           /* linha do chão na cena de viagem */

  var screenEl, bgCanvas, bgCtx, worldEl, fxEl, uiEl, viewportEl, ledEl;

  /* ------------------------------------------------------------- estado    */

  var S = null;

  function freshState() {
    return {
      age: 5,
      vehicle: 'bike',
      friends: [],
      animals: [],
      cart: {},
      price: 0,
      toys: 0,
      balloons: 0,
      candles: 0,
      stars: 0,
      mistakes: 0,
      visited: {}
    };
  }

  function guests() {
    return S.friends.length + S.animals.length;
  }

  function vehicle() {
    return Art.VEHICLES[S.vehicle];
  }

  /* --------------------------------------------------------- utilidades    */

  var timers = [];
  var rafId = null;
  var listeners = [];

  /** Listener com escopo de cena — removido automaticamente na troca. */
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
    return fn;
  }

  function clearListeners() {
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    listeners = [];
  }

  function later(fn, ms) {
    var id = setTimeout(function () {
      timers.splice(timers.indexOf(id), 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function startLoop(fn) {
    stopLoop();
    var last = performance.now();
    var step = function (now) {
      var dt = Math.min(50, now - last) / 16.6667;   /* em "frames de 60fps" */
      last = now;
      /* Agenda antes de rodar o callback: se o callback trocar de cena,
         o stopLoop() de dentro dele cancela este handle e o loop morre
         de verdade — em vez de se reagendar depois e reentrar na cena. */
      rafId = requestAnimationFrame(step);
      fn(dt);
    };
    rafId = requestAnimationFrame(step);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function E(tag, cls, parent, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }

  function css(el, styles) {
    Object.keys(styles).forEach(function (k) { el.style[k] = styles[k]; });
    return el;
  }

  /**
   * Coloca um sprite na tela.
   * y é o topo por padrão; opts.anchor 'bottom' ou 'center' muda a âncora.
   */
  function place(key, x, y, opts) {
    opts = opts || {};
    var art = Art.get(key);
    var sc = opts.scale || SCALE;
    var w = art.w * sc, h = art.h * sc;
    var el = E('div', 'spr' + (opts.cls ? ' ' + opts.cls : ''), opts.parent || worldEl);
    el.style.backgroundImage = 'url(' + art.url + ')';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    var top = y, left = x;
    if (opts.anchor === 'bottom') top = y - h;
    else if (opts.anchor === 'center') { top = y - h / 2; left = x - w / 2; }
    else if (opts.anchor === 'bottomcenter') { top = y - h; left = x - w / 2; }
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    if (opts.z !== undefined) el.style.zIndex = opts.z;
    el.dataset.w = w;
    el.dataset.h = h;
    if (opts.onClick) {
      el.classList.add('clickable');
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        opts.onClick(el, ev);
      });
    }
    return el;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function paintBg(name) {
    Art.paint(bgCtx, name);
  }

  /* ------------------------------------------------------------- diálogo   */

  var speechBusy = false;

  /** Corta HTML sem deixar uma tag pela metade durante a máquina de escrever. */
  function safeSlice(html, n) {
    var out = html.slice(0, n);
    var open = out.lastIndexOf('<');
    if (open > out.lastIndexOf('>')) out = out.slice(0, open);
    return out;
  }

  /**
   * Mostra falas em sequência. `lines` é uma lista de strings ou
   * { who:'ravi'|'bia'|..., text:'...' }. Resolve quando a última é fechada.
   */
  function say(lines, done) {
    if (!Array.isArray(lines)) lines = [lines];
    var i = 0;
    var box = E('div', 'speech', uiEl);
    var face = E('div', 'speech-face', box);
    var textEl = E('div', 'speech-text', box);
    var next = E('div', 'speech-next', box, '▼ clique');
    var typer = null;
    var full = '';
    speechBusy = true;

    function render() {
      var line = lines[i];
      var who = 'ravi', txt = line;
      if (typeof line === 'object') { who = line.who || 'ravi'; txt = line.text; }
      face.style.backgroundImage = 'url(' + Art.get('face:' + who).url + ')';
      full = txt;
      textEl.innerHTML = '';
      var n = 0;
      clearInterval(typer);
      typer = setInterval(function () {
        n += 2;
        textEl.innerHTML = safeSlice(full, n);
        if (n >= full.length) {
          clearInterval(typer);
          typer = null;
          textEl.innerHTML = full;
        }
      }, 16);
    }

    function advance() {
      if (typer) {                       /* primeiro clique completa o texto */
        clearInterval(typer);
        typer = null;
        textEl.innerHTML = full;
        return;
      }
      i++;
      Sfx.play('click');
      if (i >= lines.length) {
        box.remove();
        speechBusy = false;
        if (done) done();
      } else {
        render();
      }
    }

    box.addEventListener('click', advance);
    box.style.cursor = 'pointer';
    render();
    return box;
  }

  /* --------------------------------------------------------------- HUD     */

  function buildHud(opts) {
    opts = opts || {};
    var hud = E('div', 'hud', uiEl);

    function item(icon, value, id) {
      var wrap = E('div', 'hud-item', hud);
      var ic = E('div', 'hud-icon', wrap);
      ic.style.backgroundImage = 'url(' + Art.get(icon).url + ')';
      var v = E('span', null, wrap, value);
      v.id = id;
      return v;
    }

    item('iconStar', String(S.stars), 'hudStars');
    item('iconFriend', S.friends.length + '/5', 'hudFriends');
    item('iconPaw', S.animals.length + '/5', 'hudAnimals');
    if (opts.toys) item('iconToy', S.toys + '/' + guests(), 'hudToys');

    E('div', 'hud-spacer', hud);

    var sound = E('button', 'hud-btn' + (Sfx.isMuted() ? ' off' : ''), hud, Sfx.isMuted() ? '♪ OFF' : '♪ ON');
    sound.addEventListener('click', function () {
      var m = Sfx.setMuted(!Sfx.isMuted());
      sound.textContent = m ? '♪ OFF' : '♪ ON';
      sound.classList.toggle('off', m);
      if (!m) Sfx.play('click');
    });

    var menu = E('button', 'hud-btn', hud, 'MENU');
    menu.addEventListener('click', openMenu);

    return hud;
  }

  function refreshHud() {
    var st = document.getElementById('hudStars');
    if (st) st.textContent = String(S.stars);
    var fr = document.getElementById('hudFriends');
    if (fr) fr.textContent = S.friends.length + '/5';
    var an = document.getElementById('hudAnimals');
    if (an) an.textContent = S.animals.length + '/5';
    var ty = document.getElementById('hudToys');
    if (ty) ty.textContent = S.toys + '/' + guests();
  }

  function sceneTitle(text) {
    return E('div', 'scene-title', uiEl, text);
  }

  /* ------------------------------------------------- feedback (toast/star) */

  function toast(text, kind, ms) {
    var t = E('div', 'toast' + (kind ? ' ' + kind : ''), uiEl, text);
    later(function () { t.remove(); }, ms || 1200);
    return t;
  }

  function awardStar(fromX, fromY, n) {
    n = n || 1;
    S.stars += n;
    refreshHud();
    Sfx.play('star');
    for (var i = 0; i < n; i++) {
      (function (k) {
        later(function () {
          var el = E('div', 'star-fly', fxEl);
          el.style.backgroundImage = 'url(' + Art.get('star').url + ')';
          el.style.left = (fromX + randInt(-14, 14)) + 'px';
          el.style.top = (fromY + randInt(-10, 10)) + 'px';
          requestAnimationFrame(function () {
            el.style.transform = 'translate(' + (18 - fromX) + 'px,' + (14 - fromY) + 'px) scale(.5)';
            el.style.opacity = '0';
          });
          later(function () { el.remove(); }, 700);
        }, k * 90);
      })(i);
    }
  }

  function confettiBurst(count, host) {
    var cols = [Art.C.red, Art.C.yellow, Art.C.green, Art.C.blue, Art.C.pink, Art.C.cyan, Art.C.orange];
    for (var i = 0; i < count; i++) {
      var bit = E('div', 'confetti', host || fxEl);
      bit.style.background = cols[i % cols.length];
      bit.style.left = randInt(0, W) + 'px';
      bit.style.top = '-20px';
      bit.style.animation = 'confetti-fall ' + (1.6 + Math.random() * 1.8).toFixed(2) + 's linear ' +
        (Math.random() * 1.4).toFixed(2) + 's forwards';
    }
  }

  /* ------------------------------------------------------- painel numérico */

  /**
   * O exercício central do jogo: mostrar N objetos e perguntar quantos são.
   * Erros nunca punem de verdade — só oferecem uma contagem guiada.
   */
  function countChallenge(cfg) {
    var panel = E('div', 'panel', uiEl);
    css(panel, {
      left: '50%', top: '68px', transform: 'translateX(-50%)',
      width: '470px', textAlign: 'center'
    });

    var q = E('div', null, panel, cfg.question);
    css(q, {
      fontFamily: "'Press Start 2P', monospace", fontSize: '11px',
      color: '#241a08', lineHeight: '1.7', marginBottom: '12px'
    });

    var tray = E('div', null, panel);
    css(tray, {
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      alignItems: 'flex-end', gap: '8px', minHeight: '76px', marginBottom: '14px',
      padding: '8px', background: '#fffdf4', border: '3px solid #c9a24a'
    });

    var marks = [];
    for (var i = 0; i < cfg.answer; i++) {
      var art = Art.get(cfg.item);
      var d = E('div', 'spr', tray);
      css(d, {
        position: 'relative',
        width: (art.w * 2) + 'px',
        height: (art.h * 2) + 'px',
        backgroundImage: 'url(' + art.url + ')'
      });
      marks.push(d);
    }

    var pad = E('div', 'numpad', panel);
    var keys = [];
    var maxKey = Math.max(5, Math.min(9, cfg.answer + randInt(1, 3)));
    if (maxKey < cfg.answer) maxKey = cfg.answer;

    for (var n = 1; n <= maxKey; n++) {
      (function (value) {
        var k = E('button', 'num-key', pad, String(value));
        k.type = 'button';
        k.addEventListener('click', function () { pick(value, k); });
        keys.push(k);
      })(n);
    }

    var locked = false;

    function pick(value, keyEl) {
      if (locked) return;
      if (value === cfg.answer) {
        locked = true;
        keyEl.classList.add('right');
        Sfx.play('good');
        keys.forEach(function (k) { k.disabled = true; });
        later(function () {
          panel.remove();
          cfg.onCorrect();
        }, 700);
      } else {
        S.mistakes++;
        keyEl.classList.add('wrong');
        keyEl.disabled = true;
        Sfx.play('bad');
        toast('Quase! Vamos contar juntos…', 'bad', 1100);
        countAloud();
      }
    }

    /* Contagem guiada: pula um objeto por vez dizendo o número. */
    function countAloud() {
      locked = true;
      marks.forEach(function (m, idx) {
        later(function () {
          m.classList.add('anim-hop');
          var tag = E('div', null, m, String(idx + 1));
          css(tag, {
            position: 'absolute', left: '50%', top: '-22px', transform: 'translateX(-50%)',
            fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#d81e26'
          });
          Sfx.tone(440 + idx * 60, 0, 0.09, { vol: 0.5 });
          later(function () {
            m.classList.remove('anim-hop');
            tag.remove();
          }, 520);
        }, idx * 300);
      });
      later(function () { locked = false; }, marks.length * 300 + 300);
    }

    if (cfg.onReady) cfg.onReady(panel);
    return panel;
  }

  /* ------------------------------------------------------------ menu/ajuda */

  function modal(title, bodyFn, actions) {
    var back = E('div', 'modal-back', uiEl);
    var box = E('div', 'modal', back);
    E('h2', null, box, title);
    bodyFn(box);
    var row = E('div', 'modal-actions', box);
    actions.forEach(function (a) {
      var b = E('button', 'btn ' + (a.cls || ''), row, a.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        Sfx.play('click');
        back.remove();
        if (a.onClick) a.onClick();
      });
    });
    return back;
  }

  function openHelp(after) {
    modal('COMO SE JOGA', function (box) {
      var ul = E('ul', null, box);
      [
        'Clique em tudo que parecer interessante — casas, bichos, prateleiras e brinquedos.',
        'Sempre que aparecerem números, conte os objetos na tela e clique no número certo.',
        'Errar não tira nada de você: o jogo conta junto com você e deixa tentar de novo.',
        'Cada acerto vale uma estrelinha ⭐. Quanto mais estrelinhas, melhor a festa.',
        'Use as teclas 1 a 9 para responder rápido e Esc para abrir o menu.'
      ].forEach(function (t) { E('li', null, ul, t); });
    }, [{ label: 'ENTENDI', cls: 'green', onClick: after }]);
  }

  function openMenu() {
    if (document.querySelector('.modal-back')) return;
    modal('MENU', function (box) {
      E('p', null, box, 'Estrelinhas: ' + S.stars + '  ·  Convidados: ' + guests());
      E('p', null, box, 'Veículo: ' + vehicle().name);
    }, [
      { label: 'VOLTAR', cls: 'green' },
      { label: 'COMO JOGA', cls: 'blue', onClick: function () { openHelp(); } },
      {
        label: 'RECOMEÇAR', cls: 'red', onClick: function () {
          S = freshState();
          go('title');
        }
      }
    ]);
  }

  /* ============================================================== CENAS === */

  var Scenes = {};

  function go(name, arg) {
    clearTimers();
    stopLoop();
    Sfx.stopLoop();
    clearListeners();
    worldEl.innerHTML = '';
    fxEl.innerHTML = '';
    uiEl.innerHTML = '';
    speechBusy = false;
    Scenes[name](arg);
  }

  /* ------------------------------------------------------------- 0. BOOT   */

  Scenes.boot = function () {
    paintBg('bedroom');
    bgCtx.fillStyle = '#000';
    bgCtx.fillRect(0, 0, 320, 240);

    var boot = E('div', 'boot', uiEl);
    var lines = [
      '<span class="white">RaviVision BIOS v1.23</span>',
      'Memoria base 640K ..... OK',
      'Memoria estendida 3072K .. OK',
      '',
      'Iniciando MS-DOS 5.0',
      '',
      '<span class="amber">C:\\JOGOS\\RAVI123&gt; ravi123.exe</span>',
      '',
      'Modo grafico .. VGA 320x200, 256 cores',
      'Som ........... PC Speaker',
      'Idioma ........ Portugues (Brasil)',
      ''
    ];

    var idx = 0;
    var barWrap = null, bar = null;

    function nextLine() {
      if (idx < lines.length) {
        var p = E('div', null, boot);
        p.innerHTML = lines[idx] || '&nbsp;';
        if (lines[idx]) Sfx.tone(1200, 0, 0.012, { vol: 0.18 });
        idx++;
        later(nextLine, 105);
      } else {
        var row = E('div', null, boot);
        row.innerHTML = '<span class="green">Carregando</span>';
        barWrap = E('span', 'boot-bar', row);
        bar = E('span', null, barWrap);
        fillBar(0);
      }
    }

    function fillBar(pct) {
      bar.style.width = pct + '%';
      if (pct % 20 === 0) Sfx.tone(600 + pct * 6, 0, 0.02, { vol: 0.2 });
      if (pct < 100) {
        later(function () { fillBar(pct + 4); }, 34);
      } else {
        var done = E('div', null, boot);
        done.innerHTML = '<span class="green">Pronto! Boa festa.</span> <span class="cursor">_</span>';
        Sfx.play('boot');
        if (ledEl) ledEl.classList.add('on');
        later(function () { go('title'); }, 900);
      }
    }

    boot.addEventListener('click', function () { go('title'); });
    later(nextLine, 260);
  };

  /* ------------------------------------------------------------ 1. TÍTULO  */

  Scenes.title = function () {
    paintBg('hall');
    if (ledEl) ledEl.classList.add('on');

    /* Decoração do menu: tudo abaixo de y=390 para não brigar com os botões. */
    var colors = [Art.C.red, Art.C.yellow, Art.C.cyan, Art.C.pink, Art.C.green, Art.C.purple];
    [30, 96, 544, 610].forEach(function (x, i) {
      var b = place('balloon:' + colors[i % colors.length], x, 330, { anchor: 'bottom', cls: 'anim-bob' });
      b.style.animationDelay = (i * 0.22) + 's';
    });
    place('table', 320, 478, { anchor: 'bottomcenter' });
    place('bigcake:5', 320, 470, { anchor: 'bottomcenter', z: 2 });
    place('kid:ravi,cheer', 150, 474, { anchor: 'bottomcenter', cls: 'anim-hop', scale: 3 });
    place('animal:dog', 496, 474, { anchor: 'bottomcenter', cls: 'anim-bob', scale: 2.6 });

    var logo = E('div', 'title-logo', uiEl);
    E('div', 'title-main', logo, 'RAVI 1·2·3');
    E('div', 'title-sub', logo, 'A GRANDE FESTA SURPRESA');
    E('div', 'title-badge', logo, 'CD-ROM · 1991 · VGA');

    var menu = E('div', 'title-menu', uiEl);

    var start = E('button', 'btn green', menu, '▶  COMEÇAR A FESTA');
    start.type = 'button';
    start.addEventListener('click', function () {
      Sfx.init();
      Sfx.play('click');
      S = freshState();
      go('age');
    });

    var help = E('button', 'btn blue', menu, '?  COMO SE JOGA');
    help.type = 'button';
    help.addEventListener('click', function () {
      Sfx.init();
      Sfx.play('click');
      openHelp();
    });

    var sound = E('button', 'btn', menu, Sfx.isMuted() ? '♪  SOM: DESLIGADO' : '♪  SOM: LIGADO');
    sound.type = 'button';
    sound.addEventListener('click', function () {
      Sfx.init();
      var m = Sfx.setMuted(!Sfx.isMuted());
      sound.textContent = m ? '♪  SOM: DESLIGADO' : '♪  SOM: LIGADO';
      if (!m) { Sfx.play('click'); Sfx.loop('title', { vol: 0.4 }); }
    });

    var best = 0;
    try { best = parseInt(localStorage.getItem('ravi123.best') || '0', 10) || 0; } catch (e) { }
    E('div', 'title-foot', uiEl, best
      ? 'Recorde da casa: ' + best + ' estrelinhas ★'
      : 'Um jogo de contar, convidar e comemorar');

    confettiBurst(14);

    /* A música só entra depois do primeiro gesto — regra de autoplay. */
    var kick = function () {
      Sfx.init();
      Sfx.loop('title', { vol: 0.4 });
      screenEl.removeEventListener('pointerdown', kick);
    };
    screenEl.addEventListener('pointerdown', kick);
  };

  /* --------------------------------------------------------- 2. QUANTOS?   */

  Scenes.age = function () {
    paintBg('bedroom');
    buildHud();
    sceneTitle('O QUARTO DO RAVI');

    place('kid:ravi', 120, 400, { anchor: 'bottomcenter', cls: 'anim-bob' });
    place('bigcake:0', 330, 396, { anchor: 'bottomcenter' });

    say([
      'Bom diaaa! Hoje é <b>o meu aniversário</b>!',
      'Eu sou o <b>Ravi</b>, esse do cabelo cacheado. Hoje eu vou fazer a maior festa do bairro.',
      'Primeiro me diz uma coisa… <b>quantos anos eu faço hoje?</b>'
    ], function () {
      var panel = E('div', 'panel', uiEl);
      css(panel, { left: '50%', bottom: '24px', transform: 'translateX(-50%)', textAlign: 'center' });
      var t = E('div', null, panel, 'CLIQUE NA IDADE DO RAVI');
      css(t, {
        fontFamily: "'Press Start 2P', monospace", fontSize: '11px',
        color: '#241a08', marginBottom: '12px'
      });
      var pad = E('div', 'numpad', panel);

      for (var n = 1; n <= 9; n++) {
        (function (value) {
          var k = E('button', 'num-key', pad, String(value));
          k.type = 'button';
          k.addEventListener('click', function () { choose(value); });
        })(n);
      }

      function choose(value) {
        S.age = value;
        Sfx.play('great');
        panel.remove();
        worldEl.innerHTML = '';
        place('kid:ravi,cheer', 120, 400, { anchor: 'bottomcenter', cls: 'anim-hop' });
        place('bigcake:' + value, 330, 396, { anchor: 'bottomcenter' });
        confettiBurst(20);
        say([
          '<b>' + value + ' anos!</b> Olha só o bolo com ' + value +
          (value === 1 ? ' velinha' : ' velinhas') + '.',
          'Agora eu preciso de um <b>veículo</b> pra buscar todo mundo. Vamos na garagem!'
        ], function () { go('garage'); });
      }

      on(window, 'keydown', function (ev) {
        var n = parseInt(ev.key, 10);
        if (n >= 1 && n <= 9) choose(n);
      });
    });
  };

  /* --------------------------------------------------------- 3. GARAGEM    */

  Scenes.garage = function () {
    paintBg('garage');
    buildHud();
    sceneTitle('A GARAGEM');

    place('kid:ravi', 60, 470, { anchor: 'bottomcenter', cls: 'anim-bob' });

    var chosen = null;
    var grid = E('div', 'choice-grid', uiEl);
    css(grid, { top: '86px', width: '600px' });

    Object.keys(Art.VEHICLES).forEach(function (id) {
      var v = Art.VEHICLES[id];
      var card = E('div', 'choice', grid);
      var art = E('div', 'choice-art', card);
      art.style.backgroundImage = 'url(' + Art.get('vehicle:' + id).url + ')';
      E('div', 'choice-name', card, v.name);

      var stats = E('div', 'choice-stats', card);
      pips(stats, 'lugares', v.seats, 5, 'seats');
      pips(stats, 'veloc.', v.speed, 5, '');

      card.addEventListener('click', function () {
        Sfx.play('click');
        Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        chosen = id;
        okBtn.disabled = false;
        hint.textContent = v.desc + ' · leva ' + v.seats + ' convidados por viagem';
      });
    });

    function pips(host, label, value, max, cls) {
      var row = E('div', 'stat-row', host);
      E('span', 'stat-label', row, label);
      var bar = E('div', 'stat-bar', row);
      for (var i = 0; i < max; i++) {
        E('div', 'stat-pip' + (i < value ? ' on ' + cls : ''), bar);
      }
    }

    var hint = E('div', null, uiEl, 'Escolha o veículo da festa');
    css(hint, {
      position: 'absolute', left: '0', right: '0', bottom: '76px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '24px', color: '#fff',
      textShadow: '2px 2px 0 #101018'
    });

    var okBtn = E('button', 'btn green', uiEl, 'VAMOS NESSA!');
    okBtn.type = 'button';
    okBtn.disabled = true;
    css(okBtn, { position: 'absolute', left: '50%', bottom: '20px', transform: 'translateX(-50%)' });
    okBtn.addEventListener('click', function () {
      if (!chosen) return;
      S.vehicle = chosen;
      Sfx.play('engine');
      go('drive', { to: 'street', label: 'RUA DOS AMIGOS' });
    });
  };

  /* ------------------------------------------------------- 4. VIAGEM       */

  /**
   * Cena de ligação reaproveitada entre todos os cenários. O veículo
   * escolhido muda a velocidade e quantas estrelinhas cabem no porta-malas.
   */
  Scenes.drive = function (arg) {
    arg = arg || { to: 'street', label: 'RUA DOS AMIGOS' };
    paintBg('road');
    buildHud();
    sceneTitle('A CAMINHO: ' + arg.label);

    var v = vehicle();
    var speed = 2.2 + v.speed * 0.62;
    var capacity = v.seats + 2;
    var collected = 0;
    var progress = 0;
    var distance = 1400;

    var counter = E('div', 'counter', uiEl);
    css(counter, { left: '50%', top: '86px', transform: 'translateX(-50%)' });
    var cIcon = E('span', null, counter, '★');
    var cText = E('span', null, counter);
    cText.innerHTML = '0<span class="goal">/' + capacity + '</span>';

    /* Barra de progresso da viagem */
    var track = E('div', null, uiEl);
    css(track, {
      position: 'absolute', left: '90px', right: '90px', top: '128px', height: '16px',
      background: '#101018', border: '3px solid #f4ecd8', boxShadow: '3px 3px 0 rgba(0,0,0,.4)'
    });
    var fill = E('div', null, track);
    css(fill, { height: '100%', width: '0%', background: Art.C.green });

    var hintEl = E('div', null, uiEl, 'CLIQUE ou ESPAÇO para pular');
    css(hintEl, {
      position: 'absolute', left: '0', right: '0', bottom: '14px', textAlign: 'center',
      fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: '#fff',
      textShadow: '2px 2px 0 #101018'
    });

    /* Veículo + Ravi */
    var rig = E('div', null, worldEl);
    css(rig, { position: 'absolute', left: '80px', top: '0px', width: '120px', height: '120px' });
    var vArt = Art.get('vehicle:' + S.vehicle);
    var vEl = E('div', 'spr', rig);
    css(vEl, {
      width: (vArt.w * SCALE) + 'px', height: (vArt.h * SCALE) + 'px',
      backgroundImage: 'url(' + vArt.url + ')', left: '0px', bottom: '0px', top: 'auto'
    });
    var kArt = Art.get('kid:ravi');
    var kEl = E('div', 'spr', rig);
    css(kEl, {
      width: (kArt.w * SCALE) + 'px', height: (kArt.h * SCALE) + 'px',
      backgroundImage: 'url(' + kArt.url + ')',
      left: (vArt.w * SCALE / 2 - kArt.w) + 'px',
      bottom: (vArt.h * SCALE - 14) + 'px', top: 'auto'
    });
    var rigH = vArt.h * SCALE + kArt.h * SCALE - 14;
    css(rig, { height: rigH + 'px' });

    var y = 0, vy = 0, onGround = true;
    var props = [];
    var things = [];
    var spawnT = 0;
    var bump = 0;

    /* Cenário de rolagem */
    for (var i = 0; i < 5; i++) {
      props.push(makeProp(i % 2 ? 'tree' : 'bush', 120 + i * 180));
    }
    for (var c = 0; c < 3; c++) {
      props.push(makeProp('cloud', 100 + c * 240, true));
    }

    function makeProp(key, x, isCloud) {
      var el = place(key, x, isCloud ? 60 : 316, { anchor: isCloud ? undefined : 'bottom' });
      return { el: el, x: x, key: key, cloud: !!isCloud, w: parseFloat(el.dataset.w) };
    }

    function spawnThing() {
      var isStar = Math.random() < 0.62;
      var key = isStar ? 'star' : 'scrap';   /* peça caída na pista */
      var x = W + 40;
      var yPos = isStar ? GROUND - randInt(40, 110) : GROUND;
      var el = place(key, x, yPos, { anchor: 'bottom' });
      things.push({
        el: el, x: x, y: yPos, star: isStar,
        w: parseFloat(el.dataset.w), h: parseFloat(el.dataset.h)
      });
    }

    function jump() {
      if (!onGround) return;
      onGround = false;
      vy = -13.5;
      Sfx.play('pop');
    }

    on(screenEl, 'pointerdown', function () { jump(); });
    on(window, 'keydown', function (ev) {
      if (ev.code === 'Space' || ev.code === 'ArrowUp') {
        ev.preventDefault();
        jump();
      }
    });

    startLoop(function (dt) {
      progress += speed * dt;
      fill.style.width = Math.min(100, progress / distance * 100) + '%';

      /* física do pulo */
      if (!onGround) {
        vy += 0.78 * dt;
        y += vy * dt;
        if (y >= 0) { y = 0; vy = 0; onGround = true; }
      }
      if (bump > 0) bump -= dt;
      rig.style.transform = 'translateY(' + (y + (bump > 0 ? Math.sin(bump * 6) * 3 : 0)) + 'px)';
      rig.style.top = (GROUND - rigH) + 'px';

      /* cenário */
      props.forEach(function (p) {
        p.x -= speed * dt * (p.cloud ? 0.28 : 1);
        if (p.x < -p.w - 20) p.x = W + randInt(20, 260);
        p.el.style.left = Math.round(p.x) + 'px';
      });

      /* coletáveis e obstáculos */
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnThing();
        spawnT = randInt(26, 52) / (0.7 + v.speed * 0.12);
      }

      var rigLeft = 80, rigRight = 80 + vArt.w * SCALE;
      var rigTop = GROUND - rigH + y, rigBottom = GROUND + y;

      for (var i = things.length - 1; i >= 0; i--) {
        var t = things[i];
        t.x -= speed * dt;
        t.el.style.left = Math.round(t.x) + 'px';

        var hit = t.x < rigRight && t.x + t.w > rigLeft &&
          (t.y - t.h) < rigBottom && t.y > rigTop;

        if (hit) {
          if (t.star) {
            if (collected < capacity) {
              collected++;
              S.stars++;
              refreshHud();
              cText.innerHTML = collected + '<span class="goal">/' + capacity + '</span>';
              Sfx.play('coin');
            } else {
              Sfx.play('drop');
            }
          } else {
            bump = 3;
            Sfx.play('drop');
            if (S.stars > 0) { S.stars--; refreshHud(); }
            toast('Ops! Buraco na estrada', 'bad', 700);
          }
          t.el.remove();
          things.splice(i, 1);
          continue;
        }

        if (t.x < -60) {
          t.el.remove();
          things.splice(i, 1);
        }
      }

      if (progress >= distance) {
        stopLoop();
        Sfx.play('whoosh');
        go(arg.to);
      }
    });
  };

  /* --------------------------------------------------------- 5. AMIGOS     */

  var FRIEND_ORDER = ['bia', 'leo', 'manu', 'teo', 'nina'];
  var HOUSE_COLORS = ['blue', 'yellow', 'green', 'pink', 'purple'];
  var WINDOW_ITEMS = ['balloon:' + Art.C.red, 'star', 'heart', 'gift', 'note'];

  Scenes.street = function () {
    paintBg('street');
    buildHud();
    sceneTitle('A RUA DOS AMIGOS');

    var houses = [];
    FRIEND_ORDER.forEach(function (id, i) {
      var x = 14 + i * 125;
      var h = place('house:' + HOUSE_COLORS[i], x, 330, {
        anchor: 'bottom',
        onClick: function () { knock(id, i, x); }
      });
      houses.push(h);

      if (S.friends.indexOf(id) < 0) {
        var mark = place('marker', x + 52, 222, { anchor: 'bottomcenter', scale: 1.6, cls: 'anim-bob' });
        mark.dataset.house = id;
      }
    });

    /* Ravi e o veículo estacionado com quem já embarcou */
    place('kid:ravi', 240, 438, { anchor: 'bottomcenter', cls: 'anim-bob', z: 6 });
    drawParked(310, 438);

    var busy = false;

    function knock(id, index, x) {
      if (busy || speechBusy) return;
      if (S.friends.indexOf(id) >= 0) {
        say([{ who: id, text: 'Já tô no carro, Ravi! Bora buscar os outros!' }]);
        return;
      }
      busy = true;
      Sfx.play('doorbell');

      var kid = Art.KIDS[id];
      var answer = randInt(2, 7);
      var item = WINDOW_ITEMS[index % WINDOW_ITEMS.length];

      say([
        { who: 'ravi', text: 'Dlin-dlon! Oi, <b>' + kid.name + '</b>! Vem pra minha festa?' },
        { who: id, text: 'Vou sim! Mas antes… olha quantas coisinhas eu pendurei na janela. <b>Quantas são?</b>' }
      ], function () {
        countChallenge({
          question: 'QUANTOS VOCÊ CONTA NA JANELA DE ' + kid.name.toUpperCase() + '?',
          item: item,
          answer: answer,
          onCorrect: function () {
            S.friends.push(id);
            var marks = worldEl.querySelectorAll('[data-house="' + id + '"]');
            Array.prototype.forEach.call(marks, function (m) { m.remove(); });
            awardStar(x + 50, 300, 1);
            refreshHud();

            var walker = place('kid:' + id, x + 52, 438, { anchor: 'bottomcenter', cls: 'anim-bob', z: 7 });
            later(function () {
              walker.style.transition = 'left .8s linear';
              walker.style.left = '294px';
              Sfx.play('move');
            }, 60);
            later(function () {
              walker.remove();
              worldEl.querySelectorAll('[data-parked]').forEach(function (n) { n.remove(); });
              drawParked(310, 438);
            }, 900);

            say([{ who: id, text: 'Isso! Eram <b>' + answer + '</b>! Bora que eu levo refrigerante!' }], function () {
              busy = false;
              checkDone();
            });
          }
        });
      });
    }

    var leaving = false;
    function checkDone() {
      if (S.friends.length < FRIEND_ORDER.length || leaving) return;
      leaving = true;
      later(function () {
        say([
          'A turma toda tá comigo! Agora faltam os <b>bichinhos</b>.',
          'Eles moram no parque aqui do lado. Vamos!'
        ], function () {
          go('drive', { to: 'park', label: 'PARQUE DOS BICHOS' });
        });
      }, 400);
    }

    if (!S.visited.street) {
      S.visited.street = true;
      say([
        'Chegamos na rua dos meus amigos!',
        'Clique numa <b>casinha</b> pra chamar quem mora nela. Precisamos dos <b>5</b>!'
      ]);
    }
  };

  function drawParked(x, y) {
    var vArt = Art.get('vehicle:' + S.vehicle);
    var el = place('vehicle:' + S.vehicle, x, y, { anchor: 'bottomcenter' });
    el.dataset.parked = '1';

    var seats = vehicle().seats;
    var riders = S.friends.slice(0, seats);
    riders.forEach(function (id, i) {
      var r = place('kid:' + id, x - vArt.w * SCALE / 2 + 10 + i * 18, y - vArt.h * SCALE + 12, {
        anchor: 'bottom', scale: 1.2
      });
      r.dataset.parked = '1';
      r.style.zIndex = 5 - i;
    });
    if (S.friends.length > seats) {
      var extra = place('kid:' + S.friends[seats], x + vArt.w * SCALE / 2 + 6, y, {
        anchor: 'bottom', scale: 1.2, cls: 'anim-bob'
      });
      extra.dataset.parked = '1';
    }
    return el;
  }

  /* --------------------------------------------------------- 6. ANIMAIS    */

  var ANIMAL_ORDER = ['dog', 'cat', 'parrot', 'turtle', 'monkey'];

  Scenes.park = function () {
    paintBg('park');
    buildHud();
    sceneTitle('O PARQUE DOS BICHOS');

    var spots = [[70, 330], [190, 372], [330, 330], [452, 388], [560, 340]];
    var busy = false;

    ANIMAL_ORDER.forEach(function (id, i) {
      var pos = spots[i];
      var joined = S.animals.indexOf(id) >= 0;
      place('animal:' + id, pos[0], pos[1], {
        anchor: 'bottomcenter',
        cls: joined ? 'anim-hop' : 'anim-bob',
        onClick: function () { meet(id, pos); }
      });
      if (!joined) {
        place('marker', pos[0], pos[1] - 58, { anchor: 'bottomcenter', scale: 1.4, cls: 'anim-bob' })
          .dataset.mark = id;
      }
    });

    place('kid:ravi', 250, 470, { anchor: 'bottomcenter', cls: 'anim-bob', z: 6 });
    drawParked(320, 470);

    function meet(id, pos) {
      if (busy || speechBusy) return;
      var a = Art.ANIMALS[id];
      if (S.animals.indexOf(id) >= 0) {
        say([{ who: 'ravi', text: a.name + ' já aceitou o convite! Olha só a alegria.' }]);
        return;
      }
      busy = true;
      Sfx.play('pop');

      var want = randInt(2, 7);

      say([
        { who: 'ravi', text: 'Oi, <b>' + a.name + '</b>! Quer vir pra minha festa?' },
        { who: 'ravi', text: a.name + ' topa ir… se eu servir <b>' + want + ' ' + a.treatName + '</b>. Vamos contar!' }
      ], function () {
        treatChallenge(id, want, pos);
      });
    }

    /**
     * Aqui o jogador não escolhe um número: ele *produz* a quantidade,
     * clicando um petisco de cada vez. Contagem ativa, não reconhecimento.
     */
    function treatChallenge(id, want, pos) {
      var a = Art.ANIMALS[id];
      var panel = E('div', 'panel', uiEl);
      css(panel, {
        left: '50%', top: '74px', transform: 'translateX(-50%)',
        width: '480px', textAlign: 'center'
      });

      var q = E('div', null, panel, 'SIRVA ' + want + ' ' + a.treatName.toUpperCase() + ' PARA ' + a.name.toUpperCase());
      css(q, {
        fontFamily: "'Press Start 2P', monospace", fontSize: '11px',
        color: '#241a08', lineHeight: '1.7', marginBottom: '10px'
      });

      var bowl = E('div', null, panel);
      css(bowl, {
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
        gap: '6px', minHeight: '62px', marginBottom: '10px', padding: '6px',
        background: '#fffdf4', border: '3px dashed #c9a24a'
      });
      var bowlHint = E('div', null, bowl, 'tigela vazia');
      css(bowlHint, { fontFamily: "'VT323', monospace", fontSize: '22px', color: '#a08a5a' });

      var tray = E('div', null, panel);
      css(tray, {
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
        gap: '8px', marginBottom: '12px'
      });

      var count = 0;
      var art = Art.get(a.treat);

      for (var i = 0; i < 9; i++) {
        (function () {
          var t = E('div', 'spr clickable', tray);
          css(t, {
            position: 'relative',
            width: (art.w * 2) + 'px', height: (art.h * 2) + 'px',
            backgroundImage: 'url(' + art.url + ')'
          });
          t.addEventListener('click', function () {
            if (t.dataset.used) return;
            t.dataset.used = '1';
            t.style.opacity = '.25';
            addToBowl();
          });
        })();
      }

      function addToBowl() {
        count++;
        bowlHint.style.display = 'none';
        var b = E('div', 'spr', bowl);
        css(b, {
          position: 'relative',
          width: (art.w * 1.6) + 'px', height: (art.h * 1.6) + 'px',
          backgroundImage: 'url(' + art.url + ')'
        });
        Sfx.tone(420 + count * 55, 0, 0.07, { vol: 0.5 });
        label.textContent = 'na tigela: ' + count;
      }

      var label = E('div', null, panel, 'na tigela: 0');
      css(label, { fontFamily: "'VT323', monospace", fontSize: '24px', color: '#4a3a14', marginBottom: '8px' });

      var row = E('div', null, panel);
      css(row, { display: 'flex', gap: '10px', justifyContent: 'center' });

      var reset = E('button', 'btn small', row, 'ESVAZIAR');
      reset.type = 'button';
      reset.addEventListener('click', function () {
        count = 0;
        Sfx.play('drop');
        Array.prototype.forEach.call(bowl.querySelectorAll('.spr'), function (n) { n.remove(); });
        Array.prototype.forEach.call(tray.children, function (n) {
          delete n.dataset.used;
          n.style.opacity = '1';
        });
        bowlHint.style.display = '';
        label.textContent = 'na tigela: 0';
      });

      var ok = E('button', 'btn green small', row, 'SERVIR!');
      ok.type = 'button';
      ok.addEventListener('click', function () {
        if (count === want) {
          Sfx.play('good');
          panel.remove();
          S.animals.push(id);
          var mark = worldEl.querySelector('[data-mark="' + id + '"]');
          if (mark) mark.remove();
          awardStar(pos[0], pos[1] - 50, 1);
          refreshHud();
          confettiBurst(8);
          busy = false;
          say([{ who: 'ravi', text: 'Exatamente <b>' + want + '</b>! ' + a.name + ' vem pra festa!' }], checkDone);
        } else {
          S.mistakes++;
          Sfx.play('bad');
          toast(count > want ? 'Passou! Tire alguns.' : 'Faltam alguns…', 'bad', 1100);
        }
      });
    }

    var leaving = false;
    function checkDone() {
      if (S.animals.length < ANIMAL_ORDER.length || leaving) return;
      leaving = true;
      later(function () {
        say([
          'Cinco amigos e cinco bichinhos: <b>' + guests() + ' convidados</b>!',
          'Agora é o mercado do Seu Zé. Festa sem bolo não existe.'
        ], function () {
          go('drive', { to: 'market', label: 'MERCADO DO SEU ZÉ' });
        });
      }, 400);
    }

    if (!S.visited.park) {
      S.visited.park = true;
      say([
        'Esse é o parque! Aqui moram os bichos mais legais do bairro.',
        'Clique num <b>bichinho</b> pra convidar. Cada um pede um lanchinho.'
      ]);
    }
  };

  /* --------------------------------------------------------- 7. MERCADO    */

  Scenes.market = function () {
    paintBg('market');
    buildHud();
    sceneTitle('MERCADO DO SEU ZÉ');

    var list = [
      { id: 'cake', name: 'bolo', qty: 1 },
      { id: 'soda', name: 'refri', qty: 4 },
      { id: 'chips', name: 'salgadinho', qty: 3 },
      { id: 'brigadeiro', name: 'brigadeiro', qty: guests() },
      { id: 'candle', name: 'velinha', qty: S.age }
    ];

    S.cart = {};
    list.forEach(function (l) { S.cart[l.id] = 0; });

    /* Prateleiras: 3 alturas, itens embaralhados para não virar decoreba */
    var shelfY = [140, 244, 348];
    var picks = [];
    list.forEach(function (l) {
      /* As cópias são só variedade visual — dá pra clicar a mesma várias vezes. */
      var copies = Math.min(5, Math.max(3, Math.ceil(l.qty / 2) + 1));
      for (var i = 0; i < copies; i++) picks.push(l.id);
    });
    picks = shuffle(picks);

    var perShelf = Math.ceil(picks.length / 3);
    var stepX = perShelf > 1 ? 344 / (perShelf - 1) : 0;
    picks.forEach(function (id, i) {
      var shelf = Math.min(2, Math.floor(i / perShelf));
      var col = i % perShelf;
      place(id, 36 + col * stepX, shelfY[shelf], {
        anchor: 'bottom',
        onClick: function (el) { pick(id, el); }
      });
    });

    /* Carrinho */
    place('cart', 470, 470, { anchor: 'bottomcenter' });
    place('kid:ravi', 400, 470, { anchor: 'bottomcenter', cls: 'anim-bob' });

    /* Lista de compras */
    var panel = E('div', 'checklist', uiEl);
    css(panel, { right: '14px', top: '96px' });
    E('h3', null, panel, 'LISTA DE COMPRAS');
    var rows = {};
    list.forEach(function (l) {
      var row = E('div', 'check-row', panel);
      E('span', 'check-box', row);
      E('span', null, row, l.qty + ' ' + l.name + (l.qty > 1 ? 's' : ''));
      var qty = E('span', 'qty', row, '0');
      rows[l.id] = { row: row, qty: qty, def: l };
      row.style.cursor = 'pointer';
      row.title = 'clique para devolver um';
      row.addEventListener('click', function () { unpick(l.id); });
    });
    var tip = E('div', null, panel, 'clique na linha p/ devolver');
    css(tip, { fontFamily: "'VT323', monospace", fontSize: '17px', color: '#a08a5a', marginTop: '6px', textAlign: 'center' });

    var payBtn = E('button', 'btn green small', uiEl, 'IR AO CAIXA');
    payBtn.type = 'button';
    payBtn.disabled = true;
    css(payBtn, { position: 'absolute', right: '14px', bottom: '18px' });
    payBtn.addEventListener('click', goToCashier);

    function pick(id, el) {
      if (S.cart[id] >= 12) return;
      S.cart[id]++;
      Sfx.play('pickup');
      var flying = place(id, parseFloat(el.style.left), parseFloat(el.style.top), { parent: fxEl });
      css(flying, { transition: 'left .4s ease-in, top .4s ease-in, opacity .4s' });
      later(function () {
        flying.style.left = '470px';
        flying.style.top = '420px';
        flying.style.opacity = '0';
      }, 20);
      later(function () { flying.remove(); }, 460);
      update();
    }

    function unpick(id) {
      if (S.cart[id] <= 0) return;
      S.cart[id]--;
      Sfx.play('drop');
      update();
    }

    var announced = false;
    function update() {
      var allOk = true;
      list.forEach(function (l) {
        var r = rows[l.id];
        var n = S.cart[l.id];
        r.qty.textContent = String(n);
        r.row.classList.toggle('done', n === l.qty);
        r.row.classList.toggle('over', n > l.qty);
        if (n !== l.qty) allOk = false;
      });
      payBtn.disabled = !allOk;
      if (allOk && !announced) {
        announced = true;
        Sfx.play('great');
        awardStar(470, 400, 1);
        toast('Lista completa! Vá ao caixa.', '', 1400);
      }
      if (!allOk) announced = false;
    }

    function goToCashier() {
      Sfx.play('click');
      worldEl.innerHTML = '';
      uiEl.innerHTML = '';
      buildHud();
      sceneTitle('CAIXA DO SEU ZÉ');
      place('cart', 130, 460, { anchor: 'bottomcenter' });
      place('kid:ravi', 220, 460, { anchor: 'bottomcenter', cls: 'anim-bob' });

      S.price = randInt(4, 8);

      say([
        'Seu Zé disse que deu <b>' + S.price + ' moedinhas</b>.',
        'Clique em <b>' + S.price + ' moedas</b> da minha carteira — nem uma a mais!'
      ], function () {
        var panel2 = E('div', 'panel', uiEl);
        css(panel2, {
          left: '50%', top: '96px', transform: 'translateX(-50%)',
          width: '430px', textAlign: 'center'
        });
        var t = E('div', null, panel2, 'PAGUE ' + S.price + ' MOEDAS');
        css(t, { fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#241a08', marginBottom: '12px' });

        var wallet = E('div', null, panel2);
        css(wallet, { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '12px' });

        var paid = 0;
        var coinArt = Art.get('coin');
        for (var i = 0; i < 10; i++) {
          (function () {
            var c = E('div', 'spr clickable', wallet);
            css(c, {
              position: 'relative', width: (coinArt.w * 2.4) + 'px', height: (coinArt.h * 2.4) + 'px',
              backgroundImage: 'url(' + coinArt.url + ')'
            });
            c.addEventListener('click', function () {
              if (c.dataset.used) {
                delete c.dataset.used;
                c.style.opacity = '1';
                paid--;
                Sfx.play('drop');
              } else {
                c.dataset.used = '1';
                c.style.opacity = '.25';
                paid++;
                Sfx.play('coin');
              }
              lbl.textContent = 'no balcão: ' + paid;
            });
          })();
        }

        var lbl = E('div', null, panel2, 'no balcão: 0');
        css(lbl, { fontFamily: "'VT323', monospace", fontSize: '25px', color: '#4a3a14', marginBottom: '10px' });

        var pay = E('button', 'btn green small', panel2, 'PAGAR');
        pay.type = 'button';
        pay.addEventListener('click', function () {
          if (paid === S.price) {
            Sfx.play('great');
            awardStar(320, 240, 2);
            panel2.remove();
            confettiBurst(10);
            say([
              'Obrigado, Seu Zé! Tá tudo no carrinho.',
              'Agora o melhor: a <b>fábrica de brinquedos</b>! Preciso de um pra cada convidado.'
            ], function () {
              go('drive', { to: 'factory', label: 'FÁBRICA DE BRINQUEDOS' });
            });
          } else {
            S.mistakes++;
            Sfx.play('bad');
            toast(paid > S.price ? 'Moedas demais!' : 'Faltou moeda…', 'bad', 1100);
          }
        });
      });
    }

    if (!S.visited.market) {
      S.visited.market = true;
      say([
        'Mercado do Seu Zé! Olha a <b>lista de compras</b> ali do lado.',
        'Clique nos produtos das prateleiras até bater a quantidade certinha.'
      ]);
    }
    update();
  };

  /* --------------------------------------------------------- 8. FÁBRICA    */

  var TOY_KEYS = ['teddy', 'ball', 'robot', 'toycar', 'top'];

  Scenes.factory = function () {
    paintBg('factory');
    buildHud({ toys: true });
    sceneTitle('FÁBRICA DE BRINQUEDOS');

    var need = guests();
    S.toys = 0;
    refreshHud();

    /* Engrenagens decorativas */
    [[60, 120], [110, 96], [520, 120], [566, 96]].forEach(function (p, i) {
      var g = place('gear', p[0], p[1], { scale: 1.6 });
      g.style.animation = 'spin ' + (2 + i * 0.4) + 's linear infinite';
    });

    /* Esteira */
    var beltY = 360;
    var belt = E('div', null, worldEl);
    css(belt, {
      position: 'absolute', left: '0px', top: beltY + 'px', width: '640px', height: '22px',
      background: 'repeating-linear-gradient(90deg,#3f444e 0 12px,#5c626e 12px 24px)',
      borderTop: '4px solid #9aa0ac', borderBottom: '4px solid #2a3038'
    });

    place('kid:ravi', 66, 470, { anchor: 'bottomcenter', cls: 'anim-bob' });

    var counter = E('div', 'counter', uiEl);
    css(counter, { left: '50%', top: '92px', transform: 'translateX(-50%)' });
    E('span', null, counter, 'BRINQUEDOS');
    var cText = E('span', null, counter);
    cText.innerHTML = '0<span class="goal">/' + need + '</span>';

    var running = false;
    var items = [];
    var spawnT = 0;
    var beltOffset = 0;

    var lever = place('lever:off', 566, 350, { anchor: 'bottom', scale: 1.6, onClick: toggle });

    function toggle() {
      running = !running;
      lever.remove();
      lever = place('lever:' + (running ? 'on' : 'off'), 566, 350, { anchor: 'bottom', scale: 1.6, onClick: toggle });
      Sfx.play('machine');
      hintEl.textContent = running ? 'Clique nos brinquedos! Cuidado com as peças quebradas.' : 'Puxe a alavanca para ligar a esteira';
    }

    var hintEl = E('div', null, uiEl, 'Puxe a alavanca para ligar a esteira');
    css(hintEl, {
      position: 'absolute', left: '0', right: '0', bottom: '16px', textAlign: 'center',
      fontFamily: "'VT323', monospace", fontSize: '24px', color: '#fff',
      textShadow: '2px 2px 0 #101018'
    });

    function spawn() {
      var isScrap = Math.random() < 0.26;
      var key = isScrap ? 'scrap' : TOY_KEYS[randInt(0, TOY_KEYS.length - 1)];
      var el = place(key, -60, beltY + 2, {
        anchor: 'bottom',
        onClick: function () { grab(obj); }
      });
      var obj = { el: el, x: -60, scrap: isScrap, w: parseFloat(el.dataset.w) };
      items.push(obj);
    }

    function grab(obj) {
      if (!running || obj.taken) return;
      obj.taken = true;
      if (obj.scrap) {
        S.mistakes++;
        Sfx.play('bad');
        toast('Essa tá quebrada!', 'bad', 800);
        if (S.stars > 0) { S.stars--; refreshHud(); }
        obj.el.remove();
        items.splice(items.indexOf(obj), 1);
        return;
      }

      S.toys++;
      Sfx.play('pickup');
      refreshHud();
      cText.innerHTML = S.toys + '<span class="goal">/' + need + '</span>';

      obj.el.style.transition = 'left .45s ease-in, top .45s ease-in, opacity .45s';
      obj.el.style.left = '66px';
      obj.el.style.top = '400px';
      obj.el.style.opacity = '0';
      var ref = obj.el;
      later(function () { ref.remove(); }, 470);
      items.splice(items.indexOf(obj), 1);

      if (S.toys >= need) finish();
    }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      running = false;
      stopLoop();
      Sfx.play('great');
      awardStar(320, 300, 2);
      items.forEach(function (o) { o.el.remove(); });
      items = [];

      later(function () {
        confettiBurst(12);
        say([
          'Prontinho: <b>' + need + ' brinquedos</b>, um pra cada convidado!',
          'Agora é só decorar o salão. A festa tá quase!'
        ], function () {
          go('hall');
        });
      }, 500);
    }

    startLoop(function (dt) {
      if (!running) return;

      beltOffset = (beltOffset + dt * 3) % 24;
      belt.style.backgroundPosition = beltOffset + 'px 0';

      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = randInt(34, 58);
      }

      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.x += 2.6 * dt;
        it.el.style.left = Math.round(it.x) + 'px';
        if (it.x > W + 40) {
          it.el.remove();
          items.splice(i, 1);
        }
      }
    });

    if (!S.visited.factory) {
      S.visited.factory = true;
      say([
        'A fábrica de brinquedos! Aqui a gente pega a lembrancinha da festa.',
        'Preciso de <b>' + need + '</b> brinquedos, um pra cada convidado. Ligue a esteira!'
      ]);
    }
  };

  /* -------------------------------------------------------- 9. DECORAÇÃO   */

  Scenes.hall = function () {
    paintBg('hall');
    buildHud();
    sceneTitle('O SALÃO DA FESTA');

    var needBalloons = Math.max(3, Math.min(9, guests()));
    var step = 'banner';

    place('kid:ravi', 70, 470, { anchor: 'bottomcenter', cls: 'anim-bob' });

    var hintEl = E('div', null, uiEl, '');
    css(hintEl, {
      position: 'absolute', left: '0', right: '0', top: '92px', textAlign: 'center',
      fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#fff',
      lineHeight: '1.7', textShadow: '2px 2px 0 #101018'
    });

    var counter = null, cText = null, doneBtn = null;

    /* --- passo 1: a faixa --- */
    function stepBanner() {
      step = 'banner';
      hintEl.textContent = 'CLIQUE NA PAREDE PARA PENDURAR A FAIXA';
      var spot = E('button', 'hit', uiEl);
      css(spot, {
        left: '200px', top: '120px', width: '240px', height: '70px',
        border: '4px dashed rgba(255,255,255,.8)', background: 'rgba(255,255,255,.14)'
      });
      spot.addEventListener('click', function () {
        Sfx.play('pop');
        spot.remove();
        place('banner', 320, 190, { anchor: 'bottomcenter', cls: 'anim-wobble' });
        awardStar(320, 160, 1);
        later(stepBalloons, 500);
      });
    }

    /* --- passo 2: contar balões --- */
    function stepBalloons() {
      step = 'balloons';
      S.balloons = 0;
      hintEl.textContent = 'ENCHA EXATAMENTE ' + needBalloons + ' BALÕES';

      counter = E('div', 'counter', uiEl);
      css(counter, { left: '50%', top: '128px', transform: 'translateX(-50%)' });
      E('span', null, counter, 'BALÕES');
      cText = E('span', null, counter);
      cText.innerHTML = '0<span class="goal">/' + needBalloons + '</span>';

      var wall = E('button', 'hit', uiEl);
      css(wall, { left: '40px', top: '170px', width: '560px', height: '160px' });
      wall.addEventListener('click', function (ev) {
        if (S.balloons >= 9) return;
        var rect = screenEl.getBoundingClientRect();
        var scale = rect.width / W;
        var x = (ev.clientX - rect.left) / scale;
        var y = (ev.clientY - rect.top) / scale;
        S.balloons++;
        var cols = [Art.C.red, Art.C.yellow, Art.C.cyan, Art.C.pink, Art.C.green, Art.C.purple, Art.C.orange, Art.C.blue, Art.C.redLt];
        var b = place('balloon:' + cols[(S.balloons - 1) % cols.length], x, y + 40, {
          anchor: 'bottomcenter', cls: 'anim-bob'
        });
        b.dataset.balloon = '1';
        Sfx.tone(380 + S.balloons * 50, 0, 0.09, { vol: 0.55 });
        cText.innerHTML = S.balloons + '<span class="goal">/' + needBalloons + '</span>';
      });

      var row = E('div', null, uiEl);
      css(row, {
        position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
        display: 'flex', gap: '10px'
      });

      var clear = E('button', 'btn small', row, 'ESTOURAR TODOS');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        Sfx.play('pop');
        worldEl.querySelectorAll('[data-balloon]').forEach(function (n) { n.remove(); });
        S.balloons = 0;
        cText.innerHTML = '0<span class="goal">/' + needBalloons + '</span>';
      });

      doneBtn = E('button', 'btn green small', row, 'PRONTO!');
      doneBtn.type = 'button';
      doneBtn.addEventListener('click', function () {
        if (S.balloons === needBalloons) {
          Sfx.play('good');
          awardStar(320, 240, 1);
          wall.remove();
          row.remove();
          counter.remove();
          later(stepCake, 400);
        } else {
          S.mistakes++;
          Sfx.play('bad');
          toast(S.balloons > needBalloons ? 'Balões demais! Estoure alguns.' : 'Faltam balões…', 'bad', 1100);
        }
      });
    }

    /* --- passo 3: a mesa e as velinhas --- */
    function stepCake() {
      step = 'candles';
      S.candles = 0;
      hintEl.textContent = 'COLOQUE ' + S.age + (S.age === 1 ? ' VELINHA' : ' VELINHAS') + ' NO BOLO';

      place('table', 320, 452, { anchor: 'bottomcenter' });
      var cakeEl = place('bigcake:0', 320, 420, { anchor: 'bottomcenter' });

      counter = E('div', 'counter', uiEl);
      css(counter, { left: '50%', top: '128px', transform: 'translateX(-50%)' });
      E('span', null, counter, 'VELINHAS');
      cText = E('span', null, counter);
      cText.innerHTML = '0<span class="goal">/' + S.age + '</span>';

      var hit = E('button', 'hit', uiEl);
      css(hit, { left: '260px', top: '300px', width: '120px', height: '110px' });
      hit.addEventListener('click', function () {
        if (S.candles >= 9) return;
        S.candles++;
        cakeEl.remove();
        cakeEl = place('bigcake:' + S.candles, 320, 420, { anchor: 'bottomcenter' });
        Sfx.tone(500 + S.candles * 60, 0, 0.09, { vol: 0.55 });
        cText.innerHTML = S.candles + '<span class="goal">/' + S.age + '</span>';
      });

      var row = E('div', null, uiEl);
      css(row, {
        position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
        display: 'flex', gap: '10px'
      });

      var clear = E('button', 'btn small', row, 'TIRAR TODAS');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        S.candles = 0;
        Sfx.play('drop');
        cakeEl.remove();
        cakeEl = place('bigcake:0', 320, 420, { anchor: 'bottomcenter' });
        cText.innerHTML = '0<span class="goal">/' + S.age + '</span>';
      });

      var ok = E('button', 'btn green small', row, 'PRONTO!');
      ok.type = 'button';
      ok.addEventListener('click', function () {
        if (S.candles === S.age) {
          Sfx.play('great');
          awardStar(320, 300, 2);
          hit.remove();
          row.remove();
          counter.remove();
          hintEl.textContent = '';
          confettiBurst(16);
          say([
            'Salão decorado, bolo com <b>' + S.age + '</b> ' + (S.age === 1 ? 'velinha' : 'velinhas') + '…',
            'Só falta uma coisa: <b>todo mundo chegar</b>!'
          ], function () { go('party'); });
        } else {
          S.mistakes++;
          Sfx.play('bad');
          toast(S.candles > S.age ? 'Velinhas demais!' : 'Faltam velinhas…', 'bad', 1100);
        }
      });
    }

    if (!S.visited.hall) {
      S.visited.hall = true;
      say([
        'Esse é o salão! Tá meio sem graça ainda…',
        'Vamos decorar: primeiro a <b>faixa</b>, depois os <b>balões</b> e o <b>bolo</b>.'
      ], stepBanner);
    } else {
      stepBanner();
    }
  };

  /* ------------------------------------------------------------ 10. FESTA  */

  Scenes.party = function () {
    paintBg('party');
    buildHud();
    sceneTitle('A GRANDE FESTA SURPRESA');

    place('banner', 320, 190, { anchor: 'bottomcenter', cls: 'anim-wobble' });

    var cols = [Art.C.red, Art.C.yellow, Art.C.cyan, Art.C.pink, Art.C.green, Art.C.purple, Art.C.orange, Art.C.blue, Art.C.redLt];
    for (var i = 0; i < S.balloons; i++) {
      var b = place('balloon:' + cols[i % cols.length], 60 + i * 62, 300, { anchor: 'bottom', cls: 'anim-bob' });
      b.style.animationDelay = (i * 0.17) + 's';
    }

    place('table', 320, 452, { anchor: 'bottomcenter', z: 6 });
    var cakeEl = place('bigcake:' + S.candles, 320, 424, { anchor: 'bottomcenter', z: 7 });

    /* Convidados entram um a um */
    var lineup = [];
    S.friends.forEach(function (id) { lineup.push({ type: 'kid', id: id }); });
    S.animals.forEach(function (id) { lineup.push({ type: 'animal', id: id }); });

    var slots = [];
    var n = lineup.length;
    for (var k = 0; k < n; k++) {
      var side = k % 2 === 0 ? -1 : 1;
      var rank = Math.floor(k / 2);
      slots.push(320 + side * (70 + rank * 56));
    }

    place('kid:ravi,cheer', 320, 388, { anchor: 'bottomcenter', cls: 'anim-hop', z: 8 });

    Sfx.loop('party', { vol: 0.42 });

    lineup.forEach(function (g, idx) {
      later(function () {
        var key = g.type === 'kid' ? 'kid:' + g.id + ',cheer' : 'animal:' + g.id;
        var el = place(key, slots[idx], 400, {
          anchor: 'bottomcenter',
          cls: g.type === 'kid' ? 'anim-hop' : 'anim-bob',
          scale: 1.7,
          z: 3
        });
        el.style.animationDelay = (idx * 0.11) + 's';
        Sfx.play('pop');
        confettiBurst(4);
      }, 260 + idx * 200);
    });

    later(function () {
      confettiBurst(40);
      Sfx.stopLoop();
      Sfx.song('birthday', { vol: 0.75 });

      say([
        'Chegou todo mundo! <b>' + guests() + ' convidados</b> na minha festa!',
        'Agora vem a melhor parte…'
      ], blowStep);
    }, 400 + n * 200);

    function blowStep() {
      var hint = E('div', null, uiEl, 'SEGURE O CLIQUE (ou ESPAÇO) PARA SOPRAR AS VELINHAS');
      css(hint, {
        position: 'absolute', left: '0', right: '0', top: '96px', textAlign: 'center',
        fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#fff',
        lineHeight: '1.7', textShadow: '2px 2px 0 #101018'
      });

      var track = E('div', null, uiEl);
      css(track, {
        position: 'absolute', left: '160px', right: '160px', top: '132px', height: '22px',
        background: '#101018', border: '4px solid #f4ecd8', boxShadow: '4px 4px 0 rgba(0,0,0,.45)'
      });
      var fill = E('div', null, track);
      css(fill, { height: '100%', width: '0%', background: Art.C.cyan });

      var power = 0;
      var holding = false;
      var blown = false;
      var blowSfx = 0;

      on(screenEl, 'pointerdown', function (ev) { ev.preventDefault(); holding = true; });
      on(window, 'pointerup', function () { holding = false; });
      on(window, 'keydown', function (ev) {
        if (ev.code === 'Space') { ev.preventDefault(); holding = true; }
      });
      on(window, 'keyup', function (ev) { if (ev.code === 'Space') holding = false; });

      startLoop(function (dt) {
        if (blown) return;
        if (holding) {
          power += 1.35 * dt;
          blowSfx -= dt;
          if (blowSfx <= 0) { Sfx.play('blow'); blowSfx = 34; }
        } else {
          power -= 0.5 * dt;
        }
        power = Math.max(0, Math.min(100, power));
        fill.style.width = power + '%';

        if (power >= 100) {
          blown = true;
          stopLoop();
          holding = false;
          cakeEl.remove();
          cakeEl = place('bigcakeout:' + S.candles, 320, 424, { anchor: 'bottomcenter', z: 7 });
          hint.remove();
          track.remove();

          Sfx.play('fanfare');
          confettiBurst(60);
          awardStar(320, 300, 3);

          later(function () {
            say([
              'APAGUEIII! Fiz o pedido e não vou contar pra ninguém.',
              'Essa foi <b>a melhor festa do bairro</b>. Obrigado por me ajudar!'
            ], function () { go('report'); });
          }, 900);
        }
      });
    }
  };

  /* --------------------------------------------------------- 11. RELATÓRIO */

  Scenes.report = function () {
    paintBg('party');
    buildHud();

    place('kid:ravi,cheer', 84, 470, { anchor: 'bottomcenter', cls: 'anim-hop' });
    place('animal:dog', 566, 470, { anchor: 'bottomcenter', cls: 'anim-bob' });
    confettiBurst(30);

    var best = 0;
    try {
      best = parseInt(localStorage.getItem('ravi123.best') || '0', 10) || 0;
      if (S.stars > best) {
        best = S.stars;
        localStorage.setItem('ravi123.best', String(best));
      }
    } catch (e) { }

    var box = E('div', 'report', uiEl);
    E('h2', null, box, 'FIM DE FESTA — RELATÓRIO');

    function row(label, value) {
      var r = E('div', 'report-row', box);
      E('span', null, r, label);
      E('span', 'dots', r);
      E('span', 'val', r, String(value));
    }

    row('Idade do Ravi', S.age + (S.age === 1 ? ' ano' : ' anos'));
    row('Veículo', vehicle().name);
    row('Amigos convidados', S.friends.length + ' de 5');
    row('Bichinhos convidados', S.animals.length + ' de 5');
    row('Brinquedos na fábrica', S.toys);
    row('Balões pendurados', S.balloons);
    row('Velinhas sopradas', S.candles);
    row('Estrelinhas', S.stars + ' ★');
    row('Recorde da casa', best + ' ★');

    var medal, medalTxt;
    if (S.mistakes === 0 && S.stars >= 18) { medal = 'FESTA LENDÁRIA!'; medalTxt = 'Contou tudo certo de primeira!'; }
    else if (S.stars >= 14) { medal = 'FESTA INCRÍVEL!'; medalTxt = 'O bairro inteiro vai comentar.'; }
    else if (S.stars >= 9) { medal = 'FESTA MUITO BOA!'; medalTxt = 'Todo mundo saiu sorrindo.'; }
    else { medal = 'FESTA DIVERTIDA!'; medalTxt = 'O que vale é estar junto.'; }

    var m = E('div', 'medal', box);
    m.innerHTML = medal + '<br><span style="font-size:9px">' + medalTxt + '</span>';

    var row2 = E('div', null, uiEl);
    css(row2, {
      position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
      display: 'flex', gap: '12px'
    });

    var again = E('button', 'btn green small', row2, 'JOGAR DE NOVO');
    again.type = 'button';
    again.addEventListener('click', function () {
      Sfx.play('click');
      S = freshState();
      go('title');
    });

    var back = E('a', 'btn blue small', row2, 'VOLTAR AOS LABS');
    back.href = '/labs/';
    back.style.textDecoration = 'none';

    Sfx.play('fanfare');
  };

  /* ============================================================ bootstrap = */

  /**
   * Mede o espaço disponível a partir do wrapper (que não depende do tamanho
   * da tela) e escala os 640x480 lógicos para caber sem quebrar o 4:3.
   */
  function fitScreen() {
    var host = document.querySelector('.stage-wrap');
    var crt = document.getElementById('crt');
    var bezelPad = parseFloat(getComputedStyle(viewportEl.parentElement).paddingLeft) || 26;
    var crtPad = parseFloat(getComputedStyle(crt).paddingLeft) || 14;

    var availW = (host.clientWidth || window.innerWidth) - 2 * (crtPad + bezelPad) - 8;
    var availH = window.innerHeight - 250;

    var scale = Math.min(availW / W, Math.max(220, availH) / H);
    scale = Math.max(0.32, Math.min(1.5, scale));
    viewportEl.style.setProperty('--screen-scale', scale);
  }

  function init() {
    screenEl = document.getElementById('screen');
    bgCanvas = document.getElementById('bg');
    bgCtx = bgCanvas.getContext('2d');
    bgCtx.imageSmoothingEnabled = false;
    worldEl = document.getElementById('world');
    fxEl = document.getElementById('fx');
    uiEl = document.getElementById('ui');
    viewportEl = document.getElementById('viewport');
    ledEl = document.getElementById('crtLed');

    /* keyframe de rotação usado pelas engrenagens da fábrica */
    var style = document.createElement('style');
    style.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    document.head.appendChild(style);

    fitScreen();
    window.addEventListener('resize', fitScreen);

    /* Esc abre o menu em qualquer cena */
    window.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        var open = document.querySelector('.modal-back');
        if (open) open.remove();
        else if (S) openMenu();
      }
    });

    /* Atalho de desenvolvimento: pular direto para uma cena pelo console.
       Ex.: Ravi123.jump('market', { friends:['bia','leo'], age:7 })       */
    window.Ravi123 = {
      go: go,
      state: function () { return S; },
      jump: function (scene, patch) {
        if (patch) Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
        go(scene);
      }
    };

    S = freshState();
    go('boot');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
