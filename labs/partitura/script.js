/**
 * ============================================================================
 * PARTITURA: MAESTRO QUEST - PRO CORE ENGINE & GAMIFICATION
 * ============================================================================
 */

// --- 1. TEORIA MUSICAL DETALHADA E GEOMETRIA DA PAUTA ---
const MUSICAL_DATA = {
  notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  latinNames: { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' },
  frequencies: {
    // 3 oitavas completas abarcando os graves da Clave de Fá até os agudos da Clave de Sol
    'E2': 82.41,  'F2': 87.31,  'F#2': 92.50,  'G2': 98.00,  'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00
  },
  // Posições verticais (Y) na pauta SVG (Linhas do pentagrama de Y=70 a Y=150, espaçamento 20px)
  // Em SVG, Y=70 é a 5ª Linha (alto) e Y=150 é a 1ª Linha (baixo).
  staffPositions: {
    treble: {
      'C4': { y: 190, ledger: [190], name: 'Dó Central (C4)' },
      'D4': { y: 170, ledger: [], name: 'Ré (D4)' },
      'E4': { y: 150, ledger: [], name: 'Mi (1ª Linha)' },
      'F4': { y: 140, ledger: [], name: 'Fá (1º Espaço)' },
      'G4': { y: 130, ledger: [], name: 'Sol (2ª Linha - da Clave)' },
      'A4': { y: 120, ledger: [], name: 'Lá (2º Espaço)' },
      'B4': { y: 110, ledger: [], name: 'Si (3ª Linha Central)' },
      'C5': { y: 100, ledger: [], name: 'Dó Agudo (3º Espaço)' },
      'D5': { y: 90,  ledger: [], name: 'Ré Agudo (4ª Linha)' },
      'E5': { y: 80,  ledger: [], name: 'Mi Agudo (4º Espaço)' },
      'F5': { y: 70,  ledger: [], name: 'Fá Agudo (5ª Linha)' },
      'G5': { y: 50,  ledger: [50], name: 'Sol Super Agudo' }
    },
    bass: {
      'F2': { y: 170, ledger: [], name: 'Fá Grave (F2)' },
      'G2': { y: 150, ledger: [], name: 'Sol Grave (1ª Linha)' },
      'A2': { y: 140, ledger: [], name: 'Lá Grave (1º Espaço)' },
      'B2': { y: 130, ledger: [], name: 'Si Grave (2ª Linha)' },
      'C3': { y: 120, ledger: [], name: 'Dó Grave (2º Espaço)' },
      'D3': { y: 110, ledger: [], name: 'Ré Grave (3ª Linha)' },
      'E3': { y: 100, ledger: [], name: 'Mi Grave (3º Espaço)' },
      'F3': { y: 90,  ledger: [], name: 'Fá do Baixo (4ª Linha - da Clave)' },
      'G3': { y: 80,  ledger: [], name: 'Sol (4º Espaço)' },
      'A3': { y: 70,  ledger: [], name: 'Lá (5ª Linha)' },
      'B3': { y: 55,  ledger: [], name: 'Si (Acima da Pauta)' },
      'C4': { y: 35,  ledger: [35], name: 'Dó Central (C4 - Linha Sup. em Fá)' }
    }
  },
  scales: {
    'C-major': { 
      name: 'Dó Maior (Tom - Tom - Semitom - Tom - Tom - Tom - Semitom)', 
      notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], 
      clef: 'treble',
      theory: '💡 <strong>Dó Maior (C Major):</strong> A rainha das escalas! É composta inteiramente pelas teclas brancas do piano, sem acidentes. É a porta de entrada para toda a leitura musical.'
    },
    'G-major': { 
      name: 'Sol Maior (Apresenta o Fá Sustenido ♯)', 
      notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'], 
      clef: 'treble',
      theory: '💡 <strong>Sol Maior (G Major):</strong> Para manter a sonoridade alegre do modo maior, esta escala eleva a 7ª nota (Fá para Fá♯). É super comum no Rock e Pop!'
    },
    'F-major': { 
      name: 'Fá Maior (Apresenta o Si Bemol ♭ na Clave de Fá!)', 
      notes: ['F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3'], 
      clef: 'bass',
      theory: '💡 <strong>Fá Maior (F Major):</strong> Aqui exploramos a profunda <strong>Clave de Fá (Baixo)</strong>! Ela apresenta um Si Bemol (B♭) para preservar a perfeita simetria dos intervalos de oitava.'
    },
    'A-minor': { 
      name: 'Lá Menor Natural (A escala relativa de Dó Maior)', 
      notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], 
      clef: 'treble',
      theory: '💡 <strong>Lá Menor (A Minor):</strong> Traz uma emoção mais pensativa e melancólica. Possui as mesmíssimas notas da escala de Dó Maior, só que partindo de Lá!'
    },
    'C-penta': { 
      name: 'Dó Pentatônica (As 5 notas de ouro dos solos de guitarra e synth)', 
      notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], 
      clef: 'treble',
      theory: '💡 <strong>Pentatônica:</strong> Elimina os semitons que causam tensão (4ª e 7ª notas), deixando apenas 5 notas que combinam magistralmente em qualquer improviso!'
    },
    'C-blues': { 
      name: 'Dó Blues (A lendária Blue Note!)', 
      notes: ['C4', 'D4', 'F4', 'F#4', 'G4', 'B4', 'C5'], 
      clef: 'treble',
      theory: '💡 <strong>Escala Blues:</strong> Adiciona uma nota especial no meio do caminho — a famosa <strong>Blue Note (Fá♯/Sol♭)</strong>! Dá aquele tom expressivo e arrojado do Jazz e do Rock & Roll!'
    }
  }
};

