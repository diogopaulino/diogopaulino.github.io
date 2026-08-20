(function () {
    'use strict';

    const html = document.documentElement;
    const THEME_CORE_URL = '/assets/js/theme.js';
    const SLOT_SELECTOR = '[data-slot]';
    const HEADER_SELECTOR = '[data-lab-header]';
    const FOOTER_SELECTOR = '[data-lab-footer]';

    function applySavedTheme() {
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme && !html.getAttribute('data-theme')) {
                html.setAttribute('data-theme', savedTheme);
            }
        } catch (err) {
            /* Storage can be unavailable in private browsing contexts. */
        }
    }

    function extractSlotMarkup(root, name) {
        const slot = root.querySelector(`${SLOT_SELECTOR}[data-slot="${name}"]`);
        if (!slot) return '';

        const markup = slot.innerHTML.trim();
        slot.remove();
        return markup;
    }

    function renderThemeToggle() {
        return `
            <div class="theme-switch-wrapper">
                <button class="theme-toggle" aria-label="Alternar tema" title="Alternar tema" type="button"
                    aria-pressed="false">
                    <span class="theme-toggle-track" aria-hidden="true">
                        <span class="theme-toggle-thumb">
                            <svg class="sun-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                stroke-linejoin="round">
                                <circle cx="12" cy="12" r="4"></circle>
                                <path
                                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41">
                                </path>
                            </svg>
                            <svg class="moon-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        </span>
                    </span>
                </button>
            </div>
        `;
    }

    function buildHeader(header) {
        if (header.dataset.labReady === 'true') return;

        const backHref = header.getAttribute('data-back-href') || '/labs/';
        const backLabel = header.getAttribute('data-back-label') || 'Labs';
        const title = header.getAttribute('data-title') || document.title || 'Labs';
        const subtitle = header.getAttribute('data-subtitle');
        const logoMarkup = extractSlotMarkup(header, 'logo');
        const actionsMarkup = extractSlotMarkup(header, 'actions');
        const renderedLogo = logoMarkup
            ? (/<.+>/.test(logoMarkup) ? logoMarkup : `<div class="app-logo">${logoMarkup}</div>`)
            : `<h1 class="app-logo">${title}</h1>`;

        header.innerHTML = `
            <a href="${backHref}" class="back-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                <span>${backLabel}</span>
            </a>
            ${renderedLogo}
            <div class="header-actions">
                ${actionsMarkup}
                ${renderThemeToggle()}
            </div>
            ${subtitle ? `<p class="subtitle lab-shell-subtitle">${subtitle}</p>` : ''}
        `;

        const logo = header.querySelector('.app-logo');
        if (logo && !logo.matches('h1, [role="heading"]')) {
            logo.setAttribute('role', 'heading');
            logo.setAttribute('aria-level', '1');
        }

        header.dataset.labReady = 'true';
    }

    function buildFooter(footer) {
        if (footer.dataset.labReady === 'true') return;

        const homeHref = footer.getAttribute('data-home-href') || '/';
        const homeLabel = footer.getAttribute('data-home-label') || '← voltar para home';
        const extraMarkup = extractSlotMarkup(footer, 'extra');

        footer.innerHTML = `
            <a href="${homeHref}">${homeLabel}</a>
            ${extraMarkup}
        `;
        footer.dataset.labReady = 'true';
    }

    function initChrome() {
        document.querySelectorAll(HEADER_SELECTOR).forEach(buildHeader);
        document.querySelectorAll(FOOTER_SELECTOR).forEach(buildFooter);
    }

    function ensureThemeMeta() {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = html.getAttribute('data-theme') === 'dark' ? '#0a0a0a' : '#fafbfc';
        return meta;
    }

    function stripInlineIconStyles() {
        document.querySelectorAll('.sun-icon, .moon-icon').forEach((icon) => {
            icon.removeAttribute('style');
        });
    }

    function initToggle() {
        if (!window.ThemeManager) return;

        window.ThemeManager.initToggle({
            toggleSelector: '.theme-toggle',
            metaThemeSelector: ensureThemeMeta()
        });
        stripInlineIconStyles();
    }

    function ensureThemeCore() {
        if (window.ThemeManager) {
            initToggle();
            return;
        }

        const existingScript = document.querySelector('script[data-theme-core]');
        if (existingScript) {
            existingScript.addEventListener('load', initToggle, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = THEME_CORE_URL;
        script.defer = true;
        script.dataset.themeCore = 'true';
        script.addEventListener('load', initToggle, { once: true });
        document.head.appendChild(script);
    }

    function ensureFavicon() {
        if (document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')) return;
        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = '/favicon.ico';
        icon.sizes = 'any';
        document.head.appendChild(icon);
    }

    /* --- LabAudio ----------------------------------------------------------
       Sintetizador mínimo compartilhado pelos labs: nenhum asset de áudio, só
       osciladores criados na hora. Existe aqui (e não em cada lab) porque a
       parte chata é sempre a mesma — política de autoplay, mudo persistido e o
       botão do header.

       O AudioContext só nasce no primeiro som pedido depois de um gesto do
       usuário; antes disso os navegadores recusam ou criam um contexto suspenso
       que nunca toca. */
    const AudioAPI = (function () {
        let ctx = null;
        let master = null;
        let storageKey = 'labs:muted';
        let muted = false;
        let volume = 0.5;
        const listeners = new Set();

        function readMuted() {
            try {
                return localStorage.getItem(storageKey) === '1';
            } catch (err) {
                return false;
            }
        }

        function persist() {
            try {
                localStorage.setItem(storageKey, muted ? '1' : '0');
            } catch (err) {
                /* Storage can be unavailable in private browsing contexts. */
            }
        }

        function ensureContext() {
            if (muted) return null;
            if (!ctx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                ctx = new Ctx();
                master = ctx.createGain();
                master.gain.value = volume;
                master.connect(ctx.destination);
            }
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        }

        /* Uma nota. `slideTo` faz o glissando usado em power-ups e quedas;
           `delay` agenda sem setTimeout, então a sequência não desalinha se a
           thread principal engasgar. */
        function tone(options) {
            const audio = ensureContext();
            if (!audio) return;

            const {
                freq = 440,
                duration = 0.12,
                type = 'square',
                gain = 0.18,
                delay = 0,
                slideTo = null,
                attack = 0.006
            } = options || {};

            const start = audio.currentTime + delay;
            const osc = audio.createOscillator();
            const amp = audio.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, start);
            if (slideTo && slideTo > 0) {
                osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
            }

            amp.gain.setValueAtTime(0.0001, start);
            amp.gain.linearRampToValueAtTime(gain, start + attack);
            amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            osc.connect(amp).connect(master);
            osc.start(start);
            osc.stop(start + duration + 0.03);
        }

        /* Ruído branco filtrado: percussão, explosão, passo. */
        function noise(options) {
            const audio = ensureContext();
            if (!audio) return;

            const { duration = 0.18, gain = 0.12, delay = 0, filter = 1200, type = 'lowpass' } = options || {};
            const start = audio.currentTime + delay;
            const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
            const buffer = audio.createBuffer(1, frames, audio.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

            const src = audio.createBufferSource();
            src.buffer = buffer;

            const biquad = audio.createBiquadFilter();
            biquad.type = type;
            biquad.frequency.value = filter;

            const amp = audio.createGain();
            amp.gain.setValueAtTime(gain, start);
            amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            src.connect(biquad).connect(amp).connect(master);
            src.start(start);
            src.stop(start + duration + 0.02);
        }

        /* Arpejo: lista de frequências tocadas em passos regulares. */
        function sequence(freqs, options) {
            const { step = 0.07, duration = 0.1, type = 'square', gain = 0.16 } = options || {};
            freqs.forEach((freq, i) => tone({ freq, duration, type, gain, delay: i * step }));
        }

        function setMuted(next) {
            muted = Boolean(next);
            persist();
            if (master) master.gain.value = muted ? 0 : volume;
            listeners.forEach(fn => fn(muted));
        }

        function configure(options) {
            if (options && options.storageKey) {
                storageKey = options.storageKey;
                muted = readMuted();
            }
            if (options && typeof options.volume === 'number') {
                volume = Math.max(0, Math.min(1, options.volume));
                if (master && !muted) master.gain.value = volume;
            }
            return AudioAPI;
        }

        /* Botão de mudo do header. Devolve o elemento para o lab posicionar. */
        function mountToggle(target) {
            const host = typeof target === 'string' ? document.querySelector(target) : target;
            if (!host) return null;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lab-icon-btn';

            const sync = () => {
                btn.textContent = muted ? '🔇' : '🔊';
                btn.setAttribute('aria-pressed', String(muted));
                btn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
                btn.title = muted ? 'Ativar som' : 'Desativar som';
            };

            btn.addEventListener('click', () => {
                setMuted(!muted);
                if (!muted) tone({ freq: 880, duration: 0.07, gain: 0.14 });
            });

            listeners.add(sync);
            sync();
            host.appendChild(btn);
            return btn;
        }

        muted = readMuted();

        return Object.freeze({
            configure,
            tone,
            noise,
            sequence,
            mountToggle,
            setMuted,
            isMuted: () => muted,
            onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
        });
    })();

    /* --- Rede caiu, engine não veio ---------------------------------------
       Metade dos labs carrega Babylon ou three.js de CDN. Quando o CDN falha
       (rede ruim, bloqueio corporativo, offline) a página abre PRETA e sem uma
       palavra: o canvas fica lá, vazio, e o erro só aparece no console.

       Esta guarda transforma isso numa mensagem. Ela não tenta consertar nada
       — só explica o que houve e oferece recarregar. */
    const ENGINE_PROBES = [
        { host: 'cdn.babylonjs.com', global: 'BABYLON', label: 'Babylon.js' },
        { host: 'cdn.jsdelivr.net/npm/pixi.js', global: 'PIXI', label: 'PixiJS' }
    ];

    let engineNoticeShown = false;

    function showEngineNotice(label) {
        if (engineNoticeShown) return;
        engineNoticeShown = true;

        const notice = document.createElement('div');
        notice.className = 'lab-engine-notice';
        notice.setAttribute('role', 'alert');
        notice.innerHTML = `
            <div class="lab-engine-notice__card">
                <p class="lab-engine-notice__title">Não deu para carregar o ${label}</p>
                <p class="lab-engine-notice__text">
                    Este lab desenha em 3D com uma biblioteca que vem de um CDN, e o
                    navegador não conseguiu buscá-la. Costuma ser conexão instável ou
                    uma rede que bloqueia o domínio.
                </p>
                <div class="lab-engine-notice__actions">
                    <button type="button" class="lab-engine-notice__btn" data-engine-retry>Tentar de novo</button>
                    <a class="lab-engine-notice__link" href="/labs/">Voltar aos labs</a>
                </div>
            </div>
        `;
        notice.querySelector('[data-engine-retry]').addEventListener('click', () => location.reload());
        document.body.appendChild(notice);
    }

    /* Um lab só é cobrado pelo global se de fato pedir aquele script. */
    function checkEngines() {
        const html = Array.from(document.scripts).map(el => el.src || '').join(' ');
        for (const probe of ENGINE_PROBES) {
            if (html.includes(probe.host) && !window[probe.global]) {
                showEngineNotice(probe.label);
                return;
            }
        }
    }

    /* Scripts cuja falha realmente inviabiliza o lab. Um pacote de ícones que
       não carrega deixa a página feia, não quebrada — avisar ali seria alarme
       falso, então a lista é só de motores gráficos. */
    const CRITICAL_SCRIPT = /babylonjs|pixi\.js|\bthree(\.module)?\.js|three@/;

    function watchModuleFailures() {
        /* three.js entra por importmap dentro de <script type="module">: não há
           global para checar, e a falha de import não sobe como erro de janela.
           O evento `error` no próprio elemento do script sobe — mas só na fase
           de captura, porque não borbulha. */
        window.addEventListener('error', (event) => {
            const target = event.target;
            if (!target || target === window || target.tagName !== 'SCRIPT') return;

            const src = target.src || '';
            // Módulo local que falhou por causa do import de CDN conta; módulo
            // local com erro próprio, não — por isso o teste do importmap.
            const isEngineModule = target.type === 'module' && document.querySelector('script[type="importmap"]');
            if (isEngineModule || CRITICAL_SCRIPT.test(src)) {
                showEngineNotice('motor 3D');
            }
        }, true);
    }

    /* --- LabVisibility / LabRuntime ----------------------------------------
       Pausa loops e timers quando a aba fica oculta — evita GPU/CPU em
       background. Vários labs repetiam o mesmo visibilitychange; centralizar
       aqui deixa a adoção de uma linha. */
    const VisibilityAPI = (function () {
        const listeners = new Set();

        function notify() {
            listeners.forEach((fn) => {
                try {
                    fn(document.hidden);
                } catch (err) {
                    console.error(err);
                }
            });
        }

        document.addEventListener('visibilitychange', notify);

        function onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }

        return Object.freeze({
            isHidden: () => document.hidden,
            onChange,
            whenHidden: (fn) => onChange((hidden) => { if (hidden) fn(); }),
            whenVisible: (fn) => onChange((hidden) => { if (!hidden) fn(); })
        });
    })();

    const RuntimeAPI = (function () {
        /* Loop rAF com auto-pausa: wantsRun mantém intenção entre hide/show. */
        function createLoop(onFrame, options) {
            const autoPause = !options || options.autoPause !== false;
            let id = null;
            let wantsRun = false;

            function tick(now) {
                if (!wantsRun || document.hidden) return;
                onFrame(now);
                id = requestAnimationFrame(tick);
            }

            function start() {
                wantsRun = true;
                if (document.hidden || id !== null) return;
                id = requestAnimationFrame(tick);
            }

            function stop() {
                wantsRun = false;
                if (id !== null) {
                    cancelAnimationFrame(id);
                    id = null;
                }
            }

            let unbind = null;
            if (autoPause) {
                unbind = VisibilityAPI.onChange((hidden) => {
                    if (hidden) {
                        if (id !== null) {
                            cancelAnimationFrame(id);
                            id = null;
                        }
                    } else if (wantsRun) {
                        id = requestAnimationFrame(tick);
                    }
                });
            }

            return Object.freeze({
                start,
                stop,
                isRunning: () => wantsRun,
                destroy: () => {
                    stop();
                    if (unbind) unbind();
                }
            });
        }

        function bindBabylonLoop(engine, loopFn) {
            if (!engine || typeof loopFn !== 'function') return () => {};
            engine.runRenderLoop(loopFn);
            return VisibilityAPI.onChange((hidden) => {
                if (hidden) engine.stopRenderLoop();
                else engine.runRenderLoop(loopFn);
            });
        }

        function bindThreeLoop(renderer, loopFn) {
            if (!renderer || typeof loopFn !== 'function') return () => {};
            renderer.setAnimationLoop(loopFn);
            return VisibilityAPI.onChange((hidden) => {
                if (hidden) renderer.setAnimationLoop(null);
                else renderer.setAnimationLoop(loopFn);
            });
        }

        function debounceResize(fn, ms) {
            const delay = typeof ms === 'number' ? ms : 150;
            let timer = null;
            const run = () => {
                clearTimeout(timer);
                timer = setTimeout(fn, delay);
            };
            window.addEventListener('resize', run);
            if (window.visualViewport) window.visualViewport.addEventListener('resize', run);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', run);
                if (window.visualViewport) window.visualViewport.removeEventListener('resize', run);
            };
        }

        /* Intervalo que congela o relógio enquanto a aba está oculta. */
        function createInterval(fn, ms) {
            let id = null;
            let hiddenAt = 0;

            function start() {
                stop();
                id = setInterval(fn, ms);
            }

            function stop() {
                if (id !== null) {
                    clearInterval(id);
                    id = null;
                }
            }

            const unbind = VisibilityAPI.onChange((hidden) => {
                if (hidden) {
                    hiddenAt = Date.now();
                    stop();
                } else if (hiddenAt) {
                    hiddenAt = 0;
                    start();
                }
            });

            return Object.freeze({
                start,
                stop,
                destroy: () => {
                    stop();
                    unbind();
                }
            });
        }

        return Object.freeze({
            createLoop,
            bindBabylonLoop,
            bindThreeLoop,
            debounceResize,
            createInterval
        });
    })();

    function init() {
        ensureFavicon();
        initChrome();
        ensureThemeCore();
        // Depois do load: até lá o script do CDN teve sua chance de definir o global.
        if (document.readyState === 'complete') setTimeout(checkEngines, 400);
        else window.addEventListener('load', () => setTimeout(checkEngines, 400), { once: true });
    }

    applySavedTheme();
    /* Registrado já na avaliação do script, não no init: o `error` do
       <script type="module"> pode disparar antes do DOMContentLoaded, e um
       listener criado depois disso perderia o evento (foi o que acontecia no
       Mimo, que carrega este arquivo de forma síncrona). */
    watchModuleFailures();

    window.LabShell = Object.freeze({ init, buildHeader, buildFooter });
    window.LabAudio = AudioAPI;
    window.LabVisibility = VisibilityAPI;
    window.LabRuntime = RuntimeAPI;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
