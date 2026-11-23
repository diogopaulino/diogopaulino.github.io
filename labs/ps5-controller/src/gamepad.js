/**
 * Gamepad — teste de controle real e controle da vitrine pelo próprio controle.
 *
 * Usa a Gamepad API do navegador (USB ou Bluetooth). Com o mapeamento
 * "standard" (Chrome, Edge, Safari e Firefox com DualSense/DualShock/Xbox):
 *
 *   botões  0 ✕/A  1 ○/B  2 □/X  3 △/Y  4 L1  5 R1  6 L2  7 R2
 *           8 Create/View  9 Options/Menu  10 L3  11 R3
 *           12 ↑  13 ↓  14 ←  15 →  16 PS/Home  17 touchpad (quando existe)
 *   eixos   0/1 analógico esquerdo (x, y)   2/3 analógico direito (x, y)
 *
 * Gatilhos L2/R2 são analógicos: buttons[6|7].value vai de 0 a 1.
 *
 * Zona morta radial escalonada (a mesma usada em jogos de console):
 *   m = |(x, y)|
 *   se m < dz        → (0, 0)                 — ruído do potenciômetro some
 *   senão            → (x, y) · ((m − dz) / (1 − dz)) / m
 *   e |saída| ≤ 1.
 * Isso tira o drift sem criar o “degrau” da zona morta por eixo e mantém a
 * resposta contínua a partir da borda da zona.
 *
 * Vibração: vibrationActuator.playEffect('dual-rumble', …) — motor forte
 * (baixa frequência, esquerdo) e fraco (alta frequência, direito). Onde o
 * navegador anuncia 'trigger-rumble', os gatilhos também vibram. Sem suporte,
 * os botões ficam desativados com a explicação.
 *
 * Na vitrine (painel fechado): L1/R1 ou D-pad ←/→ trocam a edição, o analógico
 * esquerdo também (com histerese), o direito gira o controle 3D e Options abre
 * este painel. Com o painel aberto, ○ fecha.
 */

const STORAGE_KEY = 'labs:ps5-controller:pad:v1';
const ROTATE_SPEED = 2.6; // rad/s com o analógico no fim de curso
const PITCH_LIMIT = 0.38; // mesmo limite do arraste com o mouse
const REPEAT_DELAY = 420; // ms até o auto-repeat do D-pad
const REPEAT_RATE = 220; // ms entre repetições
const FLICK_ON = 0.62; // histerese do analógico esquerdo como direcional
const FLICK_OFF = 0.3;

const BUTTON_NAMES = [
    '✕ Cross', '○ Circle', '□ Square', '△ Triangle', 'L1', 'R1', 'L2', 'R2',
    'Create', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS', 'Touchpad'
];

function loadPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return {
            deadzone: Number.isFinite(data.deadzone) ? Math.min(0.35, Math.max(0, data.deadzone)) : 0.08,
            liveRumble: Boolean(data.liveRumble),
            navHaptics: data.navHaptics !== false
        };
    } catch {
        return { deadzone: 0.08, liveRumble: false, navHaptics: true };
    }
}

function savePrefs(prefs) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        /* navegação privada: segue sem salvar */
    }
}

/** Zona morta radial escalonada. Escreve em `out` para não alocar por quadro. */
export function applyDeadzone(x, y, dz, out) {
    const m = Math.hypot(x, y);
    if (m < dz || m === 0) {
        out.x = 0;
        out.y = 0;
        return out;
    }
    const scaled = Math.min(1, (m - dz) / (1 - dz));
    out.x = (x / m) * scaled;
    out.y = (y / m) * scaled;
    return out;
}

function supportsRumble(gp) {
    const act = gp && gp.vibrationActuator;
    if (!act) return Boolean(gp && gp.hapticActuators && gp.hapticActuators.length);
    if (Array.isArray(act.effects)) return act.effects.includes('dual-rumble');
    return typeof act.playEffect === 'function';
}

function supportsTriggerRumble(gp) {
    const act = gp && gp.vibrationActuator;
    return Boolean(act && Array.isArray(act.effects) && act.effects.includes('trigger-rumble'));
}