const BADGES_DEFINITIONS = {
  first_step: { id: 'first_step', icon: '🎵', title: 'Primeira Nota', desc: 'Acertou sua primeira nota musical no app!' },
  combo_master: { id: 'combo_master', icon: '🔥', title: 'Mestre do Combo', desc: 'Conseguiu uma sequência incrível de 10 acertos seguidos!' },
  scale_explorer: { id: 'scale_explorer', icon: '🎹', title: 'Explorador das Escalas', desc: 'Tocou e estudou todas as 6 escalas do Laboratório!' },
  ear_golden: { id: 'ear_golden', icon: '👂✨', title: 'Ouvido de Ouro', desc: 'Acertou 5 notas seguidas exclusivamente no Treino Auditivo!' },
  speed_demon: { id: 'speed_demon', icon: '⚡', title: 'Virtuoso dos 60s', desc: 'Ultrapassou 150 pontos na Corrida de 60 Segundos!' },
  maestro_supremo: { id: 'maestro_supremo', icon: '👑', title: 'Maestro Supremo', desc: 'Alcançou o prestigiado Nível 5 no sistema de Maestro!' }
};

// --- 2. MOTOR SONORO PRO (WEB AUDIO API + SIMULAÇÃO DE REVERB) ---
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

  playNote(pitch, duration = 1.1) {
    this.init();
    const freq = MUSICAL_DATA.frequencies[pitch] || 440;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Efeito de Reverb Simulado com Delay Suave
    const delay = this.ctx.createDelay();
    const delayGain = this.ctx.createGain();
    delay.delayTime.setValueAtTime(0.08, now);
    delayGain.gain.setValueAtTime(0.2, now);

    if (this.instrument === 'piano') {
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now); // Harmônica do timbre do piano
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(350, now + duration);
    } else if (this.instrument === 'synth') {
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq * 1.005, now); // Detune de Chorus 80s
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.2);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4200, now);
    } else if (this.instrument === 'guitar') {
      // Guitarra / Pluck (ataque super curto e ressonância de corda)
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 0.5, now); // Sub-harmônica de corpo da guitarra
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.9);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.Q.setValueAtTime(2.5, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.3);
    } else if (this.instrument === 'celesta') {
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 3, now); // Harmônico de sino
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.6);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(250, now);
    }

    osc1.frequency.setValueAtTime(freq, now);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    
    // Conecta áudio puro e loop de reverb
    gain.connect(this.ctx.destination);
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.25);
    osc2.stop(now + duration + 0.25);
  }

  playSFX(type) {
    this.init();
    const now = this.ctx.currentTime;
    if (type === 'correct' || type === 'coin') {
      this.playNote('G4', 0.16);
      setTimeout(() => this.playNote('C5', 0.28), 110);
    } else if (type === 'error') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.25);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'levelup' || type === 'badge') {
      ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => {
        setTimeout(() => this.playNote(n, 0.45), i * 90);
      });
    }
  }
}

// --- 3. GESTÃO DE ESTADO E GAMIFICAÇÃO (LOCALSTORAGE) ---
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
        this.showToast('🔥 Streak Incrível!', `Você está há ${this.state.streakDays} dias seguidos aprendendo partitura!`);
      } else if (diffDays > 1) {
        this.state.streakDays = 1;
      }
      this.state.lastLoginDate = today;
      this.saveState();
    }
  }

  addXP(amount, x, y) {
    let multiplier = 1;
    if (this.state.combo >= 10) multiplier = 3;
    else if (this.state.combo >= 5) multiplier = 2;
    else if (this.state.combo >= 3) multiplier = 1.5;

    const gained = Math.round(amount * multiplier);
    this.state.xp += gained;
    this.state.coins += Math.round(5 * multiplier);

    if (x !== undefined && y !== undefined) {
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-xp';
      floatEl.textContent = `+${gained} XP${multiplier > 1 ? ` (x${multiplier}!)` : ''}`;
      floatEl.style.left = `${Math.min(window.innerWidth - 120, Math.max(20, x))}px`;
      floatEl.style.top = `${Math.max(20, y - 30)}px`;
      document.body.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 1100);
    }

    const requiredXP = this.state.level * 100;
    if (this.state.xp >= requiredXP) {
      this.state.level += 1;
      synth.playSFX('levelup');
      this.showToast('🎉 SUBIU DE NÍVEL!', `Incrível! Você se tornou Maestro Nível ${this.state.level}!`);
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
      this.showToast(`🏆 Conquista Desbloqueada: ${b.title}!`, b.desc);
      this.saveState();
    }
  }

  showToast(title, desc) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<div><strong>${title}</strong><div style="font-size: 0.88rem; font-weight: 500; color: #cbd5e1; margin-top: 2px;">${desc}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(120%)';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
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
      'Aprendiz da Clave', 'Explorador do Baixo e Agudo', 'Mestre das Oitavas',
      'Virtuoso das Escalas', 'Maestro Supremo', 'Lenda da Partitura'
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
    if (confirm('Tem certeza de que deseja zerar seu progresso, moedas e recordes no localStorage?')) {
      localStorage.removeItem(this.storageKey);
      this.state = this.loadState();
      this.saveState();
      renderBadgesModal();
      this.showToast('🔄 Progresso Zerado', 'Um novo recomeço musical aguarda por você!');
    }
  }
}

