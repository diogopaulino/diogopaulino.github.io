/* =========================================================
   Image Optimizer — compressão local, em lote, sem travar a UI
   ---------------------------------------------------------
   Pipeline por imagem:
     decodificar (createImageBitmap, respeitando a orientação EXIF)
     → reduzir em etapas de ½ até o tamanho final (evita serrilhado:
       drawImage com fator < 0,5 pula pixels)
     → codificar (canvas.convertToBlob / toBlob) no formato e qualidade
   Onde roda: num pool de Web Workers com OffscreenCanvas (a página nunca
   congela, nem com 40 fotos de 12 MP). Sem suporte, cai para a thread
   principal, uma imagem por vez, cedendo o loop entre elas.
   Formatos: WebP/AVIF só aparecem se o navegador realmente codifica
   (testado na inicialização — Chrome decodifica AVIF mas não codifica).
   Limite de área: 16,7 MP por canvas (teto do Safari iOS); acima disso a
   imagem é reduzida automaticamente e o card avisa.
   ========================================================= */
import { makeZip } from './zip.js?v=1';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const isAppleTouch = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** No iPhone o atributo download falha com frequência — tenta a folha de share. */
async function saveBlob(blob, filename) {
    const file = typeof File !== 'undefined' ? new File([blob], filename, { type: blob.type || 'application/octet-stream' }) : null;
    if (file && isAppleTouch && typeof navigator.share === 'function') {
        const payload = { files: [file], title: filename };
        if (typeof navigator.canShare !== 'function' || navigator.canShare(payload)) {
            try {
                await navigator.share(payload);
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const MAX_AREA = 16777216;
const MAX_FILES = 120;
const MAX_BYTES = 120 * 1024 * 1024;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const LABEL = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' };
const ENCODABLE_SOURCES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/* ---------------------------------------------------------
   Núcleo de codificação — o MESMO código roda no worker
   (serializado com toString) e na thread principal.
   --------------------------------------------------------- */
async function encodeCore(bitmap, opts, env) {
    const sw = bitmap.width;
    const sh = bitmap.height;
    let scale = 1;
    if (opts.maxSide > 0) scale = Math.min(1, opts.maxSide / Math.max(sw, sh));
    let capped = false;
    if (sw * sh * scale * scale > opts.maxArea) {
        scale = Math.sqrt(opts.maxArea / (sw * sh));
        capped = true;
    }
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    let src = bitmap;
    let cw = sw;
    let ch = sh;
    while (cw / 2 >= w && ch / 2 >= h && (cw > w || ch > h)) {
        const nw = Math.max(w, Math.round(cw / 2));
        const nh = Math.max(h, Math.round(ch / 2));
        const step = env.canvas(nw, nh);
        const sctx = step.getContext('2d');
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(src, 0, 0, nw, nh);
        src = step;
        cw = nw;
        ch = nh;
    }

    const out = env.canvas(w, h);
    const ctx = out.getContext('2d', { alpha: opts.type !== 'image/jpeg' });
    if (opts.type === 'image/jpeg') {
        // JPEG não tem transparência: fundo branco em vez de preto.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    const lossless = opts.type === 'image/png';
    const blob = await env.encode(out, opts.type, lossless ? undefined : opts.quality);
    return { blob, w, h, srcW: sw, srcH: sh, capped };
}

const WORKER_SRC = `
const encodeCore = ${encodeCore.toString()};
const env = {
    canvas: (w, h) => new OffscreenCanvas(w, h),
    encode: (c, type, quality) => c.convertToBlob(quality === undefined ? { type } : { type, quality })
};
async function probe() {
    const c = new OffscreenCanvas(2, 2);
    const x = c.getContext('2d');
    x.fillStyle = '#f00';
    x.fillRect(0, 0, 2, 2);
    const out = [];
    for (const t of ['image/jpeg', 'image/webp', 'image/avif', 'image/png']) {
        try {
            const b = await c.convertToBlob({ type: t, quality: 0.8 });
            if (b && b.type === t) out.push(t);
        } catch (e) {}
    }
    return out;
}
self.onmessage = async (e) => {
    const d = e.data || {};
    if (d.cmd === 'probe') {
        try { self.postMessage({ id: d.id, ok: true, types: await probe() }); }
        catch (err) { self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); }
        return;
    }
    let bmp = null;
    try {
        try { bmp = await createImageBitmap(d.file, { imageOrientation: 'from-image' }); }
        catch (err) { bmp = await createImageBitmap(d.file); }
        const r = await encodeCore(bmp, d.opts, env);
        self.postMessage({ id: d.id, ok: true, result: r });
    } catch (err) {
        self.postMessage({ id: d.id, ok: false, decode: !bmp, error: String(err && err.message || err) });
    } finally {
        if (bmp && bmp.close) bmp.close();
    }
};`;

const mainEnv = {
    canvas: (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    },
    encode: (c, type, quality) => new Promise((resolve, reject) => {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality);
    })
};

function decodeWithElement(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            URL.revokeObjectURL(url);
            if (!img.naturalWidth) reject(new Error('decode'));
            else resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('decode'));
        };
        img.src = url;
    });
}

