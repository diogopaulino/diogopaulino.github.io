/**
 * ============================================================================
 * PARTITURA: MAESTRO QUEST - CORE ENGINE & GAMIFICATION
 * ============================================================================
 */

// --- 1. CONFIGURAÇÃO TEÓRICA E MAPA MUSICAL ---
const MUSICAL_DATA = {
  notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  latinNames: { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' },
  frequencies: {
    // 2 oitavas principais completas com bemóis/sustenidos para escalas e acordes
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99
  },
  // Posições verticais (Y) na pauta SVG (Linhas do pentagrama de Y=70 a Y=150, espaçamento 20)
  // Em SVG, Y cresce para BAIXO.
  staffPositions: {
    treble: {
      'C4': { y: 190, ledger: [190] }, // Dó central (linha suplementar inferior)
      'D4': { y: 170, ledger: [] },
      'E4': { y: 150, ledger: [] },    // 1ª Linha
      'F4': { y: 140, ledger: [] },    // 1º Espaço
      'G4': { y: 130, ledger: [] },    // 2ª Linha
      'A4': { y: 120, ledger: [] },    // 2º Espaço
      'B4': { y: 110, ledger: [] },    // 3ª Linha (Central)
      'C5': { y: 100, ledger: [] },    // 3º Espaço
      'D5': { y: 90, ledger: [] },     // 4ª Linha
      'E5': { y: 80, ledger: [] },     // 4º Espaço
      'F5': { y: 70, ledger: [] },     // 5ª Linha
      'G5': { y: 50, ledger: [50] }    // Acima do pentagrama
    },
    bass: {
      'C3': { y: 170, ledger: [] },    // 2º Espaço na Clave de Fá
      'D3': { y: 150, ledger: [] },    // 3ª Linha
      'E3': { y: 140, ledger: [] },    // 3º Espaço
      'F3': { y: 130, ledger: [] },    // 4ª Linha (Linha do Fá!)
      'G3': { y: 120, ledger: [] },    // 4º Espaço
      'A3': { y: 110, ledger: [] },    // 5ª Linha
      'B3': { y: 90, ledger: [90] },   // Linha suplementar superior em Fá
      'C4': { y: 70, ledger: [70, 90] }// Dó central alto na clave de Fá
    }
  },
  scales: {
    'C-major':    { name: 'Dó Maior (Tom - Tom - Semitom - Tom - Tom - Tom - Semitom)', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], clef: 'treble' },
    'G-major':    { name: 'Sol Maior (Apresenta Fá Sustenido ♯)', notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'], clef: 'treble' },
    'A-minor':    { name: 'Lá Menor Natural (Relativa de Dó Maior)', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], clef: 'treble' },
    'C-penta':    { name: 'Dó Pentatônica (As 5 notas mágicas de solos)', notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], clef: 'treble' },
    'C-blues':    { name: 'Dó Blues (A lendária Blue Note!)', notes: ['C4', 'D#4', 'F4', 'F#4', 'G4', 'A#4', 'C5'], clef: 'treble' },
    'A-harmonic': { name: 'Lá Menor Harmônica (Sétima grau elevado ♯)', notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G#4', 'A4'], clef: 'treble' }
  }
};

const BADGES_DEFINITIONS = {
  first_step: { id: 'first_step', icon: '🎵', title: 'Primeira Nota', desc: 'Acertou sua primeira nota musical no app!' },
  combo_master: { id: 'combo_master', icon: '🔥', title: 'Mestre do Combo', desc: 'Conseguiu uma sequência incrível de 10 acertos seguidos!' },
  scale_explorer: { id: 'scale_explorer', icon: '🎹', title: 'Explorador das Escalas', desc: 'Tocou e ouviu todas as 6 escalas do Laboratório!' },
  ear_golden: { id: 'ear_golden', icon: '👂✨', title: 'Ouvido de Ouro', desc: 'Acertou 5 notas seguidas exclusivamente no Treino Auditivo!' },
  speed_demon: { id: 'speed_demon', icon: '⚡', title: 'Virtuoso dos 60s', desc: 'Ultrapassou 150 pontos na Corrida de 60 Segundos!' },
  maestro_supremo: { id: 'maestro_supremo', icon: '👑', title: 'Maestro Supremo', desc: 'Alcançou o prestigiado Nível 5 no sistema de Maestro!' }
};