// --- 4. MOTOR DE RENDERIZAÇÃO SVG PRO COM VETORES E COMPARADOR ---
class StaffSVGRenderer {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.clef = 'treble';
    this.guideMode = false;
  }

  clear() {
    if (!this.svg) return;
    this.svg.innerHTML = '';
  }

  renderStaff(clefType = 'treble') {
    this.clear();
    this.clef = clefType;
    const ns = 'http://www.w3.org/2000/svg';

    // Atualiza tema visual da pauta (Azul Ciano p/ Sol, Roxo Amethyst p/ Fá)
    const cardWrapper = document.getElementById('staff-card-wrapper');
    const indicator = document.getElementById('clef-active-indicator');
    if (cardWrapper) {
      cardWrapper.className = `staff-display-card ${this.clef === 'bass' ? 'mode-bass-clef' : 'mode-treble-clef'}`;
    }
    if (indicator) {
      if (this.clef === 'bass') {
        indicator.textContent = '𝄢 Oitava Grave (Clave de Fá / Mão Esq.)';
        indicator.className = 'clef-badge bass-badge';
      } else {
        indicator.textContent = '𝄞 Oitava Aguda (Clave de Sol / Mão Dir.)';
        indicator.className = 'clef-badge treble-badge';
      }
    }

    // 1. As 5 linhas do pentagrama (Y de 70 a 150)
    for (let i = 0; i < 5; i++) {
      const y = 70 + (i * 20);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', '40');
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', '660');
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', '#cbd5e1');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.88');
      this.svg.appendChild(line);
    }

    const startBar = document.createElementNS(ns, 'line');
    startBar.setAttribute('x1', '40'); startBar.setAttribute('y1', '70');
    startBar.setAttribute('x2', '40'); startBar.setAttribute('y2', '150');
    startBar.setAttribute('stroke', '#cbd5e1'); startBar.setAttribute('stroke-width', '4');
    this.svg.appendChild(startBar);

    const endBar = document.createElementNS(ns, 'line');
    endBar.setAttribute('x1', '660'); endBar.setAttribute('y1', '70');
    endBar.setAttribute('x2', '660'); endBar.setAttribute('y2', '150');
    endBar.setAttribute('stroke', '#cbd5e1'); endBar.setAttribute('stroke-width', '4');
    this.svg.appendChild(endBar);

    // 2. Desenho Vetorial Perfeito das Claves
    if (this.clef === 'treble') {
      // Clave de Sol (Espiral em torno da 2ª linha, Y=130) + texto de apoio elegante
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'note-glow');
      
      const clefText = document.createElementNS(ns, 'text');
      clefText.setAttribute('x', '55');
      clefText.setAttribute('y', '136');
      clefText.setAttribute('font-size', '80');
      clefText.setAttribute('fill', '#22d3ee');
      clefText.setAttribute('font-family', 'sans-serif');
      clefText.textContent = '𝄞';
      group.appendChild(clefText);

      // Etiqueta permanente explicativa da Clave no SVG
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', '50'); label.setAttribute('y', '35');
      label.setAttribute('font-size', '13'); label.setAttribute('fill', '#22d3ee');
      label.setAttribute('font-weight', 'bold'); label.textContent = 'SOL (Agudo)';
      group.appendChild(label);

      this.svg.appendChild(group);

    } else {
      // Clave de Fá: Símbolo de Fá na 4ª Linha (Y=90) com os DOIS PONTOS clássicos em Y=80 e Y=100!
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'note-glow');
      
      const clefText = document.createElementNS(ns, 'text');
      clefText.setAttribute('x', '50');
      clefText.setAttribute('y', '128');
      clefText.setAttribute('font-size', '75');
      clefText.setAttribute('fill', '#a855f7');
      clefText.setAttribute('font-family', 'sans-serif');
      clefText.textContent = '𝄢';
      group.appendChild(clefText);

      // Desenhar explicitamente os 2 pontos da Clave de Fá abraçando a linha do Fá (Y=90) se a fonte falhar
      const dot1 = document.createElementNS(ns, 'circle');
      dot1.setAttribute('cx', '105'); dot1.setAttribute('cy', '81'); dot1.setAttribute('r', '5.5');
      dot1.setAttribute('fill', '#ec4899');
      group.appendChild(dot1);

      const dot2 = document.createElementNS(ns, 'circle');
      dot2.setAttribute('cx', '105'); dot2.setAttribute('cy', '99'); dot2.setAttribute('r', '5.5');
      dot2.setAttribute('fill', '#ec4899');
      group.appendChild(dot2);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', '45'); label.setAttribute('y', '35');
      label.setAttribute('font-size', '13'); label.setAttribute('fill', '#a855f7');
      label.setAttribute('font-weight', 'bold'); label.textContent = 'FÁ (Grave / Baixo)';
      group.appendChild(label);

      this.svg.appendChild(group);
    }
  }

  // Desenha notas musicais (e modo guia de texto se ativado!)
  drawNotes(notePitches, highlightIndex = 0) {
    if (!Array.isArray(notePitches)) notePitches = [notePitches];

    const ns = 'http://www.w3.org/2000/svg';
    const numNotes = notePitches.length;
    const startX = 200;
    const stepX = Math.min(75, 420 / Math.max(1, numNotes - 1));

    notePitches.forEach((pitch, idx) => {
      const x = startX + (idx * stepX);
      const posData = (MUSICAL_DATA.staffPositions[this.clef] || {})[pitch] || { y: 110, ledger: [], name: pitch };
      const y = posData.y;
      const isTarget = (idx === highlightIndex);
      const baseColor = this.clef === 'bass' ? '#ec4899' : '#22d3ee';

      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', `staff-note ${isTarget ? 'note-glow' : ''}`);
      group.setAttribute('id', `svg-note-${idx}`);

      // 1. Linhas Suplementares (Ledgers)
      if (posData.ledger && posData.ledger.length > 0) {
        posData.ledger.forEach(lY => {
          const lLine = document.createElementNS(ns, 'line');
          lLine.setAttribute('x1', (x - 24).toString());
          lLine.setAttribute('y1', lY.toString());
          lLine.setAttribute('x2', (x + 24).toString());
          lLine.setAttribute('y2', lY.toString());
          lLine.setAttribute('stroke', '#cbd5e1');
          lLine.setAttribute('stroke-width', '2.5');
          group.appendChild(lLine);
        });
      }

      // 2. Cabeça da nota
      const ellipse = document.createElementNS(ns, 'ellipse');
      ellipse.setAttribute('cx', x.toString());
      ellipse.setAttribute('cy', y.toString());
      ellipse.setAttribute('rx', '14');
      ellipse.setAttribute('ry', '10');
      ellipse.setAttribute('transform', `rotate(-15, ${x}, ${y})`);
      ellipse.setAttribute('fill', isTarget ? baseColor : '#f8fafc');
      group.appendChild(ellipse);

      // 3. Haste da nota
      const stem = document.createElementNS(ns, 'line');
      if (y >= 110) { 
        stem.setAttribute('x1', (x + 12).toString()); stem.setAttribute('y1', y.toString());
        stem.setAttribute('x2', (x + 12).toString()); stem.setAttribute('y2', (y - 38).toString());
      } else { 
        stem.setAttribute('x1', (x - 12).toString()); stem.setAttribute('y1', y.toString());
        stem.setAttribute('x2', (x - 12).toString()); stem.setAttribute('y2', (y + 38).toString());
      }
      stem.setAttribute('stroke', isTarget ? baseColor : '#f8fafc');
      stem.setAttribute('stroke-width', '3.5');
      group.appendChild(stem);

      // 4. Símbolos de Acidente (♯ ou ♭)
      if (pitch.includes('#') || pitch.includes('b')) {
        const acc = document.createElementNS(ns, 'text');
        acc.setAttribute('x', (x - 32).toString());
        acc.setAttribute('y', (y + 7).toString());
        acc.setAttribute('font-size', '24');
        acc.setAttribute('fill', '#fbbf24');
        acc.setAttribute('font-weight', 'bold');
        acc.textContent = pitch.includes('#') ? '♯' : '♭';
        group.appendChild(acc);
      }

      // 5. MODO GUIA: Mostra o nome da nota sob a pauta se o botão estiver ON!
      if (this.guideMode || numNotes > 1) {
        const guideText = document.createElementNS(ns, 'text');
        guideText.setAttribute('x', x.toString());
        guideText.setAttribute('y', '225');
        guideText.setAttribute('text-anchor', 'middle');
        guideText.setAttribute('font-size', '14');
        guideText.setAttribute('font-weight', 'bold');
        guideText.setAttribute('fill', isTarget ? '#fbbf24' : '#94a3b8');
        const noteNameOnly = pitch.replace(/[0-9]/g, '');
        guideText.textContent = useLatinNotation ? (MUSICAL_DATA.latinNames[noteNameOnly.charAt(0)] + (noteNameOnly.length > 1 ? noteNameOnly.slice(1) : '')) : noteNameOnly;
        group.appendChild(guideText);
      }

      this.svg.appendChild(group);
    });
  }

  // COMPARADOR EDUCATIVO DE ERRO: Exibe a nota certa em verde vs a errada tocada em vermelho!
  drawErrorComparison(targetPitch, playedPitch) {
    this.renderStaff(this.clef);
    const ns = 'http://www.w3.org/2000/svg';
    
    // 1. Desenha nota correta (Verde)
    const targetPos = (MUSICAL_DATA.staffPositions[this.clef] || {})[targetPitch] || { y: 110, ledger: [] };
    const x1 = 230;
    
    if (targetPos.ledger) {
      targetPos.ledger.forEach(lY => {
        const lLine = document.createElementNS(ns, 'line');
        lLine.setAttribute('x1', (x1 - 25).toString()); lLine.setAttribute('y1', lY.toString());
        lLine.setAttribute('x2', (x1 + 25).toString()); lLine.setAttribute('y2', lY.toString());
        lLine.setAttribute('stroke', '#cbd5e1'); lLine.setAttribute('stroke-width', '2');
        this.svg.appendChild(lLine);
      });
    }

    const ell1 = document.createElementNS(ns, 'ellipse');
    ell1.setAttribute('cx', x1.toString()); ell1.setAttribute('cy', targetPos.y.toString());
    ell1.setAttribute('rx', '14'); ell1.setAttribute('ry', '10');
    ell1.setAttribute('fill', '#10b981'); ell1.setAttribute('transform', `rotate(-15, ${x1}, ${targetPos.y})`);
    this.svg.appendChild(ell1);

    const txt1 = document.createElementNS(ns, 'text');
    txt1.setAttribute('x', x1.toString()); txt1.setAttribute('y', '230');
    txt1.setAttribute('text-anchor', 'middle'); txt1.setAttribute('fill', '#10b981');
    txt1.setAttribute('font-weight', 'bold'); txt1.setAttribute('font-size', '15');
    txt1.textContent = '🎯 CORRETA';
    this.svg.appendChild(txt1);

    // 2. Desenha nota errada (Vermelho Pulsante)
    const playedPos = (MUSICAL_DATA.staffPositions[this.clef] || {})[playedPitch] || { y: 90, ledger: [] };
    const x2 = 410;

    if (playedPos.ledger) {
      playedPos.ledger.forEach(lY => {
        const lLine = document.createElementNS(ns, 'line');
        lLine.setAttribute('x1', (x2 - 25).toString()); lLine.setAttribute('y1', lY.toString());
        lLine.setAttribute('x2', (x2 + 25).toString()); lLine.setAttribute('y2', lY.toString());
        lLine.setAttribute('stroke', '#cbd5e1'); lLine.setAttribute('stroke-width', '2');
        this.svg.appendChild(lLine);
      });
    }

    const ell2 = document.createElementNS(ns, 'ellipse');
    ell2.setAttribute('cx', x2.toString()); ell2.setAttribute('cy', playedPos.y.toString());
    ell2.setAttribute('rx', '14'); ell2.setAttribute('ry', '10');
    ell2.setAttribute('fill', '#f43f5e'); ell2.setAttribute('transform', `rotate(-15, ${x2}, ${playedPos.y})`);
    this.svg.appendChild(ell2);

    const txt2 = document.createElementNS(ns, 'text');
    txt2.setAttribute('x', x2.toString()); txt2.setAttribute('y', '230');
    txt2.setAttribute('text-anchor', 'middle'); txt2.setAttribute('fill', '#f43f5e');
    txt2.setAttribute('font-weight', 'bold'); txt2.setAttribute('font-size', '15');
    txt2.textContent = '❌ TOCADA';
    this.svg.appendChild(txt2);

    // Linha conectora pontilhada entre as duas
    const connector = document.createElementNS(ns, 'line');
    connector.setAttribute('x1', (x1 + 20).toString()); connector.setAttribute('y1', targetPos.y.toString());
    connector.setAttribute('x2', (x2 - 20).toString()); connector.setAttribute('y2', playedPos.y.toString());
    connector.setAttribute('stroke', '#fbbf24'); connector.setAttribute('stroke-width', '2');
    connector.setAttribute('stroke-dasharray', '5,5');
    this.svg.appendChild(connector);

    this.animateError();
  }

  animateSuccess() {
    const noteEl = document.getElementById('svg-note-0');
    if (noteEl) noteEl.classList.add('note-hit-anim');
  }

  animateError() {
    const wrapper = document.querySelector('.staff-display-card');
    if (wrapper) {
      wrapper.classList.add('staff-shake');
      setTimeout(() => wrapper.classList.remove('staff-shake'), 450);
    }
  }
}

