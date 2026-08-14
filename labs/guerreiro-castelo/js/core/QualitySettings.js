/** Presets gráficos. Não alteram gameplay, só custo visual. */

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        shadows: 512,
        bloom: false,
        particles: 0.35,
        vegetation: 0.4,
        far: 220,
        water: 128,
        shadowCasters: 12,
        aa: false
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.25,
        shadows: 1024,
        bloom: true,
        particles: 0.65,
        vegetation: 0.7,
        far: 320,
        water: 256,
        shadowCasters: 22,
        aa: true
    },
    high: {
        id: 'high',
        pixelRatio: 1.75,
        shadows: 2048,
        bloom: true,
        particles: 1,
        vegetation: 1,
        far: 460,
        water: 512,
        shadowCasters: 36,
        aa: true
    },
    ultra: {
        id: 'ultra',
        pixelRatio: 2,
        shadows: 4096,
        bloom: true,
        particles: 1.25,
        vegetation: 1.2,
        far: 640,
        water: 512,
        shadowCasters: 48,
        aa: true
    }
};