function rumble(gp, { duration = 120, strong = 0.5, weak = 0.5, triggers = null } = {}) {
    if (!gp) return Promise.resolve(false);
    try {
        const act = gp.vibrationActuator;
        if (act && typeof act.playEffect === 'function') {
            if (triggers && supportsTriggerRumble(gp)) {
                return act.playEffect('trigger-rumble', {
                    startDelay: 0,
                    duration,
                    leftTrigger: triggers[0],
                    rightTrigger: triggers[1],
                    strongMagnitude: strong,
                    weakMagnitude: weak
                }).then(() => true, () => false);
            }
            return act.playEffect('dual-rumble', {
                startDelay: 0,
                duration,
                strongMagnitude: strong,
                weakMagnitude: weak
            }).then(() => true, () => false);
        }
        const legacy = gp.hapticActuators && gp.hapticActuators[0];
        if (legacy && typeof legacy.pulse === 'function') {
            return Promise.resolve(legacy.pulse(Math.max(strong, weak), duration)).then(() => true, () => false);
        }
    } catch {
        /* alguns navegadores lançam se o controle sumiu no meio do caminho */
    }
    return Promise.resolve(false);
}

function stopRumble(gp) {
    try {
        gp?.vibrationActuator?.reset?.();
    } catch {
        /* noop */
    }
}

/* ------------------------------------------------------------------ SVG -- */
/* Desenho genérico de um controle de duas empunhaduras (arte própria, sem
   logotipos). Cada peça tem data-b (índice do botão) para acender. */
const PAD_SVG = `
<svg class="pad-svg" viewBox="0 0 400 250" role="img" aria-label="Diagrama do controle com o estado de cada botão">
  <defs>
    <linearGradient id="padBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.13)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0.04)"/>
    </linearGradient>
  </defs>
  <!-- gatilhos (preenchimento proporcional ao valor analógico) -->
  <g class="pad-trigger" data-b="6">
    <rect x="62" y="4" width="64" height="22" rx="9" class="pad-trigger-track"/>
    <rect x="62" y="4" width="0" height="22" rx="9" class="pad-trigger-fill" data-fill="6"/>
    <text x="94" y="19.5" text-anchor="middle">L2</text>
  </g>
  <g class="pad-trigger" data-b="7">
    <rect x="274" y="4" width="64" height="22" rx="9" class="pad-trigger-track"/>
    <rect x="274" y="4" width="0" height="22" rx="9" class="pad-trigger-fill" data-fill="7"/>
    <text x="306" y="19.5" text-anchor="middle">R2</text>
  </g>
  <rect class="pad-key" data-b="4" x="58" y="31" width="74" height="13" rx="6"/>
  <rect class="pad-key" data-b="5" x="268" y="31" width="74" height="13" rx="6"/>
  <text class="pad-mini" x="95" y="41" text-anchor="middle">L1</text>
  <text class="pad-mini" x="305" y="41" text-anchor="middle">R1</text>

  <!-- corpo -->
  <path class="pad-body" d="M120 48 H280 C318 48 344 60 356 92 L386 190 C394 220 372 242 346 236 C326 231 314 214 300 194 L282 170 H118 L100 194 C86 214 74 231 54 236 C28 242 6 220 14 190 L44 92 C56 60 82 48 120 48 Z"/>
  <!-- touchpad -->
  <rect class="pad-key pad-touch" data-b="17" x="146" y="54" width="108" height="56" rx="10"/>
  <!-- create / options -->
  <rect class="pad-key" data-b="8" x="128" y="58" width="9" height="18" rx="4"/>
  <rect class="pad-key" data-b="9" x="263" y="58" width="9" height="18" rx="4"/>
  <!-- botão central -->
  <circle class="pad-key" data-b="16" cx="200" cy="150" r="9"/>

  <!-- D-pad -->
  <path class="pad-key" data-b="12" d="M80 78 h18 v18 l-9 9 l-9 -9 z"/>
  <path class="pad-key" data-b="13" d="M80 132 h18 v-18 l-9 -9 l-9 9 z"/>
  <path class="pad-key" data-b="14" d="M62 96 v18 h18 l9 -9 l-9 -9 z"/>
  <path class="pad-key" data-b="15" d="M116 96 v18 h-18 l-9 -9 l9 -9 z"/>

  <!-- botões de face com símbolos geométricos -->
  <g class="pad-face" data-b="3"><circle class="pad-key" data-b="3" cx="311" cy="78" r="12"/><path class="pad-sym" d="M311 71 l7 12 h-14 z"/></g>
  <g class="pad-face" data-b="1"><circle class="pad-key" data-b="1" cx="337" cy="104" r="12"/><circle class="pad-sym" cx="337" cy="104" r="6"/></g>
  <g class="pad-face" data-b="0"><circle class="pad-key" data-b="0" cx="311" cy="130" r="12"/><path class="pad-sym" d="M305 124 l12 12 M317 124 l-12 12"/></g>
  <g class="pad-face" data-b="2"><circle class="pad-key" data-b="2" cx="285" cy="104" r="12"/><rect class="pad-sym" x="279.5" y="98.5" width="11" height="11"/></g>

  <!-- analógicos: anel = curso total, tracejado = zona morta, ponto = posição -->
  <g class="pad-stick" data-stick="0">
    <circle class="pad-stick-ring" cx="148" cy="160" r="24"/>
    <circle class="pad-stick-dz" cx="148" cy="160" r="2" data-dz="0"/>
    <circle class="pad-key pad-stick-cap" data-b="10" cx="148" cy="160" r="12" data-cap="0"/>
    <circle class="pad-stick-raw" cx="148" cy="160" r="2.5" data-raw="0"/>
  </g>
  <g class="pad-stick" data-stick="1">
    <circle class="pad-stick-ring" cx="252" cy="160" r="24"/>
    <circle class="pad-stick-dz" cx="252" cy="160" r="2" data-dz="1"/>
    <circle class="pad-key pad-stick-cap" data-b="11" cx="252" cy="160" r="12" data-cap="1"/>
    <circle class="pad-stick-raw" cx="252" cy="160" r="2.5" data-raw="1"/>
  </g>
</svg>`;

