// ==========================================================================
// Rock Kombat — UI & Arcade HUD Controller
// SF6 / Marvel vs. Capcom / Mortal Kombat 1 Dual Showcase Selection & HUD
// ==========================================================================

import { $, $$ } from './utils.js';
import { EX_COST, HYPER_COST, MAX_METER } from './constants.js';

export function updateHud(match, hudSignature) {
  if (!match) return hudSignature;

  const p1 = match.p1;
  const p2 = match.p2;

  const nextSignature = [
    p1.data.id, p2.data.id,
    Math.round(p1.health * 10), Math.round(p2.health * 10),
    Math.round(p1.whiteHealth * 10), Math.round(p2.whiteHealth * 10),
    Math.round(p1.meter), Math.round(p2.meter), p1.wins, p2.wins,
    match.round
  ].join('|');

  if (nextSignature === hudSignature) return hudSignature;

  $('#p1-name').textContent = p1.data.short;
  $('#p2-name').textContent = p2.data.short;

  $('#p1-life').style.transform = `scaleX(${Math.max(0, p1.health) / 100})`;
  $('#p2-life').style.transform = `scaleX(${Math.max(0, p2.health) / 100})`;
  $('#p1-chip').style.transform = `scaleX(${Math.max(0, p1.whiteHealth) / 100})`;
  $('#p2-chip').style.transform = `scaleX(${Math.max(0, p2.whiteHealth) / 100})`;

  $('#p1-life').parentElement.classList.toggle('is-danger', p1.health > 0 && p1.health <= 24);
  $('#p2-life').parentElement.classList.toggle('is-danger', p2.health > 0 && p2.health <= 24);

  const p1Pct = (p1.meter / MAX_METER) * 100;
  const p2Pct = (p2.meter / MAX_METER) * 100;
  $('#p1-meter').style.width = `${p1Pct}%`;
  $('#p2-meter').style.width = `${p2Pct}%`;

  const p1Lvl = Math.floor(p1.meter / 100);
  const p2Lvl = Math.floor(p2.meter / 100);

  const meterLabel = (meter, lvl) => {
    if (lvl >= 3) return 'MAX HYPER';
    if (meter >= HYPER_COST) return 'HYPER PRONTO';
    if (meter >= EX_COST) return 'ESPECIAL PRONTO';
    return `${Math.floor(meter)}%`;
  };

  $('#p1-meter-label').textContent = meterLabel(p1.meter, p1Lvl);
  $('#p2-meter-label').textContent = meterLabel(p2.meter, p2Lvl);

  const p1LevelEl = $('#p1-meter-level');
  const p2LevelEl = $('#p2-meter-level');
  if (p1LevelEl) p1LevelEl.textContent = `LV${p1Lvl}`;
  if (p2LevelEl) p2LevelEl.textContent = `LV${p2Lvl}`;

  const p1MeterBox = $('#p1-meter').closest('.meter');
  const p2MeterBox = $('#p2-meter').closest('.meter');

  p1MeterBox.classList.toggle('is-ready', p1.meter >= EX_COST && p1.meter < HYPER_COST);
  p1MeterBox.classList.toggle('is-super', p1.meter >= HYPER_COST);
  p2MeterBox.classList.toggle('is-ready', p2.meter >= EX_COST && p2.meter < HYPER_COST);
  p2MeterBox.classList.toggle('is-super', p2.meter >= HYPER_COST);

  [1, 2].forEach(n => {
    $(`#p1-win-${n}`).classList.toggle('won', p1.wins >= n);
    $(`#p2-win-${n}`).classList.toggle('won', p2.wins >= n);
  });

  return nextSignature;
}

export function announce(text, duration = 900) {
  const el = $('#announce');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => el.classList.remove('show'), duration);
}

