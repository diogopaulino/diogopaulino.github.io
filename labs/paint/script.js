/* =========================================================
   Paint Lab — pintura digital no navegador
   ---------------------------------------------------------
   Documento: camadas do tamanho do documento (canvas fora da tela),
   compostas sob demanda numa tela visível do tamanho do viewport
   (devicePixelRatio ≤ 2). Zoom/pan só mudam a transformação da
   composição — o desenho nunca é reamostrado.

   Pincel (modelo de "carimbos", como Procreate/Photoshop):
     · Cada traço vai para um buffer do tamanho do documento; ao soltar,
       o buffer entra na camada com a OPACIDADE do pincel (o traço não
       escurece onde se cruza consigo mesmo).
     · Ponta: círculo com borda suave; dureza h ∈ [0,1] define onde o
       gradiente começa (r·h). Espaçamento = 11% do diâmetro.
     · Pressão (caneta): raio = R·(0,15 + 0,85·p^0,9). Mouse/dedo: p = 1.
     · Suavização (streamline) s ∈ [0;0,9]: média exponencial por evento,
       P ← P + (bruto − P)·(1 − s); ao soltar, o traço alcança o ponto final.
     · Entrada em alta frequência com getCoalescedEvents() (120–240 Hz).
   Borracha: mesmo buffer, aplicado com destination-out (transparência real).
   Balde: preenchimento por varredura (scanline) sobre a composição das
   camadas visíveis, tolerância por canal (0–128), máscara dilatada 1 px
   para cobrir o antisserrilhado das linhas; pinta na camada ativa.
   Desfazer: cada ação guarda só o retângulo afetado (antes/depois).
   O histórico respeita um orçamento de memória (≈ 40 MB por GB de RAM,
   120–400 MB); passos antigos saem primeiro.
   Autossalvamento: camadas em PNG no IndexedDB, 1,5 s após cada mudança.
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const app = $('#paintApp');
const viewport = $('#viewport');
const canvas = $('#canvas');
const dctx = canvas.getContext('2d');
const brushCursor = $('#brushCursor');
const toastEl = $('#toast');
const panel = $('#sidePanel');
const backdrop = $('#sheetBackdrop');

const MAX_LAYERS = 10;
const HISTORY_BUDGET = Math.max(120, Math.min(400, (navigator.deviceMemory || 4) * 40)) * 1024 * 1024;
const TOOL_NAMES = {
    brush: 'Pincel', eraser: 'Borracha', fill: 'Balde de tinta', picker: 'Conta-gotas',
    line: 'Linha', rect: 'Retângulo', circle: 'Elipse', hand: 'Mover a tela'
};
const SHAPES = ['line', 'rect', 'circle'];

/* ---------------------------------------------------------
   Preferências
   --------------------------------------------------------- */
const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem persistência */ }
    }
};
const PREFS_KEY = 'paint-lab:prefs:v2';
const prefs = Object.assign({
    tool: 'brush', color: '#111111', size: 12, opacity: 100, hardness: 85,
    smoothing: 40, tolerance: 24, pressure: true, fillShapes: false, recent: []
}, store.get(PREFS_KEY, {}));
if (!TOOL_NAMES[prefs.tool]) prefs.tool = 'brush';
if (!Array.isArray(prefs.recent)) prefs.recent = [];
let prefsTimer = 0;
const savePrefs = () => {
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => store.set(PREFS_KEY, prefs), 300);
};

/* ---------------------------------------------------------
   Documento e camadas
   --------------------------------------------------------- */
const doc = { w: 1600, h: 1200 };
let layers = [];
let active = 0;
let layerSeq = 0;

function makeLayer(name) {
    const c = document.createElement('canvas');
    c.width = doc.w;
    c.height = doc.h;
    return { id: ++layerSeq, name, canvas: c, ctx: c.getContext('2d'), visible: true, opacity: 1 };
}

function docSizeForScreen() {
    const r = viewport.getBoundingClientRect();
    return r.height > r.width * 1.1 ? { w: 1080, h: 1440 } : { w: 1600, h: 1200 };
}

function resizeWorkCanvases() {
    [strokeCanvas, tempCanvas, sampleCanvas].forEach((c) => {
        c.width = doc.w;
        c.height = doc.h;
    });
}

const strokeCanvas = document.createElement('canvas');
const sctx = strokeCanvas.getContext('2d');
const tempCanvas = document.createElement('canvas');
const tctx = tempCanvas.getContext('2d');
const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

function newDocument(size) {
    doc.w = size.w;
    doc.h = size.h;
    layerSeq = 0;
    const bg = makeLayer('Fundo');
    bg.ctx.fillStyle = '#ffffff';
    bg.ctx.fillRect(0, 0, doc.w, doc.h);
    const ink = makeLayer('Camada 1');
    layers = [bg, ink];
    active = 1;
    resizeWorkCanvases();
    clearHistory();
    $('#canvasReadout').textContent = `${doc.w} × ${doc.h}`;
    renderLayers();
    fitView();
}

const activeLayer = () => layers[active];

/* ---------------------------------------------------------
   Visualização (zoom/pan) e composição
   --------------------------------------------------------- */
const view = { zoom: 1, x: 0, y: 0, w: 1, h: 1, dpr: 1 };
let needsRender = false;
let checker = null;

function makeChecker() {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#e5e7eb';
    x.fillRect(0, 0, 8, 8);
    x.fillRect(8, 8, 8, 8);
    checker = dctx.createPattern(c, 'repeat');
}

function resizeViewport() {
    const r = viewport.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cx = view.w / 2;
    const cy = view.h / 2;
    const docCx = (cx - view.x) / view.zoom;
    const docCy = (cy - view.y) / view.zoom;
    view.w = Math.max(1, r.width);
    view.h = Math.max(1, r.height);
    view.dpr = dpr;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    makeChecker();
    if (Number.isFinite(docCx) && view.fitted) {
        // Mantém o mesmo ponto do desenho no centro ao girar o aparelho.
        view.x = view.w / 2 - docCx * view.zoom;
        view.y = view.h / 2 - docCy * view.zoom;
    }
    requestRender();
}