async function encodeOnMain(file, opts) {
    let source = null;
    try {
        try {
            source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            source = await decodeWithElement(file);
        }
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;
        // <img> de SVG sem tamanho intrínseco: usa um quadro padrão.
        const bitmap = width && height ? source : Object.assign(source, { width: 1024, height: 1024 });
        return await encodeCore(bitmap, opts, mainEnv);
    } finally {
        if (source && source.close) source.close();
    }
}

/* ---------------------------------------------------------
   Pool de workers
   --------------------------------------------------------- */
class Pool {
    constructor(size) {
        this.workers = [];
        this.jobs = new Map();
        this.seq = 0;
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
        for (let i = 0; i < size; i += 1) {
            const w = new Worker(url);
            w.busy = 0;
            w.onmessage = (e) => this.settle(w, e.data);
            w.onerror = (e) => {
                e.preventDefault();
                // Falha do worker: rejeita o que estava com ele.
                this.jobs.forEach((job, id) => {
                    if (job.worker === w) {
                        this.jobs.delete(id);
                        w.busy = Math.max(0, w.busy - 1);
                        job.reject(new Error('worker'));
                    }
                });
            };
            this.workers.push(w);
        }
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    settle(worker, data) {
        const job = this.jobs.get(data.id);
        if (!job) return;
        this.jobs.delete(data.id);
        worker.busy = Math.max(0, worker.busy - 1);
        clearTimeout(job.timer);
        if (data.ok) job.resolve(data);
        else job.reject(Object.assign(new Error(data.error || 'falha'), { decode: data.decode }));
    }

    run(message, timeoutMs = 120000) {
        const worker = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
        const id = ++this.seq;
        worker.busy += 1;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (!this.jobs.has(id)) return;
                this.jobs.delete(id);
                worker.busy = Math.max(0, worker.busy - 1);
                reject(new Error('timeout'));
            }, timeoutMs);
            this.jobs.set(id, { resolve, reject, worker, timer });
            worker.postMessage({ ...message, id });
        });
    }

    get size() {
        return this.workers.length;
    }
}

/* ---------------------------------------------------------
   Estado
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
const PREFS_KEY = 'image-optimizer:prefs:v1';
const prefs = Object.assign({ format: 'original', quality: 80, maxSide: 0, keepSmaller: true }, store.get(PREFS_KEY, {}));

const app = $('#app');
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const grid = $('#resultsGrid');
const toastBanner = $('#toastBanner');
const qualityRange = $('#qualityRange');
const qualityValue = $('#qualityValue');
const qualityGroup = $('#qualityGroup');
const formatHint = $('#formatHint');
const maxSide = $('#maxSide');
const keepSmaller = $('#keepSmaller');
const engineBadge = $('#engineBadge');
const summaryStats = $('#summaryStats');
const summaryProgress = $('#summaryProgress');
const downloadAllBtn = $('#downloadAllBtn');

let pool = null;
let encodable = ['image/jpeg', 'image/png'];
let generation = 0;
let idSeq = 0;
const items = new Map(); // id → item
const queue = [];
let active = 0;
let concurrency = 1;

const fmtBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
};

let toastTimer = 0;
function notice(message) {
    toastBanner.textContent = message;
    toastBanner.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBanner.hidden = true; }, 4200);
}

function savePrefs() {
    store.set(PREFS_KEY, prefs);
}

/* ---------------------------------------------------------
   Inicialização: worker + detecção de formatos
   --------------------------------------------------------- */
