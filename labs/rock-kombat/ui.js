import { $, $$ } from './utils.js';
import { EX_COST, HYPER_COST, MAX_METER } from './constants.js?v=23';

const hud = ['p1', 'p2'].map(side => {
  const life = $(`#${side}-life`);
  const meter = $(`#${side}-meter`);
  return {
    side,
    life,
    healthTrack: life.parentElement,
    chip: $(`#${side}-chip`),
    name: $(`#${side}-name`),
    meter,
    meterBox: meter.closest('.meter'),
    meterLabel: $(`#${side}-meter-label`),
    wins: [$(`#${side}-win-1`), $(`#${side}-win-2`)],
    combo: $(`#${side}-combo`),
    callout: $(`#${side}-callout`)
  };
});
const touchSpecial = $('.touch-action .special');
const touchHyper = $('.touch-action .hyper');
const announcement = $('#announce');

function putText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

export function updateHud(match) {
  for (const view of hud) {
    const fighter = match[view.side];
    const state = [fighter.data.id, fighter.health, Math.round(fighter.whiteHealth * 4), Math.floor(fighter.meter), fighter.wins];
    const key = state.join('|');
    if (view.key === key) continue;
    view.key = key;

    const [, health, trailingHealth, meter, wins] = state;
    const specialReady = meter >= EX_COST;
    const hyperReady = meter >= HYPER_COST;

    putText(view.name, fighter.data.short);
    view.name.closest('.hud-side').style.setProperty('--fighter', fighter.data.color);
    view.life.style.transform = `scaleX(${health / 100})`;
    view.chip.style.transform = `scaleX(${trailingHealth / 400})`;
    view.healthTrack.classList.toggle('is-danger', health > 0 && health <= 24);
    view.meter.style.transform = `scaleX(${meter / MAX_METER})`;
    view.meterBox.classList.toggle('is-ready', specialReady);
    view.meterBox.classList.toggle('is-super', hyperReady);
    putText(view.meterLabel, hyperReady ? 'HYPER' : specialReady ? 'EX PRONTO' : 'EX');
    view.wins[0].classList.toggle('won', wins >= 1);
    view.wins[1].classList.toggle('won', wins >= 2);
    if (view.side === 'p1') {
      touchSpecial.classList.toggle('is-ready', specialReady);
      touchHyper.classList.toggle('is-ready', hyperReady);
    }
  }
}

export function resetCallouts() {
  for (const view of hud) {
    view.combo.classList.remove('show');
    view.callout.classList.remove('show');
  }
}

function replay(element) {
  if (element.classList.contains('show')) {
    const animation = element.getAnimations()[0];
    if (animation) {
      animation.currentTime = 0;
      animation.play();
      return;
    }
    element.classList.remove('show');
  }
  element.classList.add('show');
}

export function announce(text, duration = 900) {
  announcement.textContent = text;
  announcement.style.setProperty('--duration', `${duration}ms`);
  replay(announcement);
}

export function showCombo(fighter, match) {
  const { combo } = hud[fighter === match.p1 ? 0 : 1];
  combo.firstElementChild.textContent = fighter.combo;
  combo.lastElementChild.textContent = `${fighter.combo} GOLPES · ${fighter.comboDamage} DANO`;
  combo.style.setProperty('--combo-color', fighter.data.color);
  replay(combo);
}

export function showCallout(fighter, match, text, color) {
  const { callout } = hud[fighter === match.p1 ? 0 : 1];
  callout.textContent = text;
  callout.style.setProperty('--callout-color', color || fighter.data.color);
  replay(callout);
}

export function showScreen(id, focusSelector) {
  for (const screen of $$('.screen')) screen.classList.toggle('is-active', screen.id === id);
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}

export function fillVersus(p1, p2, stage) {
  $('#vs-p1-name').textContent = p1.short;
  $('#vs-p2-name').textContent = p2.short;
  $('#vs-stage-name').textContent = stage.name;
  $('#versus-screen').style.setProperty('--versus-bg', `url("${stage.image}")`);

  for (const [side, fighter] of [['p1', p1], ['p2', p2]]) {
    const sprite = $(`#vs-${side}-sprite`);
    sprite.style.setProperty('--sheet', `url("${fighter.sheet}")`);
    sprite.parentElement.style.setProperty('--fighter', fighter.color);
  }
}