function fitView() {
    const pad = view.w < 600 ? 12 : 28;
    view.zoom = Math.min((view.w - pad * 2) / doc.w, (view.h - pad * 2) / doc.h);
    view.x = (view.w - doc.w * view.zoom) / 2;
    view.y = (view.h - doc.h * view.zoom) / 2;
    view.fitted = true;
    syncZoomReadout();
    requestRender();
}

function zoomAt(next, sx, sy) {
    const z = Math.max(0.05, Math.min(32, next));
    const px = sx ?? view.w / 2;
    const py = sy ?? view.h / 2;
    const dx = (px - view.x) / view.zoom;
    const dy = (py - view.y) / view.zoom;
    view.zoom = z;
    view.x = px - dx * z;
    view.y = py - dy * z;
    clampPan();
    syncZoomReadout();
    syncCursorSize();
    requestRender();
}

function clampPan() {
    // O desenho nunca sai inteiro da tela: sobram pelo menos 80 px visíveis.
    const m = 80;
    view.x = Math.min(view.w - m, Math.max(m - doc.w * view.zoom, view.x));
    view.y = Math.min(view.h - m, Math.max(m - doc.h * view.zoom, view.y));
}

function syncZoomReadout() {
    $('#zoomFitBtn').textContent = `${Math.round(view.zoom * 100)}%`;
}

function requestRender() {
    if (needsRender) return;
    needsRender = true;
    requestAnimationFrame(render);
}

function render() {
    needsRender = false;
    const d = view.dpr;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sombra + xadrez (transparência) no espaço da tela.
    dctx.setTransform(d, 0, 0, d, 0, 0);
    const sw = doc.w * view.zoom;
    const sh = doc.h * view.zoom;
    dctx.save();
    dctx.shadowColor = 'rgba(0,0,0,0.28)';
    dctx.shadowBlur = 24;
    dctx.shadowOffsetY = 8;
    dctx.fillStyle = checker || '#fff';
    dctx.fillRect(view.x, view.y, sw, sh);
    dctx.restore();

    dctx.setTransform(d * view.zoom, 0, 0, d * view.zoom, d * view.x, d * view.y);
    // Pixels nítidos ao ampliar muito; suavizados ao reduzir.
    dctx.imageSmoothingEnabled = view.zoom < 2;
    dctx.imageSmoothingQuality = 'high';
    for (let i = 0; i < layers.length; i += 1) {
        const L = layers[i];
        if (!L.visible) continue;
        if (i === active && stroke) {
            drawLayerWithStroke(L);
        } else {
            dctx.globalAlpha = L.opacity;
            dctx.drawImage(L.canvas, 0, 0);
        }
    }
    dctx.globalAlpha = 1;
}

/** Prévia do traço em andamento sobre a camada ativa. */
function drawLayerWithStroke(L) {
    const op = prefs.opacity / 100;
    if (stroke.tool === 'eraser') {
        tctx.globalCompositeOperation = 'copy';
        tctx.globalAlpha = 1;
        tctx.drawImage(L.canvas, 0, 0);
        tctx.globalCompositeOperation = 'destination-out';
        tctx.globalAlpha = op;
        tctx.drawImage(strokeCanvas, 0, 0);
        tctx.globalCompositeOperation = 'source-over';
        tctx.globalAlpha = 1;
        dctx.globalAlpha = L.opacity;
        dctx.drawImage(tempCanvas, 0, 0);
    } else {
        dctx.globalAlpha = L.opacity;
        dctx.drawImage(L.canvas, 0, 0);
        dctx.globalAlpha = L.opacity * op;
        dctx.drawImage(strokeCanvas, 0, 0);
    }
}

function toDoc(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
}

/* ---------------------------------------------------------
   Ponta do pincel
   --------------------------------------------------------- */
const TIP = 128;
const tipCanvas = document.createElement('canvas');
tipCanvas.width = TIP;
tipCanvas.height = TIP;
const tipCtx = tipCanvas.getContext('2d');
let tipKey = '';