// --- 2. MOTOR SONORO VIA WEB AUDIO API (SYNTH POLIFÔNICO) ---
class WebAudioSynth {
  constructor() {
    this.ctx = null;
    this.instrument = 'piano';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setInstrument(type) {
    this.instrument = type;
  }

  playNote(pitch, duration = 1.0) {
    this.init();
    const freq = MUSICAL_DATA.frequencies[pitch] || 440;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (this.instrument === 'piano') {
      // Síntese de E-Piano / Cauda Suave
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now); // 1ª Harmônica
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + duration);
    } else if (this.instrument === 'synth') {
      // Synth Néon dos anos 80 (Synthwave)
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq * 1.004, now); // Leve detuning para chorus
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.2);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, now);
    } else if (this.instrument === 'celesta') {
      // Celesta / Sino Mágico
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 3, now); // Harmônico de sino
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.5);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(300, now);
    }

    osc1.frequency.setValueAtTime(freq, now);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.2);
    osc2.stop(now + duration + 0.2);
  }

  // Efeitos sonoros de Gamificação (SFX)
  playSFX(type) {
    this.init();
    const now = this.ctx.currentTime;
    if (type === 'correct' || type === 'coin') {
      this.playNote('G4', 0.15);
      setTimeout(() => this.playNote('C5', 0.25), 100);
    } else if (type === 'error') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'levelup' || type === 'badge') {
      ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => {
        setTimeout(() => this.playNote(n, 0.4), i * 90);
      });
    }
  }
}