// --- 5. INSTÂNCIAS E GERENCIAMENTO DE MODULOS ---
const synth = new WebAudioSynth();
const gameManager = new MaestroGameManager();
const renderer = new StaffSVGRenderer('staff-canvas');

let currentMode = 'quiz';
let currentClefSetting = 'treble';
let currentTargetPitch = 'G4';
let currentTargetBaseNote = 'G';
let useLatinNotation = true;
let arcadeTimerInterval = null;
let arcadeTimeRemaining = 60;
let arcadeIsRunning = false;
let arcadeCurrentScore = 0;
let isPlayingScale = false;

// --- 6. TECLADO VIRTUAL DE FÁ2 A DÓ5 E SINCRONIA GRAVE/AGUDO ---
function setupVirtualKeyboard() {
  const kbContainer = document.getElementById('piano-keyboard');
  if (!kbContainer) return;
  kbContainer.innerHTML = '';

  // Faixa expandida abarcando os graves da Clave de Fá (Baixo) e os agudos de Sol
  const whiteKeys = ['F2','G2','A2','B2','C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'];
  const blackKeyMap = { 'F2':'F#2','G2':'G#2','A2':'A#2', 'C3':'C#3','D3':'D#3','F3':'F#3','G3':'G#3','A3':'A#3', 'C4':'C#4','D4':'D#4','F4':'F#4','G4':'G#4','A4':'A#4' };

  whiteKeys.forEach((pitch, i) => {
    const wKey = document.createElement('div');
    wKey.className = 'white-key';
    wKey.dataset.pitch = pitch;
    const base = pitch.charAt(0);
    wKey.textContent = useLatinNotation ? MUSICAL_DATA.latinNames[base] : base;
    
    wKey.addEventListener('mousedown', () => handleNoteInput(pitch));
    wKey.addEventListener('touchstart', (e) => { e.preventDefault(); handleNoteInput(pitch); });
    
    kbContainer.appendChild(wKey);

    if (blackKeyMap[pitch]) {
      const bPitch = blackKeyMap[pitch];
      const bKey = document.createElement('div');
      bKey.className = 'black-key';
      bKey.dataset.pitch = bPitch;
      const offsetLeft = (i + 1) * 39 - 12;
      bKey.style.left = `${offsetLeft}px`;
      
      bKey.addEventListener('mousedown', (e) => { e.stopPropagation(); handleNoteInput(bPitch); });
      bKey.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); handleNoteInput(bPitch); });

      kbContainer.appendChild(bKey);
    }
  });

  updateKeyboardZones();
}

