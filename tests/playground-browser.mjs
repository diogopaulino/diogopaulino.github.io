// Node 22+, sem dependências. Sirva a raiz e abra Chrome com um perfil de teste
// e --remote-debugging-port=9222. Execute: node tests/playground-browser.mjs
// LAB_URL e CHROME_URL permitem escolher outras portas. Slugs opcionais filtram o catálogo.
import assert from 'node:assert/strict';
import { checkGameSettings } from './game-settings.mjs';
import { readdir, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.env.LAB_URL || 'http://localhost:8000';
const chrome = process.env.CHROME_URL || 'http://localhost:9222';
const viewports = [[375, 667], [390, 844], [667, 375], [1280, 800]];
const adventures = ['jornada-do-anel', 'joao-e-o-pe-de-feijao', 'menina-da-lanterna'];
const root = new URL('../labs/', import.meta.url);
const pages = [];
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && await stat(new URL(entry.name + '/index.html', root)).catch(() => null)) {
        pages.push('/labs/' + entry.name + '/');
    }
}
const filters = process.argv.slice(2);
const paths = filters.length ? filters.map(slug => {
    const path = '/labs/' + slug + '/';
    assert.ok(pages.includes(path), 'Lab desconhecido: ' + slug);
    return path;
}) : ['/', '/labs/', ...pages];