async function probeMain() {
    const c = mainEnv.canvas(2, 2);
    const out = [];
    for (const t of ['image/jpeg', 'image/webp', 'image/avif', 'image/png']) {
        try {
            const b = await mainEnv.encode(c, t, 0.8);
            if (b.type === t) out.push(t);
        } catch { /* sem suporte */ }
    }
    return out;
}

async function initEngine() {
    const canWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
        && typeof OffscreenCanvas.prototype.convertToBlob === 'function' && typeof createImageBitmap === 'function';
    if (canWorker) {
        try {
            const size = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
            pool = new Pool(size);
            // Folga generosa: a 1ª codificação inicializa o encoder (lento em CPU ocupada).
            const probe = await pool.run({ cmd: 'probe' }, 10000);
            if (!probe.types || !probe.types.length) throw new Error('probe vazio');
            encodable = probe.types;
            concurrency = pool.size;
            engineBadge.textContent = `Processando em ${pool.size} worker${pool.size > 1 ? 's' : ''} · a página não trava`;
            engineBadge.dataset.kind = 'worker';
        } catch (err) {
            console.warn('Workers indisponíveis, processando na página:', err && err.message);
            pool = null;
        }
    }
    if (!pool) {
        try { encodable = await probeMain(); } catch { encodable = ['image/png']; }
        concurrency = 1;
        engineBadge.textContent = 'Processando na página (navegador sem OffscreenCanvas)';
        engineBadge.dataset.kind = 'main';
    }
    $$('.seg-btn').forEach((btn) => {
        const f = btn.dataset.format;
        if (f !== 'original') btn.hidden = !encodable.includes(f);
    });
    if (prefs.format !== 'original' && !encodable.includes(prefs.format)) prefs.format = 'original';
    syncControls();
}

/* ---------------------------------------------------------
   Controles
   --------------------------------------------------------- */
function outputTypeFor(file) {
    if (prefs.format !== 'original') return prefs.format;
    if (ENCODABLE_SOURCES.includes(file.type) && encodable.includes(file.type)) return file.type;
    // GIF, BMP, SVG, HEIC decodificáveis viram PNG (sem perdas) por padrão.
    return 'image/png';
}

function syncControls() {
    $$('.seg-btn').forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.format === prefs.format)));
    qualityRange.value = String(prefs.quality);
    qualityValue.textContent = String(prefs.quality);
    maxSide.value = String(prefs.maxSide);
    if (maxSide.value !== String(prefs.maxSide)) maxSide.value = '0';
    keepSmaller.checked = !!prefs.keepSmaller;
    const lossless = prefs.format === 'image/png';
    qualityGroup.classList.toggle('is-disabled', lossless);
    qualityRange.disabled = lossless;
    formatHint.textContent = {
        original: 'Mantém o formato de cada arquivo (GIF, BMP e SVG viram PNG).',
        'image/jpeg': 'Fotos. Sem transparência (fundo vira branco).',
        'image/webp': 'Ótimo para web: ~30% menor que JPG, com transparência.',
        'image/avif': 'O menor de todos; codificação mais lenta.',
        'image/png': 'Sem perdas. Ideal para prints, ícones e transparência.'
    }[prefs.format] || '';
}

