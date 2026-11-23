/**
 * Clima e iluminação por cena, sobre o palco compartilhado (labs/shared/gfx/stage.js).
 * O palco cuida do céu físico, do sol/lua com sombra e do pós; aqui só escolhemos o
 * preset de atmosfera de cada momento da história e ajustamos interiores.
 *
 *   night     sala da lareira: céu de noite na janela, quase sem luz ambiente (a luz é o fogo)
 *   day       mar aberto, manhã clara
 *   storm     tempestade ao cair da noite
 *   dawn      amanhecer dourado (chegada à ilha, fuga)
 *   interior  masmorra: sem sol, sem névoa, só tochas
 *   sunset    pôr do sol do epílogo no mar
 *
 * Em interiores o sol é desligado (intensidade 0 e sem mapa de sombra — não há por que
 * redesenhar a cena para uma luz apagada) e exposição/luz de preenchimento são fixadas
 * à mão, porque a adaptação noturna do palco (exposição 2,6) foi calibrada para céu aberto.
 */

import { PRESETS } from '../../../shared/gfx/stage.js?v=18';

const BASE = PRESETS['dia-claro'];
PRESETS['gc-casa'] = {
    ...PRESETS['noite-lua'], hour: 22.5, clouds: 0.2, sun: 0, env: 0.5, fog: 0, haze: 0, fogGlow: 0, bloom: 0.2, rays: 0,
    saturation: 0.9, contrast: 1.04, vignette: 0.44, gain: [1.04, 1, 0.94], lift: [0.006, 0.004, 0.004], fill: 0.02, wind: 0.2
};
PRESETS['gc-masmorra'] = {
    ...PRESETS['noite-lua'], hour: 23, clouds: 0.6, sun: 0, env: 0.35, fog: 0, haze: 0, fogGlow: 0, bloom: 0.18, rays: 0,
    saturation: 0.86, contrast: 1.05, vignette: 0.46, gain: [1.03, 1, 0.95], lift: [0.004, 0.005, 0.008], fill: 0.02, wind: 0.2
};
PRESETS['gc-amanhecer'] = {
    ...PRESETS.entardecer, hour: 7.9, clouds: 0.4, exposure: 1.75, fill: 0.5, fog: 0.0034, falloff: 0.05, haze: 0.0003, fogGlow: 0.5,
    rays: 0.7, bloom: 0.12, gain: [1.05, 1, 0.94], fogTint: [0.8, 0.72, 0.7], wind: 0.7
};
PRESETS['gc-tempestade'] = {
    ...PRESETS.tempestade, hour: 17.6, exposure: 1.5, sun: 0.1, env: 1.3, fog: 0.012, haze: 0.0016, bloom: 0.1,
    saturation: 0.72, contrast: 1.14, vignette: 0.5, gain: [0.9, 0.97, 1.08], wind: 2.8
};
PRESETS['gc-mar'] = { ...BASE, hour: 9.6, clouds: 0.38, haze: 0.0002, fog: 0.0012, wind: 1.1 };
PRESETS['gc-poente'] = { ...PRESETS.entardecer, hour: 17.9, clouds: 0.5, bloom: 0.14, rays: 0.8, exposure: 1.2 };

const MAP = {
    night: { preset: 'gc-casa', interior: true, exposure: 1.35, fill: 0.55, shadowRadius: 12 },
    interior: { preset: 'gc-masmorra', interior: true, exposure: 1.15, fill: 0.62, shadowRadius: 12 },
    day: { preset: 'gc-mar', shadowRadius: 34 },
    storm: { preset: 'gc-tempestade', shadowRadius: 34 },
    dawn: { preset: 'gc-amanhecer', shadowRadius: 60 },
    sunset: { preset: 'gc-poente', shadowRadius: 34 },
    island: { preset: 'dia-claro', shadowRadius: 70 }
};

export class WeatherSystem {
    constructor(game) {
        this.game = game;
        this.preset = 'day';
        this.flash = 0;
        this.exposure = 1;
    }

    apply(preset, { shadowRadius } = {}) {
        const stage = this.game.stage;
        const cfg = MAP[preset] || MAP.day;
        this.preset = preset;
        stage.setPreset(cfg.preset);
        const interior = Boolean(cfg.interior);
        if (stage.sun.castShadow === interior) stage.sun.castShadow = !interior;
        /* interiores: preenchimento morno e neutro (rebatida das paredes) em vez do azul do céu */
        stage.fill.color.set(interior ? 0xc8b8a2 : 0xbfd4ff);
        stage.fill.groundColor.set(interior ? 0x4a3e34 : 0x54483a);
        if (interior) {
            stage.pipeline.params.exposure = cfg.exposure;
            stage.fill.intensity = cfg.fill;
        }
        stage.shadowRadius = shadowRadius ?? cfg.shadowRadius;
        this.exposure = stage.pipeline.params.exposure;
        return this.exposure;
    }

    /** Clarão do relâmpago: exposição ×(1 + 0,6·flash). */
    update() {
        const p = this.game.stage.pipeline.params;
        p.exposure = this.exposure * (1 + 0.6 * this.flash);
    }
}