function buildTip() {
    const color = prefs.color;
    const hard = prefs.hardness / 100;
    const key = `${color}|${hard}`;
    if (key === tipKey) return;
    tipKey = key;
    const r = TIP / 2;
    tipCtx.clearRect(0, 0, TIP, TIP);
    const [cr, cg, cb] = hexToRgb(color);
    const g = tipCtx.createRadialGradient(r, r, 0, r, r, r);
    const inner = Math.min(0.98, Math.max(0, hard));
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(inner, `rgba(${cr},${cg},${cb},1)`);
    // Curva suave na borda (mais natural que rampa linear).
    const steps = 6;
    for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const a = Math.pow(1 - t, 2.2);
        g.addColorStop(inner + (1 - inner) * t, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`);
    }
    tipCtx.fillStyle = g;
    tipCtx.beginPath();
    tipCtx.arc(r, r, r, 0, Math.PI * 2);
    tipCtx.fill();
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = (r, g, b) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

/* ---------------------------------------------------------
   Traços
   --------------------------------------------------------- */
let stroke = null;

function radiusFor(p, isPen) {
    const R = prefs.size / 2;
    if (!prefs.pressure || !isPen) return R;
    return Math.max(0.35, R * (0.15 + 0.85 * Math.pow(Math.max(0.02, p), 0.9)));
}

function grow(b, x, y, r) {
    if (x - r < b.x0) b.x0 = x - r;
    if (y - r < b.y0) b.y0 = y - r;
    if (x + r > b.x1) b.x1 = x + r;
    if (y + r > b.y1) b.y1 = y + r;
}

function stampAt(x, y, r) {
    // Dureza < 100% acumula: carimbos um pouco translúcidos dão borda macia sem "contas".
    sctx.globalAlpha = prefs.hardness >= 95 ? 1 : 0.55;
    sctx.drawImage(tipCanvas, x - r, y - r, r * 2, r * 2);
    grow(stroke.box, x, y, r + 1);
    stroke.stamps += 1;
}

function strokeTo(x, y, p) {
    const s = stroke;
    const dx = x - s.lx;
    const dy = y - s.ly;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return;
    const r0 = radiusFor(s.lp, s.pen);
    const r1 = radiusFor(p, s.pen);
    let d = s.residual;
    while (d <= dist) {
        const k = d / dist;
        const r = r0 + (r1 - r0) * k;
        stampAt(s.lx + dx * k, s.ly + dy * k, r);
        d += Math.max(0.5, r * 0.22);
    }
    s.residual = d - dist;
    s.lx = x;
    s.ly = y;
    s.lp = p;
}

function beginStroke(e, pt) {
    const tool = prefs.tool;
    const isPen = e.pointerType === 'pen';
    const p = isPen ? (e.pressure || 0.5) : 1;
    const L = activeLayer();
    if (!L.visible) {
        toast('Camada oculta — mostre-a para pintar');
        return false;
    }
    sctx.clearRect(0, 0, doc.w, doc.h);
    stroke = {
        tool,
        pen: isPen,
        id: e.pointerId,
        sx: pt.x,
        sy: pt.y,
        lx: pt.x,
        ly: pt.y,
        lp: p,
        mx: pt.x,
        my: pt.y,
        residual: 0,
        stamps: 0,
        box: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
        startedAt: performance.now(),
        shift: e.shiftKey
    };
    if (tool === 'brush' || tool === 'eraser') {
        buildTip();
        stampAt(pt.x, pt.y, radiusFor(p, isPen));
    }
    requestRender();
    return true;
}

function moveStroke(e) {
    if (!stroke) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    const list = events && events.length ? events : [e];
    const s = stroke;
    if (s.tool === 'brush' || s.tool === 'eraser') {
        const k = 1 - prefs.smoothing / 100;
        for (const ev of list) {
            const pt = toDoc(ev.clientX, ev.clientY);
            const p = s.pen ? (ev.pressure || s.lp) : 1;
            s.mx += (pt.x - s.mx) * k;
            s.my += (pt.y - s.my) * k;
            s.rx = pt.x;
            s.ry = pt.y;
            strokeTo(s.mx, s.my, p);
        }
    } else if (SHAPES.includes(s.tool)) {
        const last = list[list.length - 1];
        const pt = toDoc(last.clientX, last.clientY);
        drawShape(pt.x, pt.y, e.shiftKey);
    }
    requestRender();
}

function drawShape(x, y, constrain) {
    const s = stroke;
    let ex = x;
    let ey = y;
    const dx = ex - s.sx;
    const dy = ey - s.sy;
    if (constrain) {
        if (s.tool === 'line') {
            // Trava em múltiplos de 45°.
            const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            ex = s.sx + Math.cos(ang) * len;
            ey = s.sy + Math.sin(ang) * len;
        } else {
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            ex = s.sx + Math.sign(dx || 1) * m;
            ey = s.sy + Math.sign(dy || 1) * m;
        }
    }
    // Limpa só a área usada pela prévia anterior.
    if (s.box.x1 > s.box.x0) sctx.clearRect(s.box.x0 - 2, s.box.y0 - 2, s.box.x1 - s.box.x0 + 4, s.box.y1 - s.box.y0 + 4);
    s.box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const lw = prefs.size;
    sctx.save();
    sctx.globalAlpha = 1;
    sctx.strokeStyle = prefs.color;
    sctx.fillStyle = prefs.color;
    sctx.lineWidth = lw;
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    sctx.beginPath();
    if (s.tool === 'line') {
        sctx.moveTo(s.sx, s.sy);
        sctx.lineTo(ex, ey);
        sctx.stroke();
    } else if (s.tool === 'rect') {
        sctx.rect(Math.min(s.sx, ex), Math.min(s.sy, ey), Math.abs(ex - s.sx), Math.abs(ey - s.sy));
        if (prefs.fillShapes) sctx.fill();
        sctx.stroke();
    } else {
        const rx = Math.abs(ex - s.sx) / 2;
        const ry = Math.abs(ey - s.sy) / 2;
        sctx.ellipse(Math.min(s.sx, ex) + rx, Math.min(s.sy, ey) + ry, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
        if (prefs.fillShapes) sctx.fill();
        sctx.stroke();
    }
    sctx.restore();
    grow(s.box, s.sx, s.sy, lw);
    grow(s.box, ex, ey, lw);
    s.stamps = Math.hypot(ex - s.sx, ey - s.sy) > 0.5 ? 1 : 0;
}

function clampBox(b, pad = 2) {
    const x = Math.max(0, Math.floor(b.x0 - pad));
    const y = Math.max(0, Math.floor(b.y0 - pad));
    const x1 = Math.min(doc.w, Math.ceil(b.x1 + pad));
    const y1 = Math.min(doc.h, Math.ceil(b.y1 + pad));
    return { x, y, w: x1 - x, h: y1 - y };
}

function endStroke(commit = true) {
    const s = stroke;
    if (!s) return;
    if ((s.tool === 'brush' || s.tool === 'eraser') && Number.isFinite(s.rx)) {
        // Alcança o ponto final real (a suavização deixa o traço "atrasado").
        strokeTo(s.rx, s.ry, s.lp);
    }
    stroke = null;
    if (!commit || !s.stamps || !(s.box.x1 > s.box.x0)) {
        sctx.clearRect(0, 0, doc.w, doc.h);
        requestRender();
        return;
    }
    const L = activeLayer();
    const b = clampBox(s.box);
    if (b.w <= 0 || b.h <= 0) {
        sctx.clearRect(0, 0, doc.w, doc.h);
        requestRender();
        return;
    }
    const before = L.ctx.getImageData(b.x, b.y, b.w, b.h);
    L.ctx.save();
    L.ctx.globalAlpha = prefs.opacity / 100;
    L.ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    L.ctx.drawImage(strokeCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    L.ctx.restore();
    const after = L.ctx.getImageData(b.x, b.y, b.w, b.h);
    sctx.clearRect(b.x, b.y, b.w, b.h);
    pushPixels(L, b, before, after, TOOL_NAMES[s.tool]);
    if (s.tool !== 'eraser') rememberColor(prefs.color);
    layerChanged(L);
    requestRender();
}

/* ---------------------------------------------------------
   Balde e conta-gotas
   --------------------------------------------------------- */
function compositeTo(ctx2, sx = 0, sy = 0, w = doc.w, h = doc.h) {
    ctx2.clearRect(0, 0, w, h);
    for (const L of layers) {
        if (!L.visible) continue;
        ctx2.globalAlpha = L.opacity;
        ctx2.drawImage(L.canvas, sx, sy, w, h, 0, 0, w, h);
    }
    ctx2.globalAlpha = 1;
}

function floodFill(px, py) {
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const W = doc.w;
    const H = doc.h;
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const L = activeLayer();
    if (!L.visible) {
        toast('Camada oculta — mostre-a para pintar');
        return;
    }
    compositeTo(sampleCtx);
    const src = sampleCtx.getImageData(0, 0, W, H).data;
    const i0 = (y0 * W + x0) * 4;
    const tr = src[i0];
    const tg = src[i0 + 1];
    const tb = src[i0 + 2];
    const ta = src[i0 + 3];
    const tol = prefs.tolerance;
    const mask = new Uint8Array(W * H);
    const match = (p) => {
        if (mask[p]) return false;
        const i = p * 4;
        return Math.abs(src[i] - tr) <= tol && Math.abs(src[i + 1] - tg) <= tol
            && Math.abs(src[i + 2] - tb) <= tol && Math.abs(src[i + 3] - ta) <= tol;
    };
    let minX = x0;
    let maxX = x0;
    let minY = y0;
    let maxY = y0;
    // Scanline: preenche vãos horizontais e empilha só o início de cada vão vizinho.
    const stack = [x0, y0];
    while (stack.length) {
        const y = stack.pop();
        let x = stack.pop();
        let p = y * W + x;
        if (!match(p)) continue;
        while (x > 0 && match(p - 1)) {
            x -= 1;
            p -= 1;
        }
        let spanUp = false;
        let spanDown = false;
        while (x < W && match(p)) {
            mask[p] = 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y > 0) {
                const up = match(p - W);
                if (up && !spanUp) { stack.push(x, y - 1); spanUp = true; } else if (!up) spanUp = false;
            }
            if (y < H - 1) {
                const dn = match(p + W);
                if (dn && !spanDown) { stack.push(x, y + 1); spanDown = true; } else if (!dn) spanDown = false;
            }
            x += 1;
            p += 1;
        }
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    // Caixa + 1 px de dilatação.
    const bx = Math.max(0, minX - 1);
    const by = Math.max(0, minY - 1);
    const bw = Math.min(W, maxX + 2) - bx;
    const bh = Math.min(H, maxY + 2) - by;
    const [cr, cg, cb] = hexToRgb(prefs.color);
    const fill = new ImageData(bw, bh);
    const fd = fill.data;
    for (let y = 0; y < bh; y += 1) {
        const gy = by + y;
        for (let x = 0; x < bw; x += 1) {
            const gx = bx + x;
            const p = gy * W + gx;
            let on = mask[p];
            if (!on) {
                on = (gx > 0 && mask[p - 1]) || (gx < W - 1 && mask[p + 1])
                    || (gy > 0 && mask[p - W]) || (gy < H - 1 && mask[p + W]);
            }
            if (on) {
                const i = (y * bw + x) * 4;
                fd[i] = cr;
                fd[i + 1] = cg;
                fd[i + 2] = cb;
                fd[i + 3] = 255;
            }
        }
    }
    const b = { x: bx, y: by, w: bw, h: bh };
    const before = L.ctx.getImageData(b.x, b.y, b.w, b.h);
    tctx.clearRect(0, 0, bw, bh);
    tctx.putImageData(fill, 0, 0);
    L.ctx.save();
    L.ctx.globalAlpha = prefs.opacity / 100;
    L.ctx.drawImage(tempCanvas, 0, 0, bw, bh, b.x, b.y, bw, bh);
    L.ctx.restore();
    tctx.clearRect(0, 0, bw, bh);
    const after = L.ctx.getImageData(b.x, b.y, b.w, b.h);
    pushPixels(L, b, before, after, 'Balde de tinta');
    rememberColor(prefs.color);
    layerChanged(L);
    requestRender();
}

function pickColor(px, py) {
    const x = Math.floor(px);
    const y = Math.floor(py);
    if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return;
    sampleCtx.clearRect(0, 0, 1, 1);
    compositeTo(sampleCtx, x, y, 1, 1);
    const d = sampleCtx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 8) {
        toast('Área transparente — nada para pegar');
        return;
    }
    setColor(rgbToHex(d[0], d[1], d[2]));
    toast(`Cor ${prefs.color.toUpperCase()}`);
}

/* ---------------------------------------------------------
   Histórico com orçamento de memória
   --------------------------------------------------------- */
const past = [];
const future = [];
let historyBytes = 0;

function clearHistory() {
    past.length = 0;
    future.length = 0;
    historyBytes = 0;
    updateHistoryButtons();
}

function pushEntry(entry) {
    future.forEach((e) => { historyBytes -= e.bytes; });
    future.length = 0;
    past.push(entry);
    historyBytes += entry.bytes;
    while (historyBytes > HISTORY_BUDGET && past.length > 1) {
        historyBytes -= past.shift().bytes;
    }
    updateHistoryButtons();
    scheduleAutosave();
}

function pushPixels(L, b, before, after, label) {
    pushEntry({
        label,
        bytes: before.data.length + after.data.length,
        undo: () => { L.ctx.putImageData(before, b.x, b.y); layerChanged(L); },
        redo: () => { L.ctx.putImageData(after, b.x, b.y); layerChanged(L); }
    });
}

function undo() {
    if (stroke) endStroke(false);
    const e = past.pop();
    if (!e) return;
    e.undo();
    future.push(e);
    afterHistory(`Desfeito: ${e.label}`);
}

function redo() {
    if (stroke) return;
    const e = future.pop();
    if (!e) return;
    e.redo();
    past.push(e);
    afterHistory(`Refeito: ${e.label}`);
}

function afterHistory(msg) {
    updateHistoryButtons();
    renderLayers();
    requestRender();
    scheduleAutosave();
    toast(msg, 900);
}

function updateHistoryButtons() {
    $('#undoBtn').disabled = !past.length;
    $('#redoBtn').disabled = !future.length;
}

/* ---------------------------------------------------------
   Camadas (UI + operações com desfazer)
   --------------------------------------------------------- */
const layerList = $('#layerList');
const thumbTimers = new Map();

function layerChanged(L) {
    clearTimeout(thumbTimers.get(L.id));
    thumbTimers.set(L.id, setTimeout(() => drawThumb(L), 250));
}

function drawThumb(L) {
    const row = layerList.querySelector(`[data-id="${L.id}"] canvas`);
    if (!row) return;
    const c = row.getContext('2d');
    c.clearRect(0, 0, row.width, row.height);
    c.drawImage(L.canvas, 0, 0, row.width, row.height);
}

function renderLayers() {
    layerList.textContent = '';
    for (let i = layers.length - 1; i >= 0; i -= 1) {
        const L = layers[i];
        const li = document.createElement('li');
        li.className = 'layer-row';
        li.dataset.id = String(L.id);
        li.classList.toggle('is-active', i === active);
        li.classList.toggle('is-hidden', !L.visible);

        const eye = document.createElement('button');
        eye.type = 'button';
        eye.className = 'layer-eye';
        eye.dataset.act = 'eye';
        eye.setAttribute('aria-label', `${L.visible ? 'Ocultar' : 'Mostrar'} ${L.name}`);
        eye.setAttribute('aria-pressed', String(L.visible));
        eye.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${L.visible ? 'i-eye' : 'i-eye-off'}"></use></svg>`;

        const sel = document.createElement('button');
        sel.type = 'button';
        sel.className = 'layer-select';
        sel.dataset.act = 'select';
        sel.setAttribute('aria-pressed', String(i === active));
        const thumb = document.createElement('canvas');
        thumb.width = 56;
        thumb.height = Math.max(24, Math.round((56 * doc.h) / doc.w));
        thumb.className = 'layer-thumb';
        const name = document.createElement('span');
        name.className = 'layer-name';
        name.textContent = L.name;
        const op = document.createElement('span');
        op.className = 'layer-op';
        op.textContent = `${Math.round(L.opacity * 100)}%`;
        sel.append(thumb, name, op);

        li.append(eye, sel);
        layerList.appendChild(li);
        drawThumb(L);
    }
    const L = activeLayer();
    $('#layerOpacity').value = String(Math.round(L.opacity * 100));
    $('#layerOpacityVal').textContent = `${Math.round(L.opacity * 100)}%`;
    $('#layerUp').disabled = active >= layers.length - 1;
    $('#layerDown').disabled = active <= 0;
    $('#layerDelete').disabled = layers.length <= 1;
    $('#layerAdd').disabled = layers.length >= MAX_LAYERS;
    $('#layerDup').disabled = layers.length >= MAX_LAYERS;
}

