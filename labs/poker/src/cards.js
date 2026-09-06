/**
 * Cartas hiper-realistas — faces duplas (flip 3D), textura e pip pattern.
 */

import { RANK_LABEL, SUIT_SYMBOL, SUIT_COLOR, parseCard } from './engine.js';

const PIP_LAYOUTS = {
    '2': [1, 0, 0, 0, 1],
    '3': [1, 0, 1, 0, 1],
    '4': [2, 0, 0, 0, 2],
    '5': [2, 0, 1, 0, 2],
    '6': [2, 0, 2, 0, 2],
    '7': [2, 1, 2, 0, 2],
    '8': [2, 1, 2, 1, 2],
    '9': [2, 2, 1, 2, 2],
    T: [2, 2, 2, 2, 2]
};

function suitName(s) {
    return { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' }[s] || s;
}

function centerPip(rank, sym) {
    if (['J', 'Q', 'K', 'A'].includes(rank)) {
        return `<span class="pip">${sym}</span>`;
    }
    const layout = PIP_LAYOUTS[rank];
    if (!layout) return `<span class="pip">${sym}</span>`;
    const rows = layout
        .map((n) => {
            if (!n) return '<span>&nbsp;</span>';
            return `<span>${sym.repeat(n).split('').join(' ')}</span>`;
        })
        .join('');
    return `<div class="pip-grid" aria-hidden="true">${rows}</div>`;
}

export function cardElement(cardId, { faceDown = false, dealDelay = 0, flip = false } = {}) {
    const el = document.createElement('div');
    el.className = `card${faceDown ? ' is-back' : ''}`;
    el.style.setProperty('--deal-delay', `${dealDelay}ms`);
    el.style.setProperty('--deal-x', `${40 + Math.random() * 30}px`);
    el.style.setProperty('--deal-y', `${-50 - Math.random() * 40}px`);
    el.style.setProperty('--deal-rot', `${-22 + Math.random() * 18}deg`);
    el.dataset.card = cardId || '';

    let frontHtml = '';
    if (cardId && cardId !== '?') {
        const { rank, suit } = parseCard(cardId);
        const color = SUIT_COLOR[suit];
        const sym = SUIT_SYMBOL[suit];
        const label = RANK_LABEL[rank];
        el.classList.add(color === 'red' ? 'is-red' : 'is-black');
        el.setAttribute('aria-label', faceDown ? 'Carta fechada' : `${label} de ${suitName(suit)}`);
        frontHtml = `
      <div class="card-face card-front">
        <span class="corner tl"><b>${label}</b><i>${sym}</i></span>
        ${centerPip(rank, sym)}
        <span class="corner br"><b>${label}</b><i>${sym}</i></span>
      </div>`;
    } else {
        el.setAttribute('aria-label', 'Carta fechada');
        frontHtml = `<div class="card-face card-front"></div>`;
    }

    el.innerHTML = `
    <div class="card-inner">
      ${frontHtml}
      <div class="card-face card-back" aria-hidden="true"><i></i></div>
    </div>`;

    if (flip && !faceDown) {
        el.classList.add('is-back', 'is-flipping');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.remove('is-back');
            });
        });
        setTimeout(() => el.classList.remove('is-flipping'), 750);
    }

    return el;
}

export function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

export function renderCards(container, ids, opts = {}) {
    clearChildren(container);
    (ids || []).forEach((id, i) => {
        container.appendChild(
            cardElement(id, {
                ...opts,
                dealDelay: (opts.baseDelay || 0) + i * 80,
                faceDown: opts.faceDown || id === '?'
            })
        );
    });
}

/** Revela cartas viradas (flip 3D) sem re-deal. */
export function revealCards(container, ids) {
    clearChildren(container);
    (ids || []).forEach((id, i) => {
        container.appendChild(
            cardElement(id, {
                faceDown: false,
                flip: true,
                dealDelay: i * 90
            })
        );
    });
}
