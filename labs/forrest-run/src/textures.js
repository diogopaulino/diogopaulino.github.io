/**
 * Texturas procedurais PBR em canvas de alta resolução para Babylon.js:
 * Albedo, Normal Bump, Roughness e detalhes têxteis/orgânicos.
 * Zero dependências de arquivos de imagem externos — carrega instantaneamente.
 */

const textureCache = new Map();

function getOrCreateTexture(key, scene, drawFn, size = 512) {
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = typeof size === 'number' ? size : size.width;
    canvas.height = typeof size === 'number' ? size : size.height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, canvas.width, canvas.height);

    const dynTex = new BABYLON.DynamicTexture(key, canvas, scene, true);
    dynTex.hasAlpha = true;
    dynTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    dynTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    dynTex.update(false);

    textureCache.set(key, dynTex);
    return dynTex;
}

/**
 * Camisa xadrez vintage do Forrest:
 * Padrão azul marinho, vermelho e branco com textura de trama têxtil (tweed weave).
 */
export function createPlaidTexture(scene) {
    return getOrCreateTexture('tex_plaid', scene, (ctx, w, h) => {
        ctx.fillStyle = '#3a68b4';
        ctx.fillRect(0, 0, w, h);

        // Faixas largas em azul profundo
        ctx.fillStyle = '#1e3872';
        for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 24, h);
        for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 24);

        // Faixas finas vermelhas
        ctx.fillStyle = '#c82828';
        for (let x = 32; x < w; x += 64) ctx.fillRect(x, 0, 8, h);
        for (let y = 32; y < h; y += 64) ctx.fillRect(0, y, w, 8);

        // Filetes amarelos/dourados
        ctx.fillStyle = '#f0c850';
        for (let x = 16; x < w; x += 64) ctx.fillRect(x, 0, 3, h);
        for (let y = 16; y < h; y += 64) ctx.fillRect(0, y, w, 3);

        // Linhas de trama de algodão (tecido)
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < w; i += 4) {
            ctx.fillRect(i, 0, 1.5, h);
            ctx.fillRect(0, i, w, 1.5);
        }

        // Ruído sutil de tecido
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (Math.random() - 0.5) * 18;
            d[i] = Math.min(255, Math.max(0, d[i] + noise));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
    }, 256);
}

/**
 * Tênis Nike Cortez clássico do filme:
 * Couro branco com grãos, swoosh vermelho recortado e detalhe azul na sola.
 */
