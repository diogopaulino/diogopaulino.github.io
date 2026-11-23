/**
 * CyberOS v3 — estação de trabalho CRT no navegador.
 *
 * Módulos (todos neste arquivo, sem build):
 *  - Persistência: localStorage com try/catch (fósforo, som, geometria das janelas, recorde).
 *  - Gerenciador de janelas: arrastar e redimensionar com Pointer Events (8 alças),
 *    foco/ordem Z, minimizar, maximizar, encaixe nas bordas (snap), duplo clique
 *    na barra para maximizar e “Organizar” (cascata). A geometria é guardada em
 *    frações da área útil, então a janela acompanha qualquer redimensionamento
 *    do navegador e NUNCA fica perdida fora da tela (ver clampRect).
 *  - Modo compacto (celular/landscape curto): cada app vira uma folha que ocupa a
 *    área útil; o dock vira barra de abas; minimizar volta para a área de trabalho.
 *  - Apps: Terminal (FS virtual), Firewall Breach (Simon), Oracle, Cipher Lab.
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const statusMsg = $('#statusMsg');
  const statusClock = $('#statusClock');
  const bootScreen = $('#bootScreen');
  const bootLog = $('#bootLog');
  const crtFrame = $('#crtFrame');
  const desktop = $('#desktop');
  const dock = $('#dock');
  const desktopEmpty = $('#desktopEmpty');
  const snapPreview = $('#snapPreview');

  /* ─── Persistência ─── */
  const STORAGE_KEY = 'labs:cyberos:v3';
  const saved = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  })();
  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const windows = {};
      for (const w of wins.values()) {
        windows[w.name] = { rect: w.rect, open: w.open, min: w.minimized, max: w.maximized, snap: w.snap };
      }
      const data = {
        phosphor: document.body.dataset.phosphor,
        sound: soundOn,
        fwBest,
        windows
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* navegação privada / cota cheia: segue sem salvar */
      }
    }, 250);
  }

  /* ─── Áudio (Web Audio, só após gesto; falhas são silenciosas) ─── */
  let soundOn = saved.sound !== false;
  let actx = null;
  function audio() {
    if (!soundOn) return null;
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* iOS 17+ */ }
      }
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      return actx;
    } catch {
      return null;
    }
  }
  /** Bip curto com envelope exponencial (sem cliques). */
  function beep(freq, ms = 90, type = 'square', gain = 0.035) {
    const ac = audio();
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch {
      /* áudio nunca derruba o app */
    }
  }
  const sfx = {
    open: () => { beep(660, 60, 'triangle'); setTimeout(() => beep(990, 70, 'triangle'), 45); },
    close: () => { beep(520, 60, 'triangle'); setTimeout(() => beep(330, 80, 'triangle'), 45); },
    min: () => beep(440, 70, 'triangle', 0.025),
    key: () => beep(1800 + Math.random() * 400, 14, 'square', 0.008),
    err: () => beep(140, 180, 'sawtooth', 0.03)
  };

  /* ─── Virtual filesystem ─── */
  const FS = {
    '/': { type: 'dir' },
    '/home': { type: 'dir' },
    '/home/guest': { type: 'dir' },
    '/home/guest/about.txt': {
      type: 'file',
      body: `Diogo Paulino — Tech Manager
Design & Code lover. Quase 20 anos no mundo tech.
Site: https://diogopaulino.com.br
Labs: https://diogopaulino.com.br/labs/

"Construindo experiências digitais simples com
design, código, música e um pouco de IA :)"`
    },
    '/home/guest/skills.md': {
      type: 'file',
      body: `# Skills
- Frontend: HTML5, CSS, JS moderno, Canvas, Web Audio
- Produto & liderança técnica
- Design systems e micro-interações
- Experimentos retrô / arcade / generative art
- IA como copiloto criativo (não como muleta)`
    },
    '/home/guest/projects': { type: 'dir' },
    '/home/guest/projects/matrix.txt': {
      type: 'file',
      body: `MATRIX
Chuva digital com katakana espelhado, bloom CRT
e controles de cinema. Feito em Canvas puro —
cada coluna é uma stream com trail e head glow.`
    },
    '/home/guest/projects/rock-kombat.txt': {
      type: 'file',
      body: `ROCK KOMBAT
Fighting game com lendas do rock. Combos,
especiais e modo versus. Áudio procedural
+ sprites com rig custom.`
    },
    '/home/guest/projects/piano.txt': {
      type: 'file',
      body: `PIANO
Synth com 4 oitavas via Web Audio API.
Envelope ADSR + pedal de sustain. Sem samples
externos — tudo sintetizado no browser.`
    },
    '/home/guest/projects/pulsar.txt': {
      type: 'file',
      body: `PULSAR
Instrumento generativo. Toque cria orbes que
pulsam, se conectam e compõem sozinhas.
Física leve + grafo harmônico.`
    },
    '/home/guest/projects/space-shooter.txt': {
      type: 'file',
      body: `NEON INVADERS
Arcade cyberpunk com partículas e glow.
Inspiração direta para a estética do CyberOS.`
    },
    '/home/guest/secrets': { type: 'dir' },
    '/home/guest/secrets/.recruiters_readme': {
      type: 'file',
      body: `// CLASSIFIED — FOR RECRUITERS ONLY
Se você chegou aqui digitando cat, você já
passou no primeiro filtro. :)

Procuro times que valorizem craft, curiosidade
e produtos com alma — não só métricas.

Dica: rode "oracle" ou abra o app ORACLE
para perguntar como cada lab foi construído.`
    },
    '/home/guest/secrets/easter_eggs.log': {
      type: 'file',
      body: `[ok] ative o avatar da home → destaque nos labs
[ok] matrix cinema mode: tecla H
[ok] cyberos: tente "neofetch", "hack", "sudo"
[ok] cyberos: arraste uma janela até a borda para encaixar
[ok] cipher: envie uma mensagem ROT13 pra um amigo`
    },
    '/bin': { type: 'dir' },
    '/bin/firewall': { type: 'file', body: 'Executable stub. Use: run firewall' },
    '/bin/oracle': { type: 'file', body: 'Executable stub. Use: run oracle' },
    '/bin/cipher': { type: 'file', body: 'Executable stub. Use: run cipher' }
  };

  const HOME = '/home/guest';
  let cwd = HOME;
  const history = [];
  let histIndex = -1;
  const bootedAt = Date.now();

  function normalizePath(input) {
    if (!input || input === '~') return HOME;
    if (input.startsWith('~/')) input = HOME + input.slice(1);
    const parts = input.startsWith('/') ? input.split('/') : (cwd + '/' + input).split('/');
    const stack = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return '/' + stack.join('/');
  }

  function resolve(path) {
    const full = normalizePath(path);
    return { full, node: FS[full] };
  }

  function listDir(path, showHidden = true) {
    const full = normalizePath(path);
    const prefix = full === '/' ? '/' : full + '/';
    const names = new Set();
    for (const key of Object.keys(FS)) {
      if (key === full || !key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest) continue;
      names.add(rest.split('/')[0]);
    }
    return Array.from(names)
      .filter((n) => showHidden || !n.startsWith('.'))
      .sort((a, b) => {
        const aHidden = a.startsWith('.');
        const bHidden = b.startsWith('.');
        if (aHidden !== bHidden) return aHidden ? 1 : -1;
        return a.localeCompare(b);
      });
  }

  function promptPath() {
    if (cwd === HOME) return '~';
    if (cwd.startsWith(HOME + '/')) return '~' + cwd.slice(HOME.length);
    return cwd;
  }

  function setStatus(msg) {
    if (statusMsg) statusMsg.textContent = msg;
  }

  /* ════════════════════════════════════════════════════════════════════
     Gerenciador de janelas
     ════════════════════════════════════════════════════════════════════ */

  const TITLE_H = 34; // altura da barra de título (px) — usada para nunca esconder a alça
  const MIN_W = 260;
  const MIN_H = 190;
  const SNAP_EDGE = 14; // px da borda que disparam o encaixe
  const compactQuery = window.matchMedia('(max-width: 820px), (max-height: 540px)');
  let compact = compactQuery.matches;
  let zCounter = 20;

  /** @type {Map<string, {name:string, el:HTMLElement, rect:{x:number,y:number,w:number,h:number}, open:boolean, minimized:boolean, maximized:boolean, snap:string|null, z:number}>} */
  const wins = new Map();

  function parseRect(str) {
    const [x, y, w, h] = String(str || '').split(',').map(Number);
    if (![x, y, w, h].every(Number.isFinite)) return { x: 0.1, y: 0.1, w: 0.5, h: 0.6 };
    return { x, y, w, h };
  }

  /** Área útil do desktop em px (descontando o dock, que fica sempre por cima). */
  function workArea() {
    const dw = desktop.clientWidth;
    const dh = desktop.clientHeight;
    if (compact) return { left: 0, top: 0, width: dw, height: dh };
    const dockRect = dock.getBoundingClientRect();
    const deskRect = desktop.getBoundingClientRect();
    const left = Math.round(dockRect.right - deskRect.left + 8);
    return { left, top: 0, width: Math.max(120, dw - left), height: dh };
  }

  /**
   * Converte frações → px e garante que a janela fica alcançável:
   *  - tamanho mínimo (ou a área inteira, se menor que o mínimo);
   *  - nunca maior que a área útil;
   *  - a barra de título fica sempre dentro na vertical, e pelo menos 96px
   *    dela ficam visíveis na horizontal — dá para pegar e trazer de volta.
   */
  function toPx(rect, area) {
    let w = clamp(rect.w * area.width, Math.min(MIN_W, area.width), area.width);
    let h = clamp(rect.h * area.height, Math.min(MIN_H, area.height), area.height);
    let x = area.left + rect.x * area.width;
    let y = area.top + rect.y * area.height;
    const grab = Math.min(96, w);
    x = clamp(x, area.left - (w - grab), area.left + area.width - grab);
    y = clamp(y, area.top, area.top + area.height - TITLE_H);
    return { x, y, w, h };
  }

  function toFrac(px, area) {
    return {
      x: (px.x - area.left) / area.width,
      y: (px.y - area.top) / area.height,
      w: px.w / area.width,
      h: px.h / area.height
    };
  }

  const SNAP_RECTS = {
    left: { x: 0, y: 0, w: 0.5, h: 1 },
    right: { x: 0.5, y: 0, w: 0.5, h: 1 },
    max: { x: 0, y: 0, w: 1, h: 1 }
  };

  /** Escreve a geometria no DOM. No modo compacto o CSS manda (folha cheia). */
  function layout(w) {
    const el = w.el;
    if (compact) {
      el.style.left = el.style.top = el.style.width = el.style.height = '';
      return;
    }
    const area = workArea();
    const frac = w.maximized ? SNAP_RECTS.max : (w.snap ? SNAP_RECTS[w.snap] : w.rect);
    const px = toPx(frac, area);
    el.style.left = `${Math.round(px.x)}px`;
    el.style.top = `${Math.round(px.y)}px`;
    el.style.width = `${Math.round(px.w)}px`;
    el.style.height = `${Math.round(px.h)}px`;
  }

  function layoutAll() {
    for (const w of wins.values()) if (w.open) layout(w);
  }

  function topWindow() {
    let best = null;
    for (const w of wins.values()) {
      if (!w.open || w.minimized) continue;
      if (!best || w.z > best.z) best = w;
    }
    return best;
  }

  function syncChrome() {
    const top = topWindow();
    for (const w of wins.values()) {
      const focused = w === top;
      w.el.classList.toggle('is-focused', focused);
      w.el.classList.toggle('is-maximized', w.maximized || w.snap === 'max');
      w.el.classList.toggle('is-snapped', Boolean(w.snap) && w.snap !== 'max');
      const maxBtn = $('[data-win-action="max"]', w.el);
      if (maxBtn) {
        const isMax = w.maximized;
        maxBtn.setAttribute('aria-label', isMax ? 'Restaurar tamanho' : 'Maximizar');
        maxBtn.title = isMax ? 'Restaurar' : 'Maximizar';
        maxBtn.firstElementChild.textContent = isMax ? '❐' : '□';
      }
    }
    $$('.dock-icon').forEach((btn) => {
      const w = wins.get(btn.dataset.open);
      if (!w) return;
      const state = !w.open ? 'closed' : w.minimized ? 'minimized' : w === top ? 'focused' : 'running';
      btn.dataset.state = state;
      btn.setAttribute('aria-pressed', String(state === 'focused'));
      const label = btn.title.split(' · ')[0];
      const suffix = { closed: '', minimized: ' · minimizado', running: ' · aberto', focused: ' · em foco' }[state];
      btn.setAttribute('aria-label', label + suffix);
    });
    const anyVisible = Boolean(top);
    desktopEmpty.classList.toggle('is-visible', !anyVisible);
  }

  function focusWindow(w, { focusInput = false } = {}) {
    if (!w || !w.open) return;
    if (w.z !== zCounter) w.z = ++zCounter;
    w.el.style.zIndex = String(w.z);
    syncChrome();
    if (focusInput) {
      const target = $('input:not([type=hidden]), textarea, button.os-btn', $('.win-body', w.el));
      // Celular: não abrir o teclado virtual só porque a janela ganhou foco.
      if (target && !compact) target.focus({ preventScroll: true });
    }
  }

  function showEl(w) {
    w.el.hidden = false;
    // Força o estilo inicial antes de animar (sem rAF duplo, que falha em aba oculta).
    void w.el.offsetWidth;
    w.el.classList.add('is-open');
    w.el.classList.remove('is-minimized');
  }

  function hideEl(w, cls) {
    w.el.classList.remove('is-open');
    if (cls) w.el.classList.add(cls);
    const el = w.el;
    const token = (w.hideToken = (w.hideToken || 0) + 1);
    setTimeout(() => {
      if (w.hideToken === token && !el.classList.contains('is-open')) el.hidden = true;
    }, 260);
  }

  function openWindow(name, opts = {}) {
    const w = wins.get(name);
    if (!w) return;
    const wasOpen = w.open && !w.minimized;
    w.open = true;
    w.minimized = false;
    layout(w);
    showEl(w);
    focusWindow(w, { focusInput: opts.focusInput !== false });
    if (!wasOpen) {
      sfx.open();
      setStatus(`app :: ${name} online`);
    }
    persist();
  }

  function closeWindow(name) {
    const w = wins.get(name);
    if (!w || !w.open) return;
    w.open = false;
    w.minimized = false;
    hideEl(w);
    sfx.close();
    setStatus(`app :: ${name} encerrado`);
    syncChrome();
    persist();
  }

  function minimizeWindow(name) {
    const w = wins.get(name);
    if (!w || !w.open || w.minimized) return;
    w.minimized = true;
    hideEl(w, 'is-minimized');
    sfx.min();
    setStatus(`app :: ${name} minimizado — clique no dock para voltar`);
    syncChrome();
    persist();
  }

  function toggleMaximize(name) {
    const w = wins.get(name);
    if (!w || compact) return;
    w.maximized = !(w.maximized || w.snap === 'max');
    w.snap = null;
    w.el.classList.add('is-animating');
    layout(w);
    setTimeout(() => w.el.classList.remove('is-animating'), 240);
    focusWindow(w);
    persist();
  }

  /** Clique no dock: abre → foca → minimiza (como o dock do macOS / barra do Windows). */
  function dockActivate(name) {
    const w = wins.get(name);
    if (!w) return;
    if (!w.open || w.minimized) openWindow(name);
    else if (w === topWindow() && !compact) minimizeWindow(name);
    else focusWindow(w, { focusInput: true });
  }

  /** Cascata a partir do canto: traz tudo de volta para a vista. */
  function arrangeWindows() {
    let i = 0;
    const open = Array.from(wins.values()).filter((w) => w.open).sort((a, b) => a.z - b.z);
    for (const w of open) {
      w.minimized = false;
      w.maximized = false;
      w.snap = null;
      w.rect = { x: 0.02 + i * 0.05, y: 0.03 + i * 0.06, w: 0.56, h: 0.7 };
      w.el.classList.add('is-animating');
      layout(w);
      showEl(w);
      setTimeout(() => w.el.classList.remove('is-animating'), 240);
      i++;
    }
    if (!open.length) openWindow('terminal');
    syncChrome();
    setStatus(open.length ? `wm :: ${open.length} janela(s) organizada(s)` : 'wm :: terminal aberto');
    persist();
  }

  /* Monta controles (–, □, ×) e alças de redimensionamento em cada janela. */
  const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  $$('.window').forEach((el) => {
    const name = el.dataset.window;
    const bar = $('.win-titlebar', el);
    const controls = document.createElement('div');
    controls.className = 'win-controls';
    controls.innerHTML = `
      <button type="button" class="win-btn" data-win-action="min" title="Minimizar" aria-label="Minimizar"><span aria-hidden="true">–</span></button>
      <button type="button" class="win-btn win-btn-max" data-win-action="max" title="Maximizar" aria-label="Maximizar"><span aria-hidden="true">□</span></button>
      <button type="button" class="win-btn win-btn-close" data-win-action="close" title="Fechar" aria-label="Fechar"><span aria-hidden="true">×</span></button>`;
    bar.appendChild(controls);
    for (const dir of HANDLES) {
      const h = document.createElement('div');
      h.className = `win-resize win-resize-${dir}`;
      h.dataset.resize = dir;
      h.setAttribute('aria-hidden', 'true');
      el.appendChild(h);
    }

    const st = saved.windows?.[name] || {};
    const base = parseRect(el.dataset.rect);
    const rect = st.rect && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(st.rect[k])) ? st.rect : base;
    const w = {
      name,
      el,
      rect: {
        x: clamp(rect.x, -0.9, 0.98),
        y: clamp(rect.y, 0, 0.95),
        w: clamp(rect.w, 0.1, 1),
        h: clamp(rect.h, 0.1, 1)
      },
      open: Boolean(st.open),
      minimized: Boolean(st.min),
      maximized: Boolean(st.max),
      snap: ['left', 'right'].includes(st.snap) ? st.snap : null,
      z: 10
    };
    wins.set(name, w);

    controls.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-win-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.winAction;
      if (action === 'close') closeWindow(name);
      else if (action === 'min') minimizeWindow(name);
      else if (action === 'max') toggleMaximize(name);
    });

    el.addEventListener('pointerdown', () => focusWindow(w), true);
    el.addEventListener('focusin', () => {
      if (w !== topWindow()) focusWindow(w);
    });

    // Duplo clique detectado nos pointerdowns (o dblclick nativo some quando o
    // pointerdown chama preventDefault para iniciar o arraste).
    let lastDown = { t: 0, x: 0, y: 0 };
    bar.addEventListener('pointerdown', (e) => {
      // Safari/iOS: toque pode chegar com button === -1.
      if (e.target.closest('.win-controls') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const now = performance.now();
      if (now - lastDown.t < 380 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 8) {
        lastDown.t = 0;
        toggleMaximize(name);
        return;
      }
      lastDown = { t: now, x: e.clientX, y: e.clientY };
      startGesture(e, w, 'move');
    });
    $$('[data-resize]', el).forEach((h) => {
      h.addEventListener('pointerdown', (e) => startGesture(e, w, h.dataset.resize));
    });
  });

  /* ─── Arrastar / redimensionar (Pointer Events + rAF) ─── */
  let gesture = null;
  let gestureRaf = 0;

  function startGesture(e, w, mode) {
    if (compact || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (mode === 'move' && e.target.closest('.win-controls')) return;
    e.preventDefault();
    focusWindow(w);
    const area = workArea();
    const current = toPx(w.maximized ? SNAP_RECTS.max : (w.snap ? SNAP_RECTS[w.snap] : w.rect), area);
    const deskRect = desktop.getBoundingClientRect();
    gesture = {
      w,
      mode,
      area,
      deskRect,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: current,
      // Arrastar uma janela maximizada/encaixada a “desprende”, mantendo o
      // ponteiro na mesma proporção da barra (comportamento do Windows).
      detachPending: mode === 'move' && (w.maximized || Boolean(w.snap)),
      moved: false,
      lastX: e.clientX,
      lastY: e.clientY,
      snap: null
    };
    gesture.origin = { ...current };
    gesture.captureEl = e.currentTarget;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro já terminou: segue sem captura (os ouvintes na window cobrem) */
    }
    document.body.classList.add(mode === 'move' ? 'is-dragging' : 'is-resizing');
    w.el.classList.add('is-gesture');
    // Ouvintes na window: funcionam com ou sem captura e nunca deixam o arraste “preso”.
    window.addEventListener('pointermove', onGestureMove);
    window.addEventListener('pointerup', endGesture);
    window.addEventListener('pointercancel', endGesture);
    window.addEventListener('blur', endGesture);
  }

  function onGestureMove(e) {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    gesture.lastX = e.clientX;
    gesture.lastY = e.clientY;
    if (!gestureRaf) gestureRaf = requestAnimationFrame(applyGesture);
  }

  function applyGesture() {
    gestureRaf = 0;
    const g = gesture;
    if (!g) return;
    const { w, area, start, mode } = g;
    const dx = g.lastX - g.startX;
    const dy = g.lastY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 3) return;
    g.moved = true;

    if (mode === 'move') {
      if (g.detachPending) {
        g.detachPending = false;
        g.wasDetached = true;
        const restore = toPx(w.rect, area);
        const ratio = (g.startX - g.deskRect.left - start.x) / start.w;
        start.w = restore.w;
        start.h = restore.h;
        start.x = g.startX - g.deskRect.left - ratio * restore.w;
        start.y = Math.max(area.top, g.startY - g.deskRect.top - TITLE_H / 2);
        w.maximized = false;
        w.snap = null;
        syncChrome();
      }
      const grab = Math.min(96, start.w);
      const x = clamp(start.x + dx, area.left - (start.w - grab), area.left + area.width - grab);
      const y = clamp(start.y + dy, area.top, area.top + area.height - TITLE_H);
      w.el.style.left = `${Math.round(x)}px`;
      w.el.style.top = `${Math.round(y)}px`;
      w.el.style.width = `${Math.round(start.w)}px`;
      w.el.style.height = `${Math.round(start.h)}px`;
      w.rect = toFrac({ x, y, w: start.w, h: start.h }, area);

      // Encaixe: ponteiro encostado na borda esquerda/direita → metade; no topo → maximizar.
      const px = g.lastX - g.deskRect.left;
      const py = g.lastY - g.deskRect.top;
      let snap = null;
      if (py <= area.top + SNAP_EDGE) snap = 'max';
      else if (px <= area.left + SNAP_EDGE) snap = 'left';
      else if (px >= area.left + area.width - SNAP_EDGE) snap = 'right';
      if (snap !== g.snap) {
        g.snap = snap;
        if (snap) {
          const r = toPx(SNAP_RECTS[snap], area);
          snapPreview.style.left = `${r.x}px`;
          snapPreview.style.top = `${r.y}px`;
          snapPreview.style.width = `${r.w}px`;
          snapPreview.style.height = `${r.h}px`;
          snapPreview.classList.add('is-visible');
        } else {
          snapPreview.classList.remove('is-visible');
        }
      }
      return;
    }

    // Redimensionar pela alça: cada letra da direção move uma borda.
    let { x, y, w: width, h: height } = start;
    const minW = Math.min(MIN_W, area.width);
    const minH = Math.min(MIN_H, area.height);
    const right = start.x + start.w;
    const bottom = start.y + start.h;
    if (mode.includes('e')) width = clamp(start.w + dx, minW, area.left + area.width - start.x);
    if (mode.includes('s')) height = clamp(start.h + dy, minH, area.top + area.height - start.y);
    if (mode.includes('w')) {
      x = clamp(start.x + dx, area.left, right - minW);
      width = right - x;
    }
    if (mode.includes('n')) {
      y = clamp(start.y + dy, area.top, bottom - minH);
      height = bottom - y;
    }
    if (w.maximized || w.snap) {
      w.maximized = false;
      w.snap = null;
      syncChrome();
    }
    w.el.style.left = `${Math.round(x)}px`;
    w.el.style.top = `${Math.round(y)}px`;
    w.el.style.width = `${Math.round(width)}px`;
    w.el.style.height = `${Math.round(height)}px`;
    w.rect = toFrac({ x, y, w: width, h: height }, area);
  }

  function endGesture(e) {
    if (gesture && e.pointerId !== undefined && e.pointerId !== gesture.pointerId) return;
    window.removeEventListener('pointermove', onGestureMove);
    window.removeEventListener('pointerup', endGesture);
    window.removeEventListener('pointercancel', endGesture);
    window.removeEventListener('blur', endGesture);
    if (!gesture) return;
    try {
      const el = gesture.captureEl;
      if (el?.hasPointerCapture?.(gesture.pointerId)) el.releasePointerCapture(gesture.pointerId);
    } catch {
      /* noop */
    }
    if (gestureRaf) {
      cancelAnimationFrame(gestureRaf);
      gestureRaf = 0;
      applyGesture();
    }
    const g = gesture;
    gesture = null;
    document.body.classList.remove('is-dragging', 'is-resizing');
    g.w.el.classList.remove('is-gesture');
    snapPreview.classList.remove('is-visible');
    if (g.mode === 'move' && g.snap && e.type === 'pointerup') {
      // Restaurar depois do encaixe volta para onde a janela estava antes do arraste.
      if (!g.wasDetached) g.w.rect = toFrac(g.origin, g.area);
      if (g.snap === 'max') g.w.maximized = true;
      else g.w.snap = g.snap;
      g.w.el.classList.add('is-animating');
      setTimeout(() => g.w.el.classList.remove('is-animating'), 240);
    }
    layout(g.w);
    syncChrome();
    persist();
  }

  /* ─── Dock e atalhos ─── */
  $$('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => dockActivate(btn.dataset.open));
  });

  // Alt+A organiza · Alt+W fecha · Alt+M minimiza a janela em foco.
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const code = e.code;
    const top = topWindow();
    if (code === 'KeyA' || k === 'a') {
      e.preventDefault();
      arrangeWindows();
    } else if ((code === 'KeyW' || k === 'w') && top) {
      e.preventDefault();
      closeWindow(top.name);
    } else if ((code === 'KeyM' || k === 'm') && top) {
      e.preventDefault();
      minimizeWindow(top.name);
    }
  });

  function onCompactChange() {
    compact = compactQuery.matches;
    document.body.classList.toggle('is-compact', compact);
    if (gesture) {
      gesture = null;
      document.body.classList.remove('is-dragging', 'is-resizing');
      snapPreview.classList.remove('is-visible');
    }
    layoutAll();
    syncChrome();
  }
  compactQuery.addEventListener?.('change', onCompactChange);
  document.body.classList.toggle('is-compact', compact);

  // Reposiciona tudo quando a área muda (resize, rotação, barra do navegador).
  if (window.ResizeObserver) {
    let roRaf = 0;
    new ResizeObserver(() => {
      if (roRaf) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = 0;
        if (!gesture) layoutAll();
      });
    }).observe(desktop);
  } else {
    window.addEventListener('resize', layoutAll);
  }

  /* ─── Fósforo / som / organizar ─── */
  function setPhosphor(mode) {
    if (mode !== 'green' && mode !== 'amber') mode = 'green';
    document.body.dataset.phosphor = mode;
    $$('.phos-btn').forEach((b) => {
      const active = b.dataset.phosphor === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = mode === 'amber' ? '#080604' : '#050806';
  }

  // O header compartilhado monta os slots de forma assíncrona; delegação cobre isso.
  document.addEventListener('click', (e) => {
    const phos = e.target.closest('.phos-btn');
    if (phos) {
      setPhosphor(phos.dataset.phosphor);
      setStatus(`phosphor :: ${phos.dataset.phosphor}`);
      persist();
      return;
    }
    if (e.target.closest('#arrangeBtn')) {
      arrangeWindows();
      return;
    }
    const snd = e.target.closest('#soundBtn');
    if (snd) {
      soundOn = !soundOn;
      syncSoundBtn();
      if (soundOn) sfx.open();
      setStatus(`audio :: ${soundOn ? 'on' : 'mute'}`);
      persist();
    }
  });

  function syncSoundBtn() {
    const btn = $('#soundBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(soundOn));
    btn.classList.toggle('is-off', !soundOn);
  }

  setPhosphor(saved.phosphor || document.body.dataset.phosphor || 'green');
  // Slots do header podem chegar depois; sincroniza no próximo tick também.
  setTimeout(() => {
    setPhosphor(document.body.dataset.phosphor);
    syncSoundBtn();
  }, 0);

  /* Relógio — usa o runtime compartilhado para pausar automaticamente em background. */
  function tickClock() {
    statusClock.textContent = new Date().toTimeString().slice(0, 8);
  }
  const sharedClock = window.LabRuntime ? LabRuntime.createInterval(tickClock, 1000) : null;
  tickClock();
  if (sharedClock) sharedClock.start();
  else {
    let clockTimer = setInterval(tickClock, 1000);
    document.addEventListener('visibilitychange', () => {
      clearInterval(clockTimer);
      if (!document.hidden) {
        tickClock();
        clockTimer = setInterval(tickClock, 1000);
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     Terminal
     ════════════════════════════════════════════════════════════════════ */
  const termOutput = $('#termOutput');
  const termForm = $('#termForm');
  const termInput = $('#termInput');
  const termPrompt = $('#termPrompt');
  const MAX_LINES = 400;

  function updatePrompt() {
    termPrompt.textContent = `guest@cyberos:${promptPath()}$`;
    const title = $('#title-terminal');
    if (title) title.textContent = `guest@cyberos — ${cwd}`;
  }

  function print(text, cls = 'line-out') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    termOutput.appendChild(line);
    while (termOutput.childElementCount > MAX_LINES) termOutput.firstElementChild.remove();
    termOutput.scrollTop = termOutput.scrollHeight;
  }

  const HELP = `CyberOS shell — comandos disponíveis

  help              lista de comandos
  ls [-a] [path]    listar diretório (-a mostra ocultos)
  cd [path]         mudar diretório
  cat <file>        ler arquivo
  pwd · whoami      caminho atual · identidade
  clear             limpar tela (Ctrl+L)
  neofetch          status do sistema
  uptime · date     tempo de sessão · data
  open | run <app>  terminal|firewall|oracle|cipher
  close <app>       fecha um app · min <app> minimiza
  arrange           organiza todas as janelas (Alt+A)
  theme <g|a>       fósforo green|amber
  hack              atalho p/ firewall
  oracle [pergunta] consulta o Oracle
  history · exit    histórico · fecha o terminal

Atalhos: TAB autocompleta · ↑/↓ histórico · Ctrl+C cancela
Janelas: arraste pela barra, redimensione pelas bordas,
duplo clique maximiza, encoste na borda para encaixar.

Dica: explore ~/secrets e ~/projects`;

  const APP_ALIASES = {
    terminal: 'terminal',
    term: 'terminal',
    firewall: 'firewall',
    hack: 'firewall',
    breach: 'firewall',
    oracle: 'oracle',
    ai: 'oracle',
    cipher: 'cipher',
    crypto: 'cipher',
    encrypt: 'cipher'
  };

  function cmdLs(args) {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const showHidden = flags.includes('a');
    const target = args.find((a) => !a.startsWith('-')) || '.';
    const { full, node } = resolve(target);
    if (!node) return print(`ls: ${target}: não encontrado`, 'line-err');
    if (node.type !== 'dir') return print(full.split('/').pop());
    const entries = listDir(full, showHidden);
    if (!entries.length) return print(showHidden ? '(vazio)' : '(vazio — tente ls -a)');
    print(
      entries
        .map((name) => {
          const child = FS[full === '/' ? `/${name}` : `${full}/${name}`];
          return child && child.type === 'dir' ? name + '/' : name;
        })
        .join('  ')
    );
  }

  function cmdCd(args) {
    const target = args[0] || '~';
    const { full, node } = resolve(target);
    if (!node) return print(`cd: ${target}: não encontrado`, 'line-err');
    if (node.type !== 'dir') return print(`cd: ${target}: não é diretório`, 'line-err');
    cwd = full || '/';
    updatePrompt();
  }

  function cmdCat(args) {
    if (!args[0]) return print('uso: cat <arquivo>', 'line-err');
    const { full, node } = resolve(args[0]);
    if (!node) return print(`cat: ${args[0]}: não encontrado`, 'line-err');
    if (node.type === 'dir') return print(`cat: ${args[0]}: é um diretório`, 'line-err');
    print(node.body);
    if (full.includes('secrets')) setStatus('acesso classificado concedido');
  }

  function cmdNeofetch() {
    const open = Array.from(wins.values()).filter((w) => w.open).length;
    print(`
        ▄▄▄▄▄▄▄
      ▄█████████▄     guest@cyberos
     ██▀  CYBER ▀██   ─────────────
     ██  OS v3.0 ██   OS: CyberOS Phosphor
      ▀█████████▀     Host: CRT-browser
        ▀▀▀▀▀▀▀       Shell: cyber-sh
                      WM: phosphor-wm (${open} janela${open === 1 ? '' : 's'})
                      Theme: ${document.body.dataset.phosphor || 'green'}
                      Uptime: ${formatUptime()}
                      Labs: matrix rock-kombat piano…
`);
  }

  function formatUptime() {
    const s = Math.floor((Date.now() - bootedAt) / 1000);
    const m = Math.floor(s / 60);
    return m ? `${m} min ${s % 60} s` : `${s} s`;
  }

  function cmdOpen(args) {
    const name = APP_ALIASES[(args[0] || '').toLowerCase()];
    if (!name) return print('apps: terminal, firewall, oracle, cipher', 'line-err');
    openWindow(name, { focusInput: name !== 'terminal' ? true : false });
    print(`abrindo ${name}…`, 'line-ok');
  }

  function cmdTheme(args) {
    const t = (args[0] || '').toLowerCase();
    if (['g', 'green', 'verde'].includes(t)) {
      setPhosphor('green');
      print('fósforo → green');
    } else if (['a', 'amber', 'ambar', 'âmbar'].includes(t)) {
      setPhosphor('amber');
      print('fósforo → amber');
    } else {
      return print('uso: theme green|amber', 'line-err');
    }
    persist();
  }

  function runCommand(raw) {
    const line = raw.trim();
    if (!line) return;
    if (history[history.length - 1] !== line) history.push(line);
    if (history.length > 100) history.shift();
    histIndex = history.length;
    print(`${termPrompt.textContent} ${line}`, 'line-cmd');

    if ((line.match(/"/g) || []).length % 2) {
      print('Feche as aspas duplas para executar o comando.', 'line-err');
      return;
    }
    const parts = (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map((p) => p.replace(/^"|"$/g, ''));
    if (!parts.length) return;
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
      case '?':
        print(HELP);
        break;
      case 'ls':
      case 'dir':
      case 'll':
        cmdLs(cmd === 'll' ? ['-a', ...args] : args);
        break;
      case 'cd':
        cmdCd(args);
        break;
      case 'cat':
      case 'type':
        cmdCat(args);
        break;
      case 'pwd':
        print(cwd);
        break;
      case 'clear':
      case 'cls':
        termOutput.replaceChildren();
        break;
      case 'whoami':
        print('guest  ·  clearance: curious');
        break;
      case 'neofetch':
      case 'fetch':
        cmdNeofetch();
        break;
      case 'uptime':
        print(`up ${formatUptime()} · 1 user · load average: 0.42 0.27 0.12`);
        break;
      case 'open':
      case 'run':
      case 'start':
        cmdOpen(args);
        break;
      case 'close':
      case 'kill': {
        const name = APP_ALIASES[(args[0] || '').toLowerCase()];
        if (!name) print('uso: close terminal|firewall|oracle|cipher', 'line-err');
        else {
          closeWindow(name);
          if (name !== 'terminal') print(`${name} encerrado`, 'line-ok');
        }
        break;
      }
      case 'min':
      case 'minimize': {
        const name = APP_ALIASES[(args[0] || '').toLowerCase()];
        if (!name) print('uso: min terminal|firewall|oracle|cipher', 'line-err');
        else minimizeWindow(name);
        break;
      }
      case 'arrange':
      case 'tile':
        arrangeWindows();
        print('janelas organizadas', 'line-ok');
        break;
      case 'exit':
      case 'logout':
        print('logout');
        setTimeout(() => closeWindow('terminal'), 120);
        break;
      case 'reboot':
        print('reiniciando…', 'line-ok');
        setTimeout(() => location.reload(), 500);
        break;
      case 'hack':
      case 'firewall':
        openWindow('firewall');
        print('FIREWALL BREACH iniciado', 'line-ok');
        break;
      case 'oracle':
        openWindow('oracle', { focusInput: false });
        if (args.length) {
          askOracle(args.join(' '));
          print('consulta enviada ao Oracle', 'line-ok');
        } else {
          print('Oracle online', 'line-ok');
        }
        break;
      case 'cipher':
      case 'encrypt':
        openWindow('cipher');
        print('Cipher Lab online', 'line-ok');
        break;
      case 'theme':
        cmdTheme(args);
        break;
      case 'sudo':
        print('guest is not in the sudoers file. This incident will be reported.', 'line-err');
        print('(brincadeira — mas tente `hack` ou `run firewall`)', 'line-ok');
        break;
      case 'history':
        if (!history.length) print('(sem histórico)');
        else history.forEach((h, i) => print(`${String(i + 1).padStart(3)}  ${h}`));
        break;
      case 'echo':
        print(args.join(' '));
        break;
      case 'date':
        print(new Date().toString());
        break;
      default:
        sfx.err();
        print(`${cmd}: comando não encontrado. digite help`, 'line-err');
    }
  }

  termForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = termInput.value;
    termInput.value = '';
    try {
      runCommand(value);
    } catch (err) {
      print(`kernel panic evitado: ${err.message || err}`, 'line-err');
    }
  });

  /* Autocompletar com Tab: completa o comando na 1ª palavra e caminhos nas seguintes. */
  const COMMANDS = [
    'help', 'ls', 'cd', 'cat', 'pwd', 'clear', 'whoami', 'neofetch', 'open', 'run', 'close', 'min',
    'arrange', 'theme', 'hack', 'oracle', 'cipher', 'history', 'echo', 'date', 'uptime', 'sudo', 'exit'
  ];

  function longestCommonPrefix(list) {
    if (!list.length) return '';
    return list.reduce((prefix, item) => {
      let i = 0;
      while (i < prefix.length && i < item.length && prefix[i] === item[i]) i++;
      return prefix.slice(0, i);
    });
  }

  function completePath(fragment) {
    const slash = fragment.lastIndexOf('/');
    const dirPart = slash >= 0 ? fragment.slice(0, slash + 1) : '';
    const namePart = slash >= 0 ? fragment.slice(slash + 1) : fragment;
    const { node, full } = resolve(dirPart || '.');
    if (!node || node.type !== 'dir') return null;
    const matches = listDir(full, namePart.startsWith('.'))
      .filter((name) => name.startsWith(namePart))
      .map((name) => {
        const childPath = full === '/' ? `/${name}` : `${full}/${name}`;
        return FS[childPath] && FS[childPath].type === 'dir' ? `${name}/` : name;
      });
    return { dirPart, namePart, matches };
  }

  function handleTabComplete() {
    const value = termInput.value;
    const parts = value.split(' ');
    if (parts.length === 1) {
      const matches = COMMANDS.filter((c) => c.startsWith(parts[0]));
      if (!matches.length) return;
      termInput.value = matches.length === 1 ? `${matches[0]} ` : longestCommonPrefix(matches);
      if (matches.length > 1) print(matches.join('  '));
      return;
    }
    const first = parts[0].toLowerCase();
    if (['open', 'run', 'close', 'min', 'start'].includes(first) && parts.length === 2) {
      const apps = ['terminal', 'firewall', 'oracle', 'cipher'].filter((a) => a.startsWith(parts[1]));
      if (apps.length === 1) termInput.value = `${parts[0]} ${apps[0]}`;
      else if (apps.length) print(apps.join('  '));
      return;
    }
    const result = completePath(parts[parts.length - 1]);
    if (!result || !result.matches.length) return;
    const completion = result.matches.length === 1 ? result.matches[0] : longestCommonPrefix(result.matches);
    parts[parts.length - 1] = result.dirPart + completion;
    termInput.value = parts.join(' ');
    if (result.matches.length > 1) print(result.matches.join('  '));
  }

  $('#termTab').addEventListener('click', () => {
    handleTabComplete();
    termInput.focus({ preventScroll: true });
  });

  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      termOutput.replaceChildren();
      return;
    }
    // Ctrl+C sem seleção cancela a linha (com seleção, copia normalmente).
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && termInput.selectionStart === termInput.selectionEnd) {
      e.preventDefault();
      print(`${termPrompt.textContent} ${termInput.value}^C`, 'line-cmd');
      termInput.value = '';
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      histIndex = Math.max(0, histIndex - 1);
      termInput.value = history[histIndex] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIndex = Math.min(history.length, histIndex + 1);
      termInput.value = history[histIndex] || '';
    } else if (e.key.length === 1) {
      sfx.key();
    }
  });

  // Clicar no corpo do terminal (sem selecionar texto) devolve o foco ao prompt.
  $('.terminal-body').addEventListener('click', (e) => {
    if (e.target.closest('button, input')) return;
    if (String(window.getSelection?.() || '').length) return;
    termInput.focus({ preventScroll: true });
  });

  /* ════════════════════════════════════════════════════════════════════
     Firewall Breach — memória de sequência (Simon)
     Regras:
      - Camada N mostra N+2 nós (começa com 3 para não ser trivial).
      - O tempo de cada flash cai com a camada: flash = max(230, 520 − 38·N) ms.
      - Errar derruba a breach (reinicia do zero); 8 camadas = root.
      - Pontos por camada = 100 · N, bônus de velocidade se responder rápido.
     ════════════════════════════════════════════════════════════════════ */
  const fwGrid = $('#fwGrid');
  const fwStatus = $('#fwStatus');
  const fwLayerEl = $('#fwLayer');
  const fwScoreEl = $('#fwScore');
  const fwBestEl = $('#fwBest');
  const fwProgress = $('#fwProgress');
  const fwStartBtn = $('#fwStart');
  const NODES = 9;
  const LAYERS = 8;
  const NODE_FREQ = [262, 294, 330, 349, 392, 440, 494, 523, 587];
  let fwSeq = [];
  let fwPlayer = [];
  let fwAccept = false;
  let fwLevel = 1;
  let fwPoints = 0;
  let fwGen = 0; // invalida reproduções antigas quando o jogo é reiniciado
  let fwTurnStart = 0;
  let fwBest = Number(saved.fwBest) || 0;
  fwBestEl.textContent = String(fwBest);

  function buildFwGrid() {
    fwGrid.replaceChildren();
    for (let i = 0; i < NODES; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fw-node';
      btn.dataset.idx = String(i);
      btn.textContent = String(i + 1);
      btn.setAttribute('aria-label', `Nó ${i + 1}`);
      btn.disabled = true;
      fwGrid.appendChild(btn);
    }
  }

  fwGrid.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.fw-node');
    if (!btn || btn.disabled) return;
    e.preventDefault(); // resposta imediata no toque, sem esperar o click
    onFwPress(Number(btn.dataset.idx));
  });
  fwGrid.addEventListener('click', (e) => {
    // Teclado (Enter/Espaço) gera click com detail 0.
    const btn = e.target.closest('.fw-node');
    if (btn && e.detail === 0) onFwPress(Number(btn.dataset.idx));
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function setNodesEnabled(on) {
    $$('.fw-node', fwGrid).forEach((n) => {
      n.disabled = !on;
    });
  }

  function lightNode(idx, ms) {
    const btn = fwGrid.children[idx];
    if (!btn) return;
    btn.classList.add('is-lit');
    beep(NODE_FREQ[idx], Math.min(ms, 260), 'triangle', 0.05);
    setTimeout(() => btn.classList.remove('is-lit'), ms);
  }

  async function playSequence(gen) {
    fwAccept = false;
    setNodesEnabled(false);
    $$('.fw-node', fwGrid).forEach((n) => n.classList.remove('is-ok', 'is-bad'));
    fwStatus.textContent = `Camada ${fwLevel}: observe ${fwSeq.length} nós…`;
    const flash = Math.max(230, 520 - 38 * fwLevel);
    await sleep(550);
    for (const idx of fwSeq) {
      if (gen !== fwGen) return;
      lightNode(idx, flash);
      await sleep(flash + 130);
    }
    if (gen !== fwGen) return;
    fwAccept = true;
    fwTurnStart = performance.now();
    setNodesEnabled(true);
    fwStatus.textContent = 'Sua vez. Reproduza a sequência — um erro derruba a breach.';
  }

  function updateFwHud() {
    fwLayerEl.textContent = String(fwLevel);
    fwScoreEl.textContent = String(fwPoints);
    fwProgress.style.width = `${((fwLevel - 1) / LAYERS) * 100}%`;
  }

  function startFwRound(reset) {
    if (reset) {
      fwSeq = [];
      fwLevel = 1;
      fwPoints = 0;
      fwGen++;
      // Camada 1 já começa com 3 nós.
      while (fwSeq.length < 2) fwSeq.push(Math.floor(Math.random() * NODES));
    }
    fwPlayer = [];
    fwSeq.push(Math.floor(Math.random() * NODES));
    updateFwHud();
    fwStartBtn.textContent = 'REINICIAR';
    playSequence(fwGen);
  }

  function endBreach(won) {
    fwAccept = false;
    setNodesEnabled(false);
    fwStartBtn.textContent = won ? 'NOVA BREACH' : 'TENTAR DE NOVO';
    if (fwPoints > fwBest) {
      fwBest = fwPoints;
      fwBestEl.textContent = String(fwBest);
      persist();
    }
  }

  async function onFwPress(idx) {
    if (!fwAccept) return;
    const btn = fwGrid.children[idx];
    fwPlayer.push(idx);
    const expected = fwSeq[fwPlayer.length - 1];
    lightNode(idx, 160);

    if (idx !== expected) {
      btn.classList.add('is-bad');
      fwGrid.children[expected]?.classList.add('is-ok');
      sfx.err();
      fwStatus.textContent = `INTRUSION FAILED — era o nó ${expected + 1}. Score ${fwPoints}.`;
      setStatus('firewall :: breach failed');
      endBreach(false);
      return;
    }

    btn.classList.add('is-ok');
    setTimeout(() => btn.classList.remove('is-ok'), 220);
    if (fwPlayer.length < fwSeq.length) return;

    fwAccept = false;
    setNodesEnabled(false);
    const secs = (performance.now() - fwTurnStart) / 1000;
    const bonus = Math.max(0, Math.round((fwSeq.length * 0.8 - secs) * 20));
    fwPoints += fwLevel * 100 + bonus;
    if (fwLevel >= LAYERS) {
      fwProgress.style.width = '100%';
      fwScoreEl.textContent = String(fwPoints);
      fwStatus.textContent = `FIREWALL DOWN — root concedido. Score ${fwPoints}.`;
      setStatus('firewall :: breached');
      print('// firewall desativado via HACK app', 'line-ok');
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 140, 'triangle', 0.05), i * 110));
      endBreach(true);
      return;
    }
    fwLevel += 1;
    updateFwHud();
    fwStatus.textContent = `Camada ${fwLevel - 1} ok${bonus ? ` · +${bonus} rapidez` : ''}. Preparando próxima…`;
    const gen = fwGen;
    await sleep(650);
    if (gen === fwGen) startFwRound(false);
  }

  fwStartBtn.addEventListener('click', () => startFwRound(true));
  $('#fwReset').addEventListener('click', () => {
    fwGen++;
    fwAccept = false;
    fwSeq = [];
    fwPlayer = [];
    fwLevel = 1;
    fwPoints = 0;
    updateFwHud();
    fwStartBtn.textContent = 'INICIAR BREACH';
    fwStatus.textContent = 'Memorize a sequência de nós e reproduza para derrubar a camada. 8 camadas até o root.';
    buildFwGrid();
  });

  // Teclas 1–9 quando o Firewall é a janela em foco.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (topWindow()?.name !== 'firewall') return;
    if (e.target.closest?.('input, textarea, select')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && fwAccept) {
      e.preventDefault();
      onFwPress(n - 1);
    }
  });

  buildFwGrid();
  updateFwHud();

  /* ════════════════════════════════════════════════════════════════════
     Oracle
     ════════════════════════════════════════════════════════════════════ */
  const oracleLog = $('#oracleLog');
  const oracleForm = $('#oracleForm');
  const oracleInput = $('#oracleInput');

  const ORACLE_KB = [
    {
      keys: ['matrix', 'chuva', 'katakana'],
      answer:
        'Matrix é Canvas puro: colunas de streams com katakana espelhado, head glow e bloom CRT. Modo cinema com a tecla H. Sem libs — só requestAnimationFrame e tipografia.'
    },
    {
      keys: ['rock', 'kombat', 'luta', 'fight'],
      answer:
        'Rock Kombat mistura fighting arcade com lendas do rock. Tem rig de sprites, áudio próprio e especiais. Foi um dos labs mais ambiciosos em gameplay + trilha.'
    },
    {
      keys: ['piano', 'teclado', 'synth'],
      answer:
        'O Piano sintetiza as notas no Web Audio API (sem samples pesados): envelope ADSR, 4 oitavas e sustain. Bom exemplo de áudio “de verdade” 100% no cliente.'
    },
    {
      keys: ['pulsar', 'orbe', 'generativ'],
      answer:
        'Pulsar é um instrumento generativo: cada toque cria orbes que pulsam, se conectam e improvisam harmonia. Visual + Web Audio andando juntos.'
    },
    {
      keys: ['space', 'shooter', 'neon', 'invader'],
      answer:
        'Neon Invaders é arcade clássico com partículas e glow cyberpunk — a mesma vibe de fósforo que inspirou o CyberOS.'
    },
    {
      keys: ['tamagotchi', 'dino', 'pet'],
      answer:
        'RakuRaku Dinokun recria o Dinkie Dino de 1997: hardware virtual, jan-ken-po e até ar-condicionado. Nostalgia com regras fiéis.'
    },
    {
      keys: ['winamp', 'mp3', 'equalizer'],
      answer:
        'Winamp JS é um clone visual do player clássico, com equalizer e vibe skin dos anos 90. Nostalgia de desktop empacotada em HTML.'
    },
    {
      keys: ['tetris', 'snake', 'minesweeper', 'campo minado'],
      answer:
        'Os clássicos (Tetris GB, Snake Nokia, Campo Minado 95) são estudos de UI retrô + game loop limpo. Cada um carrega a “casca” visual da época.'
    },
    {
      keys: ['janela', 'window', 'arrast', 'drag'],
      answer:
        'O gerenciador de janelas usa Pointer Events com captura: 8 alças de redimensionamento, encaixe nas bordas e geometria salva em frações da tela — nenhuma janela se perde fora da área visível.'
    },
    {
      keys: ['stack', 'tecnologia', 'feito', 'constru', 'como'],
      answer:
        'Quase tudo nos Labs é HTML + CSS + JS vanilla (às vezes Canvas/Web Audio). Sem build step pesado: abre a pasta e roda. O craft está na interação e no visual.'
    },
    {
      keys: ['diogo', 'quem', 'autor', 'voce', 'você'],
      answer:
        'Diogo Paulino — Tech Manager, design & code lover. Este CyberOS é um playground pra recrutadores e nerds explorarem o portfólio como se fosse um SO dos anos 80.'
    },
    {
      keys: ['cyberos', 'este', 'terminal'],
      answer:
        'CyberOS é um SO fictício no browser: terminal com FS virtual, minijogo de firewall (memória de sequência), Cipher Lab e eu — o Oracle — com easter eggs dos outros labs.'
    },
    {
      keys: ['easter', 'segredo', 'egg', 'curiosidade', 'fato'],
      answer:
        'Curiosidade: na home, clicar várias vezes no avatar revela o badge “labs”. Aqui dentro, `cat ~/secrets/.recruiters_readme` e `neofetch` também escondem carinho.'
    },
    {
      keys: ['recrut', 'vaga', 'trabalh', 'hire'],
      answer:
        'Se está recrutando: explore `~/about.txt` e `~/skills.md`. O diferencial não é só código — é produto com personalidade. Fale comigo ou abra o LinkedIn no site principal.'
    },
    {
      keys: ['musica', 'música', 'spotify', 'audio', 'áudio'],
      answer:
        'Música atravessa vários labs: Piano, Pulsar, Partitura: Maestro Quest, Winamp JS, Rock Kombat. Diogo também tem perfil de artista no Spotify (link na home).'
    }
  ];

  const ORACLE_FALLBACK = [
    'Sinais fracos… reformule. Tente perguntar sobre matrix, piano, rock kombat ou “curiosidade”.',
    'Não decodifiquei. Sugestão: “como o matrix foi feito?” ou “stack”.',
    'Oracle offline parcial. Pergunte sobre um lab específico — matrix, pulsar, tamagotchi…'
  ];

  function appendOracle(text, who) {
    const el = document.createElement('div');
    el.className = `oracle-msg ${who}`;
    el.textContent = who === 'user' ? `você › ${text}` : text;
    oracleLog.appendChild(el);
    while (oracleLog.childElementCount > 120) oracleLog.firstElementChild.remove();
    oracleLog.scrollTop = oracleLog.scrollHeight;
    return el;
  }

  function askOracle(question) {
    const q = question.trim();
    if (!q) return;
    appendOracle(q, 'user');
    const lower = q.toLowerCase();
    const hit = ORACLE_KB.find((entry) => entry.keys.some((k) => lower.includes(k)));
    const answer = hit ? hit.answer : ORACLE_FALLBACK[Math.floor(Math.random() * ORACLE_FALLBACK.length)];
    const typing = appendOracle('decodificando', 'bot is-typing');
    setTimeout(() => {
      typing.remove();
      appendOracle(answer, 'bot');
      beep(880, 50, 'triangle', 0.02);
      setStatus('oracle :: reply sent');
    }, 320 + Math.random() * 420);
  }

  oracleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = oracleInput.value;
    oracleInput.value = '';
    askOracle(q);
  });

  $$('[data-ask]').forEach((chip) => {
    chip.addEventListener('click', () => askOracle(chip.dataset.ask));
  });

  appendOracle(
    'Canal aberto. Pergunte como os labs foram construídos, peça uma curiosidade ou digite help no terminal.',
    'bot'
  );

  /* ════════════════════════════════════════════════════════════════════
     Cipher Lab — processa ao vivo enquanto digita
     ════════════════════════════════════════════════════════════════════ */
  let cipherMode = 'encode';
  const cipherIn = $('#cipherIn');
  const cipherOut = $('#cipherOut');
  const cipherAlgo = $('#cipherAlgo');

  function setCipherMode(mode) {
    cipherMode = mode;
    $$('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === cipherMode;
      b.classList.toggle('is-active', on);
      b.classList.toggle('ghost', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    runCipher();
  }

  $$('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setCipherMode(btn.dataset.mode));
  });

  function mapAlpha(str, fn) {
    return str.replace(/[A-Za-z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(fn(ch.charCodeAt(0) - base) + base);
    });
  }
  const caesar = (str, shift) => mapAlpha(str, (n) => (n + shift + 26) % 26);
  const atbash = (str) => mapAlpha(str, (n) => 25 - n);

  function xorCipher(str, key = 'Cyber') {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      out.push(String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return out.join('');
  }

  function toHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    return hex;
  }

  function fromHex(hex) {
    const clean = hex.replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) throw new Error('hex inválido');
    let out = '';
    for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    return out;
  }

  function runCipher() {
    const algo = cipherAlgo.value;
    const input = cipherIn.value;
    const enc = cipherMode === 'encode';
    cipherOut.classList.remove('is-error');
    if (!input) {
      cipherOut.value = '';
      return;
    }
    try {
      let out;
      switch (algo) {
        case 'caesar':
          out = caesar(input, enc ? 3 : -3);
          break;
        case 'rot13':
          out = caesar(input, 13);
          break;
        case 'atbash':
          out = atbash(input);
          break;
        case 'xor':
          // Mantém o hex legado para Latin-1. O prefixo identifica bytes UTF-8.
          if (enc && /[^\u0000-ÿ]/.test(input)) {
            const bytes = new TextEncoder().encode(input);
            const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
            out = 'u8:' + toHex(xorCipher(binary));
          } else if (!enc && input.startsWith('u8:')) {
            const binary = xorCipher(fromHex(input.slice(3)));
            out = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
          } else {
            out = enc ? toHex(xorCipher(input)) : xorCipher(fromHex(input));
          }
          break;
        case 'base64':
          out = enc
            ? btoa(String.fromCharCode(...new TextEncoder().encode(input)))
            : new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0)));
          break;
        default:
          out = input;
      }
      cipherOut.value = out;
    } catch (err) {
      cipherOut.value = `erro: ${err.message || 'entrada inválida'} — está no modo certo?`;
      cipherOut.classList.add('is-error');
    }
  }

  let cipherTimer = 0;
  cipherIn.addEventListener('input', () => {
    clearTimeout(cipherTimer);
    cipherTimer = setTimeout(runCipher, 60);
  });
  cipherAlgo.addEventListener('change', () => {
    runCipher();
    setStatus(`cipher :: ${cipherAlgo.value}`);
  });

  $('#cipherSwap').addEventListener('click', () => {
    if (cipherOut.classList.contains('is-error') || !cipherOut.value) return;
    cipherIn.value = cipherOut.value;
    setCipherMode(cipherMode === 'encode' ? 'decode' : 'encode');
    setStatus(`cipher :: invertido para ${cipherMode === 'encode' ? 'cifrar' : 'decifrar'}`);
  });
  $('#cipherClear').addEventListener('click', () => {
    cipherIn.value = '';
    runCipher();
    cipherIn.focus({ preventScroll: true });
  });
  $('#cipherCopy').addEventListener('click', async () => {
    const text = cipherOut.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('cipher :: copiado');
    } catch {
      cipherOut.select();
      setStatus('cipher :: selecione e copie manualmente');
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     Boot
     ════════════════════════════════════════════════════════════════════ */
  const BOOT_LINES = [
    'CYBEROS BIOS v3.0 — phosphor init',
    'Checking memory ................ OK',
    'Mounting /home/guest ............ OK',
    'Loading neo-tty driver .......... OK',
    'Starting phosphor-wm ............ OK',
    'Seeding oracle knowledge base ... OK',
    'Firewall nodes online ........... 9',
    'Cipher algorithms ............... 5',
    '',
    'Welcome, guest. Type help to begin.'
  ];

  let booted = false;

  function finishBoot() {
    if (booted) return;
    booted = true;
    bootScreen.classList.add('is-done');
    crtFrame.hidden = false;
    setTimeout(() => {
      bootScreen.hidden = true;
    }, 520);
    updatePrompt();
    print('CyberOS v3.0 — session started', 'line-ok');
    print('Digite help · explore ~/projects · ou abra apps no dock');
    print('');

    // Restaura as janelas da última sessão; se nada estava aberto, abre o terminal.
    const ordered = Array.from(wins.values());
    let anyOpen = false;
    for (const w of ordered) {
      if (!w.open) continue;
      anyOpen = true;
      layout(w);
      w.z = ++zCounter;
      w.el.style.zIndex = String(w.z);
      if (w.minimized) {
        w.el.hidden = true;
        w.el.classList.add('is-minimized');
      } else {
        showEl(w);
      }
    }
    if (!anyOpen || !topWindow()) openWindow('terminal');
    else focusWindow(topWindow(), { focusInput: true });
    syncChrome();
  }

  async function boot() {
    bootLog.textContent = '';
    for (const line of BOOT_LINES) {
      if (booted) return;
      bootLog.textContent += line + '\n';
      await sleep(70 + Math.random() * 60);
    }
    await sleep(260);
    finishBoot();
  }

  $('#bootSkip').addEventListener('click', finishBoot);
  bootScreen.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#bootSkip')) finishBoot();
  });
  document.addEventListener('keydown', (e) => {
    if (!booted && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      finishBoot();
    }
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishBoot();
  else boot();
})();
