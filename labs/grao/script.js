/**
 * Grão — companheiro de cafeína
 *
 * Modelo: absorção instantânea + decaimento exponencial.
 * C(t) = dose × 0,5 ^ (Δt / meia-vida)
 *
 * O “último café” resolve o instante T mais tarde em que uma dose D
 * ainda deixa o total abaixo do teto na hora de dormir:
 *   existente(deitar) + D × 0,5^((deitar − T) / τ) ≤ teto
 *   T = deitar − τ × log2(D / folga)
 */

const STORAGE_KEY = 'grao:v1';
const DAY_START_HOUR = 4;
const HISTORY_DAYS = 14;
const WEEK_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const CHART_SAMPLES = 280;

const CATALOG = [
    { id: 'espresso', name: 'Espresso', hint: '50 ml', mg: 63, icon: '☕' },
    { id: 'coado', name: 'Café coado', hint: 'xícara 150 ml', mg: 95, icon: '🫖' },
    { id: 'pingado', name: 'Pingado', hint: 'com leite', mg: 80, icon: '🥛' },
    { id: 'cappuccino', name: 'Cappuccino', hint: 'copo médio', mg: 75, icon: '🫧' },
    { id: 'soluvel', name: 'Solúvel', hint: 'uma colher', mg: 60, icon: '🥄' },
    { id: 'cha-preto', name: 'Chá preto', hint: 'xícara', mg: 47, icon: '🍵' },
    { id: 'cha-verde', name: 'Chá verde', hint: 'xícara', mg: 28, icon: '🌿' },
    { id: 'mate', name: 'Mate / chimarrão', hint: 'cuia', mg: 85, icon: '🧉' },
    { id: 'energetico', name: 'Energético', hint: 'lata 250 ml', mg: 80, icon: '⚡' },
    { id: 'cola', name: 'Refrigerante cola', hint: 'lata 350 ml', mg: 34, icon: '🥤' },
    { id: 'chocolate', name: 'Chocolate', hint: 'barra 40 g', mg: 24, icon: '🍫' },
    { id: 'descafeinado', name: 'Descafeinado', hint: 'xícara', mg: 4, icon: '🌱' }
];

const DEFAULTS = {
    halfLifeHours: 5,
    sleepThresholdMg: 50,
    bedtime: '23:00',
    defaultDoseMg: 80
};

const $ = (id) => document.getElementById(id);

const store = {
    read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },
    write(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            /* modo privado / cota */
        }
    }
};

function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function loadState() {
    const saved = store.read();
    const settings = { ...DEFAULTS, ...(saved?.settings || {}) };
    settings.halfLifeHours = clamp(Number(settings.halfLifeHours) || 5, 3, 7);
    settings.sleepThresholdMg = clamp(Number(settings.sleepThresholdMg) || 50, 10, 120);
    settings.defaultDoseMg = clamp(Number(settings.defaultDoseMg) || 80, 40, 200);
    if (!/^\d{2}:\d{2}$/.test(settings.bedtime || '')) settings.bedtime = DEFAULTS.bedtime;

    const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const drinks = Array.isArray(saved?.drinks)
        ? saved.drinks
            .filter((d) => d && Number.isFinite(d.mg) && Number.isFinite(d.at) && d.at >= cutoff)
            .map((d) => ({
                id: String(d.id || uid()),
                name: String(d.name || 'Dose'),
                icon: String(d.icon || '☕'),
                mg: clamp(Number(d.mg), 1, 500),
                at: Number(d.at)
            }))
            .sort((a, b) => a.at - b.at)
        : [];

    return { settings, drinks };
}

let state = loadState();

function persist() {
    store.write(state);
}

function halfLifeMs() {
    return state.settings.halfLifeHours * 60 * 60 * 1000;
}

/**
 * Cafeína restante de uma dose no instante `at`.
 * Antes da ingestão o valor é 0; depois cai pela metade a cada meia-vida.
 */
function remainingFromDose(mg, takenAt, at, tau) {
    const dt = at - takenAt;
    if (dt < 0) return 0;
    return mg * Math.pow(0.5, dt / tau);
}

function totalAt(at, drinks = state.drinks) {
    const tau = halfLifeMs();
    let sum = 0;
    for (const drink of drinks) {
        sum += remainingFromDose(drink.mg, drink.at, at, tau);
    }
    return sum;
}

function caffeineDayStart(now = new Date()) {
    const start = new Date(now);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    if (now < start) start.setDate(start.getDate() - 1);
    return start;
}

