/**
 * Marcador do objetivo: um losango dourado na tela que aponta para onde ir agora.
 * Pensado para quem nunca jogou (e para crianças): o texto do objetivo diz "o quê",
 * o marcador diz "onde".
 *
 * Alvo por objetivo (QuestManager): ou um item de interação pelo rótulo (o mais
 * próximo, já em coordenadas de mundo — o navio se move), ou um ponto no referencial
 * do nível em que Dico está (ilha, masmorra).
 *
 * Projeção: p_ndc = projeção(câmera, alvo). Na tela → o losango fica sobre o alvo.
 * Fora da tela ou atrás da câmera → vai para a borda de uma elipse (86 % da largura;
 * em cima só até 55 %, para não cobrir os painéis do HUD; embaixo 78 %) na direção do
 * alvo e vira uma seta: ângulo = atan2(ndc.y, ndc.x), com o vetor
 * invertido quando o alvo está atrás (z > 1), para a seta não apontar ao contrário.
 * Perto (< 2,2 m) o marcador some: o aviso "E Interagir" assume.
 * Atualiza a cada quadro, sem alocar (vetores de módulo).
 */

import * as THREE from 'three';
import { ISLAND_MARKS } from '../world/Island.js?v=50';
import { UP } from '../world/Dungeon.js?v=50';

/** Limites verticais do marcador em NDC (+1 = topo): o topo fica livre para o HUD. */
const TOP = 0.55;
const TOP_SHORT = 0.38;
const BOTTOM = 0.78;

const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

/** Rótulos (interactionLabel) ou pontos locais por objetivo. `any` ignora `enabled`. */
const TARGETS = {
    explore_ship: { labels: ['Conversar'] },
    talk_crew: { labels: ['Conversar'] },
    horizon: { labels: ['Observar o horizonte'] },
    check_helm: { labels: ['Verificar o leme'] },
    teco_play: { labels: ['Interagir com Teco'] },
    free_helm: { labels: ['Mandar Teco'] },
    reach_castle: { local: (g) => islandPoint(g, ISLAND_MARKS.view.x, ISLAND_MARKS.view.z - 2) },
    other_entrance: { labels: ['Mandar Teco'] },
    hidden_door: { local: (g) => islandPoint(g, ISLAND_MARKS.secret.x - 2.5, ISLAND_MARKS.secret.z + 2) },
    open_door: { labels: ['Pedir ajuda a Teco', 'Abrir'] },
    stealth_up: { labels: ['Pegar chaves'] },
    steal_keys: { labels: ['Pegar chaves'] },
    find_camila: { labels: ['Conversar com Camila'] },
    /* sem o molho do carcereiro, a chave a buscar é a dele */
    cell_key: { labels: (g) => (g.inventory.keys || g.inventory.cellKey ? ['Usar chave'] : ['Pegar chaves']) },
    teco_tiger: { labels: ['Mandar Teco'], any: true },
    back_camila: { labels: ['Usar chave'] },
    free_camila: { labels: ['Conversar com Camila'] },
    leave_cell: { local: () => _p.set(0, UP + 1, -21) },
    flee: { local: () => _p.set(0, UP + 1, -21) },
    reach_ship: { local: (g) => islandPoint(g, 4, ISLAND_MARKS.reach + 1) },
    untie: { labels: ['Soltar amarra'] },
    raise_sail: { labels: ['Levantar a vela'] },
    take_helm: { labels: ['Assumir o leme'] }
};

function islandPoint(g, x, z) {
    if (!g.island) return null;
    return _p.set(x, g.island.heightAt(x, z) + 1, z);
}

export class ObjectiveMarker {
    constructor(game) {
        this.game = game;
        this.el = document.getElementById('objMarker');
        this.dist = document.getElementById('objDist');
        this.visible = false;
        this._lastDist = -1;
        this._lastX = -1;
        this._lastY = -1;
        this._lastRot = 99;
        this._lastMode = '';
    }

    _hide() {
        if (!this.visible || !this.el) return;
        this.visible = false;
        this.el.hidden = true;
    }

    /** Posição de mundo do alvo do objetivo atual (em _w) ou null. */
    _target() {
        const g = this.game;
        const spec = TARGETS[g.quests.current?.id];
        if (!spec) return null;
        if (spec.labels) {
            const labels = typeof spec.labels === 'function' ? spec.labels(g) : spec.labels;
            g.player.worldPosition(_p);
            let best = null;
            let bestD = Infinity;
            for (const item of g.interact.items) {
                if (!spec.any && item.enabled === false) continue;
                if (!labels.includes(item.interactionLabel)) continue;
                const obj = item.object;
                if (!obj || !obj.parent) continue;
                obj.getWorldPosition(_n);
                if (item.offsetY) _n.y += item.offsetY;
                const d = _n.distanceToSquared(_p);
                if (d < bestD) {
                    bestD = d;
                    best = item;
                    _w.copy(_n);
                }
            }
            return best ? _w : null;
        }
        const local = spec.local(g);
        const parent = g.player.root.parent;
        if (!local || !parent) return null;
        return parent.localToWorld(_w.copy(local));
    }

    update() {
        const g = this.game;
        if (!this.el) return;
        if (!g.running || g.paused || g.loading || g.cutscenes.blocking || g.dialogue.blocking ||
            g.player.controller.mode !== 'walk' || g._failing) {
            this._hide();
            return;
        }
        const t = this._target();
        if (!t) {
            this._hide();
            return;
        }
        g.player.worldPosition(_p);
        const dist = Math.hypot(t.x - _p.x, t.z - _p.z);
        if (dist < 2.2) {
            this._hide();
            return;
        }

        _n.copy(t).project(g.camera);
        const behind = _n.z > 1;
        let x = behind ? -_n.x : _n.x;
        let y = behind ? -_n.y : _n.y;
        /* tela deitada e baixa: o HUD ocupa proporcionalmente mais do topo */
        const top = window.innerHeight < 520 ? TOP_SHORT : TOP;
        const onScreen = !behind && Math.abs(x) < 0.86 && y < top && y > -BOTTOM;
        let mode = 'on';
        let rot = 0;
        if (!onScreen) {
            mode = 'edge';
            const a = Math.atan2(y, x);
            x = Math.cos(a) * 0.86;
            y = Math.sin(a) * (y > 0 ? top : BOTTOM);
            rot = -a; // CSS gira no sentido horário; NDC cresce para cima
        }
        const px = Math.round((x * 0.5 + 0.5) * 1000) / 10;
        const py = Math.round((0.5 - y * 0.5) * 1000) / 10;

        if (!this.visible) {
            this.visible = true;
            this.el.hidden = false;
        }
        if (px !== this._lastX || py !== this._lastY) {
            this._lastX = px;
            this._lastY = py;
            this.el.style.left = `${px}%`;
            this.el.style.top = `${py}%`;
        }
        if (mode !== this._lastMode) {
            this._lastMode = mode;
            this.el.dataset.mode = mode;
        }
        const r = Math.round(rot * 100) / 100;
        if (r !== this._lastRot) {
            this._lastRot = r;
            this.el.style.setProperty('--rot', `${r}rad`);
        }
        const d = Math.round(dist);
        if (d !== this._lastDist && this.dist) {
            this._lastDist = d;
            this.dist.textContent = `${d} m`;
        }
    }
}