function updateKeyboardZones() {
  const zoneLeft = document.getElementById('zone-left');
  const zoneRight = document.getElementById('zone-right');
  if (!zoneLeft || !zoneRight) return;

  if (currentClefSetting === 'bass') {
    zoneLeft.classList.add('active-zone');
    zoneRight.classList.remove('active-zone');
  } else if (currentClefSetting === 'treble') {
    zoneRight.classList.add('active-zone');
    zoneLeft.classList.remove('active-zone');
  } else {
    zoneLeft.classList.add('active-zone');
    zoneRight.classList.add('active-zone');
  }
}

function updateNotationButtons() {
  const btns = document.querySelectorAll('.trigger-pad, .note-btn');
  btns.forEach(b => {
    const note = b.dataset.note;
    const nameEl = b.querySelector('.note-name');
    const cifraEl = b.querySelector('.note-cifra');
    const hintEl = b.querySelector('.note-octave-hint');

    if (nameEl && cifraEl) {
      if (useLatinNotation) {
        nameEl.textContent = MUSICAL_DATA.latinNames[note];
        cifraEl.textContent = note;
      } else {
        nameEl.textContent = note;
        cifraEl.textContent = MUSICAL_DATA.latinNames[note];
      }
    }

    // Atualiza dica de oitava (Baixo vs Agudo) nos botões da UI!
    if (hintEl) {
      if (currentClefSetting === 'bass') {
        hintEl.textContent = 'Oitava 3 (Grave)';
        hintEl.style.color = '#a855f7';
      } else if (currentClefSetting === 'treble') {
        hintEl.textContent = 'Oitava 4 (Agudo)';
        hintEl.style.color = '#22d3ee';
      } else {
        hintEl.textContent = 'Grave / Agudo';
        hintEl.style.color = '#fbbf24';
      }
    }
  });

  setupVirtualKeyboard();
  const notDisp = document.getElementById('notation-mode-display');
  if (notDisp) notDisp.textContent = useLatinNotation ? 'Notação: Dó Ré Mi' : 'Notação: C D E';
}