// --- 3. GESTÃO DE ESTADO & GAMIFICAÇÃO NO LOCALSTORAGE ---
class MaestroGameManager {
  constructor() {
    this.storageKey = 'maestro_quest_data';
    this.defaultState = {
      xp: 0,
      level: 1,
      coins: 0,
      combo: 0,
      maxCombo: 0,
      streakDays: 1,
      totalCorrect: 0,
      totalAttempts: 0,
      maxArcadeScore: 0,
      scalesExplored: [],
      earCorrectStreak: 0,
      unlockedBadges: [],
      lastLoginDate: new Date().toDateString()
    };
    this.state = this.loadState();
    this.checkStreak();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return { ...this.defaultState, ...JSON.parse(saved) };
    } catch(e) { console.error('Error loading localStorage', e); }
    return { ...this.defaultState };
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      this.updateDashboardUI();
    } catch(e) { console.error('Error saving localStorage', e); }
  }

  checkStreak() {
    const today = new Date().toDateString();
    if (this.state.lastLoginDate !== today) {
      const last = new Date(this.state.lastLoginDate);
      const now = new Date();
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        this.state.streakDays += 1;
        this.showToast('🔥 Streak Incrível!', `Você está há ${this.state.streakDays} dias seguidos praticando!`);
      } else if (diffDays > 1) {
        this.state.streakDays = 1;
      }
      this.state.lastLoginDate = today;
      this.saveState();
    }
  }

  addXP(amount, x, y) {
    // Multiplicador do combo
    let multiplier = 1;
    if (this.state.combo >= 10) multiplier = 3;
    else if (this.state.combo >= 5) multiplier = 2;
    else if (this.state.combo >= 3) multiplier = 1.5;

    const gained = Math.round(amount * multiplier);
    this.state.xp += gained;
    this.state.coins += Math.round(5 * multiplier);

    // Efeito de XP flutuante na tela
    if (x !== undefined && y !== undefined) {
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-xp';
      floatEl.textContent = `+${gained} XP${multiplier > 1 ? ` (x${multiplier}!)` : ''}`;
      floatEl.style.left = `${x}px`;
      floatEl.style.top = `${y - 20}px`;
      document.body.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 1000);
    }

    // Checagem de Nivelamento (Level Up) -> Cada Nível custa Nível * 100 XP
    const requiredXP = this.state.level * 100;
    if (this.state.xp >= requiredXP) {
      this.state.level += 1;
      synth.playSFX('levelup');
      this.showToast('🎉 SUBIU DE NÍVEL!', `Parabéns, agora você é Maestro Nível ${this.state.level}!`);
      if (this.state.level >= 5) this.unlockBadge('maestro_supremo');
    }

    this.saveState();
  }

  registerHit(isCorrect, isEarMode = false) {
    this.state.totalAttempts += 1;
    if (isCorrect) {
      this.state.totalCorrect += 1;
      this.state.combo += 1;
      if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;
      if (isEarMode) {
        this.state.earCorrectStreak += 1;
        if (this.state.earCorrectStreak >= 5) this.unlockBadge('ear_golden');
      }
      if (this.state.totalCorrect >= 1) this.unlockBadge('first_step');
      if (this.state.combo >= 10) this.unlockBadge('combo_master');
    } else {
      this.state.combo = 0;
      if (isEarMode) this.state.earCorrectStreak = 0;
    }
    this.saveState();
  }

  registerScaleExplored(scaleId) {
    if (!this.state.scalesExplored.includes(scaleId)) {
      this.state.scalesExplored.push(scaleId);
      this.saveState();
      if (this.state.scalesExplored.length >= 6) {
        this.unlockBadge('scale_explorer');
      }
    }
  }

  unlockBadge(badgeId) {
    if (!this.state.unlockedBadges.includes(badgeId)) {
      this.state.unlockedBadges.push(badgeId);
      const b = BADGES_DEFINITIONS[badgeId];
      synth.playSFX('badge');
      this.showToast(`🏆 Conquista: ${b.title}!`, b.desc);
      this.saveState();
    }
  }

  showToast(title, desc) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<div><strong>${title}</strong><div style="font-size: 0.85rem; font-weight: 400;">${desc}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  updateDashboardUI() {
    const titleEl = document.getElementById('maestro-level-title');
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    const comboCount = document.getElementById('combo-count');
    const streakDays = document.getElementById('streak-days');
    const coinCount = document.getElementById('coin-count');
    const comboBox = document.getElementById('combo-box');

    const titles = [
      'Aprendiz da Clave', 'Explorador das Oitavas', 'Mestre do Staccato',
      'Virtuoso das Escalas', 'Maestro Supremo', 'Divindade da Partitura'
    ];
    const rankName = titles[Math.min(this.state.level - 1, titles.length - 1)];

    if (titleEl) titleEl.textContent = `Nível ${this.state.level}: ${rankName}`;
    
    const targetXP = this.state.level * 100;
    const currentLevelBase = (this.state.level - 1) * 100;
    const progressPct = Math.min(100, Math.max(0, ((this.state.xp - currentLevelBase) / (targetXP - currentLevelBase)) * 100));

    if (xpBar) xpBar.style.width = `${progressPct}%`;
    if (xpText) xpText.textContent = `${this.state.xp} / ${targetXP} XP`;
    if (comboCount) comboCount.textContent = `x${this.state.combo}`;
    if (streakDays) streakDays.textContent = `${this.state.streakDays}`;
    if (coinCount) coinCount.textContent = `${this.state.coins}`;

    if (comboBox) {
      if (this.state.combo >= 3) comboBox.classList.add('active');
      else comboBox.classList.remove('active');
    }

    // Modal stats
    const totalCorrectEl = document.getElementById('stat-total-correct');
    const accuracyEl = document.getElementById('stat-accuracy');
    const maxComboEl = document.getElementById('stat-max-combo');
    const maxArcadeEl = document.getElementById('stat-max-arcade');

    if (totalCorrectEl) totalCorrectEl.textContent = this.state.totalCorrect;
    if (maxComboEl) maxComboEl.textContent = `x${this.state.maxCombo}`;
    if (maxArcadeEl) maxArcadeEl.textContent = this.state.maxArcadeScore;
    if (accuracyEl) {
      const acc = this.state.totalAttempts === 0 ? 100 : Math.round((this.state.totalCorrect / this.state.totalAttempts) * 100);
      accuracyEl.textContent = `${acc}%`;
    }
  }

  resetProgress() {
    if (confirm('Tem certeza de que deseja zerar todas as suas moedas, XP e medalhas no localStorage?')) {
      localStorage.removeItem(this.storageKey);
      this.state = this.loadState();
      this.saveState();
      renderBadgesModal();
      this.showToast('🔄 Progresso Zerado', 'Um novo recomeço musical aguarda por você!');
    }
  }
}

