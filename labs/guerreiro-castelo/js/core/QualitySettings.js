/**
 * Presets gráficos. Não alteram gameplay, só custo visual.
 * `tier` é o degrau do palco compartilhado (labs/shared/gfx/stage.js): ele decide
 * pós-processamento, resolução da sombra do sol e densidade de grama/floresta.
 *   pointShadows  quantas luzes pontuais (lareira, lustre, tochas) projetam sombra
 *   lights        fração das tochas decorativas que ganham luz própria
 */
export const QUALITY = {
    low: { id: 'low', tier: 'low', pointShadows: 0, pointShadowMap: 256, lights: 0.5, rain: 500, particles: 0.5 },
    medium: { id: 'medium', tier: 'medium', pointShadows: 1, pointShadowMap: 512, lights: 0.8, rain: 1200, particles: 0.8 },
    high: { id: 'high', tier: 'high', pointShadows: 2, pointShadowMap: 512, lights: 1, rain: 2200, particles: 1 },
    ultra: { id: 'ultra', tier: 'high', pointShadows: 3, pointShadowMap: 1024, lights: 1, rain: 3200, particles: 1.25 }
};