/* ------------------------------------------------------------------ UI -- */

function h(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
}

export function initGamepad(app) {
    const prefs = loadPrefs();
    const hasApi = typeof navigator.getGamepads === 'function';
    const out = { x: 0, y: 0 };

    /* Botão flutuante */
    const fab = h('button', 'pad-fab', `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 7h10a5 5 0 0 1 4.9 6l-.6 3a3 3 0 0 1-5.3 1.2L14.5 15h-5L8 17.2A3 3 0 0 1 2.7 16l-.6-3A5 5 0 0 1 7 7z"/>
          <path d="M7.5 10v3M6 11.5h3"/><circle cx="16" cy="10.5" r=".6" fill="currentColor"/><circle cx="17.8" cy="12.5" r=".6" fill="currentColor"/>
        </svg>
        <span class="pad-fab__label">Testar controle</span>
        <i class="pad-fab__dot" aria-hidden="true"></i>`);
    fab.type = 'button';
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-label', 'Testar controle de videogame (Gamepad API)');

    /* Painel */
    const dialog = h('dialog', 'pad-dialog');
    dialog.setAttribute('aria-labelledby', 'padTitle');
    dialog.innerHTML = `
      <div class="pad-head">
        <div>
          <p class="pad-kicker">( Gamepad API )</p>
          <h2 id="padTitle">Teste do controle</h2>
        </div>
        <button type="button" class="pad-close" aria-label="Fechar teste do controle">✕</button>
      </div>
      <p class="pad-status" role="status" aria-live="polite"></p>
      <div class="pad-grid">
        <div class="pad-visual">${PAD_SVG}</div>
        <div class="pad-readouts">
          <div class="pad-meter">
            <span>L2</span><div class="pad-bar"><i data-bar="6"></i></div><output data-val="6">0%</output>
          </div>
          <div class="pad-meter">
            <span>R2</span><div class="pad-bar"><i data-bar="7"></i></div><output data-val="7">0%</output>
          </div>
          <div class="pad-axes">
            <div><span>Esq.</span><output data-axis="0">x 0.00 · y 0.00</output></div>
            <div><span>Dir.</span><output data-axis="1">x 0.00 · y 0.00</output></div>
          </div>
          <label class="pad-field">
            <span>Zona morta <output class="pad-dz-out">${Math.round(prefs.deadzone * 100)}%</output></span>
            <input type="range" class="pad-dz" min="0" max="0.35" step="0.01" value="${prefs.deadzone}">
          </label>
          <p class="pad-last" aria-live="off">Último botão: —</p>
        </div>
      </div>
      <div class="pad-rumble">
        <p class="pad-section">Vibração</p>
        <div class="pad-actions">
          <button type="button" class="pad-btn" data-rumble="weak">Fraca</button>
          <button type="button" class="pad-btn" data-rumble="strong">Forte</button>
          <button type="button" class="pad-btn" data-rumble="pulse">Pulso</button>
          <button type="button" class="pad-btn" data-rumble="triggers">Gatilhos</button>
        </div>
        <label class="pad-check"><input type="checkbox" class="pad-live"> Vibração segue L2/R2</label>
        <label class="pad-check"><input type="checkbox" class="pad-nav-haptics"> Toque leve ao trocar de edição</label>
        <p class="pad-note pad-rumble-note"></p>
      </div>
      <details class="pad-help">
        <summary>Usar o controle na vitrine</summary>
        <ul>
          <li><b>L1 / R1</b> ou <b>D-pad ← →</b>: troca a edição (analógico esquerdo também)</li>
          <li><b>Analógico direito</b>: gira o controle 3D</li>
          <li><b>Options</b>: abre este painel · <b>○</b> fecha</li>
        </ul>
        <p class="pad-note">Navegadores só revelam o controle depois que você aperta um botão. No iPhone/iPad, pareie por Bluetooth em Ajustes.</p>
      </details>
      <details class="pad-help pad-raw-wrap">
        <summary>Leitura bruta (todos os botões e eixos)</summary>
        <pre class="pad-raw"></pre>
      </details>`;

    document.body.append(fab, dialog);

    const status = dialog.querySelector('.pad-status');
    const lastEl = dialog.querySelector('.pad-last');
    const dzInput = dialog.querySelector('.pad-dz');
    const dzOut = dialog.querySelector('.pad-dz-out');
    const liveInput = dialog.querySelector('.pad-live');
    const navInput = dialog.querySelector('.pad-nav-haptics');
    const rumbleNote = dialog.querySelector('.pad-rumble-note');
    const rawEl = dialog.querySelector('.pad-raw');
    const rawWrap = dialog.querySelector('.pad-raw-wrap');
    const rumbleBtns = Array.from(dialog.querySelectorAll('[data-rumble]'));
    liveInput.checked = prefs.liveRumble;
    navInput.checked = prefs.navHaptics;

    const keyEls = new Map(); // índice → elementos
    dialog.querySelectorAll('[data-b]').forEach((node) => {
        const i = Number(node.dataset.b);
        if (!keyEls.has(i)) keyEls.set(i, []);
        keyEls.get(i).push(node);
    });
    const fills = [6, 7].map((i) => dialog.querySelector(`[data-fill="${i}"]`));
    const bars = [6, 7].map((i) => dialog.querySelector(`[data-bar="${i}"]`));
    const vals = [6, 7].map((i) => dialog.querySelector(`[data-val="${i}"]`));
    const caps = [0, 1].map((i) => dialog.querySelector(`[data-cap="${i}"]`));
    const raws = [0, 1].map((i) => dialog.querySelector(`[data-raw="${i}"]`));
    const dzs = [0, 1].map((i) => dialog.querySelector(`[data-dz="${i}"]`));
    const axisOuts = [0, 1].map((i) => dialog.querySelector(`[data-axis="${i}"]`));
    const STICK_R = 24;

    function syncDeadzoneRing() {
        for (const ring of dzs) ring.setAttribute('r', String(Math.max(1.5, prefs.deadzone * STICK_R)));
        dzOut.textContent = `${Math.round(prefs.deadzone * 100)}%`;
    }
    syncDeadzoneRing();

    /* Estado */
    let activeIndex = -1; // índice do controle em uso
    let running = false;
    let rafId = 0;
    let lastTime = 0;
    const prevPressed = new Array(18).fill(false);
    const prevShown = new Array(18).fill(false);
    let prevTrig = [-1, -1];
    const prevStick = [[9, 9, 9, 9], [9, 9, 9, 9]];
    const repeatAt = { left: 0, right: 0 };
    let flickArmed = true;
    let liveRumbleAt = 0;
    let rawAt = 0;

    function pads() {
        if (!hasApi) return [];
        try {
            return Array.from(navigator.getGamepads() || []).filter(Boolean);
        } catch {
            return []; // política de permissões pode bloquear a API
        }
    }

    function currentPad() {
        if (!hasApi) return null;
        let list;
        try {
            list = navigator.getGamepads() || [];
        } catch {
            return null;
        }
        if (activeIndex >= 0 && list[activeIndex] && list[activeIndex].connected) return list[activeIndex];
        for (const gp of list) {
            if (gp && gp.connected) {
                activeIndex = gp.index;
                return gp;
            }
        }
        activeIndex = -1;
        return null;
    }

    function describe(gp) {
        const id = gp.id.replace(/\s*\(.*?Vendor.*?\)\s*/i, ' ').replace(/\s+/g, ' ').trim();
        return id.length > 60 ? id.slice(0, 57) + '…' : id;
    }

    function syncStatus() {
        const gp = currentPad();
        fab.classList.toggle('is-connected', Boolean(gp));
        dialog.classList.toggle('is-connected', Boolean(gp));
        if (!hasApi) {
            status.textContent = 'Este navegador não expõe a Gamepad API. Tente Chrome, Edge, Safari ou Firefox atualizados.';
        } else if (!gp) {
            status.textContent = 'Nenhum controle detectado. Conecte por USB ou Bluetooth e aperte qualquer botão.';
        } else {
            const mapping = gp.mapping === 'standard' ? 'mapeamento padrão' : 'mapeamento não padrão — veja a leitura bruta';
            status.textContent = `${describe(gp)} · ${mapping}`;
        }
        const canRumble = Boolean(gp) && supportsRumble(gp);
        const canTrig = Boolean(gp) && supportsTriggerRumble(gp);
        rumbleBtns.forEach((b) => {
            b.disabled = !canRumble || (b.dataset.rumble === 'triggers' && !canTrig);
        });
        liveInput.disabled = !canRumble;
        rumbleNote.textContent = !gp
            ? ''
            : canRumble
                ? (canTrig ? 'Motores principais e dos gatilhos disponíveis.' : 'Motores principais disponíveis. Vibração nos gatilhos não é exposta por este navegador.')
                : 'Este navegador/controle não expõe vibração.';
        fab.setAttribute('aria-label', gp ? `Testar controle — ${describe(gp)} conectado` : 'Testar controle de videogame (Gamepad API)');
    }

    /* ----------------------------------------------------------- loop -- */
    function wantsLoop() {
        return !document.hidden && (dialog.open || pads().length > 0);
    }

    function start() {
        if (running || !hasApi) return;
        if (!wantsLoop()) return;
        running = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
    }

    function tick(now) {
        if (!running) return;
        const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        try {
            const gp = currentPad();
            if (gp) {
                // Decide pelo estado do início do quadro: o mesmo toque em Options
                // que abre o painel não pode fechá-lo no mesmo quadro.
                if (dialog.open) {
                    updatePanel(gp, now);
                    handlePanelButtons(gp);
                } else {
                    driveShowcase(gp, dt, now);
                }
                for (let i = 0; i < prevPressed.length; i++) prevPressed[i] = Boolean(gp.buttons[i] && gp.buttons[i].pressed);
            }
        } catch (err) {
            console.warn('[gamepad] leitura ignorada', err);
        }
        if (wantsLoop()) rafId = requestAnimationFrame(tick);
        else running = false;
    }

    function pressedEdge(gp, i) {
        const b = gp.buttons[i];
        return Boolean(b && b.pressed && !prevPressed[i]);
    }

    function updatePanel(gp, now) {
        // Botões (só mexe no DOM quando o estado muda)
        for (const [i, nodes] of keyEls) {
            const b = gp.buttons[i];
            const on = Boolean(b && (b.pressed || b.value > 0.5));
            if (on !== prevShown[i]) {
                prevShown[i] = on;
                for (const n of nodes) n.classList.toggle('is-on', on);
                if (on) lastEl.textContent = `Último botão: ${BUTTON_NAMES[i] || `#${i}`}`;
            }
        }
        // Gatilhos analógicos
        for (let k = 0; k < 2; k++) {
            const b = gp.buttons[6 + k];
            const v = b ? b.value : 0;
            if (Math.abs(v - prevTrig[k]) > 0.004) {
                prevTrig[k] = v;
                fills[k].setAttribute('width', String(Math.max(0, 64 * v)));
                bars[k].style.transform = `scaleX(${v})`;
                vals[k].textContent = `${Math.round(v * 100)}%`;
            }
        }
        // Analógicos: ponto cru + capa com zona morta aplicada
        for (let s = 0; s < 2; s++) {
            const rx = gp.axes[s * 2] || 0;
            const ry = gp.axes[s * 2 + 1] || 0;
            applyDeadzone(rx, ry, prefs.deadzone, out);
            const p = prevStick[s];
            if (Math.abs(p[0] - rx) + Math.abs(p[1] - ry) + Math.abs(p[2] - out.x) + Math.abs(p[3] - out.y) < 0.003) continue;
            p[0] = rx;
            p[1] = ry;
            p[2] = out.x;
            p[3] = out.y;
            caps[s].setAttribute('transform', `translate(${(out.x * (STICK_R - 10)).toFixed(2)} ${(out.y * (STICK_R - 10)).toFixed(2)})`);
            raws[s].setAttribute('transform', `translate(${(rx * STICK_R).toFixed(2)} ${(ry * STICK_R).toFixed(2)})`);
            axisOuts[s].textContent = `x ${out.x.toFixed(2)} · y ${out.y.toFixed(2)}`;
        }
        // Vibração ao vivo pelos gatilhos (a cada 100 ms, efeitos de 140 ms se sobrepõem)
        if (prefs.liveRumble && now - liveRumbleAt > 100) {
            liveRumbleAt = now;
            const l2 = gp.buttons[6] ? gp.buttons[6].value : 0;
            const r2 = gp.buttons[7] ? gp.buttons[7].value : 0;
            if (l2 > 0.02 || r2 > 0.02) {
                rumble(gp, { duration: 140, strong: l2, weak: r2, triggers: supportsTriggerRumble(gp) ? [l2 * 0.6, r2 * 0.6] : null });
            }
        }
        // Leitura bruta (texto) só quando aberta, 10×/s
        if (rawWrap.open && now - rawAt > 100) {
            rawAt = now;
            const btn = gp.buttons.map((b, i) => `${String(i).padStart(2)}:${b.pressed ? '■' : '·'}${b.value.toFixed(2)}`).join('  ');
            const ax = gp.axes.map((a, i) => `a${i}:${a >= 0 ? ' ' : ''}${a.toFixed(3)}`).join('  ');
            rawEl.textContent = `id: ${gp.id}\nmapping: ${gp.mapping || '(vazio)'} · índice ${gp.index}\n\n${ax}\n\n${btn}`;
        }
    }

    function handlePanelButtons(gp) {
        if (pressedEdge(gp, 1) || pressedEdge(gp, 9)) closePanel();
    }

    function navHaptic(gp) {
        if (prefs.navHaptics && supportsRumble(gp)) rumble(gp, { duration: 45, strong: 0, weak: 0.35 });
    }

    function driveShowcase(gp, dt, now) {
        if (pressedEdge(gp, 9)) {
            openPanel();
            return;
        }
        // Troca de edição: L1/R1 e D-pad com auto-repeat
        const dir = (pressedEdge(gp, 5) || pressedEdge(gp, 15)) ? 1 : (pressedEdge(gp, 4) || pressedEdge(gp, 14)) ? -1 : 0;
        if (dir) {
            app.step(dir);
            navHaptic(gp);
            repeatAt[dir > 0 ? 'right' : 'left'] = now + REPEAT_DELAY;
        } else {
            for (const [side, idx, d] of [['left', 14, -1], ['right', 15, 1]]) {
                const held = gp.buttons[idx] && gp.buttons[idx].pressed;
                if (held && repeatAt[side] && now >= repeatAt[side]) {
                    app.step(d);
                    repeatAt[side] = now + REPEAT_RATE;
                } else if (!held) {
                    repeatAt[side] = 0;
                }
            }
        }
        // Analógico esquerdo como direcional (histerese evita trocas em série)
        const lx = gp.axes[0] || 0;
        if (flickArmed && Math.abs(lx) > FLICK_ON) {
            flickArmed = false;
            app.step(lx > 0 ? 1 : -1);
            navHaptic(gp);
        } else if (!flickArmed && Math.abs(lx) < FLICK_OFF) {
            flickArmed = true;
        }
        // Analógico direito gira o produto (mesmo estado do arraste com mouse)
        const drag = app.scene && app.scene.drag;
        if (drag && !drag.active) {
            applyDeadzone(gp.axes[2] || 0, gp.axes[3] || 0, prefs.deadzone, out);
            if (out.x || out.y) {
                // Curva quadrática: precisão perto do centro, velocidade no fim de curso.
                const cx = out.x * Math.abs(out.x);
                const cy = out.y * Math.abs(out.y);
                drag.velocityYaw = 0;
                drag.velocityPitch = 0;
                drag.yaw += cx * ROTATE_SPEED * dt;
                drag.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, drag.pitch + cy * ROTATE_SPEED * 0.6 * dt));
                drag.releasedAt = performance.now(); // depois de solto, volta suave à pose
            }
        }
    }

    /* ------------------------------------------------------- painel -- */
    function openPanel() {
        if (dialog.open) return;
        try {
            dialog.showModal();
        } catch {
            dialog.setAttribute('open', '');
        }
        prevShown.fill(false);
        prevTrig = [-1, -1];
        syncStatus();
        start();
    }

    function closePanel() {
        if (!dialog.open) return;
        stopRumble(currentPad());
        dialog.close();
        fab.focus({ preventScroll: true });
    }

    fab.addEventListener('click', openPanel);
    dialog.querySelector('.pad-close').addEventListener('click', closePanel);
    dialog.addEventListener('close', () => stopRumble(currentPad()));
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closePanel(); // clique no backdrop
    });

    dzInput.addEventListener('input', () => {
        prefs.deadzone = Number(dzInput.value);
        syncDeadzoneRing();
        for (const p of prevStick) p[0] = 9; // força redesenho
        savePrefs(prefs);
    });
    liveInput.addEventListener('change', () => {
        prefs.liveRumble = liveInput.checked;
        if (!prefs.liveRumble) stopRumble(currentPad());
        savePrefs(prefs);
    });
    navInput.addEventListener('change', () => {
        prefs.navHaptics = navInput.checked;
        savePrefs(prefs);
    });

    const EFFECTS = {
        weak: [{ duration: 260, strong: 0, weak: 0.7 }],
        strong: [{ duration: 260, strong: 1, weak: 0.2 }],
        pulse: [
            { duration: 90, strong: 0.9, weak: 0.4 },
            { duration: 90, strong: 0.9, weak: 0.4, delay: 180 },
            { duration: 90, strong: 0.9, weak: 0.4, delay: 360 }
        ],
        triggers: [{ duration: 300, strong: 0, weak: 0, triggers: [0.8, 0.8] }]
    };
    rumbleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const gp = currentPad();
            if (!gp) return;
            for (const fx of EFFECTS[btn.dataset.rumble]) {
                setTimeout(() => rumble(currentPad(), fx), fx.delay || 0);
            }
        });
    });

    /* ------------------------------------------------- ciclo de vida -- */
    window.addEventListener('gamepadconnected', (e) => {
        activeIndex = e.gamepad.index;
        syncStatus();
        start();
    });
    window.addEventListener('gamepaddisconnected', (e) => {
        if (e.gamepad.index === activeIndex) activeIndex = -1;
        prevPressed.fill(false);
        syncStatus();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopRumble(currentPad());
            stop();
        } else {
            start();
        }
    });
    window.addEventListener('blur', () => stopRumble(currentPad()));

    syncStatus();
    start();

    return { open: openPanel, close: closePanel };
}