// --- 4. MOTOR DE RENDERIZAÇÃO DA PARTITURA SVG ---
class StaffSVGRenderer {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.clef = 'treble';
    this.activeNotes = [];
  }

  clear() {
    if (!this.svg) return;
    this.svg.innerHTML = '';
  }

  renderStaff(clefType = 'treble') {
    this.clear();
    this.clef = clefType;
    const ns = 'http://www.w3.org/2000/svg';

    // 1. Desenhar as 5 linhas do pentagrama (Y de 70 a 150)
    for (let i = 0; i < 5; i++) {
      const y = 70 + (i * 20);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', '40');
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', '560');
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', '#cbd5e1');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.85');
      this.svg.appendChild(line);
    }

    // Linhas de compasso inicial e final
    const startBar = document.createElementNS(ns, 'line');
    startBar.setAttribute('x1', '40'); startBar.setAttribute('y1', '70');
    startBar.setAttribute('x2', '40'); startBar.setAttribute('y2', '150');
    startBar.setAttribute('stroke', '#cbd5e1'); startBar.setAttribute('stroke-width', '4');
    this.svg.appendChild(startBar);

    const endBar = document.createElementNS(ns, 'line');
    endBar.setAttribute('x1', '560'); endBar.setAttribute('y1', '70');
    endBar.setAttribute('x2', '560'); endBar.setAttribute('y2', '150');
    endBar.setAttribute('stroke', '#cbd5e1'); endBar.setAttribute('stroke-width', '4');
    this.svg.appendChild(endBar);

    // 2. Desenhar Símbolo da Clave
    const clefText = document.createElementNS(ns, 'text');
    clefText.setAttribute('x', '55');
    clefText.setAttribute('y', this.clef === 'treble' ? '135' : '130');
    clefText.setAttribute('font-size', this.clef === 'treble' ? '75' : '65');
    clefText.setAttribute('fill', '#fbbf24');
    clefText.setAttribute('class', 'note-glow');
    clefText.textContent = this.clef === 'treble' ? '𝄞' : '𝄢';
    this.svg.appendChild(clefText);
  }

  // Desenha uma nota ou sequência na pauta
  drawNotes(notePitches, highlightIndex = 0) {
    if (!Array.isArray(notePitches)) notePitches = [notePitches];
    this.activeNotes = notePitches;

    const ns = 'http://www.w3.org/2000/svg';
    const numNotes = notePitches.length;
    const startX = 170;
    const stepX = Math.min(65, 340 / Math.max(1, numNotes - 1));

    notePitches.forEach((pitch, idx) => {
      const x = startX + (idx * stepX);
      const posData = (MUSICAL_DATA.staffPositions[this.clef] || {})[pitch] || { y: 110, ledger: [] };
      const y = posData.y;
      const isTarget = (idx === highlightIndex);

      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', `staff-note ${isTarget ? 'note-glow' : ''}`);
      group.setAttribute('id', `svg-note-${idx}`);

      // 1. Linhas Suplementares (Ledger Lines) se houver
      if (posData.ledger && posData.ledger.length > 0) {
        posData.ledger.forEach(lY => {
          const lLine = document.createElementNS(ns, 'line');
          lLine.setAttribute('x1', (x - 20).toString());
          lLine.setAttribute('y1', lY.toString());
          lLine.setAttribute('x2', (x + 20).toString());
          lLine.setAttribute('y2', lY.toString());
          lLine.setAttribute('stroke', '#cbd5e1');
          lLine.setAttribute('stroke-width', '2');
          group.appendChild(lLine);
        });
      }

      // 2. Cabeça da Nota (Notehead)
      const ellipse = document.createElementNS(ns, 'ellipse');
      ellipse.setAttribute('cx', x.toString());
      ellipse.setAttribute('cy', y.toString());
      ellipse.setAttribute('rx', '13');
      ellipse.setAttribute('ry', '9');
      ellipse.setAttribute('transform', `rotate(-15, ${x}, ${y})`);
      ellipse.setAttribute('fill', isTarget ? '#22d3ee' : '#f8fafc');
      group.appendChild(ellipse);

      // 3. Haste da nota (Stem) - para cima se Y > 110, para baixo se <= 110
      const stem = document.createElementNS(ns, 'line');
      if (y >= 110) { // Haste para cima (à direita)
        stem.setAttribute('x1', (x + 11).toString());
        stem.setAttribute('y1', y.toString());
        stem.setAttribute('x2', (x + 11).toString());
        stem.setAttribute('y2', (y - 35).toString());
      } else { // Haste para baixo (à esquerda)
        stem.setAttribute('x1', (x - 11).toString());
        stem.setAttribute('y1', y.toString());
        stem.setAttribute('x2', (x - 11).toString());
        stem.setAttribute('y2', (y + 35).toString());
      }
      stem.setAttribute('stroke', isTarget ? '#22d3ee' : '#f8fafc');
      stem.setAttribute('stroke-width', '3');
      group.appendChild(stem);

      // 4. Símbolos de Acidente (Sustenido ♯ ou Bemol ♭)
      if (pitch.includes('#') || pitch.includes('b')) {
        const acc = document.createElementNS(ns, 'text');
        acc.setAttribute('x', (x - 28).toString());
        acc.setAttribute('y', (y + 6).toString());
        acc.setAttribute('font-size', '22');
        acc.setAttribute('fill', '#f43f5e');
        acc.setAttribute('font-weight', 'bold');
        acc.textContent = pitch.includes('#') ? '♯' : '♭';
        group.appendChild(acc);
      }

      this.svg.appendChild(group);
    });
  }

  // Anima acerto da nota principal
  animateSuccess() {
    const noteEl = document.getElementById('svg-note-0');
    if (noteEl) noteEl.classList.add('note-hit-anim');
  }

  // Anima erro do palco
  animateError() {
    const wrapper = document.querySelector('.staff-display-card');
    if (wrapper) {
      wrapper.classList.add('staff-shake');
      setTimeout(() => wrapper.classList.remove('staff-shake'), 400);
    }
  }
}

