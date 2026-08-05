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
    Math.round(p1.meter), Math.round(p2.meter), p1.wins, p2.wins
  ].join('|');
  
  if (nextSignature === hudSignature) return hudSignature;
  
  $('#p1-name').textContent = p1.data.short;
  $('#p2-name').textContent = p2.data.short;
  
  $('#p1-life').style.transform = `scaleX(${p1.health / 100})`;
  $('#p2-life').style.transform = `scaleX(${p2.health / 100})`;
  
  $('#p1-chip').style.transform = `scaleX(${p1.whiteHealth / 100})`;
  $('#p2-chip').style.transform = `scaleX(${p2.whiteHealth / 100})`;
  
  $('#p1-meter').style.width = `${p1.meter}%`;
  $('#p2-meter').style.width = `${p2.meter}%`;
  
  $('#p1-meter-label').textContent = p1.meter >= 100 ? 'SUPER' : p1.meter >= SPECIAL_COST ? 'READY' : `${Math.floor(p1.meter)}%`;
  $('#p2-meter-label').textContent = p2.meter >= 100 ? 'SUPER' : p2.meter >= SPECIAL_COST ? 'READY' : `${Math.floor(p2.meter)}%`;
  
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
  void el.offsetWidth; // trigger reflow
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

export function showCombo(fighter, match) {
  const el = fighter === match.p1 ? $('#p1-combo') : $('#p2-combo');
  el.innerHTML = `${fighter.combo} <small>HITS</small>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

export function showScreen(id) {
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === id));
  window.scrollTo(0, 0);
}

export function renderRoster(fighters, onSelect) {
  $('#roster').innerHTML = fighters.map(f => `
    <button class="fighter-card" role="listitem" data-fighter="${f.id}" style="--fighter:${f.color}" aria-label="Selecionar ${f.name}, ${f.era}">
      <div class="fighter-visual"><i class="fighter-sprite" style="--sheet:url('${f.sheet}')"></i></div>
      <footer><small>${f.era}</small><h3>${f.name}</h3><p>${f.style}<br>Especial: ${f.special}</p>
        <div class="stats"><span><b>POWER</b><i style="--value:${f.power}%"></i></span><span><b>MOBILITY</b><i style="--value:${f.mobility}%"></i></span><span><b>DEFENSE</b><i style="--value:${f.defense}%"></i></span></div>
      </footer>
    </button>`).join('');
    
  $$('.fighter-card').forEach(card => card.addEventListener('click', () => {
    const selectedFighter = fighters.find(f => f.id === card.dataset.fighter);
    const others = fighters.filter(f => f.id !== selectedFighter.id);
    const cpuFighter = others[Math.floor(Math.random() * others.length)];
    
    $$('.fighter-card').forEach(item => item.classList.toggle('is-selected', item === card));
    
    onSelect(selectedFighter, cpuFighter);
  }));
}