layerList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.layer-row').dataset.id);
    const idx = layers.findIndex((L) => L.id === id);
    if (idx < 0) return;
    if (btn.dataset.act === 'eye') {
        layers[idx].visible = !layers[idx].visible;
        scheduleAutosave();
    } else {
        active = idx;
    }
    renderLayers();
    requestRender();
});

function insertLayer(L, index, label) {
    layers.splice(index, 0, L);
    active = index;
    pushEntry({
        label,
        bytes: 1024,
        undo: () => {
            const i = layers.indexOf(L);
            if (i >= 0) layers.splice(i, 1);
            active = Math.min(active, layers.length - 1);
        },
        redo: () => {
            layers.splice(Math.min(index, layers.length), 0, L);
            active = layers.indexOf(L);
        }
    });
    renderLayers();
    requestRender();
}

$('#layerAdd').addEventListener('click', () => {
    if (layers.length >= MAX_LAYERS) return;
    insertLayer(makeLayer(`Camada ${layerSeq}`), active + 1, 'Nova camada');
});

$('#layerDup').addEventListener('click', () => {
    if (layers.length >= MAX_LAYERS) return;
    const src = activeLayer();
    const L = makeLayer(`${src.name} cópia`);
    L.ctx.drawImage(src.canvas, 0, 0);
    L.opacity = src.opacity;
    insertLayer(L, active + 1, 'Duplicar camada');
});

