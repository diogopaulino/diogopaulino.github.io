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

function frontMarkup(cardId) {
    const { rank, suit } = parseCard(cardId);
    const sym = SUIT_SYMBOL[suit];
    const label = RANK_LABEL[rank];
    return `
      <div class="card-face card-front">
        <span class="corner tl"><b>${label}</b><i>${sym}</i></span>
        ${centerPip(rank, sym)}
        <span class="corner br"><b>${label}</b><i>${sym}</i></span>
      </div>`;
}

function backMarkup() {
    return `<div class="card-face card-back" aria-hidden="true"><i></i></div>`;
}

export function cardElement(cardId, { faceDown = false, dealDelay = 0, flip = false } = {}) {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.setProperty('--deal-delay', `${dealDelay}ms`);
    el.style.setProperty('--deal-x', `${36 + Math.random() * 28}px`);
    el.style.setProperty('--deal-y', `${-48 - Math.random() * 36}px`);
    el.style.setProperty('--deal-rot', `${-20 + Math.random() * 16}deg`);
    el.dataset.card = cardId || '';

    const valid = cardId && cardId !== '?' && cardId.length >= 2;

    if (valid) {
        const { suit } = parseCard(cardId);
        el.classList.add(SUIT_COLOR[suit] === 'red' ? 'is-red' : 'is-black');
        const { rank } = parseCard(cardId);
        el.setAttribute(
            'aria-label',
            faceDown && !flip ? 'Carta fechada' : `${RANK_LABEL[rank]} de ${suitName(suit)}`
        );
    } else {
        el.setAttribute('aria-label', 'Carta fechada');
    }

    // Flip: ambas as faces. Face-up: só frente. Face-down: só verso.
    let inner;
    if (flip && valid) {
        el.classList.add('is-back', 'is-flipping', 'has-flip');
        inner = `${frontMarkup(cardId)}${backMarkup()}`;
    } else if (faceDown || !valid) {
        el.classList.add('is-back');
        inner = backMarkup();
    } else {
        inner = frontMarkup(cardId);
    }

    el.innerHTML = `<div class="card-inner">${inner}</div>`;

    if (flip && valid) {
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
                faceDown: opts.faceDown || id === '?',
                flip: false
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