// --- 5. INICIALIZAÇÃO DOS MÓDULOS E ESTADO DA UI ---
const synth = new WebAudioSynth();
const gameManager = new MaestroGameManager();
const renderer = new StaffSVGRenderer('staff-canvas');

let currentMode = 'quiz';
let currentClefSetting = 'treble';
let currentTargetPitch = 'G4';
let currentTargetBaseNote = 'G'; // Sem oitava
let useLatinNotation = true; // Dó-Ré-Mi por padrão
let arcadeTimerInterval = null;
let arcadeTimeRemaining = 60;
let arcadeIsRunning = false;
let arcadeCurrentScore = 0;
let isPlayingScale = false;

// --- 6. GERADOR DO TECLADO VIRTUAL E BOTões ---
function setupVirtualKeyboard() {
  const kbContainer = document.getElementById('piano-keyboard');
  if (!kbContainer) return;
  kbContainer.innerHTML = '';

  // Gerar de C3 a B4 (24 semitons básicos de teclas brancas e pretas)
  const whiteKeys = ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'];
  const blackKeyMap = { 'C3':'C#3', 'D3':'D#3', 'F3':'F#3', 'G3':'G#3', 'A3':'A#3', 'C4':'C#4', 'D4':'D#4', 'F4':'F#4', 'G4':'G#4', 'A4':'A#4' };

  whiteKeys.forEach((pitch, i) => {
    const wKey = document.createElement('div');
    wKey.className = 'white-key';
    wKey.dataset.pitch = pitch;
    const base = pitch.charAt(0);
    wKey.textContent = useLatinNotation ? MUSICAL_DATA.latinNames[base] : base;
    
    wKey.addEventListener('mousedown', () => handleNoteInput(pitch));
    wKey.addEventListener('touchstart', (e) => { e.preventDefault(); handleNoteInput(pitch); });
    
    kbContainer.appendChild(wKey);

    // Checa se tem tecla preta logo após
    if (blackKeyMap[pitch]) {
      const bPitch = blackKeyMap[pitch];
      const bKey = document.createElement('div');
      bKey.className = 'black-key';
      bKey.dataset.pitch = bPitch;
      // Posiciona absolutamente acima da junção com a próxima tecla branca
      const offsetLeft = (i + 1) * 42 - 13;
      bKey.style.left = `${offsetLeft}px`;
      
      bKey.addEventListener('mousedown', (e) => { e.stopPropagation(); handleNoteInput(bPitch); });
      bKey.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); handleNoteInput(bPitch); });

      kbContainer.appendChild(bKey);
    }
  });
}

function updateNotationButtons() {
  const btns = document.querySelectorAll('.note-btn');
  btns.forEach(b => {
    const note = b.dataset.note;
    const nameEl = b.querySelector('.note-name');
    const cifraEl = b.querySelector('.note-cifra');
    if (nameEl && cifraEl) {
      if (useLatinNotation) {
        nameEl.textContent = MUSICAL_DATA.latinNames[note];
        cifraEl.textContent = note;
      } else {
        nameEl.textContent = note;
        cifraEl.textContent = MUSICAL_DATA.latinNames[note];
      }
    }
  });
  // Re-renderiza rótulos nas teclas do piano tbm
  setupVirtualKeyboard();
  const notDisp = document.getElementById('notation-mode-display');
  if (notDisp) notDisp.textContent = useLatinNotation ? 'Latina (Dó Ré Mi)' : 'Cifra (C D E)';
}

// --- 7. FLUXO PRINCIPAL DOS MODOS DE APRENDIZADO ---

function updateFeedback(msg, type = 'normal') {
  const banner = document.getElementById('feedback-display');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  if (!banner) return;

  banner.className = `feedback-banner ${type}`;
  if (type === 'success') {
    icon.textContent = '🌟';
  } else if (type === 'error') {
    icon.textContent = '❌';
  } else {
    icon.textContent = '💡';
  }
  text.textContent = msg;
}