$('#layerDelete').addEventListener('click', () => {
    if (layers.length <= 1) return;
    const idx = active;
    const L = layers[idx];
    layers.splice(idx, 1);
    active = Math.max(0, idx - 1);
    pushEntry({
        label: 'Excluir camada',
        bytes: doc.w * doc.h * 4,
        undo: () => {
            layers.splice(idx, 0, L);
            active = idx;
        },
        redo: () => {
            const i = layers.indexOf(L);
            if (i >= 0) layers.splice(i, 1);
            active = Math.max(0, Math.min(active, layers.length - 1));
        }
    });
    renderLayers();
    requestRender();
    toast('Camada excluída — Ctrl+Z desfaz');
});

function moveLayer(dir) {
    const from = active;
    const to = from + dir;
    if (to < 0 || to >= layers.length) return;
    const swap = () => {
        const a = layers.indexOf(L);
        const b = a + (a === from ? dir : -dir);
        [layers[a], layers[b]] = [layers[b], layers[a]];
        active = b;
    };
    const L = layers[from];
    [layers[from], layers[to]] = [layers[to], layers[from]];
    active = to;
    pushEntry({ label: 'Mover camada', bytes: 64, undo: swap, redo: swap });
    renderLayers();
    requestRender();
}
$('#layerUp').addEventListener('click', () => moveLayer(1));
$('#layerDown').addEventListener('click', () => moveLayer(-1));

$('#layerOpacity').addEventListener('input', (e) => {
    const L = activeLayer();
    L.opacity = Number(e.target.value) / 100;
    $('#layerOpacityVal').textContent = `${e.target.value}%`;
    const op = layerList.querySelector(`[data-id="${L.id}"] .layer-op`);
    if (op) op.textContent = `${e.target.value}%`;
    requestRender();
    scheduleAutosave();
});

function clearActiveLayer() {
    const L = activeLayer();
    const b = { x: 0, y: 0, w: doc.w, h: doc.h };
    const before = L.ctx.getImageData(0, 0, doc.w, doc.h);
    L.ctx.clearRect(0, 0, doc.w, doc.h);
    // O fundo volta a ser branco, não transparente.
    if (active === 0 && L.name === 'Fundo') {
        L.ctx.fillStyle = '#ffffff';
        L.ctx.fillRect(0, 0, doc.w, doc.h);
    }
    const after = L.ctx.getImageData(0, 0, doc.w, doc.h);
    pushPixels(L, b, before, after, 'Limpar camada');
    layerChanged(L);
    requestRender();
    toast(`"${L.name}" limpa — Ctrl+Z desfaz`);
}
$('#clearBtn').addEventListener('click', clearActiveLayer);

