/**
 * Fichas 3D em CSS — decomposição visual do stack/pote.
 * Denominações clássicas: 1, 5, 10, 25, 100, 500, 1000.
 */

export const CHIP_DENOMS = [1000, 500, 100, 25, 10, 5, 1];

/** Máximo de discos visíveis numa pilha (performance + leitura). */
const MAX_VISIBLE = 10;

/**
 * Decompõe amount em fichas (guloso), limitado a MAX_VISIBLE.
 * @returns {{ denom: number, count: number }[]}
 */
export function decomposeChips(amount) {
    let left = Math.max(0, Math.floor(amount || 0));
    if (left <= 0) return [];

    const piles = [];
    let total = 0;
    for (const d of CHIP_DENOMS) {
        const n = Math.floor(left / d);
        if (n > 0) {
            piles.push({ denom: d, count: n });
            left -= n * d;
            total += n;
        }
    }

    // Colapsa se demais: mantém as de maior valor
    if (total <= MAX_VISIBLE) return expandChips(piles);

    const flat = expandChips(piles);
    return flat.slice(0, MAX_VISIBLE);
}

function expandChips(piles) {
    const out = [];
    for (const { denom, count } of piles) {
        for (let i = 0; i < count; i++) out.push(denom);
    }
    return out;
}

export function renderChipStack(container, amount) {
    if (!container) return;
    const denoms = decomposeChips(amount);
    container.innerHTML = denoms
        .map((d) => `<span class="chip chip--${d}" title="${d}"></span>`)
        .join('');
    container.dataset.amount = String(amount || 0);
}

/**
 * Anima fichas voando de um elemento origem até o pote.
 */
export function flyChips(fromEl, toEl, amount, { count = 4 } = {}) {
    if (!fromEl || !toEl || amount <= 0) return Promise.resolve();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return Promise.resolve();
    }

    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const denoms = decomposeChips(amount).slice(0, count);
    if (!denoms.length) denoms.push(25);

    const layer = document.body;

    const promises = denoms.map((d, i) => {
        return new Promise((resolve) => {
            const el = document.createElement('span');
            el.className = `chip chip-fly chip--${d}`;
            const x0 = from.left + from.width / 2 - 10;
            const y0 = from.top + from.height / 2;
            const x1 = to.left + to.width / 2 - 10 + (Math.random() - 0.5) * 16;
            const y1 = to.top + to.height / 2 + (Math.random() - 0.5) * 10;
            el.style.left = `${x0}px`;
            el.style.top = `${y0}px`;
            el.style.transform = 'translate(0,0) scale(1)';
            layer.appendChild(el);

            requestAnimationFrame(() => {
                const delay = i * 45;
                el.style.transitionDelay = `${delay}ms`;
                el.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) scale(0.85)`;
                el.style.opacity = '0.15';
            });

            setTimeout(() => {
                el.remove();
                resolve();
            }, 620 + i * 45);
        });
    });

    return Promise.all(promises);
}
