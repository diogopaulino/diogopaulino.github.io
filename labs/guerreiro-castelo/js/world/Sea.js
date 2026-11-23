/**
 * Mar: ondas de Gerstner de labs/shared/gfx/ocean.js em três regimes (malhas separadas,
 * criadas sob demanda porque a amplitude das ondas é fixada na criação do shader):
 *   calm    mar aberto de dia            (ondas ×1)
 *   storm   tempestade                   (ondas ×2,6, água escura)
 *   island  costa da ilha                (profundidade analítica da ilha + arrebentação)
 *
 * Flutuação do navio (sample): em vez da inclinação pontual, mede a altura em quatro
 * pontos do casco — o navio tem 30 m e filtra as ondas curtas:
 *   y     = média das quatro alturas
 *   pitch = atan2(h(proa) − h(popa), 2·a)     a = 10 m
 *   roll  = atan2(h(boreste) − h(bombordo), 2·b)·0,7   b = 3,2 m
 */
import { createOcean, DEFAULT_WAVES } from '../../../shared/gfx/ocean.js';
import { ISLAND_DEPTH_GLSL } from './Island.js?v=50';

const HALF_LEN = 10;
const HALF_BEAM = 3.2;

export class Ocean {
    constructor(game) {
        this.game = game;
        this.seas = {};
        this.mode = 'calm';
        this.time = 0;
        this._visible = true;
        this._out = { y: 0, pitch: 0, roll: 0, yaw: 0 };
    }

    _get(mode) {
        if (!this.seas[mode]) {
            const tier = this.game.stage.tier;
            let sea;
            if (mode === 'storm') {
                sea = createOcean({ tier, waveScale: 2.6, deep: 0x06222c, shallow: 0x1f4a4c, scatter: 0x3a7a78, windAngle: 0.5 });
            } else if (mode === 'island') {
                sea = createOcean({ tier, depthGLSL: ISLAND_DEPTH_GLSL, surf: true, waveScale: 0.7, deepDepth: 7, surfAmp: 0.3 });
            } else {
                sea = createOcean({ tier, waves: DEFAULT_WAVES, waveScale: 1.15 });
            }
            sea.mesh.userData.keep = true;
            sea.mesh.visible = false;
            this.game.scene.add(sea.mesh);
            this.seas[mode] = sea;
        }
        return this.seas[mode];
    }

    /** Troca o regime do mar. */
    setMode(mode) {
        this.mode = mode;
        this._get(mode);
        this._apply();
    }

    _apply() {
        for (const k of Object.keys(this.seas)) this.seas[k].mesh.visible = this._visible && k === this.mode;
    }

    set visible(v) {
        this._visible = v;
        if (v) this._get(this.mode);
        this._apply();
    }

    get visible() {
        return this._visible;
    }

    /** Compatibilidade com o StormController antigo: a intensidade agora escolhe o regime. */
    setStorm() {}

    height(x, z) {
        return this._get(this.mode).heightAt(x, z, this.time);
    }

    sample(x, z) {
        const sea = this._get(this.mode);
        const t = this.time;
        const bow = sea.heightAt(x, z - HALF_LEN, t);
        const stern = sea.heightAt(x, z + HALF_LEN, t);
        const stb = sea.heightAt(x + HALF_BEAM, z, t);
        const port = sea.heightAt(x - HALF_BEAM, z, t);
        const o = this._out;
        o.y = (bow + stern + stb + port) * 0.25;
        o.pitch = Math.atan2(bow - stern, HALF_LEN * 2);
        o.roll = Math.atan2(stb - port, HALF_BEAM * 2) * 0.7;
        o.yaw = Math.sin(t * 0.3) * 0.01;
        return o;
    }

    update(dt, time) {
        this.time = time;
        if (!this._visible) return;
        const stage = this.game.stage;
        this._get(this.mode).update(time, stage.camera, stage.sky.daylight);
    }
}