function setTargetClefAndPitch() {
  let selectedClef = document.getElementById('clef-select')?.value || 'treble';
  if (selectedClef === 'both') {
    selectedClef = Math.random() < 0.5 ? 'treble' : 'bass';
  }

  const availablePitches = Object.keys(MUSICAL_DATA.staffPositions[selectedClef]);
  let nextPitch = currentTargetPitch;
  while (nextPitch === currentTargetPitch && availablePitches.length > 1) {
    nextPitch = availablePitches[Math.floor(Math.random() * availablePitches.length)];
  }

  currentTargetPitch = nextPitch;
  currentTargetBaseNote = currentTargetPitch.charAt(0);
  renderer.renderStaff(selectedClef);

  if (currentMode === 'ear') {
    // No modo auditivo, mostramos uma interrogação sonora, não desenhamos a nota na pauta imediatamente!
    renderer.clear();
    renderer.renderStaff(selectedClef);
    const ns = 'http://www.w3.org/2000/svg';
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '280');
    text.setAttribute('y', '125');
    text.setAttribute('font-size', '65');
    text.setAttribute('fill', '#22d3ee');
    text.setAttribute('class', 'note-glow');
    text.textContent = '❓';
    renderer.svg.appendChild(text);
    
    // Reproduzir áudio misterioso
    setTimeout(() => synth.playNote(currentTargetPitch, 1.2), 300);
  } else {
    renderer.drawNotes([currentTargetPitch], 0);
  }
}

function handleNoteInput(playedPitchOrNote, event) {
  if (isPlayingScale) return;

  // Extrair nota básica caso tenha sido botão sem oitava (ex: "C", "D")
  const playedBaseNote = playedPitchOrNote.charAt(0);
  const soundPitch = playedPitchOrNote.length > 1 ? playedPitchOrNote : `${playedBaseNote}4`;
  
  // Toca o som instantâneo
  synth.playNote(soundPitch, 0.8);

  // Ilumina tecla no teclado virtual visualmente
  const keyEl = document.querySelector(`[data-pitch="${soundPitch}"]`);
  if (keyEl) {
    keyEl.classList.add('active-key');
    setTimeout(() => keyEl.classList.remove('active-key'), 300);
  }

  // Verifica lógica dos jogos
  if (currentMode === 'quiz' || currentMode === 'ear' || (currentMode === 'arcade' && arcadeIsRunning)) {
    const isCorrect = (playedBaseNote === currentTargetBaseNote);

    let clientX, clientY;
    if (event) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      const banner = document.getElementById('feedback-display');
      const rect = banner ? banner.getBoundingClientRect() : { left: 300, top: 200 };
      clientX = rect.left + rect.width / 2;
      clientY = rect.top;
    }

    const correctName = useLatinNotation ? MUSICAL_DATA.latinNames[currentTargetBaseNote] : currentTargetBaseNote;

    if (isCorrect) {
      synth.playSFX('correct');
      renderer.animateSuccess();
      gameManager.registerHit(true, currentMode === 'ear');
      gameManager.addXP(10, clientX, clientY);

      if (currentMode === 'arcade') {
        arcadeCurrentScore += 10;
        document.getElementById('arcade-score').textContent = arcadeCurrentScore;
      }

      updateFeedback(`Perfeito! É a nota ${correctName} (${currentTargetPitch})!`, 'success');

      setTimeout(() => {
        if (currentMode !== 'arcade' || arcadeIsRunning) setTargetClefAndPitch();
      }, 700);

    } else {
      synth.playSFX('error');
      renderer.animateError();
      gameManager.registerHit(false, currentMode === 'ear');
      updateFeedback(`Quase! Você tocou ${useLatinNotation ? MUSICAL_DATA.latinNames[playedBaseNote] : playedBaseNote}, mas a correta era ${correctName}.`, 'error');
    }
  } else if (currentMode === 'scales') {
    updateFeedback(`Você tocou ${useLatinNotation ? MUSICAL_DATA.latinNames[playedBaseNote] : playedPitchOrNote}. Clique em ▶ Tocar Escala para ouvir o arpejo!`, 'normal');
  }
}