// --- 7. FLUXO DE QUIZ E JOGOS ---
function updateFeedback(msg, type = 'normal') {
  const banner = document.getElementById('feedback-display');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  if (!banner) return;

  banner.className = `feedback-banner ${type}`;
  if (type === 'success') icon.textContent = '🌟';
  else if (type === 'error') icon.textContent = '❌';
  else icon.textContent = '💡';
  text.innerHTML = msg;
}

function setTargetClefAndPitch() {
  let selectedClef = document.getElementById('clef-select')?.value || 'treble';
  currentClefSetting = selectedClef;
  
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
  
  updateNotationButtons();
  updateKeyboardZones();
  renderer.renderStaff(selectedClef);

  if (currentMode === 'ear') {
    renderer.clear();
    renderer.renderStaff(selectedClef);
    const ns = 'http://www.w3.org/2000/svg';
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '310'); text.setAttribute('y', '135');
    text.setAttribute('font-size', '70'); text.setAttribute('fill', selectedClef === 'bass' ? '#ec4899' : '#22d3ee');
    text.setAttribute('class', 'note-glow'); text.textContent = '❓';
    renderer.svg.appendChild(text);
    
    setTimeout(() => synth.playNote(currentTargetPitch, 1.3), 250);
  } else {
    renderer.drawNotes([currentTargetPitch], 0);
  }
}