// Novo desenho apaga tudo (inclusive o histórico): pede um segundo toque.
let newDocArmed = 0;
$('#newDocBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!newDocArmed) {
        btn.textContent = 'Toque de novo para apagar tudo';
        btn.classList.add('is-armed');
        newDocArmed = setTimeout(() => {
            newDocArmed = 0;
            btn.textContent = 'Novo desenho';
            btn.classList.remove('is-armed');
        }, 3500);
        return;
    }
    clearTimeout(newDocArmed);
    newDocArmed = 0;
    btn.textContent = 'Novo desenho';
    btn.classList.remove('is-armed');
    newDocument(docSizeForScreen());
    deleteAutosave();
    closePanel();
    toast('Novo desenho');
});

/* ---------------------------------------------------------
   Importar imagem como camada
   --------------------------------------------------------- */
async function importImage(file) {
    if (!file || !(file.type || '').startsWith('image/')) {
        toast('Isso não é uma imagem');
        return;
    }
    if (layers.length >= MAX_LAYERS) {
        toast(`Limite de ${MAX_LAYERS} camadas`);
        return;
    }
    let bmp = null;
    try {
        bmp = await createImageBitmap(file);
    } catch {
        try {
            bmp = await new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
                img.src = url;
            });
        } catch {
            toast('Não foi possível abrir essa imagem');
            return;
        }
    }
    const L = makeLayer((file.name || 'Imagem').replace(/\.[^.]+$/, '').slice(0, 24) || 'Imagem');
    const w = bmp.width || bmp.naturalWidth;
    const h = bmp.height || bmp.naturalHeight;
    const k = Math.min(doc.w / w, doc.h / h, 1);
    const dw = w * k;
    const dh = h * k;
    L.ctx.imageSmoothingQuality = 'high';
    L.ctx.drawImage(bmp, (doc.w - dw) / 2, (doc.h - dh) / 2, dw, dh);
    if (bmp.close) bmp.close();
    insertLayer(L, active + 1, 'Importar imagem');
    toast('Imagem importada como camada');
}

$('#importBtn').addEventListener('click', () => $('#importInput').click());
$('#importInput').addEventListener('change', (e) => {
    importImage(e.target.files[0]);
    e.target.value = '';
});
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    $('#dropHint').hidden = false;
});
window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) $('#dropHint').hidden = true;
});
window.addEventListener('drop', (e) => {
    e.preventDefault();
    $('#dropHint').hidden = true;
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) importImage(f);
});
window.addEventListener('paste', (e) => {
    const item = e.clipboardData && Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    importImage(item.getAsFile());
});

/* ---------------------------------------------------------
   Exportar
   --------------------------------------------------------- */
async function saveImage() {
    if (stroke) endStroke(true);
    const out = document.createElement('canvas');
    out.width = doc.w;
    out.height = doc.h;
    compositeTo(out.getContext('2d'));
    try {
        const { saveCanvas } = await import('../shared/save-canvas.js');
        await saveCanvas(out, `paint-lab-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`);
        toast('PNG salvo');
    } catch {
        toast('Falha ao salvar');
    }
}
$('#saveBtn').addEventListener('click', saveImage);

/* ---------------------------------------------------------
   Autossalvamento (IndexedDB)
   --------------------------------------------------------- */
const DB_NAME = 'paint-lab';
let autosaveTimer = 0;

function openDb() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('sem idb'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('doc');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosave, 1500);
}

async function autosave() {
    clearTimeout(autosaveTimer);
    if (stroke) {
        scheduleAutosave();
        return;
    }
    try {
        const blobs = await Promise.all(layers.map((L) => new Promise((r) => L.canvas.toBlob(r, 'image/png'))));
        const data = {
            w: doc.w,
            h: doc.h,
            active,
            savedAt: Date.now(),
            layers: layers.map((L, i) => ({ name: L.name, visible: L.visible, opacity: L.opacity, blob: blobs[i] }))
        };
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('doc', 'readwrite');
            tx.objectStore('doc').put(data, 'current');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch {
        /* sem armazenamento: segue só em memória */
    }
}

async function loadAutosave() {
    try {
        const db = await openDb();
        const data = await new Promise((resolve, reject) => {
            const req = db.transaction('doc').objectStore('doc').get('current');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        db.close();
        if (!data || !Array.isArray(data.layers) || !data.layers.length || !data.w || !data.h) return false;
        if (data.w * data.h > 8_000_000) return false;
        doc.w = data.w;
        doc.h = data.h;
        layerSeq = 0;
        const restored = [];
        for (const item of data.layers.slice(0, MAX_LAYERS)) {
            const L = makeLayer(String(item.name || 'Camada').slice(0, 30));
            L.visible = item.visible !== false;
            L.opacity = Math.max(0, Math.min(1, Number(item.opacity) || 1));
            if (item.blob) {
                const bmp = await createImageBitmap(item.blob);
                L.ctx.drawImage(bmp, 0, 0);
                if (bmp.close) bmp.close();
            }
            restored.push(L);
        }
        layers = restored;
        active = Math.max(0, Math.min(layers.length - 1, Number(data.active) || 0));
        resizeWorkCanvases();
        clearHistory();
        $('#canvasReadout').textContent = `${doc.w} × ${doc.h}`;
        renderLayers();
        fitView();
        return true;
    } catch {
        return false;
    }
}

async function deleteAutosave() {
    try {
        const db = await openDb();
        db.transaction('doc', 'readwrite').objectStore('doc').delete('current');
        db.close();
    } catch {
        /* nada a apagar */
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (stroke) endStroke(true);
        autosave();
    }
});

/* ---------------------------------------------------------
   Ferramentas e propriedades
   --------------------------------------------------------- */
function setTool(tool) {
    if (!TOOL_NAMES[tool]) return;
    if (stroke) endStroke(true);
    prefs.tool = tool;
    savePrefs();
    app.dataset.tool = tool;
    $$('.tool-btn').forEach((b) => {
        const on = b.dataset.tool === tool;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
    });
    $$('[data-for]').forEach((el) => {
        el.hidden = !el.dataset.for.split(' ').includes(tool);
    });
    $('#activeToolName').textContent = TOOL_NAMES[tool];
    syncHud();
    syncCursorSize();
}
$$('.tool-btn').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

function syncHud() {
    const t = prefs.tool;
    const extra = t === 'fill' ? `tolerância ${prefs.tolerance}`
        : t === 'picker' || t === 'hand' ? ''
            : `${prefs.size} px · ${prefs.opacity}%`;
    $('#hudSize').textContent = extra;
    $('#hudSize').previousSibling.textContent = extra ? ' · ' : '';
}

function setColor(color) {
    prefs.color = color.toLowerCase();
    savePrefs();
    $('#colorPicker').value = prefs.color;
    $('#colorWellDot').style.background = prefs.color;
    $('#quickColorDot').style.background = prefs.color;
    $$('.color-swatch').forEach((sw) => {
        const on = sw.dataset.color.toLowerCase() === prefs.color;
        sw.classList.toggle('is-active', on);
        sw.setAttribute('aria-pressed', String(on));
    });
    tipKey = '';
    brushCursor.style.setProperty('--c', prefs.color);
}

function rememberColor(color) {
    const c = color.toLowerCase();
    prefs.recent = [c, ...prefs.recent.filter((x) => x !== c)].slice(0, 8);
    savePrefs();
    renderRecent();
}

function renderRecent() {
    const box = $('#recentColors');
    box.textContent = '';
    prefs.recent.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'color-swatch recent';
        b.style.setProperty('--swatch', c);
        b.dataset.color = c;
        b.setAttribute('aria-label', `Cor recente ${c}`);
        box.appendChild(b);
    });
    box.hidden = !prefs.recent.length;
}