// --- 8. LABORATÓRIO DE ESCALAS (ANIMATED PLAYBACK) ---
function playSelectedScale() {
  if (isPlayingScale) return;
  const scaleSelect = document.getElementById('scale-select');
  const scaleId = scaleSelect ? scaleSelect.value : 'C-major';
  const scaleObj = MUSICAL_DATA.scales[scaleId];
  if (!scaleObj) return;

  isPlayingScale = true;
  updateFeedback(`🎶 Explorando ${scaleObj.name}...`, 'normal');
  renderer.renderStaff(scaleObj.clef);
  renderer.drawNotes(scaleObj.notes, -1); // Desenha todas

  gameManager.registerScaleExplored(scaleId);

  // Tocar sequencialmente com animação de brilho nas notas e no teclado
  scaleObj.notes.forEach((pitch, index) => {
    setTimeout(() => {
      synth.playNote(pitch, 0.6);
      
      // Ilumina na partitura SVG
      renderer.drawNotes(scaleObj.notes, index);

      // Ilumina tecla no piano
      const keyEl = document.querySelector(`[data-pitch="${pitch}"]`);
      if (keyEl) {
        keyEl.classList.add('active-key');
        setTimeout(() => keyEl.classList.remove('active-key'), 350);
      }

      if (index === scaleObj.notes.length - 1) {
        setTimeout(() => {
          isPlayingScale = false;
          updateFeedback(`✅ Conclusão da escala ${scaleObj.name}!`, 'success');
        }, 600);
      }
    }, index * 400);
  });
}

// --- 9. MODO CORRIDA 60 SEGUNDOS (ARCADE TIMER) ---
function startArcadeMode() {
  if (arcadeIsRunning) return;
  arcadeIsRunning = true;
  arcadeTimeRemaining = 60;
  arcadeCurrentScore = 0;
  
  const timerEl = document.getElementById('timer-display');
  const scoreEl = document.getElementById('arcade-score');
  const btnStart = document.getElementById('btn-start-arcade');

  if (scoreEl) scoreEl.textContent = '0';
  if (btnStart) {
    btnStart.textContent = '⏳ Rodando...';
    btnStart.disabled = true;
    btnStart.classList.remove('pulse-btn');
  }

  updateFeedback('⚡ Valendo! Acerte o máximo de notas na pauta rapidinho!', 'normal');
  setTargetClefAndPitch();

  clearInterval(arcadeTimerInterval);
  arcadeTimerInterval = setInterval(() => {
    arcadeTimeRemaining--;
    if (timerEl) timerEl.textContent = `${arcadeTimeRemaining}s`;

    if (arcadeTimeRemaining <= 0) {
      clearInterval(arcadeTimerInterval);
      arcadeIsRunning = false;
      if (btnStart) {
        btnStart.textContent = '⚡ Jogar Novamente';
        btnStart.disabled = false;
        btnStart.classList.add('pulse-btn');
      }

      // Checa recorde personal no localStorage
      if (arcadeCurrentScore > gameManager.state.maxArcadeScore) {
        gameManager.state.maxArcadeScore = arcadeCurrentScore;
        gameManager.saveState();
        document.getElementById('arcade-highscore').textContent = arcadeCurrentScore;
        updateFeedback(`🏆 NOVO RECORDE PESSOAL! Você marcou ${arcadeCurrentScore} pontos!`, 'success');
        synth.playSFX('levelup');
      } else {
        updateFeedback(`⏰ Fim de papo! Você conquistou ${arcadeCurrentScore} pontos neste round!`, 'normal');
      }

      if (arcadeCurrentScore >= 150) {
        gameManager.unlockBadge('speed_demon');
      }
    }
  }, 1000);
}