function handleNoteInput(playedPitchOrNote, event) {
  if (isPlayingScale) return;

  const playedBaseNote = playedPitchOrNote.charAt(0);
  
  // SOLUÇÃO DO ÁUDIO DA CLAVE DE FÁ:
  // Se o usuário clicou no botão "Dó" (sem oitava especificada) e estamos na Clave de Fá,
  // reproduzimos o áudio na Oitava 3 (ou 2), soando grave e autêntico!
  let soundPitch = playedPitchOrNote;
  if (playedPitchOrNote.length === 1) {
    const targetOctave = renderer.clef === 'bass' ? '3' : '4';
    soundPitch = `${playedBaseNote}${targetOctave}`;
  }
  
  synth.playNote(soundPitch, 0.85);

  const keyEl = document.querySelector(`[data-pitch="${soundPitch}"]`);
  if (keyEl) {
    keyEl.classList.add('active-key');
    setTimeout(() => keyEl.classList.remove('active-key'), 350);
  }

  if (currentMode === 'quiz' || currentMode === 'ear' || (currentMode === 'arcade' && arcadeIsRunning)) {
    const isCorrect = (playedBaseNote === currentTargetBaseNote);

    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 3;
    if (event && event.clientX) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      const banner = document.getElementById('feedback-display');
      if (banner) {
        const rect = banner.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top;
      }
    }

    const targetPosInfo = (MUSICAL_DATA.staffPositions[renderer.clef] || {})[currentTargetPitch] || { name: currentTargetPitch };
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

      updateFeedback(`Perfeito! É a nota <strong>${correctName}</strong> (${targetPosInfo.name})!`, 'success');

      setTimeout(() => {
        if (currentMode !== 'arcade' || arcadeIsRunning) setTargetClefAndPitch();
      }, 850);

    } else {
      synth.playSFX('error');
      gameManager.registerHit(false, currentMode === 'ear');
      
      const playedName = useLatinNotation ? MUSICAL_DATA.latinNames[playedBaseNote] : playedBaseNote;
      updateFeedback(`Quase! Você tocou <strong>${playedName}</strong>, mas a nota no pentagrama era <strong>${correctName}</strong> (${targetPosInfo.name}).`, 'error');

      // Se não for modo auditivo, projeta a comparação na pauta!
      if (currentMode !== 'ear') {
        renderer.drawErrorComparison(currentTargetPitch, soundPitch);
      }
    }
  } else if (currentMode === 'scales') {
    updateFeedback(`Você tocou <strong>${soundPitch}</strong> no sintetizador!`, 'normal');
  }
}

// --- 8. LAB DE ESCALAS PRO (ASCENDENTE E DESCENDENTE) ---
function playSelectedScale(direction = 'asc') {
  if (isPlayingScale) return;
  const scaleSelect = document.getElementById('scale-select');
  const scaleId = scaleSelect ? scaleSelect.value : 'C-major';
  const scaleObj = MUSICAL_DATA.scales[scaleId];
  if (!scaleObj) return;

  isPlayingScale = true;
  updateFeedback(`🎶 Tocando arpejo ${direction === 'asc' ? 'ascendente' : 'descendente'} de <strong>${scaleObj.name}</strong>...`, 'normal');
  renderer.renderStaff(scaleObj.clef);
  
  const notesToPlay = direction === 'asc' ? [...scaleObj.notes] : [...scaleObj.notes].reverse();
  renderer.drawNotes(notesToPlay, -1);

  gameManager.registerScaleExplored(scaleId);

  notesToPlay.forEach((pitch, index) => {
    setTimeout(() => {
      synth.playNote(pitch, 0.65);
      renderer.drawNotes(notesToPlay, index);

      const keyEl = document.querySelector(`[data-pitch="${pitch}"]`);
      if (keyEl) {
        keyEl.classList.add('active-key');
        setTimeout(() => keyEl.classList.remove('active-key'), 350);
      }

      if (index === notesToPlay.length - 1) {
        setTimeout(() => {
          isPlayingScale = false;
          updateFeedback(`✅ Escala de ${scaleObj.name} concluída com sucesso!`, 'success');
        }, 650);
      }
    }, index * 420);
  });
}

// --- 9. MODO CORRIDA 60s ---
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
    btnStart.textContent = '⏳ Desafio Em Curso...';
    btnStart.disabled = true;
    btnStart.classList.remove('pulse-btn');
  }

  updateFeedback('⚡ Valendo! Acerte o máximo de notas na pauta o mais rápido que puder!', 'normal');
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

      if (arcadeCurrentScore > gameManager.state.maxArcadeScore) {
        gameManager.state.maxArcadeScore = arcadeCurrentScore;
        gameManager.saveState();
        document.getElementById('arcade-highscore').textContent = arcadeCurrentScore;
        updateFeedback(`🏆 NOVO RECORDE PESSOAL! Você conquistou impressionantes ${arcadeCurrentScore} pontos!`, 'success');
        synth.playSFX('levelup');
      } else {
        updateFeedback(`⏰ Fim de papo! Você conquistou ${arcadeCurrentScore} pontos neste round!`, 'normal');
      }

      if (arcadeCurrentScore >= 150) gameManager.unlockBadge('speed_demon');
    }
  }, 1000);
}