function nextBedtime(now = new Date()) {
    const [hh, mm] = state.settings.bedtime.split(':').map(Number);
    const bed = new Date(now);
    bed.setHours(hh, mm, 0, 0);
    if (bed <= now) bed.setDate(bed.getDate() + 1);
    return bed;
}

function formatTime(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(date) {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function greetingFor(date) {
    const h = date.getHours();
    if (h < 5) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
}

function statusFor(mg, threshold) {
    if (mg < 2) return 'Cafeína zerada — o corpo está livre.';
    if (mg < threshold) return 'Abaixo do teto do sono. Pode deitar tranquilo.';
    if (mg < 80) return 'Descendo. Ainda dá para sentir um resto de alerta.';
    if (mg < 160) return 'Alerta. Bom para foco — evite outra xícara perto da noite.';
    return 'Pico alto. Água, luz e movimento ajudam mais do que mais café.';
}

function toast(message) {
    const region = $('toast-region');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 2400);
}

function announce(message) {
    $('live-region').textContent = message;
}

function drinksToday(now = new Date()) {
    const start = caffeineDayStart(now).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return state.drinks.filter((d) => d.at >= start && d.at < end);
}

function addDrink({ name, mg, icon, at }) {
    state.drinks.push({
        id: uid(),
        name,
        mg: clamp(mg, 1, 500),
        icon: icon || '☕',
        at: at || Date.now()
    });
    state.drinks.sort((a, b) => a.at - b.at);
    persist();
    render();
    toast(`${name} · ${Math.round(mg)} mg`);
    announce(`Registrado ${name}, ${Math.round(mg)} miligramas.`);
}

function removeDrink(id) {
    state.drinks = state.drinks.filter((d) => d.id !== id);
    persist();
    render();
}

function catalogById(id) {
    return CATALOG.find((d) => d.id === id);
}

/* ---------- Corte para o sono ---------- */

function log2(n) {
    return Math.log(n) / Math.LN2;
}

function cutoffForDose(now, bed, doseMg) {
    const threshold = state.settings.sleepThresholdMg;
    const existingAtBed = totalAt(bed.getTime());
    const slack = threshold - existingAtBed;

    if (slack <= 0) {
        return { kind: 'over', existingAtBed };
    }
    if (doseMg <= slack) {
        return { kind: 'anytime', existingAtBed, slack };
    }

    const tau = halfLifeMs();
    const wait = tau * log2(doseMg / slack);
    const latest = new Date(bed.getTime() - wait);
    if (latest < now) {
        return { kind: 'late', latest, existingAtBed, slack };
    }
    return { kind: 'ok', latest, existingAtBed, slack };
}

function clearAt(now) {
    const threshold = state.settings.sleepThresholdMg;
    if (totalAt(now.getTime()) <= threshold) return now;

    const tau = halfLifeMs();
    let lo = now.getTime();
    let hi = lo + 3 * tau;
    if (totalAt(hi) > threshold) hi += 4 * tau;
    for (let i = 0; i < 28; i += 1) {
        const mid = (lo + hi) / 2;
        if (totalAt(mid) > threshold) lo = mid;
        else hi = mid;
    }
    return new Date(hi);
}

/* ---------- Render ---------- */

function renderDrinks() {
    const grid = $('drink-grid');
    grid.innerHTML = CATALOG.map((drink) => `
        <button class="drink-btn" type="button" data-drink="${drink.id}">
            <span class="icon" aria-hidden="true">${drink.icon}</span>
            <span class="name">${drink.name}</span>
            <span class="meta">${drink.hint} · ${drink.mg} mg</span>
        </button>
    `).join('');
}

function renderHero(now) {
    const mg = totalAt(now.getTime());
    const rounded = mg < 10 ? mg.toFixed(1) : Math.round(mg);
    $('current-mg').textContent = rounded;
    $('greeting').textContent = greetingFor(now);
    $('status-label').textContent = statusFor(mg, state.settings.sleepThresholdMg);

    const today = drinksToday(now);
    const ingested = today.reduce((sum, d) => sum + d.mg, 0);
    const peak = today.length
        ? Math.max(...today.map((d) => totalAt(d.at + 60 * 1000)))
        : mg;
    const tauH = state.settings.halfLifeHours;

    $('hero-meta').textContent = today.length
        ? `Hoje: ${Math.round(ingested)} mg ingeridos · pico ~ ${Math.round(peak)} mg · meia-vida ${tauH} h`
        : `A cafeína cai pela metade a cada ${tauH} horas. Toque numa xícara para começar.`;
}

function renderSleep(now) {
    const bed = nextBedtime(now);
    const dose = state.settings.defaultDoseMg;
    const cutoff = cutoffForDose(now, bed, dose);
    const clear = clearAt(now);
    const lead = $('sleep-lead');
    const cutoffEl = $('cutoff-time');
    const cutoffHint = $('cutoff-hint');
    const clearEl = $('clear-time');
    const clearHint = $('clear-hint');
    const cutoffBox = cutoffEl.closest('.sleep-stat');

    cutoffBox.classList.toggle('is-late', cutoff.kind === 'late' || cutoff.kind === 'over');

    if (cutoff.kind === 'over') {
        cutoffEl.textContent = 'já passou';
        cutoffHint.textContent = `${Math.round(cutoff.existingAtBed)} mg na hora de deitar`;
        lead.textContent = `Com o que já está no corpo, você chega às ${formatTime(bed)} acima do teto de ${state.settings.sleepThresholdMg} mg.`;
    } else if (cutoff.kind === 'anytime') {
        cutoffEl.textContent = formatTime(bed);
        cutoffHint.textContent = `${dose} mg ainda cabem`;
        lead.textContent = `Dá para tomar mais um (${dose} mg) e mesmo assim deitar às ${formatTime(bed)} abaixo do teto.`;
    } else if (cutoff.kind === 'late') {
        cutoffEl.textContent = formatTime(cutoff.latest);
        cutoffHint.textContent = `já passou · ${dose} mg`;
        lead.textContent = `O último café de ${dose} mg deveria ter sido às ${formatTime(cutoff.latest)} para deitar às ${formatTime(bed)}.`;
    } else {
        cutoffEl.textContent = formatTime(cutoff.latest);
        cutoffHint.textContent = `para ${dose} mg`;
        lead.textContent = `Para deitar às ${formatTime(bed)} com no máximo ${state.settings.sleepThresholdMg} mg, o último café (${dose} mg) é às ${formatTime(cutoff.latest)}.`;
    }

    if (clear <= now) {
        clearEl.textContent = 'agora';
        clearHint.textContent = 'já abaixo do teto';
    } else {
        clearEl.textContent = formatTime(clear);
        const hours = (clear - now) / 36e5;
        clearHint.textContent = hours >= 1
            ? `em ${hours.toFixed(1).replace('.', ',')} h`
            : `em ${Math.round((clear - now) / 60000)} min`;
    }
}

function renderLog(now) {
    const today = [...drinksToday(now)].sort((a, b) => b.at - a.at);
    const list = $('log-list');
    const ingested = today.reduce((sum, d) => sum + d.mg, 0);
    $('today-total').textContent = `${Math.round(ingested)} mg`;

    if (!today.length) {
        list.innerHTML = '<li class="log-empty">Nada ainda. O primeiro café do dia vira o ponto de partida da curva.</li>';
        return;
    }

    list.innerHTML = today.map((d) => {
        const left = remainingFromDose(d.mg, d.at, now.getTime(), halfLifeMs());
        return `
            <li class="log-item">
                <span class="icon" aria-hidden="true">${d.icon}</span>
                <span class="body">
                    <span class="name">${d.name}</span>
                    <span class="when">${formatTime(new Date(d.at))} · restam ${left < 10 ? left.toFixed(1) : Math.round(left)} mg</span>
                </span>
                <span class="mg">${d.mg} mg</span>
                <button class="remove" type="button" data-remove="${d.id}" aria-label="Remover ${d.name}">×</button>
            </li>
        `;
    }).join('');
}

function renderWeek(now) {
    const start = caffeineDayStart(now);
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(start);
        day.setDate(start.getDate() - i);
        const from = day.getTime();
        const to = from + 24 * 60 * 60 * 1000;
        const total = state.drinks
            .filter((d) => d.at >= from && d.at < to)
            .reduce((sum, d) => sum + d.mg, 0);
        days.push({ date: day, total, isToday: i === 0 });
    }

    const max = Math.max(120, ...days.map((d) => d.total));
    const avg = days.reduce((sum, d) => sum + d.total, 0) / days.length;
    $('week-avg').textContent = `média ${Math.round(avg)} mg`;

    $('week-bars').innerHTML = days.map((d) => {
        const h = d.total ? Math.max(6, Math.round((d.total / max) * 88)) : 0;
        return `
            <div class="week-day${d.isToday ? ' is-today' : ''}">
                <strong>${d.total ? Math.round(d.total) : '–'}</strong>
                <div class="week-col" aria-hidden="true">
                    <div class="week-fill" style="height:${h}px"></div>
                </div>
                <span>${WEEK_LABELS[d.date.getDay()]}</span>
            </div>
        `;
    }).join('');
}