export function showCombo(fighter, match) {
  const isP1 = fighter === match.p1;
  const el = isP1 ? $('#p1-combo') : $('#p2-combo');
  if (!el) return;
  el.innerHTML = `
    <strong>${fighter.combo}</strong>
    <small>HITS · ${fighter.comboDamage} DANO</small>
  `;
  el.style.setProperty('--combo-color', fighter.data.color);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

export function showCallout(fighter, match, text, color) {
  const isP1 = fighter === match.p1;
  const el = isP1 ? $('#p1-callout') : $('#p2-callout');
  if (!el) return;
  el.textContent = text;
  el.style.setProperty('--callout-color', color || fighter.data.color);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

export function showScreen(id) {
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === id));
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

export function fillVersus(p1, p2, stage) {
  $('#vs-p1-name').textContent = p1.short;
  $('#vs-p2-name').textContent = p2.short;
  const p1Title = $('#vs-p1-title');
  const p2Title = $('#vs-p2-title');
  if (p1Title) p1Title.textContent = p1.title || p1.era;
  if (p2Title) p2Title.textContent = p2.title || p2.era;
  $('#vs-stage-name').textContent = stage.name;
  $('#vs-p1-sprite').style.setProperty('--sheet', `url("${p1.sheet}")`);
  $('#vs-p2-sprite').style.setProperty('--sheet', `url("${p2.sheet}")`);
  $('#vs-p1-sprite').style.setProperty('--fighter', p1.color);
  $('#vs-p2-sprite').style.setProperty('--fighter', p2.color);
}

function updateShowcaseSide(prefix, fighter) {
  if (!fighter) return;
  const box = $(`#${prefix}-showcase`);
  if (box) box.style.setProperty('--fighter', fighter.color);

  const sprite = $(`#${prefix}-showcase-sprite`);
  if (sprite) sprite.style.setProperty('--sheet', `url("${fighter.sheet}")`);

  const nameEl = $(`#${prefix}-showcase-name`);
  if (nameEl) nameEl.textContent = fighter.name;

  const eraEl = $(`#${prefix}-showcase-era`);
  if (eraEl) eraEl.textContent = fighter.archetype || fighter.era;

  const styleEl = $(`#${prefix}-showcase-style`);
  if (styleEl) styleEl.textContent = fighter.style;

  const pwrEl = $(`#${prefix}-stat-pwr`);
  if (pwrEl) pwrEl.style.setProperty('--val', `${fighter.power}%`);

  const spdEl = $(`#${prefix}-stat-spd`);
  if (spdEl) spdEl.style.setProperty('--val', `${fighter.mobility}%`);

  const defEl = $(`#${prefix}-stat-def`);
  if (defEl) defEl.style.setProperty('--val', `${fighter.defense}%`);

  const movesBox = $(`#${prefix}-moveset`);
  if (movesBox && fighter.moveset) {
    movesBox.innerHTML = fighter.moveset.map(m => `
      <div class="showcase-move" title="${m.desc}">
        <kbd>${m.cmd}</kbd>
        <b>${m.name}</b>
      </div>
    `).join('');
  }
}

export function renderRoster(fighters, onChange) {
  $('#roster').innerHTML = fighters.map((f, index) => `
    <button class="roster-portrait" role="listitem" data-fighter="${f.id}" style="--fighter:${f.color}" aria-label="Selecionar ${f.name}" type="button">
      <div class="portrait-badges">
        <i class="p-badge key">[${index + 1}]</i>
        <i class="p-badge p1" hidden>P1</i>
        <i class="p-badge cpu" hidden>CPU</i>
      </div>
      <div class="portrait-thumb">
        <i class="portrait-sprite" style="--sheet:url('${f.sheet}')"></i>
      </div>
      <div class="portrait-meta">
        <strong>${f.short}</strong>
        <small>${f.archetype}</small>
      </div>
    </button>
  `).join('');

  const state = {
    slot: 'p1',
    p1: fighters[0],
    cpu: fighters[1]
  };

  function sync() {
    $$('.roster-portrait').forEach(card => {
      const id = card.dataset.fighter;
      card.classList.toggle('is-p1', state.p1?.id === id);
      card.classList.toggle('is-cpu', state.cpu?.id === id);
      card.querySelector('.p-badge.p1').hidden = state.p1?.id !== id;
      card.querySelector('.p-badge.cpu').hidden = state.cpu?.id !== id;
    });

    $$('[data-pick]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.pick === state.slot));

    $('#p1-showcase')?.classList.toggle('is-picking', state.slot === 'p1');
    $('#cpu-showcase')?.classList.toggle('is-picking', state.slot === 'cpu');

    updateShowcaseSide('p1', state.p1);
    updateShowcaseSide('cpu', state.cpu);

    const vsLabel = $('#vs-matchup-label');
    if (vsLabel && state.p1 && state.cpu) {
      vsLabel.textContent = `${state.p1.short} × ${state.cpu.short}`;
    }

    onChange(state.p1, state.cpu, state.slot);
  }

  $$('.roster-portrait').forEach(card => {
    card.addEventListener('click', () => {
      const fighter = fighters.find(f => f.id === card.dataset.fighter);
      if (!fighter) return;
      if (state.slot === 'p1') {
        state.p1 = fighter;
        state.slot = 'cpu';
      } else {
        state.cpu = fighter;
        state.slot = 'p1';
      }
      sync();
    });
  });

  $$('[data-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.slot = btn.dataset.pick;
      sync();
    });
  });

  $('#cpu-random')?.addEventListener('click', () => {
    const others = fighters.filter(f => f.id !== state.cpu?.id);
    state.cpu = others[Math.floor(Math.random() * others.length)] || fighters[0];
    sync();
  });

  setTimeout(sync, 0);

  return {
    getState: () => state,
    selectIndex(index) {
      const fighter = fighters[index];
      if (!fighter) return;
      if (state.slot === 'p1') {
        state.p1 = fighter;
        state.slot = 'cpu';
      } else {
        state.cpu = fighter;
        state.slot = 'p1';
      }
      sync();
    },
    reset() {
      state.slot = 'p1';
      state.p1 = fighters[0];
      state.cpu = fighters[1];
      sync();
    }
  };
}