$('#colorPicker').addEventListener('input', (e) => setColor(e.target.value));
$('#colorPicker').addEventListener('change', (e) => rememberColor(e.target.value));
panel.addEventListener('click', (e) => {
    const sw = e.target.closest('.color-swatch');
    if (sw) setColor(sw.dataset.color);
});

function bindRange(id, key, fmt, after) {
    const input = document.getElementById(id);
    const out = document.getElementById(`${id}Val`);
    input.value = String(prefs[key]);
    out.textContent = fmt(prefs[key]);
    input.addEventListener('input', () => {
        prefs[key] = Number(input.value);
        out.textContent = fmt(prefs[key]);
        savePrefs();
        if (after) after();
        syncHud();
    });
}
bindRange('brushSize', 'size', (v) => `${v} px`, syncCursorSize);
bindRange('opacity', 'opacity', (v) => `${v}%`);
bindRange('hardness', 'hardness', (v) => `${v}%`, () => { tipKey = ''; });
bindRange('smoothing', 'smoothing', (v) => `${v}%`);
bindRange('tolerance', 'tolerance', (v) => String(v));

const pressureToggle = $('#pressureToggle');
pressureToggle.checked = !!prefs.pressure;
pressureToggle.addEventListener('change', () => { prefs.pressure = pressureToggle.checked; savePrefs(); });
const fillShapes = $('#fillShapes');
fillShapes.checked = !!prefs.fillShapes;
fillShapes.addEventListener('change', () => { prefs.fillShapes = fillShapes.checked; savePrefs(); });

function setSize(v) {
    prefs.size = Math.max(1, Math.min(200, Math.round(v)));
    $('#brushSize').value = String(prefs.size);
    $('#brushSizeVal').textContent = `${prefs.size} px`;
    savePrefs();
    syncCursorSize();
    syncHud();
}

function setOpacity(v) {
    prefs.opacity = Math.max(1, Math.min(100, Math.round(v)));
    $('#opacity').value = String(prefs.opacity);
    $('#opacityVal').textContent = `${prefs.opacity}%`;
    savePrefs();
    syncHud();
}

/* Cursor do pincel (contorno do tamanho real no zoom atual). */
function syncCursorSize() {
    const d = Math.max(4, prefs.size * view.zoom);
    brushCursor.style.width = `${d}px`;
    brushCursor.style.height = `${d}px`;
}

