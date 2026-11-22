/**
 * Ponto de entrada do jogo O Guerreiro e o Castelo (three.js r185).
 * `?debug=1` expõe `window.__lab` com atalhos de teste (pular de fase, teleportar).
 */

import { Game } from './core/Game.js?v=49';

const canvas = document.getElementById('scene');
const game = new Game(canvas);

game.init()
    .then(() => {
        game.start();
    })
    .catch((err) => {
        console.error('[Guerreiro] falha na inicialização', err);
        window.guerreiroLoadError?.();
    });

if (new URLSearchParams(location.search).has('debug')) {
    window.__lab = {
        game,
        /** Vai direto para um checkpoint: __lab.go('tiger_room') */
        go(cp) {
            const map = {
                home_intro: 'home', ship_start: 'ship', storm_start: 'ship', storm_rope: 'ship', castle_beach: 'island',
                castle_exterior: 'island', secret_door: 'island', sleeping_guard: 'interior', princess_cell: 'interior',
                tiger_room: 'interior', princess_rescued: 'interior', escape_start: 'escape', ship_escape: 'shipEscape', ending: 'ending'
            };
            game.menu.hide();
            game.hud.show();
            game.running = true;
            game.paused = false;
            game.audio.setBusVolume?.('master', 0);
            return game.loadStage(map[cp] || cp, cp);
        },
        tp(x, y, z) {
            game.player.position.set(x, y, z);
            game.player.controller.vy = 0;
        },
        notify: (e) => game.story.notify(e),
        cam(yaw, pitch = 0.3, dist) {
            game.cameraRig.yaw = yaw;
            game.cameraRig.pitch = pitch;
            if (dist) game.cameraRig.targetDistance = game.cameraRig.distance = dist;
        },
        /** Pula a cutscene e avança todas as falas pendentes. */
        skip() {
            game.cutscenes.skip();
            for (let i = 0; i < 16 && game.dialogue.active; i++) game.dialogue.advance();
        },
        /** Aciona uma interação pelo rótulo, sem precisar chegar perto: __lab.use('Pegar chaves') */
        use(label) {
            const item = game.interact.items.find((i) => i.interactionLabel === label && i.enabled !== false);
            if (!item) return false;
            item.interact(game.player, game);
            return true;
        },
        labels: () => game.interact.items.filter((i) => i.enabled !== false).map((i) => i.interactionLabel),
        stats: () => game.stage.stats(),
        state: () => ({
            stage: game.stageId, cp: game.checkpoints.current, quest: game.quests.current.id, loading: game.loading,
            pos: game.player.position.toArray().map((v) => +v.toFixed(2)), hp: game.player.health, flags: game.story.flags
        })
    };
}