export function createCortezTexture(scene) {
    return getOrCreateTexture('tex_cortez', scene, (ctx, w, h) => {
        ctx.fillStyle = '#f6f5f0';
        ctx.fillRect(0, 0, w, h);

        // Grão de couro
        for (let i = 0; i < 4000; i++) {
            const val = 230 + Math.random() * 25;
            ctx.fillStyle = `rgba(${val},${val},${val - 4}, 0.5)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }

        // Swoosh vermelho curvado
        ctx.fillStyle = '#d62424';
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.55);
        ctx.bezierCurveTo(w * 0.4, h * 0.85, w * 0.75, h * 0.7, w * 0.95, h * 0.25);
        ctx.bezierCurveTo(w * 0.65, h * 0.55, w * 0.35, h * 0.45, w * 0.15, h * 0.55);
        ctx.fill();

        // Linha azul da entressola
        ctx.fillStyle = '#2255aa';
        ctx.fillRect(0, h * 0.88, w, h * 0.08);

        // Costuras finas
        ctx.strokeStyle = 'rgba(180, 170, 160, 0.6)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.4);
        ctx.lineTo(w * 0.95, h * 0.4);
        ctx.stroke();
    }, 256);
}

/**
 * Boné Bubba Gump Shrimp Co. vermelho
 */
export function createBubbaCapTexture(scene) {
    return getOrCreateTexture('tex_bubba_cap', scene, (ctx, w, h) => {
        ctx.fillStyle = '#c42020';
        ctx.fillRect(0, 0, w, h);

        // Emblema oval frontal
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e6b022';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = '#1a3055';
        ctx.font = 'bold 24px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('BUBBA GUMP', w / 2, h / 2 - 4);

        ctx.fillStyle = '#c42020';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText('SHRIMP CO.', w / 2, h / 2 + 18);
    }, 256);
}

/**
 * Textura de Asfalto Ultra-Realista:
 * Agregado de brita mineral, linhas de alcatrão e desgaste natural.
 */
export function createAsphaltTexture(scene) {
    return getOrCreateTexture('tex_asphalt', scene, (ctx, w, h) => {
        ctx.fillStyle = '#2d2e33';
        ctx.fillRect(0, 0, w, h);

        // Brita e pedriscos incrustados
        for (let i = 0; i < 9000; i++) {
            const lum = 35 + Math.random() * 65;
            const r = lum + (Math.random() - 0.5) * 8;
            const g = lum + (Math.random() - 0.5) * 8;
            const b = lum + 4;
            ctx.fillStyle = `rgba(${r},${g},${b}, 0.75)`;
            const s = 1 + Math.random() * 2.5;
            ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
        }

        // Ranhuras e micro-fissuras de pneu
        ctx.strokeStyle = 'rgba(18, 18, 20, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 24; i++) {
            ctx.beginPath();
            let x = Math.random() * w;
            let y = 0;
            ctx.moveTo(x, y);
            while (y < h) {
                y += 20 + Math.random() * 40;
                x += (Math.random() - 0.5) * 14;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }, 512);
}

/**
 * Normal Map gerado para o Asfalto
 */
export function createAsphaltBumpTexture(scene) {
    return getOrCreateTexture('tex_asphalt_bump', scene, (ctx, w, h) => {
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const nx = 128 + (Math.random() - 0.5) * 55;
            const ny = 128 + (Math.random() - 0.5) * 55;
            const nz = 240 + Math.random() * 15;
            d[i] = nx;
            d[i + 1] = ny;
            d[i + 2] = nz;
            d[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, 512);
}

/**
 * Textura de Estrada de Terra e Cascalho (Alabama / Greenbow):
 * Argila avermelhada, sulcos de trator e pequenas pedras.
 */
export function createDirtTexture(scene) {
    return getOrCreateTexture('tex_dirt', scene, (ctx, w, h) => {
        ctx.fillStyle = '#85643e';
        ctx.fillRect(0, 0, w, h);

        // Camadas de areia e barro
        for (let i = 0; i < 7000; i++) {
            const n = Math.random();
            const r = 110 + n * 80;
            const g = 75 + n * 55;
            const b = 45 + n * 35;
            ctx.fillStyle = `rgba(${r},${g},${b}, 0.65)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2 + n * 3, 2 + n * 2);
        }

        // Trilhos longitudinais de pneus
        ctx.fillStyle = 'rgba(80, 50, 25, 0.22)';
        ctx.fillRect(w * 0.15, 0, w * 0.2, h);
        ctx.fillRect(w * 0.65, 0, w * 0.2, h);

        // Pedrinhas claras
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = 'rgba(215, 195, 165, 0.8)';
            const s = 1.5 + Math.random() * 3;
            ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
        }
    }, 512);
}

/**
 * Grama e Vegetação de Beira de Estrada
 */