function moveCursor(e) {
    const show = e.pointerType === 'mouse' || e.pointerType === 'pen';
    const t = prefs.tool;
    const visible = show && !panning && !spaceDown && (t === 'brush' || t === 'eraser' || SHAPES.includes(t));
    brushCursor.classList.toggle('is-visible', visible);
    if (!visible) return;
    const r = viewport.getBoundingClientRect();
    brushCursor.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px) translate(-50%, -50%)`;
}

/* ---------------------------------------------------------
   Entrada (ponteiros, pinça, pan)
   --------------------------------------------------------- */
const pointers = new Map();
let pinch = null;
let panning = null;
let spaceDown = false;
let penSeen = false;

const pointerOpts = { passive: false };

canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen') penSeen = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    // Capture só mouse/caneta: no iOS o capture do 1º dedo impede a pinça.
    if (e.pointerType !== 'touch') {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }

    // Segundo dedo: cancela o traço recém-começado e vira pinça (Procreate).
    const touches = Array.from(pointers.values()).filter((p) => p.type === 'touch');
    if (touches.length >= 2) {
        if (stroke) endStroke(performance.now() - stroke.startedAt > 600 && stroke.stamps > 20);
        panning = null;
        const [a, b] = touches;
        pinch = {
            dist: Math.hypot(a.x - b.x, a.y - b.y),
            cx: (a.x + b.x) / 2,
            cy: (a.y + b.y) / 2,
            zoom: view.zoom,
            vx: view.x,
            vy: view.y
        };
        e.preventDefault();
        return;
    }
    if (pointers.size > 1) return;

    // Safari/iOS: toque chega com button 0 ou -1.
    const wantsPan = e.button === 1 || spaceDown || prefs.tool === 'hand' || (e.pointerType === 'touch' && penSeen);
    if (wantsPan) {
        e.preventDefault();
        panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        app.classList.add('is-panning');
        return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const pt = toDoc(e.clientX, e.clientY);
    const tool = prefs.tool;
    if (tool === 'picker' || (e.altKey && tool !== 'fill')) {
        pickColor(pt.x, pt.y);
        return;
    }
    if (tool === 'fill') {
        floodFill(pt.x, pt.y);
        return;
    }
    beginStroke(e, pt);
}, pointerOpts);

function onPointerMove(e) {
    moveCursor(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pinch) {
        e.preventDefault();
        const touches = Array.from(pointers.values()).filter((p) => p.type === 'touch');
        if (touches.length < 2) return;
        const [a, b] = touches;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const z = Math.max(0.05, Math.min(32, pinch.zoom * (dist / Math.max(1, pinch.dist))));
        const r = canvas.getBoundingClientRect();
        // Ponto do desenho sob o centro inicial da pinça acompanha os dedos.
        const docX = (pinch.cx - r.left - pinch.vx) / pinch.zoom;
        const docY = (pinch.cy - r.top - pinch.vy) / pinch.zoom;
        view.zoom = z;
        view.x = cx - r.left - docX * z;
        view.y = cy - r.top - docY * z;
        clampPan();
        syncZoomReadout();
        syncCursorSize();
        requestRender();
        return;
    }
    if (panning) {
        e.preventDefault();
        view.x = panning.vx + (e.clientX - panning.x);
        view.y = panning.vy + (e.clientY - panning.y);
        clampPan();
        requestRender();
        return;
    }
    if (stroke && e.pointerId === stroke.id) {
        e.preventDefault();
        moveStroke(e);
    }
}
// Window: dedos sem capture (iOS) continuam desenhando/pinçando fora do canvas.
window.addEventListener('pointermove', onPointerMove, pointerOpts);

function releasePointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch && Array.from(pointers.values()).filter((p) => p.type === 'touch').length < 2) {
        pinch = null;
    }
    if (panning && !pointers.size) {
        panning = null;
        app.classList.remove('is-panning');
    }
    if (stroke && e.pointerId === stroke.id) endStroke(true);
}
window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') brushCursor.classList.remove('is-visible');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, pointerOpts);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, pointerOpts);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    // Pinça do trackpad (ctrl+roda) ou roda do mouse = zoom; rolagem de dois dedos = mover.
    const isMouseWheel = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0);
    if (e.ctrlKey || e.metaKey || isMouseWheel) {
        const k = e.deltaMode === 1 ? 0.06 : 0.0022;
        zoomAt(view.zoom * Math.exp(-e.deltaY * k), sx, sy);
    } else {
        view.x -= e.deltaX;
        view.y -= e.deltaY;
        clampPan();
        requestRender();
    }
}, { passive: false });

$('#zoomInBtn').addEventListener('click', () => zoomAt(view.zoom * 1.25));
$('#zoomOutBtn').addEventListener('click', () => zoomAt(view.zoom / 1.25));
$('#zoomFitBtn').addEventListener('click', fitView);
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);

/* ---------------------------------------------------------
   Painel (lateral no desktop, folha inferior no celular)
   --------------------------------------------------------- */
const sheetQuery = window.matchMedia('(max-width: 899px), (max-height: 520px) and (orientation: landscape)');

function openPanel() {
    app.classList.add('panel-open');
    $('#panelToggle').setAttribute('aria-expanded', 'true');
    if (sheetQuery.matches) {
        backdrop.hidden = false;
        $('#panelClose').focus({ preventScroll: true });
    }
}

function closePanel() {
    app.classList.remove('panel-open');
    $('#panelToggle').setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
}

$('#panelToggle').addEventListener('click', () => (app.classList.contains('panel-open') ? closePanel() : openPanel()));
$('#quickColor').addEventListener('click', openPanel);
$('#panelClose').addEventListener('click', closePanel);
backdrop.addEventListener('click', closePanel);
sheetQuery.addEventListener('change', () => closePanel());

/* ---------------------------------------------------------
   Atalhos
   --------------------------------------------------------- */
const KEY_TOOLS = { b: 'brush', e: 'eraser', g: 'fill', i: 'picker', l: 'line', r: 'rect', c: 'circle', o: 'circle', h: 'hand' };

document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && ((t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
        else if (k === 's') { e.preventDefault(); saveImage(); }
        else if (k === 'o') { e.preventDefault(); $('#importInput').click(); }
        else if (k === 'n' && e.shiftKey) { e.preventDefault(); $('#layerAdd').click(); }
        else if (k === '0') { e.preventDefault(); fitView(); }
        return;
    }
    if (e.altKey) return;
    if (e.key === ' ') {
        if (t && t.tagName === 'BUTTON') return;
        e.preventDefault();
        if (!spaceDown) {
            spaceDown = true;
            app.classList.add('is-space');
            brushCursor.classList.remove('is-visible');
        }
        return;
    }
    if (e.key === 'Escape') {
        if (app.classList.contains('panel-open') && sheetQuery.matches) closePanel();
        else if (stroke) endStroke(false);
        return;
    }
    if (t && t.type === 'range') return;
    if (KEY_TOOLS[k]) { e.preventDefault(); setTool(KEY_TOOLS[k]); return; }
    if (e.key === '[') { e.preventDefault(); setSize(prefs.size - Math.max(1, Math.round(prefs.size * 0.1))); return; }
    if (e.key === ']') { e.preventDefault(); setSize(prefs.size + Math.max(1, Math.round(prefs.size * 0.1))); return; }
    if (/^[0-9]$/.test(e.key) && !e.shiftKey) {
        // 1 = 10% … 9 = 90%, 0 = 100% (como no Photoshop).
        e.preventDefault();
        setOpacity(e.key === '0' ? 100 : Number(e.key) * 10);
        toast(`Opacidade ${prefs.opacity}%`, 700);
        return;
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(view.zoom * 1.25); return; }
    if (e.key === '-') { e.preventDefault(); zoomAt(view.zoom / 1.25); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearActiveLayer(); }
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        spaceDown = false;
        app.classList.remove('is-space');
    }
});

window.addEventListener('blur', () => {
    // Sem teclas presas nem traço pela metade ao trocar de janela.
    spaceDown = false;
    app.classList.remove('is-space', 'is-panning');
    if (stroke) endStroke(true);
    pointers.clear();
    pinch = null;
    panning = null;
});

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */
let toastTimer = 0;
function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
const ro = new ResizeObserver(() => resizeViewport());
ro.observe(viewport);
resizeViewport();
setColor(prefs.color);
renderRecent();
setTool(prefs.tool);
newDocument(docSizeForScreen());
loadAutosave().then((ok) => {
    if (ok) toast('Desenho anterior restaurado');
});
window.addEventListener('pagehide', () => autosave());
