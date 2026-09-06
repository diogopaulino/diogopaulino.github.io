/**
 * Renderização de cartas — HTML/CSS hiper-realista.
 */

import { RANK_LABEL, SUIT_SYMBOL, SUIT_COLOR, parseCard } from './engine.js';

export function cardElement(cardId, { faceDown = false, small = false, dealDelay = 0 } = {}) {
    const el = document.createElement('div');
    el.className = `card${faceDown ? ' is-back' : ''}${small ? ' is-small' : ''}`;
    el.style.setProperty('--deal-delay', `${dealDelay}ms`);
    el.dataset.card = cardId || '';

    if (faceDown || !cardId) {
        el.innerHTML = `<div class="card-face card-back" aria-hidden="true"><i></i></div>`;
        el.setAttribute('aria-label', 'Carta fechada');
        return el;
    }

    const { rank, suit } = parseCard(cardId);
    const color = SUIT_COLOR[suit];
    const sym = SUIT_SYMBOL[suit];
    const label = RANK_LABEL[rank];
    el.classList.add(color === 'red' ? 'is-red' : 'is-black');
    el.setAttribute('aria-label', `${label} de ${suitName(suit)}`);
    el.innerHTML = `
      <div class="card-face card-front">
        <span class="corner tl"><b>${label}</b><i>${sym}</i></span>
        <span class="pip">${sym}</span>
        <span class="corner br"><b>${label}</b><i>${sym}</i></span>
      </div>`;
    return el;
}

function suitName(s) {
    return { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' }[s] || s;
}

export function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

export function renderCards(container, ids, opts = {}) {
    clearChildren(container);
    (ids || []).forEach((id, i) => {
        container.appendChild(cardElement(id, { ...opts, dealDelay: (opts.baseDelay || 0) + i * 70 }));
    });
}