async function checkControls(path, evaluate, reload) {
    async function waitFor(expression) {
        for (let attempt = 0; attempt < 240; attempt++) {
            if (await evaluate(expression)) return;
            await delay(125);
        }
        assert.fail('Controle não chegou ao estado esperado: ' + expression);
    }
    await checkGameSettings(evaluate, reload, waitFor);
    const lab = path.split('/')[2];
    if (lab === 'jungle-run') {
        await waitFor('window.__lab?.game && document.querySelector("#startBtn")');
        await evaluate("document.querySelector('#startBtn').click()");
        await waitFor("window.__lab.game.state === 'playing'");
        const cleared = new Set();
        for (let attempt = 0; attempt < 24 && cleared.size < 4; attempt++) {
            const result = await evaluate("import('/tests/runner-controls.mjs').then(m => m.jungleLevel(__lab.game))");
            if (result.state === 'won') {
                cleared.add(result.level);
                await evaluate("document.querySelector('#nextLevelBtn').click()");
            } else {
                assert.equal(result.state, 'over');
                await evaluate("document.querySelector('#restartBtn').click()");
            }
        }
        assert.deepEqual([...cleared], [1, 2, 3, 4]);
        assert.equal(await evaluate('__lab.game.currentLevel.id'), 5);
    }
    if (lab === 'english-duo') {
        const languages = await evaluate("Array.from(document.querySelectorAll('.language-card'), b => b.dataset.lang)");
        assert.equal(languages.length, 8);
        for (const language of languages) {
            await evaluate(`document.querySelector('[data-lang="${language}"]').click()`);
            for (let question = 0; question < 40; question++) {
                if (await evaluate("!DOM.levelComplete.classList.contains('hidden')")) break;
                await evaluate("import('/tests/lesson-controls.mjs').then(m => m.answerExercise())");
            }
            assert.ok(await evaluate("!DOM.levelComplete.classList.contains('hidden')"), language);
            await evaluate('DOM.continueBtn.click(); DOM.btnBackLang.click()');
        }
    }
    if (lab === 'calculator') {
        const result = await evaluate(`(() => {
            const keys = [...document.querySelectorAll('#calculator button')];
            for (const label of ['AC', '9', '×', '7', '=']) keys.find(k => k.textContent.trim() === label).click();
            return document.querySelector('#calculator .current-operand').textContent;
        })()`);
        assert.equal(result, '63');
    }
    if (lab === 'minesweeper') {
        const endings = await evaluate("import('/tests/board-controls.mjs').then(m => m.minefield())");
        assert.deepEqual(endings, ['😵', '😎']);
    }
    if (lab === 'xadrez') {
        await waitFor("document.querySelector('#startButton').offsetWidth");
        await evaluate("import('/tests/board-controls.mjs').then(m => m.chessMatch())");
        await waitFor("!document.querySelector('#resultOverlay').hidden");
        assert.equal(await evaluate("document.querySelector('#resultTitle').textContent"), 'Xeque-mate');
        await evaluate("document.querySelector('#resultAgain').click()");
        await waitFor("document.body.dataset.state === 'play'");
    }
    if (lab === 'rastro-vermelho') {
        await waitFor("window.__rastro?.state === 'menu'");
        await evaluate("const start = __rastro.ui.newButton; (start.offsetWidth ? start : __rastro.ui.startButton).click()");
        await evaluate("import('/tests/trail-controls.mjs').then(m => { window.ride = m.trailControls(__rastro); })");
        let journey;
        for (let batch = 0; batch < 160; batch++) {
            journey = await evaluate('window.ride()');
            if (journey.state !== 'play') break;
        }
        assert.equal(journey.stage, 6, JSON.stringify(journey));
        assert.equal(journey.kills, 7);
        assert.equal(journey.state, 'end');
        await evaluate('__rastro.ui.retryButton.click()');
        await waitFor("__rastro.state === 'play'");
    }
    if (lab === 'rock-kombat') {
        assert.ok(await evaluate("import('/tests/fight-controls.mjs').then(m => m.checkCombat())"));
        await evaluate(`document.querySelector('#enter-button').click();
            document.querySelectorAll('.roster-portrait')[0].click();
            document.querySelector('[data-pick="cpu"]').click();
            document.querySelectorAll('.roster-portrait')[1].click();
            document.querySelector('[data-difficulty="easy"]').click();
            document.querySelector('#fight-button').click();`);
        await waitFor("!document.querySelector('#versus-start').disabled");
        await evaluate("document.querySelector('#versus-start').click()");
        await waitFor("window.__lab.match?.phase === 'intro' || window.__lab.match?.phase === 'fight'");
        const fight = await evaluate("import('/tests/fight-controls.mjs').then(m => m.fightRounds())");
        assert.deepEqual(fight, { hits: true, phase: 'complete', wins: 2 });
        await waitFor("document.querySelector('#results-screen').classList.contains('is-active')");
        assert.match(await evaluate("document.querySelector('#result-score').textContent"), /KURT [0-2] × [0-2] AXL/);
        await evaluate("document.querySelector('#rematch-button').click()");
        await waitFor("window.__lab.match.round === 1 && document.querySelector('#arena-screen').classList.contains('is-active')");
    }
    if (lab === 'lander') {
        await evaluate("document.querySelector('#btnStart').click()");
        for (let level = 1; level <= 3; level++) {
            const flight = await evaluate("import('/tests/lander-controls.mjs').then(m => m.flyMission())");
            assert.equal(flight.state, 'LANDED');
            assert.equal(flight.level, level);
            assert.ok(flight.score > 0);
            await evaluate("document.querySelector('#btnContinue').click()");
        }
    }
    if (lab === 'jurassic') {
        await waitFor("window.__lab?.game.state === 'menu'");
        await evaluate("document.querySelector('#startButton').click()");
        await evaluate("import('/tests/island-controls.mjs').then(m => { window.drive = m.islandControls(__lab.game); })");
        let result;
        for (let batch = 0; batch < 180; batch++) {
            result = await evaluate('window.drive()');
            if (result.state !== 'play') break;
        }
        assert.equal(result.state, 'victory', JSON.stringify(result));
        assert.equal(result.seen.length, 6);
        await evaluate("document.querySelector('#victoryMenuButton').click()");
        await waitFor("window.__lab.game.state === 'menu'");
    }
    if (lab === 'nina') {
        await waitFor("window.__lab?.game.state === 'menu'");
        await evaluate("document.querySelector('#startButton').click()");
        await evaluate("import('/tests/valley-controls.mjs').then(m => { window.walkValley = m.valleyControls(__lab.game); })");
        let result;
        for (let batch = 0; batch < 300; batch++) {
            result = await evaluate('window.walkValley()');
            if (result.won) break;
        }
        assert.equal(result.home, 7, JSON.stringify(result));
        await waitFor("window.__lab.game.state === 'victory'");
        await evaluate("document.querySelector('#victoryMenuButton').click()");
        await waitFor("window.__lab.game.state === 'menu'");
    }
    if (lab === 'river-knight') {
        await waitFor("window.__lab?.game.state === 'menu'");
        await evaluate("document.querySelector('#difficultyOptions button').click()");
        await evaluate("document.querySelector('#startButton').click()");
        await evaluate("import('/tests/runner-controls.mjs').then(async m => { window.sail = await m.riverControls(__lab.game); })");
        let state;
        for (let batch = 0; batch < 240; batch++) {
            state = await evaluate('window.sail()');
            if (state === 'victory') break;
            if (state === 'gameover') await evaluate("document.querySelector('#retryButton').click()");
            await delay(40);
        }
        assert.equal(state, 'victory');
        await evaluate("document.querySelector('#victoryMenuButton').click()");
        await waitFor("window.__lab.game.state === 'menu'");
    }
    if (adventures.includes(lab)) {
        await waitFor("window.__lab?.game.state === 'menu'");
        await evaluate("document.querySelector('#startButton').click()");
        await waitFor("window.__lab.game.state !== 'menu'");
        await evaluate(`import('/tests/adventure-controls.mjs').then(({ adventureControls }) => {
            window.playBatch = adventureControls(${JSON.stringify(lab)}, window.__lab.game);
        })`);
        const chapters = new Set();
        let result;
        for (let batch = 0; batch < 800; batch++) {
            result = await evaluate('window.playBatch()');
            chapters.add(result.chapter);
            if (result.state === 'defeat') await evaluate("document.querySelector('#retryButton').click()");
            if (result.state === 'victory') break;
            await delay(100);
        }
        assert.equal(result.state, 'victory', result.destination);
        assert.equal(chapters.size, 5);
        await evaluate("document.querySelector('#victoryMenuButton').click()");
        await waitFor("window.__lab.game.state === 'menu'");
    }
    if (path === '/labs/poker/') {
        await waitFor("document.querySelector('#intro').open");
        await evaluate("document.querySelector('#btnAcademyIntro').click()");
        assert.ok(await evaluate("!document.querySelector('#academyPanel').hidden"));
        await evaluate("document.querySelector('#nextLesson').click()");
        assert.match(await evaluate("document.querySelector('#lessonProgress').textContent"), /^2 \//);
        await evaluate("document.querySelector('#modePlay').click()");
        await waitFor("document.querySelector('#handNumber').textContent === 'Mão #1'");
        for (let attempt = 0; attempt < 140; attempt++) {
            if (await evaluate("!!document.querySelector('[data-action=nexthand]')")) break;
            await evaluate("document.querySelector('[data-action=call], [data-action=check]')?.click()");
            await delay(150);
        }
        await evaluate("document.querySelector('[data-action=nexthand]').click()");
        assert.equal(await evaluate("document.querySelector('#handNumber').textContent"), 'Mão #2');
    }
    if (path === '/labs/winamp/') {
        const lit = key => `document.querySelector('#wa-lamp-${key}').classList.contains('is-lit')`;
        const press = key => evaluate(`document.querySelector('[data-cmd="${key}"]').click()`);
        await press('play');
        await waitFor(lit('play'));
        await press('pause');
        assert.ok(await evaluate(lit('pause')));
        await press('play');
        await waitFor(lit('play'));
        await press('next');
        await press('stop');
        await delay(500);
        assert.ok(await evaluate(lit('stop')));
    }
    if (path === '/labs/ps5-controller/') {
        for (const [selector, side] of [['.cta', 'front'], ['.promo-card__button', 'back']]) {
            await evaluate(`document.querySelector('${selector}').click()`);
            await waitFor(`document.querySelector('.edition-photo').open &&
                document.querySelector('.edition-photo img').naturalWidth > 0 &&
                document.querySelector('.edition-photo img').src.endsWith('-${side}.webp')`);
            await evaluate("document.querySelector('.edition-photo form button').click()");
        }
    }
}

async function inspect(path) {
    const tab = await (await fetch(chrome + '/json/new?about:blank', { method: 'PUT' })).json();
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    const pending = new Map();
    const errors = [];
    let serial = 0;
    let loaded = false;
    socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (message.method === 'Page.loadEventFired') loaded = true;
        if (message.method === 'Runtime.exceptionThrown') {
            const error = message.params.exceptionDetails;
            errors.push(error.exception?.description || error.text);
        }
        if (message.method === 'Network.responseReceived') {
            const { response } = message.params;
            if (response.status >= 400) errors.push(response.status + ' ' + response.url);
        }
        pending.get(message.id)?.(message);
        pending.delete(message.id);
    };
    function send(method, params = {}) {
        const id = ++serial;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(method + ' expirou')), 30000);
            pending.set(id, reply => {
                clearTimeout(timeout);
                if (reply.error) reject(new Error(reply.error.message));
                else resolve(reply.result);
            });
            socket.send(JSON.stringify({ id, method, params }));
        });
    }
    async function evaluate(expression) {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, userGesture: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description || result.exceptionDetails?.text);
        return result.result.value;
    }
    try {
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        await Promise.all(['Network', 'Runtime', 'Page'].map(domain => send(domain + '.enable')));
        await send('Network.setCacheDisabled', { cacheDisabled: true });
        for (const [width, height] of viewports) {
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
            await send('Emulation.setTouchEmulationEnabled', { enabled: width < 768 });
            if (!loaded) {
                const url = new URL(path, origin);
                if ([...adventures, 'river-knight', 'jungle-run', 'nina', 'jurassic', 'rock-kombat'].includes(path.split('/')[2])) url.searchParams.set('debug', '1');
                const response = await send('Page.navigate', { url: url.href });
                assert.ok(!response.errorText, response.errorText);
                for (let i = 0; !loaded && i < 150; i++) await delay(200);
                assert.ok(loaded, 'Tempo de carregamento excedido');
            }
            await delay(180);
            assert.ok(await evaluate('document.title && document.body.childElementCount'), 'Página vazia');
            const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
            assert.ok(overflow <= 1, width + '×' + height + ' excedeu a largura em ' + overflow + ' px');
        }
        await send('Page.bringToFront');
        await checkControls(path, evaluate, async () => {
            loaded = false;
            await send('Page.reload', { ignoreCache: true });
            for (let i = 0; !loaded && i < 150; i++) await delay(200);
            assert.ok(loaded, 'Tempo de recarga excedido');
        });
        if (path === '/labs/rock-kombat/') {
            for (const [width, height] of viewports.slice(0, 3)) {
                await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
                await send('Emulation.setTouchEmulationEnabled', { enabled: true });
                await delay(120);
                assert.ok(await evaluate(`(() => {
                    const stage = document.querySelector('#game').getBoundingClientRect();
                    const pause = document.querySelector('#pause-button').getBoundingClientRect();
                    const keys = [...document.querySelectorAll('.touch-controls button')].map(button => button.getBoundingClientRect());
                    const inside = rect => rect.width >= 44 && rect.height >= 44
                        && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
                    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
                    return document.documentElement.scrollWidth === innerWidth && keys.length === 12
                        && inside(pause) && keys.every(key => inside(key) && !overlaps(key, stage) && !overlaps(key, pause))
                        && keys.every((key, i) => keys.every((other, j) => i === j || !overlaps(key, other)));
                })()`), `Controles da arena em ${width}×${height}`);
            }
        }
        assert.deepEqual(errors, []);
    } finally {
        socket.close();
        await fetch(chrome + '/json/close/' + tab.id);
    }
}
for (const path of paths) {
    try {
        await inspect(path);
        console.log('OK', path);
    } catch (error) {
        console.error('FALHOU', path, error.message);
        process.exitCode = 1;
    }
}