// --- 10. GALERIA DE TROFÉUS MODAL ---
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
        <small style="color: ${isUnlocked ? '#34d399' : '#64748b'}; font-weight: 700; margin-top: 6px; display: block;">
          ${isUnlocked ? '✓ Desbloqueada & Conquistada!' : '🔒 Travada no localStorage'}
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

// --- 11. ABAS E INTERATIVIDADE COMPLETA ---
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
        if (instrText) instrText.textContent = '🎯 Desafio da Clave: Toque no piano ou botão correspondente à nota iluminada!';
        updateFeedback('Qual é esta nota no pentagrama?', 'normal');
        setTargetClefAndPitch();
      } else if (currentMode === 'scales') {
        if (toolScales) toolScales.classList.remove('hidden');
        if (instrText) instrText.textContent = '📈 Laboratório de Escalas: Estude a estrutura teórica e ouça as notas ao vivo!';
        updateFeedback('Escolha uma escala abaixo e toque para ver na pauta!', 'normal');
        
        const select = document.getElementById('scale-select');
        if (select && MUSICAL_DATA.scales[select.value]) {
          const scaleObj = MUSICAL_DATA.scales[select.value];
          renderer.renderStaff(scaleObj.clef);
          renderer.drawNotes(scaleObj.notes, -1);
          const theoryEl = document.getElementById('scale-theory-desc');
          if (theoryEl && scaleObj.theory) theoryEl.innerHTML = scaleObj.theory;
        }
      } else if (currentMode === 'ear') {
        if (instrText) instrText.textContent = '👂 Treino Auditivo: Ouça o timbre com atenção e descubra qual tom foi tocado!';
        updateFeedback('Ouça a nota misteriosa e toque a sua resposta no teclado!', 'normal');
        setTargetClefAndPitch();
      } else if (currentMode === 'arcade') {
        if (toolArcade) toolArcade.classList.remove('hidden');
        if (instrText) instrText.textContent = '⚡ Corrida 60s: Frenesi musical contra o tempo! Quebre o recorde!';
        updateFeedback('Pressione Iniciar Desafio para acionar o cronômetro!', 'normal');
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

  const btnHint = document.getElementById('toggle-hint-btn');
  const hintStatus = document.getElementById('hint-status');
  if (btnHint && hintStatus) {
    btnHint.addEventListener('click', () => {
      renderer.guideMode = !renderer.guideMode;
      hintStatus.textContent = renderer.guideMode ? 'ON (Ativado)' : 'OFF';
      btnHint.classList.toggle('active-guide', renderer.guideMode);
      synth.playSFX('coin');
      if (currentMode !== 'ear' && currentMode !== 'scales') {
        renderer.renderStaff(renderer.clef);
        renderer.drawNotes([currentTargetPitch], 0);
      }
    });
  }

  const btnPlayScale = document.getElementById('btn-play-scale');
  if (btnPlayScale) btnPlayScale.addEventListener('click', () => playSelectedScale('asc'));

  const btnPlayScaleDesc = document.getElementById('btn-play-scale-desc');
  if (btnPlayScaleDesc) btnPlayScaleDesc.addEventListener('click', () => playSelectedScale('desc'));

  const scaleSelect = document.getElementById('scale-select');
  if (scaleSelect) {
    scaleSelect.addEventListener('change', (e) => {
      const scaleObj = MUSICAL_DATA.scales[e.target.value];
      if (scaleObj) {
        renderer.renderStaff(scaleObj.clef);
        renderer.drawNotes(scaleObj.notes, -1);
        const theoryEl = document.getElementById('scale-theory-desc');
        if (theoryEl && scaleObj.theory) theoryEl.innerHTML = scaleObj.theory;
        updateFeedback(`Escala selecionada: <strong>${scaleObj.name}</strong>`, 'normal');
      }
    });
  }

  const btnStartArcade = document.getElementById('btn-start-arcade');
  if (btnStartArcade) btnStartArcade.addEventListener('click', () => startArcadeMode());

  const noteBtns = document.querySelectorAll('.trigger-pad, .note-btn');
  noteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const note = btn.dataset.note;
      handleNoteInput(note, e);
    });
  });

  // Teclado físico prático: A=Dó, S=Ré, D=Mi, F=Fá, G=Sol...
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const oct = renderer.clef === 'bass' ? '3' : '4';
    const octHigh = renderer.clef === 'bass' ? '4' : '5';
    const keyMap = {
      'a': `C${oct}`, 'w': `C#${oct}`, 's': `D${oct}`, 'e': `D#${oct}`, 'd': `E${oct}`,
      'f': `F${oct}`, 't': `F#${oct}`, 'g': `G${oct}`, 'y': `G#${oct}`, 'h': `A${oct}`, 'u': `A#${oct}`, 'j': `B${oct}`, 'k': `C${octHigh}`
    };
    const mapped = keyMap[e.key.toLowerCase()];
    if (mapped) handleNoteInput(mapped);
  });
}

// --- 12. INICIALIZAÇÃO AO CARREGAR A PÁGINA ---
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
