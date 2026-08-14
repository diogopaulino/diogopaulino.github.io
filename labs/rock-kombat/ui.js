import { $, $$ } from './utils.js';
import { SPECIAL_COST } from './constants.js';

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

  $('#p1-life').style.transform = `scaleX(${p1.health / 100})`;
  $('#p2-life').style.transform = `scaleX(${p2.health / 100})`;
  $('#p1-chip').style.transform = `scaleX(${p1.whiteHealth / 100})`;
  $('#p2-chip').style.transform = `scaleX(${p2.whiteHealth / 100})`;

  $('#p1-life').parentElement.classList.toggle('is-danger', p1.health > 0 && p1.health <= 22);
  $('#p2-life').parentElement.classList.toggle('is-danger', p2.health > 0 && p2.health <= 22);

  $('#p1-meter').style.width = `${p1.meter}%`;
  $('#p2-meter').style.width = `${p2.meter}%`;

  const meterLabel = meter => meter >= 100 ? 'SUPER' : meter >= SPECIAL_COST ? 'READY' : `${Math.floor(meter)}%`;
  $('#p1-meter-label').textContent = meterLabel(p1.meter);
  $('#p2-meter-label').textContent = meterLabel(p2.meter);

  $('#p1-meter').closest('.meter').classList.toggle('is-ready', p1.meter >= SPECIAL_COST && p1.meter < 100);
  $('#p1-meter').closest('.meter').classList.toggle('is-super', p1.meter >= 100);
  $('#p2-meter').closest('.meter').classList.toggle('is-ready', p2.meter >= SPECIAL_COST && p2.meter < 100);
  $('#p2-meter').closest('.meter').classList.toggle('is-super', p2.meter >= 100);

  [1, 2].forEach(n => {
    $(`#p1-win-${n}`).classList.toggle('won', p1.wins >= n);
    $(`#p2-win-${n}`).classList.toggle('won', p2.wins >= n);
  });

  return nextSignature;
}

export function announce(text, duration = 850) {
  const el = $('#announce');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => el.classList.remove('show'), duration);
}

export function showCombo(fighter, match) {
  const el = fighter === match.p1 ? $('#p1-combo') : $('#p2-combo');
  el.innerHTML = `${fighter.combo}<small>HIT COMBO</small>`;
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
  $('#vs-stage-name').textContent = stage.name;
  $('#vs-p1-sprite').style.setProperty('--sheet', `url("${p1.sheet}")`);
  $('#vs-p2-sprite').style.setProperty('--sheet', `url("${p2.sheet}")`);
  $('#vs-p1-sprite').style.setProperty('--fighter', p1.color);
  $('#vs-p2-sprite').style.setProperty('--fighter', p2.color);
}

export function renderRoster(fighters, onChange) {
  $('#roster').innerHTML = fighters.map(f => `
    <button class="fighter-card" role="listitem" data-fighter="${f.id}" style="--fighter:${f.color}" aria-label="Selecionar ${f.name}, ${f.era}">
      <span class="card-badges">
        <i class="badge p1" hidden>P1</i>
        <i class="badge cpu" hidden>CPU</i>
      </span>
      <div class="fighter-visual"><i class="fighter-sprite" style="--sheet:url('${f.sheet}')"></i></div>
      <footer>
        <small>${f.era}</small>
        <h3>${f.name}</h3>
        <p>${f.style}<br>Especial: ${f.special}</p>
        <div class="stats">
          <span><b>POWER</b><i style="--value:${f.power}%"></i></span>
          <span><b>MOBILITY</b><i style="--value:${f.mobility}%"></i></span>
          <span><b>DEFENSE</b><i style="--value:${f.defense}%"></i></span>
        </div>
      </footer>
    </button>`).join('');

  const state = { slot: 'p1', p1: null, cpu: null };

  function sync() {
    $$('.fighter-card').forEach(card => {
      const id = card.dataset.fighter;
      card.classList.toggle('is-p1', state.p1?.id === id);
      card.classList.toggle('is-cpu', state.cpu?.id === id);
      card.querySelector('.badge.p1').hidden = state.p1?.id !== id;
      card.querySelector('.badge.cpu').hidden = state.cpu?.id !== id;
    });
    $$('[data-pick]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.pick === state.slot));
    $('#p1-preview').textContent = state.p1?.short || 'ESCOLHA';
    $('#cpu-preview').textContent = state.cpu?.short || 'ESCOLHA';
    onChange(state.p1, state.cpu, state.slot);
  }

  $$('.fighter-card').forEach(card => {
    card.addEventListener('click', () => {
      const fighter = fighters.find(f => f.id === card.dataset.fighter);
      if (state.slot === 'p1') {
        state.p1 = fighter;
        if (!state.cpu) state.slot = 'cpu';
      } else {
        state.cpu = fighter;
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
    state.cpu = fighters[Math.floor(Math.random() * fighters.length)];
    sync();
  });

  return {
    getState: () => state,
    selectIndex(index) {
      const fighter = fighters[index];
      if (!fighter) return;
      if (state.slot === 'p1') {
        state.p1 = fighter;
        if (!state.cpu) state.slot = 'cpu';
      } else {
        state.cpu = fighter;
      }
      sync();
    },
    reset() {
      state.slot = 'p1';
      state.p1 = null;
      state.cpu = null;
      sync();
    }
  };
}