$$('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        prefs.format = btn.dataset.format;
        savePrefs();
        syncControls();
        reprocessAll();
    });
    btn.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const visible = $$('.seg-btn').filter((b) => !b.hidden);
        const i = visible.indexOf(btn);
        const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
        next.focus();
        next.click();
    });
});

let qualityTimer = 0;
qualityRange.addEventListener('input', () => {
    prefs.quality = Number(qualityRange.value);
    qualityValue.textContent = String(prefs.quality);
    clearTimeout(qualityTimer);
    // Espera o dedo parar antes de recomprimir o lote todo.
    qualityTimer = setTimeout(() => {
        savePrefs();
        reprocessAll();
    }, 380);
});

maxSide.addEventListener('change', () => {
    prefs.maxSide = Number(maxSide.value) || 0;
    savePrefs();
    reprocessAll();
});

keepSmaller.addEventListener('change', () => {
    prefs.keepSmaller = keepSmaller.checked;
    savePrefs();
    items.forEach(renderItem);
    renderSummary();
});

/* ---------------------------------------------------------
   Entrada de arquivos
   --------------------------------------------------------- */
function addFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic|heif)$/i.test(f.name));
    const skipped = files.length - images.length;
    let added = 0;
    let tooBig = 0;
    for (const file of images) {
        if (items.size >= MAX_FILES) break;
        if (file.size > MAX_BYTES) {
            tooBig += 1;
            continue;
        }
        const id = ++idSeq;
        const item = {
            id,
            file,
            url: URL.createObjectURL(file),
            status: 'queued',
            result: null,
            error: '',
            gen: -1,
            el: null
        };
        items.set(id, item);
        item.el = buildCard(item);
        grid.appendChild(item.el);
        enqueue(item);
        added += 1;
    }
    const msgs = [];
    if (skipped) msgs.push(`${skipped} arquivo${skipped > 1 ? 's' : ''} não é imagem`);
    if (tooBig) msgs.push(`${tooBig} acima de ${fmtBytes(MAX_BYTES)}`);
    if (images.length > added + tooBig) msgs.push(`limite de ${MAX_FILES} imagens por vez`);
    if (msgs.length) notice(`Ignorado: ${msgs.join(' · ')}.`);
    if (added) app.dataset.state = 'filled';
    renderSummary();
    pump();
}

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addFiles(e.dataTransfer && e.dataTransfer.files);
});
// Soltar fora da zona não deve abrir a imagem na aba (e perder o trabalho).
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dropZone.contains(e.target)) addFiles(e.dataTransfer && e.dataTransfer.files);
});
fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
});
window.addEventListener('paste', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const files = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];
    if (files.length) {
        e.preventDefault();
        addFiles(files);
    }
});

/* ---------------------------------------------------------
   Fila de processamento
   --------------------------------------------------------- */
function enqueue(item) {
    item.status = 'queued';
    item.error = '';
    if (!queue.includes(item)) queue.push(item);
    renderItem(item);
}

function reprocessAll() {
    generation += 1;
    queue.length = 0;
    items.forEach((item) => enqueue(item));
    renderSummary();
    pump();
}

let ready = false;

function pump() {
    if (!ready) return; // espera o motor (worker + formatos) ficar pronto
    while (active < concurrency && queue.length) {
        const item = queue.shift();
        if (!items.has(item.id)) continue;
        active += 1;
        processItem(item).finally(() => {
            active -= 1;
            renderSummary();
            // Cede o loop entre imagens (no fallback da thread principal).
            setTimeout(pump, pool ? 0 : 16);
        });
    }
    renderSummary();
}