export function createGrassTexture(scene) {
    return getOrCreateTexture('tex_grass', scene, (ctx, w, h) => {
        ctx.fillStyle = '#446e28';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 5000; i++) {
            const green = 80 + Math.random() * 95;
            ctx.fillStyle = `rgba(${green - 30},${green},${green - 50}, 0.65)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4 + Math.random() * 6);
        }
    }, 256);
}

/**
 * Casca de Carvalho / Pinheiro com veios profundos
 */
export function createBarkTexture(scene) {
    return getOrCreateTexture('tex_bark', scene, (ctx, w, h) => {
        ctx.fillStyle = '#483424';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(20, 12, 6, 0.65)';
        for (let x = 4; x < w; x += 10) {
            ctx.lineWidth = 2 + Math.random() * 3;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (Math.random() - 0.5) * 8, h);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(110, 90, 65, 0.4)';
        for (let i = 0; i < 1500; i++) {
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    }, 256);
}

/**
 * Placa de Rodovia e Billboard
 */
export function createSignTexture(scene, title = 'BUBBA GUMP', sub = 'SHRIMP CO.') {
    const key = `tex_sign_${title}_${sub}`;
    return getOrCreateTexture(key, scene, (ctx, w, h) => {
        // Moldura verde floresta estilo anos 70
        ctx.fillStyle = '#1c4228';
        ctx.fillRect(0, 0, w, h);

        // Borda dourada
        ctx.fillStyle = '#e2cca0';
        ctx.fillRect(10, 10, w - 20, h - 20);

        ctx.fillStyle = '#1c4228';
        ctx.fillRect(18, 18, w - 36, h - 36);

        // Texto principal
        ctx.fillStyle = '#f6edd4';
        ctx.font = 'bold 36px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText(title, w / 2, h / 2 - 8);

        // Subtítulo
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillStyle = '#e2cca0';
        ctx.fillText(sub, w / 2, h / 2 + 36);
    }, { width: 512, height: 256 });
}

/**
 * Nuvem Suave e Volumétrica para os céus americanos
 */
export function createCloudTexture(scene) {
    return getOrCreateTexture('tex_cloud', scene, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);

        const puffs = [
            { x: 0.3, y: 0.55, r: 0.25 },
            { x: 0.5, y: 0.45, r: 0.32 },
            { x: 0.7, y: 0.55, r: 0.26 },
            { x: 0.4, y: 0.65, r: 0.22 },
            { x: 0.6, y: 0.65, r: 0.22 }
        ];

        for (const p of puffs) {
            const rad = p.r * w;
            const cx = p.x * w;
            const cy = p.y * h;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.5, 'rgba(250, 246, 240, 0.6)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            ctx.fill();
        }
    }, 512);
}

/**
 * Pena Branca Clássica do filme
 */
export function createFeatherTexture(scene) {
    return getOrCreateTexture('tex_feather', scene, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);

        // Barbas da pena com gradiente suave
        const grad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(248, 246, 238, 0.95)');
        grad.addColorStop(1, 'rgba(235, 230, 220, 0.7)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.05);
        ctx.bezierCurveTo(w * 0.85, h * 0.3, w * 0.8, h * 0.7, w * 0.5, h * 0.95);
        ctx.bezierCurveTo(w * 0.2, h * 0.7, w * 0.15, h * 0.3, w * 0.5, h * 0.05);
        ctx.fill();

        // Raque central (haste)
        ctx.strokeStyle = 'rgba(210, 205, 195, 0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.02);
        ctx.lineTo(w * 0.5, h * 0.98);
        ctx.stroke();

        // Franjas delicadas
        ctx.strokeStyle = 'rgba(220, 218, 210, 0.4)';
        ctx.lineWidth = 1.5;
        for (let y = h * 0.1; y < h * 0.88; y += 8) {
            ctx.beginPath();
            ctx.moveTo(w * 0.5, y);
            ctx.lineTo(w * 0.8, y + 14);
            ctx.moveTo(w * 0.5, y);
            ctx.lineTo(w * 0.2, y + 14);
            ctx.stroke();
        }
    }, 256);
}

/**
 * Pingo de chuva e faísca
 */
export function createParticleTexture(scene) {
    return getOrCreateTexture('tex_spark', scene, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.35, 'rgba(255, 235, 180, 0.8)');
        grad.addColorStop(0.7, 'rgba(240, 180, 70, 0.3)');
        grad.addColorStop(1, 'rgba(255, 180, 50, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }, 128);
}
