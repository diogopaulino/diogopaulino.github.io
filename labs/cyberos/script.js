(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const statusMsg = $('#statusMsg');
  const statusClock = $('#statusClock');
  const bootScreen = $('#bootScreen');
  const bootLog = $('#bootLog');
  const crtFrame = $('#crtFrame');

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
      body: `[ok] clique 5x no avatar da home → badge labs
[ok] matrix cinema mode: tecla H
[ok] cyberos: tente "neofetch", "hack", "sudo"
[ok] cipher: envie uma mensagem ROT13 pra um amigo`
    },
    '/bin': { type: 'dir' },
    '/bin/firewall': { type: 'file', body: 'Executable stub. Use: run firewall' },
    '/bin/oracle': { type: 'file', body: 'Executable stub. Use: run oracle' },
    '/bin/cipher': { type: 'file', body: 'Executable stub. Use: run cipher' }
  };

  const HOME = '/home/guest';
  let cwd = HOME;
  let zCounter = 20;
  const history = [];
  let histIndex = -1;

  function normalizePath(input) {
    if (!input || input === '~') return HOME;
    if (input.startsWith('~/')) input = HOME + input.slice(1);
    let parts;
    if (input.startsWith('/')) {
      parts = input.split('/');
    } else {
      parts = (cwd + '/' + input).split('/');
    }
    const stack = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return '/' + stack.join('/') || '/';
  }

  function resolve(path) {
    const full = normalizePath(path);
    return { full, node: FS[full] };
  }

  function listDir(path) {
    const full = normalizePath(path);
    const prefix = full === '/' ? '/' : full + '/';
    const names = new Set();
    for (const key of Object.keys(FS)) {
      if (key === full) continue;
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest) continue;
      const name = rest.split('/')[0];
      names.add(name);
    }
    return Array.from(names).sort((a, b) => {
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

  /* ─── Window manager ─── */
  function openWindow(name) {
    const win = $(`#win-${name}`);
    if (!win) return;
    win.hidden = false;
    requestAnimationFrame(() => win.classList.add('is-open'));
    focusWindow(win);
    setStatus(`app :: ${name} online`);
  }

  function closeWindow(name) {
    const win = $(`#win-${name}`);
    if (!win) return;
    win.classList.remove('is-open', 'is-focused');
    setTimeout(() => {
      if (!win.classList.contains('is-open')) win.hidden = true;
    }, 280);
  }

  function focusWindow(win) {
    $$('.window').forEach((w) => w.classList.remove('is-focused'));
    win.classList.add('is-focused');
    win.style.zIndex = String(++zCounter);
  }

  function setStatus(msg) {
    if (statusMsg) statusMsg.textContent = msg;
  }

  $$('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openWindow(btn.dataset.open));
  });

  $$('[data-close]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeWindow(btn.dataset.close);
    });
  });

  $$('.window').forEach((win) => {
    win.addEventListener('pointerdown', () => focusWindow(win));
  });

  /* Drag windows (desktop) */
  let drag = null;

  $$('[data-drag]').forEach((bar) => {
    bar.addEventListener('pointerdown', (e) => {
      if (window.matchMedia('(max-width: 820px)').matches) return;
      if (e.target.closest('.win-close')) return;
      const win = bar.closest('.window');
      focusWindow(win);
      const rect = win.getBoundingClientRect();
      const parent = $('#desktop').getBoundingClientRect();
      drag = {
        win,
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        parent
      };
      // Best-effort: lança InvalidStateError se o ponteiro já terminou.
      try {
          bar.setPointerCapture(e.pointerId);
      } catch (err) {
          /* segue sem captura */
      }
    });

    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const { win, ox, oy, parent } = drag;
      let x = e.clientX - parent.left - ox;
      let y = e.clientY - parent.top - oy;
      x = Math.max(0, Math.min(x, parent.width - 80));
      y = Math.max(0, Math.min(y, parent.height - 40));
      win.style.left = `${(x / parent.width) * 100}%`;
      win.style.top = `${(y / parent.height) * 100}%`;
      win.style.setProperty('--wx', win.style.left);
      win.style.setProperty('--wy', win.style.top);
    });

    const endDrag = () => {
      drag = null;
    };

    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
    bar.addEventListener('lostpointercapture', endDrag);
  });

  /* Phosphor */
  function setPhosphor(mode) {
    document.body.dataset.phosphor = mode;
    $$('.phos-btn').forEach((b) => {
      const active = b.dataset.phosphor === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  $$('.phos-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPhosphor(btn.dataset.phosphor);
      setStatus(`phosphor :: ${btn.dataset.phosphor}`);
    });
  });

  setPhosphor(document.body.dataset.phosphor || 'green');

  /* Clock — pausa quando a aba está oculta para não acordar o main thread à toa */
  let clockTimer = null;

  function tickClock() {
    const now = new Date();
    statusClock.textContent = now.toTimeString().slice(0, 8);
  }

  function startClock() {
    tickClock();
    if (clockTimer === null) clockTimer = setInterval(tickClock, 1000);
  }

  function stopClock() {
    if (clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopClock();
    else startClock();
  });

  startClock();

  /* ─── Terminal ─── */
  const termOutput = $('#termOutput');
  const termForm = $('#termForm');
  const termInput = $('#termInput');
  const termPrompt = $('#termPrompt');

  function updatePrompt() {
    termPrompt.textContent = `guest@cyberos:${promptPath()}$`;
    const title = $('.win-title', $('#win-terminal'));
    if (title) title.textContent = `guest@cyberos — ${cwd}`;
  }

  function print(text, cls = 'line-out') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    termOutput.appendChild(line);
    termOutput.scrollTop = termOutput.scrollHeight;
  }

  const HELP = `CyberOS shell — comandos disponíveis

  help              lista de comandos
  ls [path]         listar diretório
  cd [path]         mudar diretório
  cat <file>        ler arquivo
  pwd               caminho atual
  clear             limpar tela
  whoami            identidade
  neofetch          status do sistema
  open | run <app>  terminal|firewall|oracle|cipher
  theme <g|a>       fósforo green|amber
  hack              atalho p/ firewall
  oracle [pergunta] consulta o Oracle
  history           histórico de comandos

Atalhos: TAB autocompleta · ↑/↓ navega no histórico

Dica: explore ~/secrets e ~/projects`;

  function cmdHelp() {
    print(HELP);
  }

  function cmdLs(args) {
    const target = args[0] || '.';
    const { full, node } = resolve(target);
    if (!node) return print(`ls: ${target}: não encontrado`, 'line-err');
    if (node.type !== 'dir') return print(full.split('/').pop());
    const entries = listDir(full);
    if (!entries.length) return print('(vazio)');
    const formatted = entries
      .map((name) => {
        const child = FS[full === '/' ? `/${name}` : `${full}/${name}`];
        return child && child.type === 'dir' ? name + '/' : name;
      })
      .join('  ');
    print(formatted);
  }

  function cmdCd(args) {
    const target = args[0] || '~';
    const { full, node } = resolve(target);
    if (!node) return print(`cd: ${target}: não encontrado`, 'line-err');
    if (node.type !== 'dir') return print(`cd: ${target}: não é diretório`, 'line-err');
    cwd = full === '' ? '/' : full;
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

  function cmdPwd() {
    print(cwd);
  }

  function cmdWhoami() {
    print('guest  ·  clearance: curious');
  }

  function cmdClear() {
    termOutput.innerHTML = '';
  }

  function cmdNeofetch() {
    print(`
        ▄▄▄▄▄▄▄
      ▄█████████▄     guest@cyberos
     ██▀  CYBER ▀██   ─────────────
     ██  OS v2.7 ██   OS: CyberOS Phosphor
      ▀█████████▀     Host: CRT-browser
        ▀▀▀▀▀▀▀       Shell: cyber-sh
                      Theme: ${document.body.dataset.phosphor || 'green'}
                      Uptime: ∞ sessions
                      Labs: matrix rock-kombat piano…
`);
  }

  function cmdOpen(args) {
    const app = (args[0] || '').toLowerCase();
    const map = {
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
    const name = map[app];
    if (!name) {
      print('apps: terminal, firewall, oracle, cipher', 'line-err');
      return;
    }
    openWindow(name);
    print(`abrindo ${name}…`, 'line-ok');
  }

  function cmdTheme(args) {
    const t = (args[0] || '').toLowerCase();
    if (t === 'g' || t === 'green' || t === 'verde') {
      setPhosphor('green');
      print('fósforo → green');
    } else if (t === 'a' || t === 'amber' || t === 'ambar' || t === 'âmbar') {
      setPhosphor('amber');
      print('fósforo → amber');
    } else {
      print('uso: theme green|amber', 'line-err');
    }
  }

  function cmdSudo() {
    print('guest is not in the sudoers file. This incident will be reported.', 'line-err');
    print('(brincadeira — mas tente `hack` ou `run firewall`)', 'line-ok');
  }

  function cmdHistory() {
    if (!history.length) return print('(sem histórico)');
    history.forEach((h, i) => print(`${String(i + 1).padStart(3)}  ${h}`));
  }

  function runCommand(raw) {
    const line = raw.trim();
    if (!line) return;
    history.push(line);
    histIndex = history.length;
    print(`${termPrompt.textContent} ${line}`, 'line-cmd');

    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g).map((p) => p.replace(/^"|"$/g, ''));
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
      case '?':
        cmdHelp();
        break;
      case 'ls':
      case 'dir':
        cmdLs(args);
        break;
      case 'cd':
        cmdCd(args);
        break;
      case 'cat':
      case 'type':
        cmdCat(args);
        break;
      case 'pwd':
        cmdPwd();
        break;
      case 'clear':
      case 'cls':
        cmdClear();
        break;
      case 'whoami':
        cmdWhoami();
        break;
      case 'neofetch':
      case 'fetch':
        cmdNeofetch();
        break;
      case 'open':
      case 'run':
      case 'start':
        cmdOpen(args);
        break;
      case 'hack':
      case 'firewall':
        openWindow('firewall');
        print('FIREWALL BREACH iniciado', 'line-ok');
        break;
      case 'oracle':
        if (args.length) {
          openWindow('oracle');
          askOracle(args.join(' '));
          print('consulta enviada ao Oracle', 'line-ok');
        } else {
          openWindow('oracle');
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
        cmdSudo();
        break;
      case 'history':
        cmdHistory();
        break;
      case 'echo':
        print(args.join(' '));
        break;
      case 'date':
        print(new Date().toString());
        break;
      default:
        print(`${cmd}: comando não encontrado. digite help`, 'line-err');
    }
  }

  termForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = termInput.value;
    termInput.value = '';
    runCommand(value);
  });

  /* Autocompletar com Tab: completa o comando na 1ª palavra e caminhos nas seguintes. */
  const COMMANDS = [
    'help', 'ls', 'cd', 'cat', 'pwd', 'clear', 'whoami', 'neofetch', 'open', 'run',
    'theme', 'hack', 'oracle', 'cipher', 'history', 'echo', 'date', 'sudo'
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

    const matches = listDir(full)
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
    const isFirstWord = parts.length === 1;

    if (isFirstWord) {
      const matches = COMMANDS.filter((c) => c.startsWith(parts[0]));
      if (!matches.length) return;
      termInput.value = matches.length === 1 ? `${matches[0]} ` : longestCommonPrefix(matches);
      if (matches.length > 1) print(matches.join('  '));
      return;
    }

    const result = completePath(parts[parts.length - 1]);
    if (!result || !result.matches.length) return;
    const completion =
      result.matches.length === 1 ? result.matches[0] : longestCommonPrefix(result.matches);
    parts[parts.length - 1] = result.dirPart + completion;
    termInput.value = parts.join(' ');
    if (result.matches.length > 1) print(result.matches.join('  '));
  }

  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
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
    }
  });

  /* ─── Firewall minigame (Simon / sequence) ─── */
  const fwGrid = $('#fwGrid');
  const fwStatus = $('#fwStatus');
  const fwLayer = $('#fwLayer');
  const fwScore = $('#fwScore');
  const NODES = 9;
  let fwSeq = [];
  let fwPlayer = [];
  let fwPlaying = false;
  let fwAccept = false;
  let fwLevel = 1;
  let fwPoints = 0;

  function buildFwGrid() {
    fwGrid.innerHTML = '';
    for (let i = 0; i < NODES; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fw-node';
      btn.dataset.idx = String(i);
      btn.textContent = i.toString(16).toUpperCase();
      btn.disabled = true;
      btn.addEventListener('click', () => onFwPress(i, btn));
      fwGrid.appendChild(btn);
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function flashNode(idx, ms = 380) {
    const btn = fwGrid.children[idx];
    if (!btn) return;
    btn.classList.add('is-lit');
    await sleep(ms);
    btn.classList.remove('is-lit');
    await sleep(120);
  }

  async function playSequence() {
    fwAccept = false;
    $$('.fw-node', fwGrid).forEach((n) => {
      n.disabled = true;
      n.classList.remove('is-ok', 'is-bad');
    });
    fwStatus.textContent = 'Observe a sequência de nós…';
    await sleep(450);
    for (const idx of fwSeq) {
      await flashNode(idx);
    }
    fwAccept = true;
    $$('.fw-node', fwGrid).forEach((n) => {
      n.disabled = false;
    });
    fwStatus.textContent = 'Reproduza a sequência. Um erro reinicia a camada.';
  }

  function startFwRound(resetSeq) {
    if (resetSeq) {
      fwSeq = [];
      fwLevel = 1;
      fwPoints = 0;
    }
    fwPlayer = [];
    fwLayer.textContent = String(fwLevel);
    fwScore.textContent = String(fwPoints);
    fwSeq.push(Math.floor(Math.random() * NODES));
    fwPlaying = true;
    playSequence();
  }

  async function onFwPress(idx, btn) {
    if (!fwAccept || !fwPlaying) return;
    fwPlayer.push(idx);
    const expected = fwSeq[fwPlayer.length - 1];
    btn.classList.add('is-lit');
    setTimeout(() => btn.classList.remove('is-lit'), 180);

    if (idx !== expected) {
      fwAccept = false;
      btn.classList.add('is-bad');
      fwStatus.textContent = 'INTRUSION FAILED — sequência incorreta. Tente de novo.';
      setStatus('firewall :: breach failed');
      $$('.fw-node', fwGrid).forEach((n) => {
        n.disabled = true;
      });
      fwPlaying = false;
      return;
    }

    btn.classList.add('is-ok');
    if (fwPlayer.length === fwSeq.length) {
      fwAccept = false;
      fwPoints += fwLevel * 100;
      fwScore.textContent = String(fwPoints);
      if (fwLevel >= 5) {
        fwStatus.textContent = 'FIREWALL DOWN — acesso root simbólico concedido. Score máximo!';
        setStatus('firewall :: breached');
        print('// firewall desativado via HACK app', 'line-ok');
        fwPlaying = false;
        $$('.fw-node', fwGrid).forEach((n) => {
          n.disabled = true;
        });
        return;
      }
      fwLevel += 1;
      fwLayer.textContent = String(fwLevel);
      fwStatus.textContent = `Camada ${fwLevel - 1} ok. Preparando próxima…`;
      await sleep(700);
      startFwRound(false);
    }
  }

  $('#fwStart').addEventListener('click', () => startFwRound(true));
  $('#fwReset').addEventListener('click', () => {
    fwPlaying = false;
    fwAccept = false;
    fwSeq = [];
    fwPlayer = [];
    fwLevel = 1;
    fwPoints = 0;
    fwLayer.textContent = '1';
    fwScore.textContent = '0';
    fwStatus.textContent = 'Memorize a sequência de nós e reproduza para desativar a camada.';
    buildFwGrid();
  });

  buildFwGrid();

  /* ─── Oracle ─── */
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
    oracleLog.scrollTop = oracleLog.scrollHeight;
  }

  function askOracle(question) {
    const q = question.trim();
    if (!q) return;
    appendOracle(q, 'user');
    const lower = q.toLowerCase();
    const hit = ORACLE_KB.find((entry) => entry.keys.some((k) => lower.includes(k)));
    const answer = hit
      ? hit.answer
      : ORACLE_FALLBACK[Math.floor(Math.random() * ORACLE_FALLBACK.length)];
    setTimeout(() => {
      appendOracle(answer, 'bot');
      setStatus('oracle :: reply sent');
    }, 280 + Math.random() * 420);
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

  /* ─── Cipher ─── */
  let cipherMode = 'encode';

  $$('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cipherMode = btn.dataset.mode;
      $$('[data-mode]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.mode === cipherMode);
        b.classList.toggle('ghost', b.dataset.mode !== cipherMode);
      });
    });
  });

  function mapAlpha(str, fn) {
    return str.replace(/[A-Za-z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(fn(ch.charCodeAt(0) - base) + base);
    });
  }

  function caesar(str, shift) {
    return mapAlpha(str, (n) => (n + shift + 26) % 26);
  }

  function atbash(str) {
    return mapAlpha(str, (n) => 25 - n);
  }

  function xorCipher(str, key = 'Cyber') {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      out.push(String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return out.join('');
  }

  function toHex(str) {
    return Array.from(str)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  }

  function fromHex(hex) {
    const clean = hex.replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) throw new Error('hex inválido');
    let out = '';
    for (let i = 0; i < clean.length; i += 2) {
      out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    }
    return out;
  }

  function runCipher() {
    const algo = $('#cipherAlgo').value;
    const input = $('#cipherIn').value;
    const enc = cipherMode === 'encode';
    let out = '';
    try {
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
          if (enc) out = toHex(xorCipher(input));
          else out = xorCipher(fromHex(input));
          break;
        case 'base64':
          out = enc ? btoa(unescape(encodeURIComponent(input))) : decodeURIComponent(escape(atob(input)));
          break;
        default:
          out = input;
      }
      $('#cipherOut').value = out;
      setStatus(`cipher :: ${algo} ${cipherMode}`);
    } catch (err) {
      $('#cipherOut').value = `erro: ${err.message || 'entrada inválida'}`;
    }
  }

  $('#cipherRun').addEventListener('click', runCipher);
  $('#cipherCopy').addEventListener('click', async () => {
    const text = $('#cipherOut').value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('cipher :: copiado');
    } catch {
      setStatus('cipher :: falha ao copiar');
    }
  });

  /* ─── Boot sequence ─── */
  const BOOT_LINES = [
    'CYBEROS BIOS v2.7 — phosphor init',
    'Checking memory ................ OK',
    'Mounting /home/guest ............ OK',
    'Loading neo-tty driver .......... OK',
    'Starting window compositor ...... OK',
    'Seeding oracle knowledge base ... OK',
    'Firewall nodes online ........... 9',
    'Cipher algorithms ............... 5',
    '',
    'Welcome, guest. Type help to begin.',
    'Boot complete.'
  ];

  async function boot() {
    bootLog.textContent = '';
    for (const line of BOOT_LINES) {
      bootLog.textContent += line + '\n';
      await sleep(90 + Math.random() * 70);
    }
    await sleep(320);
    bootScreen.classList.add('is-done');
    crtFrame.hidden = false;
    await sleep(520);
    bootScreen.hidden = true;
    updatePrompt();
    print('CyberOS v2.7 — session started', 'line-ok');
    print('Digite help · explore ~/projects · ou abra apps no dock');
    print('');
    termInput.focus();
    openWindow('terminal');
  }

  /* Focus terminal on desktop click empty */
  $('#desktop').addEventListener('click', (e) => {
    if (e.target.id === 'desktop') termInput.focus();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bootScreen.hidden = true;
    crtFrame.hidden = false;
    updatePrompt();
    print('CyberOS v2.7 — session started', 'line-ok');
    print('Digite help · explore ~/projects · ou abra apps no dock');
    openWindow('terminal');
  } else {
    boot();
  }
})();