// Keyboard command → names of the on-screen touch buttons (shown on pointer: coarse).
const TOUCH_NAMES = [[/\bJ\b/g, 'Soco'], [/\bK\b/g, 'Chute'], [/\bI\b/g, 'Forte'], [/\bH\b/g, 'Lançar'], [/Espaço/g, 'EX'], [/\bP\b/g, 'Hyper']];
function touchCommand(cmd) {
  return TOUCH_NAMES.reduce((text, [pattern, name]) => text.replace(pattern, name), cmd);
}

function updateShowcaseSide(side, fighter) {
  $(`#${side}-showcase`).style.setProperty('--fighter', fighter.color);
  $(`#${side}-showcase-sprite`).style.setProperty('--sheet', `url("${fighter.sheet}")`);
  $(`#${side}-showcase-name`).textContent = fighter.name;
  $(`#${side}-showcase-era`).textContent = fighter.archetype;
  $(`#${side}-showcase-style`).textContent = fighter.style;
  $(`#${side}-moveset`).innerHTML = fighter.moveset.map(move => `
    <div class="showcase-move" title="${move.desc}">
      <kbd class="for-keys">${move.cmd}</kbd><kbd class="for-touch">${touchCommand(move.cmd)}</kbd> <b>${move.name}</b>
    </div>
  `).join('');
}

export function renderRoster(fighters, onChange) {
  $('#roster').innerHTML = fighters.map((fighter, index) => `
    <button class="roster-portrait" data-fighter="${fighter.id}" style="--fighter:${fighter.color}" aria-label="${fighter.name}" type="button">
      <span class="portrait-thumb" aria-hidden="true">
        <i class="portrait-sprite" style="--sheet:url('${fighter.sheet}')"></i>
      </span>
      <span class="portrait-meta">
        <strong>${fighter.short}</strong>
        <span class="portrait-badges" aria-hidden="true"><i>${index + 1}</i><i class="p1" hidden>VOCÊ</i><i class="cpu" hidden>RIVAL</i></span>
      </span>
    </button>
  `).join('');

  const cards = $$('.roster-portrait');
  const slots = $$('[data-pick]');
  const state = { slot: 'p1', p1: fighters[0], cpu: fighters[1] };
  let previousP1;
  let previousCpu;

  function sync() {
    for (const card of cards) {
      const id = card.dataset.fighter;
      card.setAttribute('aria-pressed', String(state[state.slot].id === id));
      card.querySelector('.p1').hidden = state.p1.id !== id;
      card.querySelector('.cpu').hidden = state.cpu.id !== id;
    }

    for (const button of slots) {
      const active = button.dataset.pick === state.slot;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    $('#p1-showcase').classList.toggle('is-picking', state.slot === 'p1');
    $('#cpu-showcase').classList.toggle('is-picking', state.slot === 'cpu');
    if (previousP1 !== state.p1) updateShowcaseSide('p1', state.p1);
    if (previousCpu !== state.cpu) updateShowcaseSide('cpu', state.cpu);
    previousP1 = state.p1;
    previousCpu = state.cpu;
    onChange(state.p1, state.cpu);
  }

  function selectIndex(index) {
    if (!fighters[index]) return;
    state[state.slot] = fighters[index];
    sync();
  }

  cards.forEach((card, index) => card.addEventListener('click', () => selectIndex(index)));
  for (const button of slots) {
    button.addEventListener('click', () => {
      state.slot = button.dataset.pick;
      sync();
    });
  }

  $('#cpu-random').addEventListener('click', () => {
    const others = fighters.filter(fighter => fighter !== state.cpu);
    state.cpu = others[Math.floor(Math.random() * others.length)];
    state.slot = 'cpu';
    sync();
  });

  sync();
  return {
    selectIndex,
    reset() {
      state.slot = 'p1';
      state.p1 = fighters[0];
      state.cpu = fighters[1];
      sync();
    }
  };
}