function renderSettings() {
    $('setting-halflife').value = state.settings.halfLifeHours;
    $('halflife-label').textContent = `${String(state.settings.halfLifeHours).replace('.', ',')} h`;
    $('setting-threshold').value = state.settings.sleepThresholdMg;
    $('threshold-label').textContent = `${state.settings.sleepThresholdMg} mg`;
    $('setting-dose').value = state.settings.defaultDoseMg;
    $('dose-label').textContent = `${state.settings.defaultDoseMg} mg`;
    $('bedtime').value = state.settings.bedtime;
}

/* ---------- Canvas ---------- */

const chart = {
    canvas: $('curve'),
    ctx: null,
    start: 0,
    end: 0,
    maxY: 120,
    points: [],
    width: 0,
    height: 0,
    pad: { t: 22, r: 16, b: 28, l: 40 }
};

function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function resizeCanvas() {
    const { canvas } = chart;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    chart.width = rect.width;
    chart.height = rect.height;
    chart.ctx = canvas.getContext('2d');
    chart.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function xOf(t) {
    const { start, end, pad, width } = chart;
    const inner = width - pad.l - pad.r;
    return pad.l + ((t - start) / (end - start)) * inner;
}

function yOf(mg) {
    const { maxY, pad, height } = chart;
    const inner = height - pad.t - pad.b;
    return pad.t + (1 - mg / maxY) * inner;
}

function drawChart(now) {
    resizeCanvas();
    const ctx = chart.ctx;
    if (!ctx) return;

    const dayStart = caffeineDayStart(now);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    chart.start = dayStart.getTime();
    chart.end = dayEnd.getTime();

    chart.points = [];
    let peak = state.settings.sleepThresholdMg;
    for (let i = 0; i <= CHART_SAMPLES; i += 1) {
        const t = chart.start + ((chart.end - chart.start) * i) / CHART_SAMPLES;
        const mg = totalAt(t);
        peak = Math.max(peak, mg);
        chart.points.push({ t, mg });
    }
    chart.maxY = Math.max(80, Math.ceil((peak * 1.18) / 20) * 20);

    const bean = cssVar('--bean', '#8a4b2a');
    const crema = cssVar('--crema', '#d9a36a');
    const text = cssVar('--text-tertiary', '#64748b');
    const track = cssVar('--ring-track', 'rgba(15,23,42,0.08)');
    const { width, height, pad } = chart;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = track;
    ctx.lineWidth = 1;
    const ticks = 4;
    ctx.font = '11px Outfit, system-ui, sans-serif';
    ctx.fillStyle = text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= ticks; i += 1) {
        const mg = (chart.maxY * i) / ticks;
        const y = yOf(mg);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(width - pad.r, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(mg)}`, pad.l - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let h = 0; h < 24; h += 4) {
        const t = chart.start + h * 36e5;
        const x = xOf(t);
        const labelDate = new Date(t);
        ctx.fillText(formatTime(labelDate), x, height - pad.b + 8);
    }

    const threshold = state.settings.sleepThresholdMg;
    const ty = yOf(threshold);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = bean;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(pad.l, ty);
    ctx.lineTo(width - pad.r, ty);
    ctx.stroke();
    ctx.restore();

    const bed = nextBedtime(now).getTime();
    if (bed >= chart.start && bed <= chart.end) {
        const bx = xOf(bed);
        ctx.save();
        ctx.strokeStyle = text;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(bx, pad.t);
        ctx.lineTo(bx, height - pad.b);
        ctx.stroke();
        ctx.restore();
    }

    ctx.beginPath();
    chart.points.forEach((p, i) => {
        const x = xOf(p.t);
        const y = yOf(p.mg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(xOf(chart.end), height - pad.b);
    ctx.lineTo(xOf(chart.start), height - pad.b);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, pad.t, 0, height - pad.b);
    fill.addColorStop(0, crema);
    fill.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    chart.points.forEach((p, i) => {
        const x = xOf(p.t);
        const y = yOf(p.mg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = bean;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const nx = xOf(now.getTime());
    const ny = yOf(totalAt(now.getTime()));
    if (now.getTime() >= chart.start && now.getTime() <= chart.end) {
        ctx.beginPath();
        ctx.arc(nx, ny, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = bean;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = cssVar('--bg-card', '#fff');
        ctx.stroke();
    }

    const today = drinksToday(now);
    ctx.fillStyle = bean;
    for (const drink of today) {
        ctx.beginPath();
        ctx.arc(xOf(drink.at), yOf(totalAt(drink.at)), 3.2, 0, Math.PI * 2);
        ctx.fill();
    }

    $('chart-range').textContent = formatDayLabel(dayStart);
}

function chartAtX(clientX) {
    const rect = chart.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const inner = chart.width - chart.pad.l - chart.pad.r;
    const ratio = clamp((x - chart.pad.l) / inner, 0, 1);
    const t = chart.start + ratio * (chart.end - chart.start);
    return { t, mg: totalAt(t), x };
}

function showHover(clientX) {
    if (!chart.end) return;
    const hover = $('chart-hover');
    const { t, mg } = chartAtX(clientX);
    hover.hidden = false;
    $('chart-hover-time').textContent = formatTime(new Date(t));
    $('chart-hover-mg').textContent = `${mg < 10 ? mg.toFixed(1) : Math.round(mg)} mg`;
}

function hideHover() {
    $('chart-hover').hidden = true;
}

function render() {
    const now = new Date();
    renderSettings();
    renderHero(now);
    renderSleep(now);
    renderLog(now);
    renderWeek(now);
    drawChart(now);
}

/* ---------- Modais ---------- */

function openModal(id) {
    const el = $(id);
    el.hidden = false;
    const close = el.querySelector('.icon-btn');
    close?.focus();
}

function closeModal(id) {
    $(id).hidden = true;
}

function toLocalInput(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function bind() {
    renderDrinks();

    $('drink-grid').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-drink]');
        if (!btn) return;
        const drink = catalogById(btn.dataset.drink);
        if (!drink) return;
        addDrink({ name: drink.name, mg: drink.mg, icon: drink.icon });
    });

    $('log-list').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-remove]');
        if (!btn) return;
        removeDrink(btn.dataset.remove);
    });

    $('bedtime').addEventListener('change', () => {
        state.settings.bedtime = $('bedtime').value || DEFAULTS.bedtime;
        persist();
        render();
    });

    $('btn-settings').addEventListener('click', () => openModal('settings-modal'));
    $('btn-close-settings').addEventListener('click', () => closeModal('settings-modal'));
    $('settings-modal').addEventListener('click', (event) => {
        if (event.target.id === 'settings-modal') closeModal('settings-modal');
    });

    $('btn-custom').addEventListener('click', () => {
        $('custom-name').value = '';
        $('custom-mg').value = '80';
        $('custom-when').value = toLocalInput(new Date());
        openModal('custom-modal');
        $('custom-name').focus();
    });
    $('btn-close-custom').addEventListener('click', () => closeModal('custom-modal'));
    $('custom-modal').addEventListener('click', (event) => {
        if (event.target.id === 'custom-modal') closeModal('custom-modal');
    });

    $('custom-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const name = $('custom-name').value.trim() || 'Dose';
        const mg = Number($('custom-mg').value);
        const when = $('custom-when').value ? new Date($('custom-when').value) : new Date();
        if (!Number.isFinite(mg) || mg <= 0) return;
        addDrink({ name, mg, icon: '✨', at: when.getTime() });
        closeModal('custom-modal');
    });

    const syncRange = (inputId, labelId, key, suffix, renderAfter = true) => {
        const input = $(inputId);
        const apply = () => {
            const value = Number(input.value);
            state.settings[key] = value;
            $(labelId).textContent = `${String(value).replace('.', ',')} ${suffix}`;
            persist();
            if (renderAfter) render();
        };
        input.addEventListener('input', apply);
    };
    syncRange('setting-halflife', 'halflife-label', 'halfLifeHours', 'h');
    syncRange('setting-threshold', 'threshold-label', 'sleepThresholdMg', 'mg');
    syncRange('setting-dose', 'dose-label', 'defaultDoseMg', 'mg');

    $('btn-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grao-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Histórico exportado');
    });

    $('btn-clear').addEventListener('click', () => {
        if (!confirm('Apagar todos os cafés registrados neste aparelho?')) return;
        state.drinks = [];
        persist();
        closeModal('settings-modal');
        render();
        toast('Histórico apagado');
    });

    const canvas = $('curve');
    canvas.addEventListener('pointermove', (event) => showHover(event.clientX));
    canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId);
        showHover(event.clientX);
    });
    canvas.addEventListener('pointerup', () => setTimeout(hideHover, 900));
    canvas.addEventListener('pointerleave', hideHover);
    canvas.addEventListener('pointercancel', hideHover);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeModal('settings-modal');
        closeModal('custom-modal');
    });

    window.addEventListener('resize', () => drawChart(new Date()));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') render();
    });

    const mo = new MutationObserver(() => drawChart(new Date()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

bind();
render();
setInterval(() => render(), 30_000);