async function processItem(item) {
    const gen = generation;
    const opts = {
        type: outputTypeFor(item.file),
        quality: prefs.quality / 100,
        maxSide: prefs.maxSide,
        maxArea: MAX_AREA
    };
    item.status = 'working';
    renderItem(item);
    let result = null;
    try {
        if (pool) {
            try {
                const res = await pool.run({ cmd: 'encode', file: item.file, opts });
                result = res.result;
            } catch (err) {
                // O worker não decodifica alguns formatos (SVG, por exemplo): tenta na página.
                if (err && (err.decode || err.message === 'worker')) result = await encodeOnMain(item.file, opts);
                else throw err;
            }
        } else {
            result = await encodeOnMain(item.file, opts);
        }
    } catch (err) {
        if (!items.has(item.id) || gen !== generation) return;
        item.status = 'error';
        item.error = err && err.message === 'timeout'
            ? 'Demorou demais para processar'
            : /heic|heif/i.test(item.file.type + item.file.name)
                ? 'HEIC não é suportado por este navegador'
                : 'Não foi possível ler esta imagem';
        renderItem(item);
        return;
    }
    if (!items.has(item.id) || gen !== generation) return;
    if (item.result && item.result.url) URL.revokeObjectURL(item.result.url);
    const actualType = result.blob.type || opts.type;
    item.result = {
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        w: result.w,
        h: result.h,
        srcW: result.srcW,
        srcH: result.srcH,
        type: actualType,
        capped: result.capped,
        fellBack: actualType !== opts.type
    };
    item.status = 'done';
    item.gen = gen;
    renderItem(item);
}

/* ---------------------------------------------------------
   Cards
   --------------------------------------------------------- */
function baseName(name) {
    const dot = name.lastIndexOf('.');
    return (dot > 0 ? name.slice(0, dot) : name) || 'imagem';
}

/** O que efetivamente vai para o download (respeita "manter o original"). */
function finalOutput(item) {
    if (item.status !== 'done' || !item.result) return null;
    const r = item.result;
    const keepOriginal = prefs.keepSmaller && r.blob.size >= item.file.size
        && (r.w === r.srcW && r.h === r.srcH);
    if (keepOriginal) {
        return { blob: item.file, url: item.url, name: item.file.name, kept: true, type: item.file.type };
    }
    const ext = EXT[r.type] || 'png';
    return { blob: r.blob, url: r.url, name: `${baseName(item.file.name)}.${ext}`, kept: false, type: r.type };
}

