(() => {
  'use strict';

  // --- THE 3 OFFICIAL ROCK LEGENDS (KURT, AXL, LENNON) ---
  const fighters = [
    {
      id: 'kurt',
      name: 'Kurt Cobain',
      short: 'KURT',
      era: 'Grunge Rebel',
      special: 'Guitarrada Smash',
      quote: 'Melhor que queimar o palco.',
      color: '#e8d574', accent: '#49684e', hair: '#d8bf79', outfit: '#394b38', skin: '#e2b48e',
      power: 5, speed: 4, defense: 3, style: 'grunge', portrait: 'portrait-kurt-v2.jpg'
    },
    {
      id: 'axl',
      name: 'Axl Rose',
      short: 'AXL',
      era: 'Sunset Wildcard',
      special: 'Serpent Mic-Stand',
      quote: 'Você quis o melhor? Agora aguenta.',
      color: '#ff435f', accent: '#8e183a', hair: '#b72b27', outfit: '#17141b', skin: '#e6ae80',
      power: 4, speed: 5, defense: 3, style: 'glam', portrait: 'portrait-axl-v2.jpg'
    },
    {
      id: 'lennon',
      name: 'John Lennon',
      short: 'LENNON',
      era: 'The Dreamer',
      special: 'Peace & Love Pulse',
      quote: 'Dê uma chance ao contra-ataque.',
      color: '#6acfa0', accent: '#27463a', hair: '#34251e', outfit: '#314d3f', skin: '#e1b08a',
      power: 4, speed: 3, defense: 5, style: 'moptop', portrait: 'portrait-lennon-v2.jpg'
    }
  ];

  // --- DOM ELEMENTS & STATE ---
  const screens = [...document.querySelectorAll('.screen')];
  const roster = document.querySelector('#roster');
  const gameCanvas = document.querySelector('#game');
  const ctx = gameCanvas.getContext('2d');
  const faceImages = {};
  const spriteCanvases = {};
  const keys = {};
  const touch = {};
  let pick1 = null;
  let pick2 = null;
  let currentStage = 'stadium'; // 'stadium' or 'club'
  let muted = false;
  let audio = null;
  let distortionNode = null;
  let match = null;
  let raf = 0;
  let lastFrameTime = 0;
  let accumulator = 0;
  const fixedStep = 1000 / 60;

  // 1P Control Mapping (WASD, Arrow keys, Q, E, R, Space, F, G, H)
  const p1KeyMap = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['KeyW', 'ArrowUp'],
    block: ['KeyS', 'ArrowDown'],
    punch: ['KeyQ', 'KeyF', 'KeyJ'],
    kick: ['KeyE', 'KeyG', 'KeyK'],
    special: ['KeyR', 'KeyH', 'KeyL', 'Space']
  };

  function isPressed(action) {
    const codes = p1KeyMap[action];
    return codes.some(code => keys[code] || touch[code]);
  }

  function consumeAction(action) {
    const codes = p1KeyMap[action];
    for (const code of codes) {
      if (keys[code] === 1 || touch[code] === 1) {
        if (keys[code]) keys[code] = 2;
        if (touch[code]) touch[code] = 2;
        return true;
      }
    }
    return false;
  }

  // --- TRANSPARENT CHROMA-KEY PREPROCESSOR ---
  function createPerfectTransparentCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 300;
    c.height = img.naturalHeight || img.height || 400;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);

    try {
      const imgData = cx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const maxRGB = Math.max(r, g, b);
        const minRGB = Math.min(r, g, b);
        // Remove black & dark grey compression background pixels with soft edge feathering
        if (maxRGB < 45 || (maxRGB < 70 && maxRGB - minRGB < 18)) {
          data[i + 3] = 0;
        } else if (maxRGB < 85) {
          data[i + 3] = Math.round(((maxRGB - 45) / 40) * 255);
        }
      }
      cx.putImageData(imgData, 0, 0);
    } catch (e) {}
    return c;
  }

  function loadSpritePose(id, poseName, srcUrl) {
    const key = `${id}_${poseName}`;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      spriteCanvases[key] = createPerfectTransparentCanvas(img);
    };
    img.onerror = () => {
      // Quietly ignore missing optional pose images
    };
    img.src = srcUrl;
  }

  // Preload UI & Active Sprite Assets
  fighters.forEach(f => {
    const portraitImg = new Image();
    portraitImg.decoding = 'async';
    portraitImg.src = `assets/${f.portrait}`;
    faceImages[f.id] = portraitImg;

    loadSpritePose(f.id, 'idle', `assets/sprite-${f.id}.jpg`);
    loadSpritePose(f.id, 'punch', `assets/sprite-${f.id}-punch.jpg`);
    loadSpritePose(f.id, 'kick', `assets/sprite-${f.id}-kick.jpg`);
    loadSpritePose(f.id, 'special', `assets/sprite-${f.id}-special.jpg`);
  });

  // Stage Fog & Crowd Effects
  const stageFog = [];
  const crowdLights = [];
  for (let i = 0; i < 40; i++) {
    crowdLights.push({
      x: Math.random() * 960,
      y: 395 + Math.random() * 65,
      size: Math.random() * 2.8 + 1.2,
      color: Math.random() > 0.4 ? '#36dff1' : Math.random() > 0.5 ? '#ff4797' : '#ffc44d',
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.04
    });
  }
  for (let i = 0; i < 20; i++) {
    stageFog.push({
      x: Math.random() * 1100 - 100,
      y: 380 + Math.random() * 50,
      vx: 0.15 + Math.random() * 0.25,
      radius: 42 + Math.random() * 45,
      alpha: 0.06 + Math.random() * 0.08
    });
  }

  const $ = (selector) => document.querySelector(selector);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;

  // --- CANVAS HIGH-DPI RESIZING ---
  function resizeCanvas() {
    if (!gameCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = gameCanvas.getBoundingClientRect();
    const targetW = rect.width || 960;
    const targetH = rect.height || 540;

    if (gameCanvas.width !== Math.round(targetW * dpr) || gameCanvas.height !== Math.round(targetH * dpr)) {
      gameCanvas.width = Math.round(targetW * dpr);
      gameCanvas.height = Math.round(targetH * dpr);
    }
  }
  window.addEventListener('resize', resizeCanvas);

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'arena-screen') {
      setTimeout(resizeCanvas, 50);
    }
  }

  // --- WEB AUDIO SYNTHESIZER ---
  function makeDistortionCurve(amount = 50) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function initAudio() {
    if (muted) return;
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      distortionNode = audio.createWaveShaper();
      distortionNode.curve = makeDistortionCurve(75);
      distortionNode.oversample = '4x';
    }
    if (audio.state === 'suspended') audio.resume();
  }

  function playPowerChord(rootFreq, duration = 0.5, type = 'heavy') {
    if (muted) return;
    initAudio();
    const now = audio.currentTime;
    const freqs = [rootFreq, rootFreq * 1.498, rootFreq * 2.0];

    const masterGain = audio.createGain();
    const cabinetFilter = audio.createBiquadFilter();
    cabinetFilter.type = 'lowpass';
    cabinetFilter.frequency.value = type === 'special' ? 3600 : 2300;

    masterGain.gain.setValueAtTime(0.15, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    freqs.forEach((freq, idx) => {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * (idx === 0 ? 1 : 1.002), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + duration);
      osc.connect(distortionNode);
    });

    distortionNode.connect(cabinetFilter);
    cabinetFilter.connect(masterGain);
    masterGain.connect(audio.destination);

    setTimeout(() => {
      try { masterGain.disconnect(); } catch (e) {}
    }, duration * 1000 + 100);
  }

  function sound(type, pitch = 1) {
    if (muted) return;
    initAudio();
    const now = audio.currentTime;

    if (type === 'special') {
      playPowerChord(146.83 * pitch, 0.9, 'special');
      return;
    }

    if (type === 'hit') {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(now); osc.stop(now + 0.22);

      playPowerChord(98.0 * pitch, 0.28, 'heavy');
      return;
    }

    if (type === 'block') {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.setValueAtTime(350 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filter).connect(gain).connect(audio.destination);
      osc.start(now); osc.stop(now + 0.15);
      return;
    }

    if (type === 'crowd') {
      const bufferSize = audio.sampleRate * 0.6;
      const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = audio.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, now);
      filter.frequency.exponentialRampToValueAtTime(1700, now + 0.3);
      filter.Q.value = 3;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      whiteNoise.connect(filter).connect(gain).connect(audio.destination);
      whiteNoise.start(now);
      return;
    }

    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(270 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain).connect(audio.destination);
    osc.start(now); osc.stop(now + 0.15);
  }

  function stat(label, value) {
    return `<div class="stats"><b>${label}</b><span class="stat-dots">${[1,2,3,4,5].map(i => `<i class="${i <= value ? 'on' : ''}"></i>`).join('')}</span></div>`;
  }

  roster.innerHTML = '';
  fighters.forEach(fighter => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'fighter-card';
    card.dataset.id = fighter.id;
    card.style.setProperty('--fighter', fighter.color);
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Selecionar ${fighter.name}, especial ${fighter.special}`);
    card.innerHTML = `<div class="portrait"></div><div class="fighter-info"><h3>${fighter.name}</h3><p>${fighter.special}</p>${stat('PWR',fighter.power)}${stat('SPD',fighter.speed)}</div>`;
    const portrait = card.querySelector('.portrait');
    portrait.style.setProperty('--portrait-image', `url("assets/${fighter.portrait}")`);
    card.addEventListener('click', () => selectFighter(fighter));
    roster.append(card);
  });

  function selectFighter(fighter) {
    initAudio();
    sound('ui', 1.3);
    pick1 = fighter;
    const others = fighters.filter(f => f.id !== fighter.id);
    pick2 = others[Math.floor(Math.random() * others.length)];
    updatePicks();
  }

  function updatePicks() {
    document.querySelectorAll('.fighter-card').forEach(card => {
      card.classList.toggle('is-p1', pick1?.id === card.dataset.id);
      card.classList.toggle('is-p2', pick2?.id === card.dataset.id);
    });
    $('#p1-pick strong').textContent = pick1 ? pick1.name : 'ESCOLHA';
    $('#p2-pick strong').textContent = pick2 ? pick2.name : 'ALEATÓRIO';
    $('#start-fight').disabled = !(pick1 && pick2);
  }

  // Stage Switcher Listener
  document.querySelectorAll('.stage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStage = btn.dataset.stage;
      document.querySelectorAll('.stage-btn').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  // --- PLAYER ENTITY CLASS ---
  class Player {
    constructor(data, x, facing, isCpu = false) {
      this.data = data; this.x = x; this.y = 425; this.vx = 0; this.vy = 0;
      this.facing = facing; this.cpu = isCpu;
      this.health = 100; this.meter = 20; this.width = 75; this.height = 160;
      this.grounded = true; this.attack = null; this.attackTimer = 0; this.cooldown = 0;
      this.hitFlash = 0; this.stun = 0; this.blocking = false; this.aiTimer = 0;
      this.afterimages = []; this.combo = 0; this.comboTimer = 0; this.animFrame = 0;
      this.landSquash = 0; this.bufferedAttack = null;
    }

    input(other) {
      if (this.stun > 0) return { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };
      if (!this.cpu) {
        return {
          left: isPressed('left'),
          right: isPressed('right'),
          jump: consumeAction('jump'),
          block: isPressed('block'),
          punch: consumeAction('punch'),
          kick: consumeAction('kick'),
          special: consumeAction('special')
        };
      }

      this.aiTimer--;
      const distance = Math.abs(other.x - this.x);
      const input = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };

      if (other.attack && distance < 145 && Math.random() < 0.85) {
        input.block = true;
      }
      if (distance > 115) {
        input[other.x < this.x ? 'left' : 'right'] = true;
      } else if (distance < 65 && Math.random() < 0.25) {
        input[other.x < this.x ? 'right' : 'left'] = true;
      }

      if (distance < 145 && this.cooldown <= 0 && this.aiTimer <= 0) {
        if (this.meter >= 100 && Math.random() < 0.78) {
          input.special = true;
        } else {
          const randAttack = Math.random();
          if (randAttack < 0.50) input.punch = true;
          else if (randAttack < 0.88) input.kick = true;
          else input.block = true;
        }
        this.aiTimer = rand(12, 34);
      }
      if (distance > 210 && Math.random() < 0.04) input.jump = true;
      return input;
    }

    update(other) {
      this.animFrame++;
      if (this.cooldown > 0) this.cooldown--;
      if (this.hitFlash > 0) this.hitFlash--;
      if (this.stun > 0) this.stun--;
      if (this.landSquash > 0) this.landSquash--;
      if (this.comboTimer > 0) this.comboTimer--; else this.combo = 0;

      const input = this.input(other);

      if (this.attack && this.attackTimer <= Math.max(9, this.attack.activeAt)) {
        if (input.punch) this.bufferedAttack = 'punch';
        else if (input.kick) this.bufferedAttack = 'kick';
        else if (input.special && this.meter >= 100) this.bufferedAttack = 'special';
      }
      if (!this.attack && this.bufferedAttack && this.cooldown <= 0) {
        const queued = this.bufferedAttack; this.bufferedAttack = null; this.startAttack(queued);
      }

      this.blocking = input.block && this.grounded && !this.attack;
      const speed = (3.5 + this.data.speed * 0.25) * (this.cpu ? 0.92 : 1);

      if (!this.attack && !this.blocking && this.stun <= 0) {
        const targetSpeed = input.left ? -speed : input.right ? speed : 0;
        const control = this.grounded ? 0.40 : 0.18;
        this.vx += (targetSpeed - this.vx) * control;
        if (!input.left && !input.right) this.vx *= this.grounded ? 0.70 : 0.96;
        if (input.jump && this.grounded) {
          this.vy = -13.0; this.grounded = false; sound('ui', 0.65);
        }
        if (input.punch) this.startAttack('punch');
        else if (input.kick) this.startAttack('kick');
        else if (input.special && this.meter >= 100) this.startAttack('special');
      } else if (this.attack) {
        this.vx *= 0.80;
      }

      const wasGrounded = this.grounded;
      this.vy += 0.75;
      this.x += this.vx; this.y += this.vy;

      if (this.y >= 425) {
        this.y = 425;
        if (!wasGrounded && this.vy > 4) {
          this.landSquash = 8;
          match.shake = Math.max(match.shake, 3.0);
          sound('ui', 0.48);
        }
        this.vy = 0; this.grounded = true;
      }
      this.x = clamp(this.x, 70, 890);
      this.facing = other.x >= this.x ? 1 : -1;

      if (this.attackTimer > 0) {
        this.attackTimer--;
        if (!this.attack.hit && this.attackTimer <= this.attack.activeAt) this.checkHit(other);
        if (this.attackTimer <= 0) this.attack = null;
      }
      this.afterimages = this.afterimages.filter(a => --a.life > 0);
    }

    startAttack(type) {
      if (this.cooldown > 0) return;
      const config = {
        punch: { duration: 18, activeAt: 10, range: 108 + (this.cpu ? 0 : 14), damage: 7 + this.data.power * 0.75, knock: 4.0 },
        kick: { duration: 25, activeAt: 14, range: 128 + (this.cpu ? 0 : 14), damage: 10 + this.data.power * 1.05, knock: 6.0 },
        special: { duration: 55, activeAt: 35, range: 280 + (this.cpu ? 0 : 20), damage: 22 + this.data.power * 1.3, knock: 13 }
      }[type];

      this.attack = { type, ...config, hit: false };
      this.attackTimer = config.duration;
      this.cooldown = (type === 'special' ? 55 : config.duration + 2) + (this.cpu ? 5 : 0);
      this.vx += this.facing * (type === 'special' ? 4.8 : type === 'kick' ? 3.0 : 2.0);

      if (type === 'special') {
        this.meter = 0;
        this.afterimages.push({ x: this.x - 20 * this.facing, y: this.y, life: 25 });
        announce(this.data.special.toUpperCase(), 780);
        sound('special', 1 + this.data.speed * 0.05);
        sound('crowd');
      } else {
        if (type === 'kick') this.afterimages.push({ x: this.x - 10 * this.facing, y: this.y, life: 12 });
        sound('ui', type === 'kick' ? 0.75 : 1.1);
      }
    }

    checkHit(other) {
      const reach = this.attack.range;
      const inFront = (other.x - this.x) * this.facing > -25;
      const distance = Math.abs(other.x - this.x);
      const vertical = Math.abs(other.y - this.y) < 110;

      if (inFront && distance < reach && vertical) {
        this.attack.hit = true;
        let damage = this.attack.damage;
        if (this.cpu) damage *= 0.65;
        else if (other.cpu) damage *= 1.15;
        if (other.blocking) damage *= 0.15;

        other.health = clamp(other.health - damage, 0, 100);
        other.hitFlash = 9;
        other.stun = other.blocking ? 6 : this.attack.type === 'special' ? 30 : 12;
        other.vx = this.attack.knock * this.facing * (other.blocking ? 0.35 : 1);
        if (this.attack.type === 'special') other.vy = -6.5;

        this.meter = clamp(this.meter + (this.attack.type === 'special' ? 0 : this.cpu ? 11 : 24), 0, 100);
        other.meter = clamp(other.meter + (other.cpu ? 6 : 14), 0, 100);
        this.combo++; this.comboTimer = 65;

        match.shake = this.attack.type === 'special' ? 18 : 6;
        match.flash = this.attack.type === 'special' ? 8 : 2;
        match.hitStop = other.blocking ? 3 : this.attack.type === 'special' ? 11 : this.attack.type === 'kick' ? 6 : 4;
        match.zoomPulse = this.attack.type === 'special' ? 0.07 : 0.02;

        const impactText = this.attack.type === 'special'
          ? (this.data.id === 'kurt' ? 'GUITARRADA SMASH!' : this.data.id === 'axl' ? 'SERPENT SCREAM!' : 'PEACE & LOVE PULSE!')
          : (other.blocking ? 'BLOCK!' : this.attack.type === 'kick' ? 'THUD!' : 'POW!');

        match.impacts.push({
          x: (this.x + other.x) / 2, y: other.y - 95,
          text: impactText,
          color: this.data.color, life: this.attack.type === 'special' ? 38 : 24
        });

        burst((this.x + other.x) / 2, other.y - 85, this.data.color, this.attack.type === 'special' ? 36 : 14);
        sound(other.blocking ? 'block' : 'hit', this.attack.type === 'special' ? 0.6 : 0.95);
      }
    }
  }

  function startMatch() {
    if (!pick1 || !pick2) return;
    initAudio();
    showScreen('arena-screen');
    $('#p1-name').textContent = pick1.short;
    $('#p2-name').textContent = pick2.short;
    $('#opponent-label').textContent = 'CPU';

    match = {
      p1: new Player(pick1, 260, 1, false),
      p2: new Player(pick2, 700, -1, true),
      timer: 75, frames: 0, state: 'intro', intro: 150, particles: [], impacts: [], shake: 0, flash: 0, hitStop: 0, zoomPulse: 0, ended: false, paused: false,
      camX: 480, camZoom: 1.0
    };
    match.p1.meter = 55;
    match.p2.meter = 0;
    match.p2.health = 90;

    $('#coach-text').textContent = window.matchMedia('(max-width: 720px)').matches
      ? 'Use as setas ← e → para chegar perto do rival.'
      : 'Use A/D ou Setas. Q é Soco, E é Chute, R é Golpe Especial!';

    announce('ROUND 1', 800);
    sound('crowd');
    cancelAnimationFrame(raf);
    lastFrameTime = 0; accumulator = 0;
    raf = requestAnimationFrame(loop);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      match.particles.push({
        x, y,
        vx: rand(-10, 10), vy: rand(-10, 5),
        life: rand(18, 38),
        color, size: rand(2.5, 7.5), length: rand(10, 32)
      });
    }
  }

  function update() {
    if (!match || match.paused || match.ended) return;
    if (match.hitStop > 0) { match.hitStop--; return; }

    match.frames++;
    if (match.state === 'intro') {
      match.intro--;
      if (match.intro === 72) announce('FIGHT!', 800);
      if (match.intro <= 35) match.state = 'fight';
    } else {
      match.p1.update(match.p2);
      match.p2.update(match.p1);
      if (match.frames % 60 === 0) match.timer--;
      if (match.p1.health <= 0 || match.p2.health <= 0 || match.timer <= 0) endMatch();
    }

    match.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.life--; });
    match.particles = match.particles.filter(p => p.life > 0);
    match.impacts.forEach(impact => impact.life--);
    match.impacts = match.impacts.filter(impact => impact.life > 0);

    stageFog.forEach(f => {
      f.x += f.vx;
      if (f.x > 1060) f.x = -100;
    });

    if (match.shake > 0) match.shake *= 0.78;
    if (match.zoomPulse > 0) match.zoomPulse *= 0.74;
    if (match.flash > 0) match.flash--;
    if (match.frames % 20 === 0) updateCoach();
    updateHud();
  }

  function updateCoach() {
    if (!match || match.state === 'intro') return;
    const player = match.p1;
    const distance = Math.abs(match.p2.x - player.x);
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    let tip;
    if (player.meter >= 100) tip = mobile ? '★ ESPECIAL PRONTO! Toque no botão rosa com estrela.' : '★ ESPECIAL PRONTO! Aperte R ou Espaço agora.';
    else if (player.health < 35) tip = mobile ? 'Segure ↓ para defender e reduzir o dano.' : 'Segure S ou ↓ para defender e reduzir bastante o dano.';
    else if (distance > 150) tip = mobile ? 'Chegue perto usando as setas ← e →.' : 'Chegue perto: use A/D ou as Setas ← →.';
    else if (match.frames < 650) tip = mobile ? 'Ataque agora: toque em P ou K.' : 'Ataque agora: Q dá Soco e E dá Chute.';
    else if (player.meter > 72) tip = mobile ? 'A barra amarela está quase cheia. Prepare o ★.' : 'Sua barra amarela está quase cheia. Prepare o R.';
    else {
      const tips = mobile ? [
        'Alterne P e K para encaixar combos.',
        'Use ↑ para pular por cima dos ataques.',
        'Segure ↓ quando o rival começar a atacar.',
        'Golpes acertados carregam seu especial rapidamente.'
      ] : [
        'Alterne Q e E para encaixar combos.',
        'W ou ↑ pula por cima dos ataques.',
        'Segure S ou ↓ quando o rival começar a atacar.',
        'Golpes acertados carregam seu especial rapidamente.'
      ];
      tip = tips[Math.floor(match.frames / 240) % tips.length];
    }
    $('#coach-text').textContent = tip;
  }

  function updateHud() {
    $('#p1-health').style.transform = `scaleX(${match.p1.health / 100})`;
    $('#p2-health').style.transform = `scaleX(${match.p2.health / 100})`;
    $('#p1-meter').style.width = `${match.p1.meter}%`;
    $('#p2-meter').style.width = `${match.p2.meter}%`;
    $('#p1-ready').classList.toggle('is-ready', match.p1.meter >= 100);
    $('#p2-ready').classList.toggle('is-ready', match.p2.meter >= 100);
    $('#p1-ready').textContent = match.p1.meter >= 100 ? 'PRONTO!' : 'CARREGANDO';
    $('#p2-ready').textContent = match.p2.meter >= 100 ? 'PRONTO!' : 'CARREGANDO';
    $('#timer').textContent = String(Math.max(0, match.timer)).padStart(2, '0');
  }

  function loop(timestamp = 0) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = Math.min(50, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    accumulator += elapsed;
    while (accumulator >= fixedStep) {
      update();
      accumulator -= fixedStep;
    }
    draw();
    if (match && !match.ended && !match.paused) raf = requestAnimationFrame(loop);
  }

  // --- RENDERING PIPELINE ---
  function draw() {
    if (!match) return;

    resizeCanvas();
    const canvasW = gameCanvas.width;
    const canvasH = gameCanvas.height;

    ctx.save();
    ctx.scale(canvasW / 960, canvasH / 540);

    const renderState = p => p.blocking ? 'block' : p.attack?.type || (p.stun > 0 ? 'hit' : !p.grounded ? 'jump' : Math.abs(p.vx) > 0.55 ? 'walk' : 'idle');
    const motionData = p => ({ vx: p.vx, vy: p.vy, animFrame: p.animFrame, landSquash: p.landSquash });

    const targetCamX = (match.p1.x + match.p2.x) / 2;
    match.camX += (targetCamX - match.camX) * 0.08;
    const dist = Math.abs(match.p1.x - match.p2.x);
    const targetZoom = clamp(960 / (dist + 380), 1.0, 1.14);
    match.camZoom += (targetZoom - match.camZoom) * 0.08;

    const shakeX = match.shake ? rand(-match.shake, match.shake) : 0;
    const shakeY = match.shake ? rand(-match.shake * 0.5, match.shake * 0.5) : 0;
    ctx.translate(shakeX, shakeY);

    if (match.zoomPulse || match.camZoom > 1.0) {
      const totalZoom = match.camZoom + match.zoomPulse;
      ctx.translate(480, 270);
      ctx.scale(totalZoom, totalZoom);
      ctx.translate(-match.camX, -270);
    } else {
      ctx.translate(480 - match.camX, 0);
    }

    // 1. Draw Selected Stage
    drawStage(ctx, match.frames);

    // 2. Glossy Stage Floor Reflections (100% Transparent Sprites)
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -850);
    ctx.globalAlpha = 0.24;
    drawTransparentSprite(ctx, match.p1.data, match.p1.x, match.p1.y, match.p1.facing, renderState(match.p1), match.p1.attackTimer, 1, 0, motionData(match.p1));
    drawTransparentSprite(ctx, match.p2.data, match.p2.x, match.p2.y, match.p2.facing, renderState(match.p2), match.p2.attackTimer, 1, 0, motionData(match.p2));
    ctx.restore();

    // 3. Draw Fighter After-images & Main 100% Transparent Sprites
    match.p1.afterimages.forEach(a => drawTransparentSprite(ctx, match.p1.data, a.x, a.y, match.p1.facing, match.p1.attack?.type || 'idle', match.p1.attackTimer, 0.18 * a.life / 24, 0));
    match.p2.afterimages.forEach(a => drawTransparentSprite(ctx, match.p2.data, a.x, a.y, match.p2.facing, match.p2.attack?.type || 'idle', match.p2.attackTimer, 0.18 * a.life / 24, 0));

    drawTransparentSprite(ctx, match.p1.data, match.p1.x, match.p1.y, match.p1.facing, renderState(match.p1), match.p1.attackTimer, 1, match.p1.hitFlash, motionData(match.p1));
    drawTransparentSprite(ctx, match.p2.data, match.p2.x, match.p2.y, match.p2.facing, renderState(match.p2), match.p2.attackTimer, 1, match.p2.hitFlash, motionData(match.p2));

    // 4. Draw Particle Effects, Combos & Text Impacts
    drawEffects();

    ctx.restore();

    if (match.flash) {
      ctx.fillStyle = `rgba(255,255,255,${match.flash / 9})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  // --- STAGE RENDERER (STADIUM vs UNDERGROUND CLUB) ---
  function drawStage(c, frame) {
    if (currentStage === 'club') {
      // 🎸 STAGE 2: UNDERGROUND ROCK CLUB
      const bg = c.createLinearGradient(0, -50, 0, 540);
      bg.addColorStop(0, '#0d0408');
      bg.addColorStop(0.5, '#240813');
      bg.addColorStop(1, '#080205');
      c.fillStyle = bg;
      c.fillRect(-200, -50, 1360, 600);

      // Gritty Red Brick Wall Pattern
      c.strokeStyle = 'rgba(75, 25, 35, 0.4)';
      c.lineWidth = 2;
      for (let y = 30; y < 420; y += 22) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
        const offset = Math.floor(y / 22) % 2 === 0 ? 0 : 25;
        for (let x = -100 + offset; x < 1060; x += 50) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke();
        }
      }

      // Red Velvet Side Stage Curtains
      const curtainG1 = c.createLinearGradient(-100, 0, 120, 0);
      curtainG1.addColorStop(0, '#590a18'); curtainG1.addColorStop(1, 'transparent');
      c.fillStyle = curtainG1; c.fillRect(-100, 0, 220, 420);

      const curtainG2 = c.createLinearGradient(1060, 0, 840, 0);
      curtainG2.addColorStop(0, '#590a18'); curtainG2.addColorStop(1, 'transparent');
      c.fillStyle = curtainG2; c.fillRect(840, 0, 220, 420);

      // Pulsing Neon Sign "ROCK CELLAR"
      c.save();
      c.font = 'italic 900 36px "Barlow Condensed"';
      c.textAlign = 'center';
      c.shadowColor = '#ff2e78';
      c.shadowBlur = 18 + Math.sin(frame * 0.1) * 8;
      c.fillStyle = '#ff2e78';
      c.fillText('⚡ UNDERGROUND ROCK CLUB ⚡', 480, 100);
      c.restore();

      // Warm Amber Spotlights
      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i++) {
        const baseX = 140 + i * 230;
        const sweep = Math.sin(frame * 0.02 + i * 1.5) * 80;
        const spotG = c.createLinearGradient(baseX, 30, baseX + sweep, 425);
        spotG.addColorStop(0, 'rgba(255, 196, 77, 0.32)');
        spotG.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = spotG;
        c.beginPath();
        c.moveTo(baseX - 12, 30);
        c.lineTo(baseX + sweep - 80, 425);
        c.lineTo(baseX + sweep + 80, 425);
        c.lineTo(baseX + 12, 30);
        c.closePath();
        c.fill();
      }
      c.restore();

      // Vintage Dark Wooden Stage Floor
      const floorG = c.createLinearGradient(0, 420, 0, 540);
      floorG.addColorStop(0, '#36141a');
      floorG.addColorStop(0.2, '#1b090d');
      floorG.addColorStop(1, '#070204');
      c.fillStyle = floorG;
      c.fillRect(-200, 420, 1360, 120);

      c.strokeStyle = 'rgba(255, 196, 77, 0.18)';
      c.lineWidth = 1;
      for (let y = 435; y < 540; y += 18) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
      }
      return;
    }

    // 🏟️ STAGE 1: NEON STADIUM ARENA
    const bg = c.createLinearGradient(0, -50, 0, 540);
    bg.addColorStop(0, '#06040d');
    bg.addColorStop(0.45, '#1b0826');
    bg.addColorStop(0.8, '#0b0612');
    c.fillStyle = bg;
    c.fillRect(-200, -50, 1360, 600);

    c.save();
    c.globalAlpha = 0.18;
    for (let x = -50; x < 1010; x += 28) {
      const eqHeight = 80 + Math.sin(x * 0.05 + frame * 0.1) * 60 + Math.cos(x * 0.1) * 30;
      const ledG = c.createLinearGradient(0, 200 - eqHeight, 0, 200);
      ledG.addColorStop(0, '#ff2e78');
      ledG.addColorStop(1, '#23d7ef');
      c.fillStyle = ledG;
      c.fillRect(x, 220 - eqHeight, 22, eqHeight);
    }
    c.restore();

    c.strokeStyle = '#271b33';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-100, 30); c.lineTo(1060, 30);
    c.moveTo(-100, 55); c.lineTo(1060, 55);
    for (let x = -80; x < 1060; x += 40) {
      c.moveTo(x, 30); c.lineTo(x + 20, 55);
      c.moveTo(x + 20, 30); c.lineTo(x, 55);
    }
    c.stroke();

    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const baseX = 60 + i * 160;
      const sweep = Math.sin(frame * 0.03 + i * 1.2) * 110;
      const spotG = c.createLinearGradient(baseX, 30, baseX + sweep, 425);
      const color = i % 3 === 0 ? 'rgba(35, 215, 239, 0.28)' : i % 3 === 1 ? 'rgba(255, 46, 120, 0.28)' : 'rgba(255, 196, 77, 0.24)';
      spotG.addColorStop(0, color);
      spotG.addColorStop(1, 'rgba(0,0,0,0)');

      c.fillStyle = spotG;
      c.beginPath();
      c.moveTo(baseX - 15, 30);
      c.lineTo(baseX + sweep - 90, 425);
      c.lineTo(baseX + sweep + 90, 425);
      c.lineTo(baseX + 15, 30);
      c.closePath();
      c.fill();
    }
    c.restore();

    for (let side = 0; side < 2; side++) {
      const startX = side === 0 ? -40 : 880;
      for (let stack = 0; stack < 3; stack++) {
        const x = startX + stack * 34;
        const y = 250 + (stack % 2) * 15;
        c.fillStyle = '#110c18';
        c.fillRect(x, y, 92, 125);
        c.strokeStyle = '#322240';
        c.lineWidth = 3;
        c.strokeRect(x, y, 92, 125);

        c.fillStyle = '#221910';
        c.fillRect(x + 8, y + 12, 76, 98);

        c.fillStyle = '#ffc44d';
        c.font = 'bold 9px Inter';
        c.fillText('MARSHALL', x + 22, y + 25);

        c.fillStyle = '#08050c';
        for (let sp = 0; sp < 4; sp++) {
          const cx = x + 26 + (sp % 2) * 40;
          const cy = y + 46 + Math.floor(sp / 2) * 42;
          c.beginPath(); c.arc(cx, cy, 14, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#443252'; c.lineWidth = 1.5; c.stroke();
          c.fillStyle = '#ff2e78';
          c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();
        }
      }
    }

    c.fillStyle = '#050308';
    c.beginPath();
    for (let i = -50; i < 1010; i += 22) {
      const armY = 385 + Math.sin(i * 0.15 + frame * 0.08) * 8;
      c.arc(i, armY, 14, Math.PI, 0);
      c.fillRect(i - 14, armY, 28, 45);
    }
    c.fill();

    crowdLights.forEach(light => {
      light.phase += light.speed;
      const alpha = 0.4 + Math.sin(light.phase) * 0.4;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = light.color;
      c.shadowColor = light.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(light.x, light.y + Math.sin(light.phase * 0.5) * 4, light.size, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });

    const floorG = c.createLinearGradient(0, 420, 0, 540);
    floorG.addColorStop(0, '#2b1035');
    floorG.addColorStop(0.15, '#170921');
    floorG.addColorStop(1, '#07040a');
    c.fillStyle = floorG;
    c.fillRect(-200, 420, 1360, 120);

    c.strokeStyle = 'rgba(255, 46, 120, 0.15)';
    c.lineWidth = 1;
    for (let y = 435; y < 540; y += 18) {
      c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
    }
    for (let x = -100; x <= 1060; x += 80) {
      c.beginPath(); c.moveTo(480, 420); c.lineTo(x, 540); c.stroke();
    }

    c.strokeStyle = '#36dff1';
    c.lineWidth = 3;
    c.shadowColor = '#36dff1';
    c.shadowBlur = 12;
    c.beginPath();
    c.moveTo(-100, 420); c.lineTo(1060, 420);
    c.stroke();
    c.shadowBlur = 0;

    c.save();
    stageFog.forEach(fog => {
      c.fillStyle = `rgba(220, 180, 240, ${fog.alpha})`;
      c.beginPath();
      c.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }

  // --- DYNAMIC TRANSPARENT FIGHTER RENDERER ---
  function drawTransparentSprite(c, f, x, ground, facing = 1, state = 'idle', timer = 0, alpha = 1, flash = 0, motionData = null) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, ground);
    c.scale(facing, 1);

    const frame = motionData?.animFrame || 0;
    const idleBounce = state === 'idle' ? Math.sin(frame * 0.12) * 2.5 : 0;
    const walkShift = state === 'walk' ? Math.sin(frame * 0.35) * 3.8 : 0;
    const crouchShift = state === 'block' ? 18 : 0;
    const squash = motionData?.landSquash ? Math.sin((motionData.landSquash / 8) * Math.PI) * 0.08 : 0;

    c.translate(0, idleBounce - Math.abs(walkShift) * 0.5);
    c.scale(1 + squash, 1 - squash);

    if (flash) { c.shadowColor = '#ffffff'; c.shadowBlur = 35; }
    if (state === 'hit') c.rotate(-0.14);

    const attackDuration = state === 'punch' ? 18 : state === 'kick' ? 25 : state === 'special' ? 55 : 1;
    const phase = timer ? clamp(1 - timer / attackDuration, 0, 1) : 0;
    let action = 0;
    if (phase < 0.18) action = -0.16 * (1 - Math.pow(1 - phase / 0.18, 2));
    else if (phase < 0.43) action = -0.16 + 1.16 * (1 - Math.pow(1 - (phase - 0.18) / 0.25, 3));
    else action = Math.pow(clamp(1 - (phase - 0.43) / 0.57, 0, 1), 2);

    const punchLunge = (state === 'punch' || state === 'special') ? action : 0;
    const kickLunge = state === 'kick' ? action : 0;

    // Drop Shadow
    c.fillStyle = 'rgba(0, 0, 0, 0.65)';
    c.beginPath();
    c.ellipse(kickLunge * 35, 4, 60 + kickLunge * 32, 14, 0, 0, Math.PI * 2);
    c.fill();

    // SELECT TRANSPARENT ACTION POSE SPRITE
    let poseKey = `${f.id}_idle`;
    if (state === 'punch') poseKey = `${f.id}_punch`;
    else if (state === 'kick') poseKey = `${f.id}_kick`;
    else if (state === 'special') poseKey = `${f.id}_special`;

    const poseCanvas = spriteCanvases[poseKey] || spriteCanvases[`${f.id}_idle`];

    c.save();
    if (state === 'punch' || state === 'special') {
      c.translate(punchLunge * 34, -punchLunge * 6);
      c.rotate(-0.06 * punchLunge);
    } else if (state === 'kick') {
      c.translate(kickLunge * 45, -kickLunge * 12);
      c.rotate(-0.1 * kickLunge);
    } else if (state === 'block') {
      c.translate(-10, crouchShift * 0.5);
    }

    if (poseCanvas) {
      const sprW = 180;
      const sprH = 235;
      c.drawImage(poseCanvas, -sprW / 2, -sprH + 14, sprW, sprH);

      // Character Rim Light Highlight
      c.save();
      c.globalCompositeOperation = 'screen';
      c.fillStyle = f.color;
      c.globalAlpha = 0.22;
      c.fillRect(-sprW / 2, -sprH + 14, sprW, sprH);
      c.restore();
    }
    c.restore();

    // SIGNATURE SPECIAL POWER VISUAL EFFECTS (KURT, AXL, LENNON)
    if (f.id === 'kurt' && state === 'special' && punchLunge > 0.25) {
      // Kurt: GUITARRADA SMASH! Explosive Fender Mustang Guitar Lightning Strike
      c.save(); c.globalCompositeOperation = 'screen';
      c.strokeStyle = '#23d7ef'; c.lineWidth = 10; c.shadowColor = '#23d7ef'; c.shadowBlur = 32;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4 + match.frames * 0.2;
        c.moveTo(0, -90);
        c.lineTo(Math.cos(ang) * 190, -90 + Math.sin(ang) * 150);
      }
      c.stroke();
      c.strokeStyle = '#ffc44d'; c.lineWidth = 5; c.stroke();
      c.restore();
    }
    else if (f.id === 'axl' && state === 'special' && punchLunge > 0.25) {
      // Axl: SERPENT MIC-STAND SCREAM! Roaring Flaming Fire Dragon Waves
      c.save(); c.globalCompositeOperation = 'screen';
      c.strokeStyle = '#ff2e78'; c.lineWidth = 14; c.shadowColor = '#ff2e78'; c.shadowBlur = 35;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        c.moveTo(20, -100);
        c.quadraticCurveTo(80 + i * 35, -140 + Math.sin(i * 1.5 + match.frames * 0.4) * 45, 180 + i * 40, -100);
      }
      c.stroke();
      c.strokeStyle = '#ffc44d'; c.lineWidth = 6; c.stroke();
      c.restore();
    }
    else if (f.id === 'lennon' && state === 'special' && punchLunge > 0.25) {
      // Lennon: PEACE & LOVE PULSE! Expanding Emerald Peace Sign Barrier
      c.save(); c.globalCompositeOperation = 'screen';
      c.strokeStyle = '#6acfa0'; c.lineWidth = 12; c.shadowColor = '#6acfa0'; c.shadowBlur = 36;
      c.beginPath();
      const r = 90 + Math.sin(punchLunge * 12) * 35;
      c.arc(0, -100, r, 0, Math.PI * 2);
      c.moveTo(0, -100 - r); c.lineTo(0, -100 + r);
      c.moveTo(0, -100); c.lineTo(-r * 0.7, -100 + r * 0.7);
      c.moveTo(0, -100); c.lineTo(r * 0.7, -100 + r * 0.7);
      c.stroke();
      c.restore();
    }

    // Standard Attack Motion Trail Sparks
    if ((state === 'punch' || state === 'special') && punchLunge > 0.4) {
      c.save(); c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.7 * punchLunge; c.strokeStyle = f.color; c.lineWidth = 8;
      c.shadowColor = f.color; c.shadowBlur = 22;
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.moveTo(40 + punchLunge * 30 - i * 12, -110 + i * 10); c.lineTo(95 + punchLunge * 45, -100 + i * 5); c.stroke();
      }
      c.restore();
    }

    if (state === 'kick' && kickLunge > 0.35) {
      c.save(); c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.75 * kickLunge; c.strokeStyle = f.color; c.lineWidth = 9;
      c.shadowColor = f.color; c.shadowBlur = 22;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(20 - i * 10, -50 + i * 12);
        c.quadraticCurveTo(60 + kickLunge * 30, -80 + i * 4, 110 + kickLunge * 45, -110 + i * 8);
        c.stroke();
      }
      c.restore();
    }

    c.restore();
  }

  function announce(text, duration = 800) {
    const el = $('#announcer'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    sound('announce');
    setTimeout(() => el.classList.remove('show'), duration);
  }

  function drawEffects() {
    const players = [match.p1, match.p2];
    players.forEach(p => {
      if (p.attack?.type === 'special' && p.attackTimer > 8) {
        const life = p.attackTimer / 55;
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.8 * life;
        const x = p.x + p.facing * 85; const y = p.y - 85;
        ctx.strokeStyle = p.data.color; ctx.lineWidth = 14; ctx.shadowColor = p.data.color; ctx.shadowBlur = 34;
        ctx.beginPath();
        for (let r = 20; r < 180; r += 32) { ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.stroke(); ctx.restore();
      }

      if (p.combo > 1 && p.comboTimer > 0) {
        ctx.save();
        ctx.fillStyle = p.data.color;
        ctx.font = 'italic 900 38px "Barlow Condensed"';
        ctx.textAlign = 'center';
        ctx.shadowColor = p.data.color;
        ctx.shadowBlur = 12;
        ctx.fillText(`${p.combo} HIT COMBO!`, p.x, p.y - 185);
        ctx.restore();
      }
    });

    match.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life / 38;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      const mag = Math.hypot(p.vx, p.vy) || 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / mag * p.length, p.y - p.vy / mag * p.length); ctx.stroke();
      ctx.restore();
    });

    match.impacts.forEach(impact => {
      const progress = impact.life / 38;
      ctx.save();
      ctx.translate(impact.x, impact.y);
      ctx.rotate(-0.09);
      ctx.scale(1 + (1 - progress) * 0.28, 1 + (1 - progress) * 0.28);
      ctx.font = 'italic 900 42px "Barlow Condensed"';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#0a040b';
      ctx.strokeText(impact.text, 0, 0);
      ctx.fillStyle = impact.color;
      ctx.shadowColor = impact.color;
      ctx.shadowBlur = 14;
      ctx.fillText(impact.text, 0, 0);
      ctx.restore();
    });
  }

  function endMatch() {
    if (match.ended) return;
    match.ended = true;
    const winner = match.p1.health === match.p2.health ? match.p1 : (match.p1.health > match.p2.health ? match.p1 : match.p2);
    announce('K.O.!', 1000);
    sound('special', 0.45);
    sound('crowd');
    setTimeout(() => {
      $('#result-kicker').textContent = match.timer <= 0 ? 'TIME OVER' : 'KNOCKOUT';
      $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU!</em>`;
      $('#result-quote').textContent = `“${winner.data.quote}”`;
      const portrait = $('#winner-portrait'); portrait.innerHTML = '';
      portrait.style.setProperty('--portrait-image', `url("assets/${winner.data.portrait}")`);
      showScreen('result-screen');
    }, 1000);
  }

  // --- INPUT CONTROLS ---
  document.addEventListener('keydown', e => {
    const gameKeys = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyR', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
      if (!keys[e.code]) keys[e.code] = 1;
    }
    if (e.code === 'Escape' && !$('#how-modal').hidden) closeHow();
    else if (e.code === 'Escape' && match && !match.ended) togglePause();
  });

  document.addEventListener('keyup', e => { keys[e.code] = 0; });

  document.querySelectorAll('[data-touch]').forEach(btn => {
    const map = { left: 'KeyA', right: 'KeyD', jump: 'KeyW', block: 'KeyS', punch: 'KeyQ', kick: 'KeyE', special: 'KeyR' };
    const key = map[btn.dataset.touch];
    const down = e => { e.preventDefault(); initAudio(); touch[key] = 1; btn.classList.add('is-down'); };
    const up = e => { e.preventDefault(); touch[key] = 0; btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  function togglePause(force) {
    if (!match) return;
    match.paused = typeof force === 'boolean' ? force : !match.paused;
    $('#pause-modal').hidden = !match.paused;
    if (!match.paused && !match.ended) { lastFrameTime = 0; accumulator = 0; raf = requestAnimationFrame(loop); }
  }

  function openHow() {
    $('#how-modal').hidden = false;
    $('#close-how').focus();
  }

  function closeHow() {
    $('#how-modal').hidden = true;
    $('#how-to-play').focus();
  }

  $('#enter-game').addEventListener('click', () => { initAudio(); sound('ui', 1.5); showScreen('select-screen'); });
  $('#back-to-hero').addEventListener('click', () => showScreen('hero-screen'));
  $('#start-fight').addEventListener('click', startMatch);
  $('#rematch').addEventListener('click', startMatch);
  $('#change-fighter').addEventListener('click', () => { pick1 = null; pick2 = null; updatePicks(); showScreen('select-screen'); });
  $('#pause-btn').addEventListener('click', () => togglePause());
  $('#resume').addEventListener('click', () => togglePause(false));
  $('#quit-fight').addEventListener('click', () => { match.ended = true; $('#pause-modal').hidden = true; showScreen('select-screen'); });
  $('#sound-toggle').addEventListener('click', e => { muted = !muted; e.currentTarget.textContent = `SOM: ${muted ? 'OFF' : 'ON'}`; if (!muted) { initAudio(); sound('ui'); } });
  $('#how-to-play').addEventListener('click', openHow);
  $('#open-guide-arena').addEventListener('click', openHow);
  $('#close-how').addEventListener('click', closeHow);
  $('#how-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeHow(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && match && !match.ended && !match.paused) togglePause(true);
  });
})();
