import { findRoute } from './navigation.mjs';

// Piloto de teste para os três jogos de capítulos. Observa destinos e colisões;
// todas as ações do personagem entram pelo teclado ou pelos botões do jogo.
export function adventureControls(lab, game) {
    let held = new Set();
    let route = [];
    let destination = '';
    let blockedSteps = 0;
    let sidesteps = 0;
    let forestStage = 0;
    const player = game.player;
    const distance = point => Math.hypot(point.x - player.x, point.z - player.z);

    function press(keys) {
        const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        for (const code of held) if (!keys.includes(code)) send('keyup', code);
        for (const code of keys) if (!held.has(code)) send('keydown', code);
        held = new Set(keys);
    }

    function advance(frames) {
        for (let i = 0; i < frames; i++) game._update(1 / 60);
    }

    function tap(code) {
        press([]);
        press([code]);
        advance(1);
        press([]);
    }

    function objective() {
        const world = game.world;
        const chapter = game.chapter.id;
        const items = world.interactables.filter(item => !item.done);
        const kind = name => items.find(item => item.kind === name);
        const id = name => items.find(item => item.id === name);
        if (lab === 'jornada-do-anel') {
            // Contorna a patrulha pela mata e volta ao vau.
            if (chapter === 'forest') {
                if (player.z < 5 && Math.abs(player.x) < 2) forestStage = 0;
                const flanks = [{ x: 21, z: 8 }, { x: 21, z: 59 }, { x: 21, z: 96 }, { x: 21, z: 124 }];
                while (flanks[forestStage] && distance(flanks[forestStage]) < 2) forestStage++;
                if (flanks[forestStage]) return { ...flanks[forestStage], r: 1.6, id: 'desvio' };
            }
            return kind('ring') || kind('goal');
        }
        if (lab === 'joao-e-o-pe-de-feijao') {
            if (['night', 'cottage'].includes(chapter) && !world.flags.talkedMother) return id('mother');
            return items.find(item => !['talk', 'goal'].includes(item.kind)) || id('merchant') || kind('goal');
        }
        if (world.needTalk && !world.progress.talked) return kind('talk');
        if (chapter === 'aldeia') return kind('memory') || kind('lamp') || kind('goal');
        const stops = items.filter(item => ['memory', 'lamp'].includes(item.kind));
        const root = items.find(item => item.kind === 'crystal' && item.index === world.progress.crystals.length);
        return stops.sort((a, b) => distance(a) - distance(b))[0] || kind('cage') || root || kind('place') || kind('goal');
    }

    function traversable(x, z) {
        const world = game.world;
        const b = world.bounds;
        if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || world.heightAt(x, z) < -14) return false;
        if (world.blockedAt) return !world.blockedAt(x, z, 0.47);
        if (world.blocked) return !world.blocked(x, z, 0.66);
        return !player._blocked(x, z, world);
    }

    function walk(target) {
        if (blockedSteps > 2) {
            press([['KeyD', 'KeyA', 'KeyW', 'KeyS'][sidesteps++ % 4]]);
            advance(18);
            route = [];
            blockedSteps = 0;
        }
        if (!route.length) route = findRoute(player, target, traversable);
        while (route.length && distance(route[0]) < 0.75) route.shift();
        const aim = route[0] || target;
        const dx = aim.x - player.x;
        const dz = aim.z - player.z;
        const cos = Math.cos(player.camYaw);
        const sin = Math.sin(player.camYaw);
        const sideways = dx * cos - dz * sin;
        const forward = -dx * sin - dz * cos;
        const threshold = 0.4 * Math.max(Math.abs(sideways), Math.abs(forward));
        const keys = ['ShiftLeft'];
        if (Math.abs(sideways) > threshold) keys.push(sideways > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(forward) > threshold) keys.push(forward > 0 ? 'KeyW' : 'KeyS');
        press(keys);
        const before = { x: player.x, z: player.z };
        advance(4);
        blockedSteps = distance(before) < 0.015 ? blockedSteps + 1 : 0;
    }

    return function playBatch() {
        for (let step = 0; step < 75; step++) {
            if (game.state === 'dialogue') {
                press([]);
                document.querySelector('#dialogueContinue').click();
                continue;
            }
            if (['transition', 'loading', 'menu', 'defeat', 'victory'].includes(game.state)) {
                press([]);
                break;
            }
            if (game.state !== 'playing') {
                press([]);
                advance(10);
                continue;
            }
            const target = objective();
            if (!target) { advance(4); continue; }
            const name = [game.chapter.id, target.id || target.label, Math.round(target.x), Math.round(target.z)].join('/');
            if (destination !== name) { destination = name; route = []; blockedSteps = 0; }
            if (target.id === 'clouds' && player.y < 66 && (player.climbing || distance(target) < 2.7)) {
                if (!player.climbing) tap('Space');
                press(['KeyW']);
                advance(8);
                continue;
            }
            if (target.kind === 'axe' && player.climbing) { press(['KeyS']); advance(8); continue; }
            const world = game.world;
            if (world.shadows && player.fuel >= 14 && !player.flashT) {
                const threatened = world.shadows.some(shadow => !shadow.stun && distance(shadow) < 3.7);
                if (threatened || (world.night && !world.night.stun && distance(world.night) < 4.2)) tap('Space');
            }
            if (distance(target) < target.r - 0.1) {
                route = [];
                tap(target.kind === 'cage' ? 'Space' : 'KeyE');
                advance(4);
            } else walk(target);
        }
        return { state: game.state, chapter: game.chapter.id, destination };
    };
}