function buildCard(item) {
    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
        <button type="button" class="thumb" data-act="compare" aria-label="Comparar antes e depois">
            <img alt="" loading="lazy" decoding="async">
            <span class="thumb-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>
                Comparar
            </span>
            <span class="thumb-spinner" aria-hidden="true"></span>
        </button>
        <div class="card-body">
            <div class="card-title"></div>
            <div class="card-meta"></div>
            <div class="savings-bar" aria-hidden="true"><span></span></div>
            <div class="card-status"></div>
        </div>
        <div class="card-actions">
            <button type="button" class="dl-btn" data-act="download" aria-label="Baixar imagem">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 19h14"/></svg>
                <span>Baixar</span>
            </button>
            <button type="button" class="remove-btn" data-act="remove" aria-label="Remover imagem">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>`;
    li.dataset.id = String(item.id);
    const img = li.querySelector('img');
    img.src = item.url;
    img.onerror = () => { img.removeAttribute('src'); li.classList.add('no-thumb'); };
    li.querySelector('.card-title').textContent = item.file.name;
    li.querySelector('.card-title').title = item.file.name;
    return li;
}

function renderItem(item) {
    const li = item.el;
    if (!li) return;
    li.dataset.status = item.status;
    const meta = li.querySelector('.card-meta');
    const status = li.querySelector('.card-status');
    const bar = li.querySelector('.savings-bar span');
    const dl = li.querySelector('.dl-btn');
    const thumb = li.querySelector('.thumb');
    const out = finalOutput(item);

    if (item.status === 'error') {
        meta.textContent = fmtBytes(item.file.size);
        status.textContent = item.error;
        status.dataset.tone = 'error';
        bar.style.width = '0%';
        dl.removeAttribute('href');
        dl.setAttribute('aria-disabled', 'true');
        thumb.disabled = true;
        return;
    }
    if (!out) {
        meta.textContent = `${fmtBytes(item.file.size)}${item.result ? ` · ${item.result.srcW}×${item.result.srcH}` : ''}`;
        status.textContent = item.status === 'working' ? 'Comprimindo…' : 'Na fila…';
        status.dataset.tone = 'muted';
        dl.removeAttribute('href');
        dl.setAttribute('aria-disabled', 'true');
        thumb.disabled = !item.result;
        return;
    }
    const r = item.result;
    const orig = item.file.size;
    const delta = (out.blob.size - orig) / orig;
    meta.innerHTML = '';
    const a = document.createElement('span');
    a.textContent = `${fmtBytes(orig)} · ${r.srcW}×${r.srcH}`;
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    const b = document.createElement('b');
    b.textContent = out.kept ? fmtBytes(orig) : `${fmtBytes(out.blob.size)} · ${r.w}×${r.h}`;
    meta.append(a, arrow, b);

    const pct = Math.round(Math.abs(delta) * 100);
    bar.style.width = `${Math.max(2, Math.min(100, 100 - Math.round((out.blob.size / orig) * 100)))}%`;
    let msg;
    let tone;
    if (out.kept) {
        msg = 'Já estava enxuta — original mantido';
        tone = 'muted';
    } else if (delta < -0.005) {
        msg = `−${pct}% · ${LABEL[out.type] || out.type}`;
        tone = 'good';
    } else if (delta > 0.005) {
        msg = `+${pct}% maior · ${LABEL[out.type] || out.type}`;
        tone = 'warn';
    } else {
        msg = `Mesmo tamanho · ${LABEL[out.type] || out.type}`;
        tone = 'muted';
    }
    if (r.fellBack) msg += ' (formato indisponível, usado PNG)';
    if (r.capped) msg += ' · reduzida ao limite de 16,7 MP';
    status.textContent = msg;
    status.dataset.tone = tone;
    li.classList.toggle('is-larger', tone === 'warn');
    dl.href = out.url;
    dl.download = out.name;
    dl.removeAttribute('aria-disabled');
    dl.setAttribute('aria-label', `Baixar ${out.name}`);
    thumb.disabled = false;
}

grid.addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    if (!target) return;
    const li = target.closest('.card');
    const item = items.get(Number(li && li.dataset.id));
    if (!item) return;
    const act = target.dataset.act;
    if (act === 'download') {
        e.preventDefault();
        if (target.getAttribute('aria-disabled') === 'true') return;
        const out = finalOutput(item);
        if (out) void saveBlob(out.blob, out.name);
        return;
    }
    if (act === 'remove') removeItem(item);
    if (act === 'compare') openCompare(item);
});

function removeItem(item) {
    items.delete(item.id);
    const qi = queue.indexOf(item);
    if (qi !== -1) queue.splice(qi, 1);
    URL.revokeObjectURL(item.url);
    if (item.result) URL.revokeObjectURL(item.result.url);
    item.el.classList.add('is-leaving');
    setTimeout(() => item.el.remove(), 200);
    if (!items.size) app.dataset.state = 'empty';
    renderSummary();
}

function clearAll() {
    generation += 1;
    queue.length = 0;
    items.forEach((item) => {
        URL.revokeObjectURL(item.url);
        if (item.result) URL.revokeObjectURL(item.result.url);
    });
    items.clear();
    grid.textContent = '';
    app.dataset.state = 'empty';
    renderSummary();
}
$('#clearListBtn').addEventListener('click', clearAll);

function renderSummary() {
    const list = Array.from(items.values());
    const total = list.length;
    const done = list.filter((i) => i.status === 'done').length;
    const errors = list.filter((i) => i.status === 'error').length;
    const before = list.reduce((acc, i) => acc + (i.status === 'done' ? i.file.size : 0), 0);
    const after = list.reduce((acc, i) => {
        const out = finalOutput(i);
        return acc + (out ? out.blob.size : 0);
    }, 0);
    const pending = total - done - errors;
    let text = `${total} ${total === 1 ? "imagem" : "imagens"}`;
    if (done) {
        const saved = before ? Math.round((1 - after / before) * 100) : 0;
        text += ` · ${fmtBytes(before)} → ${fmtBytes(after)}`;
        if (saved > 0) text += ` (−${saved}%)`;
    }
    if (pending) text += ` · processando ${done + errors + 1} de ${total}`;
    if (errors) text += ` · ${errors} com erro`;
    summaryStats.textContent = total ? text : '';
    summaryProgress.style.width = total ? `${((done + errors) / total) * 100}%` : '0%';
    summaryProgress.parentElement.classList.toggle('is-active', pending > 0);
    downloadAllBtn.disabled = done === 0 || pending > 0;
    downloadAllBtn.querySelector('span').textContent = done > 1 ? `Baixar tudo (.zip)` : 'Baixar';
}

/* ---------------------------------------------------------
   Download em lote
   --------------------------------------------------------- */
downloadAllBtn.addEventListener('click', async () => {
    const outs = Array.from(items.values()).map(finalOutput).filter(Boolean);
    if (!outs.length) return;
    if (outs.length === 1) {
        await saveBlob(outs[0].blob, outs[0].name);
        return;
    }
    const label = downloadAllBtn.querySelector('span');
    downloadAllBtn.disabled = true;
    label.textContent = 'Gerando ZIP…';
    try {
        // Nomes únicos dentro do ZIP.
        const used = new Map();
        const files = outs.map((o) => {
            let name = o.name;
            const n = used.get(name) || 0;
            used.set(name, n + 1);
            if (n) {
                const dot = name.lastIndexOf('.');
                name = `${name.slice(0, dot)}-${n + 1}${name.slice(dot)}`;
            }
            return { name, blob: o.blob };
        });
        const zip = await makeZip(files);
        await saveBlob(zip, `imagens-otimizadas-${new Date().toISOString().slice(0, 10)}.zip`);
        notice(`ZIP com ${files.length} imagens · ${fmtBytes(zip.size)}`);
    } catch {
        notice('Não foi possível gerar o ZIP (memória insuficiente?). Baixe uma a uma.');
    } finally {
        renderSummary();
    }
});

/* ---------------------------------------------------------
   Comparação antes/depois (slider + zoom/pan)
   Divisor em coordenadas da tela; as duas camadas recebem o mesmo
   transform (zoom + deslocamento), então o recorte fica alinhado
   pixel a pixel em qualquer zoom.
   --------------------------------------------------------- */
const dialog = $('#compareDialog');
const viewport = $('#compareViewport');
const clip = $('#compareClip');
const handle = $('#compareHandle');
const layerBefore = $('#layerBefore');
const layerAfter = $('#layerAfter');
const imgBefore = $('#imgBefore');
const imgAfter = $('#imgAfter');
const view = { split: 50, zoom: 1, x: 0, y: 0, natW: 1, natH: 1 };

function fitScale() {
    const vw = viewport.clientWidth || 1;
    const vh = viewport.clientHeight || 1;
    return Math.min(vw / view.natW, vh / view.natH, 1);
}

function applyView() {
    clip.style.clipPath = `inset(0 ${100 - view.split}% 0 0)`;
    handle.style.left = `${view.split}%`;
    handle.setAttribute('aria-valuenow', String(Math.round(view.split)));
    const s = fitScale() * view.zoom;
    const w = view.natW * s;
    const h = view.natH * s;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    // Limita o pan para a imagem não sumir da tela.
    const maxX = Math.max(0, (w - vw) / 2);
    const maxY = Math.max(0, (h - vh) / 2);
    view.x = Math.max(-maxX, Math.min(maxX, view.x));
    view.y = Math.max(-maxY, Math.min(maxY, view.y));
    const transform = `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`;
    [layerBefore, layerAfter].forEach((layer) => {
        layer.style.width = `${w}px`;
        layer.style.height = `${h}px`;
        layer.style.transform = transform;
    });
    viewport.classList.toggle('is-zoomed', view.zoom > 1.001);
}

function setZoom(z, cx, cy) {
    const old = view.zoom;
    const next = Math.max(1, Math.min(12, z));
    if (next === old) return;
    // Zoom ancorado no ponteiro.
    const rect = viewport.getBoundingClientRect();
    const px = (cx ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const py = (cy ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    view.x = px - ((px - view.x) * next) / old;
    view.y = py - ((py - view.y) * next) / old;
    view.zoom = next;
    applyView();
}

function openCompare(item) {
    if (!item.result) return;
    const out = finalOutput(item);
    imgBefore.src = item.url;
    imgAfter.src = out ? out.url : item.result.url;
    view.natW = item.result.srcW;
    view.natH = item.result.srcH;
    view.split = 50;
    view.zoom = 1;
    view.x = 0;
    view.y = 0;
    $('#compareTitle').textContent = item.file.name;
    $('#tagBefore').textContent = `Original · ${fmtBytes(item.file.size)}`;
    $('#tagAfter').textContent = out
        ? `${out.kept ? 'Original mantido' : LABEL[out.type] || 'Saída'} · ${fmtBytes(out.blob.size)}`
        : 'Saída';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(applyView);
    handle.focus({ preventScroll: true });
}

function closeCompare() {
    if (dialog.open) dialog.close();
}
$('#compareClose').addEventListener('click', closeCompare);
dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeCompare();
});
dialog.addEventListener('close', () => {
    imgBefore.removeAttribute('src');
    imgAfter.removeAttribute('src');
});
$('#zoomFitBtn').addEventListener('click', () => {
    view.zoom = 1;
    view.x = 0;
    view.y = 0;
    applyView();
});
$('#zoom100Btn').addEventListener('click', () => setZoom(1 / fitScale()));
window.addEventListener('resize', () => {
    if (dialog.open) applyView();
});

// Ponteiros: 1 dedo no divisor = arrasta o divisor; 1 dedo na imagem = pan
// (com zoom) ou move o divisor (sem zoom); 2 dedos = pinça.
const pointers = new Map();
let gesture = null;

function splitFromEvent(e) {
    const rect = viewport.getBoundingClientRect();
    view.split = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
}

viewport.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { viewport.setPointerCapture(e.pointerId); } catch { /* ok */ }
    if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
        return;
    }
    const onHandle = e.target.closest('#compareHandle');
    if (onHandle || view.zoom <= 1.001) {
        gesture = { kind: 'split' };
        splitFromEvent(e);
        applyView();
    } else {
        gesture = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    }
});
viewport.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        setZoom(gesture.zoom * (dist / Math.max(1, gesture.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (gesture.kind === 'split') {
        splitFromEvent(e);
        applyView();
    } else if (gesture.kind === 'pan') {
        view.x = gesture.vx + (e.clientX - gesture.x);
        view.y = gesture.vy + (e.clientY - gesture.y);
        applyView();
    }
});
const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && gesture && gesture.kind === 'pinch') gesture = null;
    if (!pointers.size) gesture = null;
};
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(view.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
}, { passive: false });
handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') view.split = Math.max(0, view.split - step);
    else if (e.key === 'ArrowRight') view.split = Math.min(100, view.split + step);
    else if (e.key === 'Home') view.split = 0;
    else if (e.key === 'End') view.split = 100;
    else return;
    e.preventDefault();
    applyView();
});
dialog.addEventListener('keydown', (e) => {
    if (e.key === '0') $('#zoomFitBtn').click();
    else if (e.key === '1') $('#zoom100Btn').click();
    else if (e.key === '+' || e.key === '=') setZoom(view.zoom * 1.25);
    else if (e.key === '-') setZoom(view.zoom / 1.25);
});

window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    items.forEach((item) => {
        URL.revokeObjectURL(item.url);
        if (item.result) URL.revokeObjectURL(item.result.url);
    });
});

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
syncControls();
renderSummary();
initEngine().catch(() => { /* fallback já configurado */ }).finally(() => {
    ready = true;
    // Itens adicionados antes do motor pronto podem ter tipo de saída diferente agora.
    reprocessAll();
});