// --- 10. MODAL E GALERIA DE TROFÉUS ---
function renderBadgesModal() {
  const container = document.getElementById('badges-grid-container');
  if (!container) return;
  container.innerHTML = '';

  Object.values(BADGES_DEFINITIONS).forEach(b => {
    const isUnlocked = gameManager.state.unlockedBadges.includes(b.id);
    const card = document.createElement('div');
    card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="badge-icon">${isUnlocked ? b.icon : '🔒'}</div>
      <div class="badge-info">
        <h3>${b.title}</h3>
        <p>${b.desc}</p>
        <small style="color: ${isUnlocked ? '#34d399' : '#64748b'}; font-weight: 600;">
          ${isUnlocked ? '✓ Desbloqueada!' : 'Travada'}
        </small>
      </div>
    `;
    container.appendChild(card);
  });
}

function setupModalListeners() {
  const modal = document.getElementById('modal-badges');
  const btnOpen = document.getElementById('btn-open-badges');
  const btnClose = document.getElementById('btn-close-badges');
  const btnReset = document.getElementById('btn-reset-data');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      gameManager.updateDashboardUI();
      renderBadgesModal();
      modal.classList.remove('hidden');
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => gameManager.resetProgress());
  }
}

// --- 11. TROCA DE ABAS E CONFIGURAÇÃO DA INTERFACE ---
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const toolScales = document.getElementById('toolbar-scales');
  const toolArcade = document.getElementById('toolbar-arcade');
  const instrText = document.getElementById('mode-instruction-text');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      currentMode = tab.dataset.mode;

      if (toolScales) toolScales.classList.add('hidden');
      if (toolArcade) toolArcade.classList.add('hidden');

      if (currentMode === 'quiz') {
        if (instrText) instrText.textContent = '🎯 Desafio da Clave: Toque no teclado ou botão correspondente à nota iluminada!';
        updateFeedback('Qual é esta nota no pentagrama?', 'normal');
        setTargetClefAndPitch();
      } else if (currentMode === 'scales') {
        if (toolScales) toolScales.classList.remove('hidden');
        if (instrText) instrText.textContent = '📈 Laboratório de Escalas: Selecione uma escala musical para ver sua estrutura e ouvir o arpejo!';
        updateFeedback('Escolha uma escala e pressione Tocar!', 'normal');
        const select = document.getElementById('scale-select');
        if (select && MUSICAL_DATA.scales[select.value]) {
          renderer.renderStaff('treble');
          renderer.drawNotes(MUSICAL_DATA.scales[select.value].notes, -1);
        }
      } else if (currentMode === 'ear') {
        if (instrText) instrText.textContent = '👂 Treino Auditivo: Ouça atentamente o som misterioso e adivinhe qual nota foi tocada!';
        updateFeedback('Ouça a nota misteriosa e toque a sua resposta!', 'normal');
        setTargetClefAndPitch();
      } else if (currentMode === 'arcade') {
        if (toolArcade) toolArcade.classList.remove('hidden');
        if (instrText) instrText.textContent = '⚡ Corrida 60 Segundos: Modo veloz contra o relógio! Pressione Iniciar Desafio!';
        updateFeedback('Pressione Iniciar para acionar o cronômetro!', 'normal');
      }
    });
  });
}

function setupControlBars() {
  const instrumentSelect = document.getElementById('instrument-select');
  if (instrumentSelect) {
    instrumentSelect.addEventListener('change', (e) => synth.setInstrument(e.target.value));
  }

  const clefSelect = document.getElementById('clef-select');
  if (clefSelect) {
    clefSelect.addEventListener('change', () => {
      if (currentMode !== 'scales') setTargetClefAndPitch();
    });
  }

  const btnNotation = document.getElementById('toggle-notation-btn');
  if (btnNotation) {
    btnNotation.addEventListener('click', () => {
      useLatinNotation = !useLatinNotation;
      updateNotationButtons();
      synth.playSFX('coin');
    });
  }

  const btnPlayScale = document.getElementById('btn-play-scale');
  if (btnPlayScale) {
    btnPlayScale.addEventListener('click', () => playSelectedScale());
  }

  const scaleSelect = document.getElementById('scale-select');
  if (scaleSelect) {
    scaleSelect.addEventListener('change', (e) => {
      const scaleObj = MUSICAL_DATA.scales[e.target.value];
      if (scaleObj) {
        renderer.renderStaff(scaleObj.clef);
        renderer.drawNotes(scaleObj.notes, -1);
        updateFeedback(`Escala selecionada: ${scaleObj.name}`, 'normal');
      }
    });
  }

  const btnStartArcade = document.getElementById('btn-start-arcade');
  if (btnStartArcade) {
    btnStartArcade.addEventListener('click', () => startArcadeMode());
  }

  // Botões de notas fáceis da UI
  const noteBtns = document.querySelectorAll('.note-btn');
  noteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const note = btn.dataset.note;
      handleNoteInput(note, e);
    });
  });

  // Teclado físico para atalhos convenientes (A = Dó, S = Ré, D = Mi...)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const keyMap = {
      'a': 'C4', 'w': 'C#4', 's': 'D4', 'e': 'D#4', 'd': 'E4',
      'f': 'F4', 't': 'F#4', 'g': 'G4', 'y': 'G#4', 'h': 'A4', 'u': 'A#4', 'j': 'B4', 'k': 'C5'
    };
    const mapped = keyMap[e.key.toLowerCase()];
    if (mapped) handleNoteInput(mapped);
  });
}

// --- 12. INICIALIZAÇÃO GERAL AO CARREGAR A PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
  setupVirtualKeyboard();
  updateNotationButtons();
  setupTabs();
  setupControlBars();
  setupModalListeners();
  
  gameManager.updateDashboardUI();
  
  // Inicia com primeira pergunta na Clave de Sol
  setTargetClefAndPitch();
});
