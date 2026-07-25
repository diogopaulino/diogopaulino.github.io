(() => {
  'use strict';

  const fighters = [
    { id:'kurt', name:'Kurt Cobain', short:'KURT', era:'Grunge Rebel', special:'Feedback Avalanche', quote:'Melhor que queimar o palco.', color:'#e8d574', accent:'#49684e', hair:'#d8bf79', outfit:'#394b38', skin:'#e2b48e', power:4, speed:4, defense:3, style:'grunge', portrait:'portrait-kurt-v2.jpg' },
    { id:'axl', name:'Axl Rose', short:'AXL', era:'Sunset Wildcard', special:'Serpent Scream', quote:'Você quis o melhor? Agora aguenta.', color:'#ff435f', accent:'#8e183a', hair:'#b72b27', outfit:'#17141b', skin:'#e6ae80', power:4, speed:5, defense:2, style:'glam', portrait:'portrait-axl-v2.jpg' },
    { id:'slash', name:'Slash', short:'SLASH', era:'Top Hat Shredder', special:'Inferno Solo', quote:'O solo sempre fala mais alto.', color:'#f0a52e', accent:'#4a2411', hair:'#161216', outfit:'#171315', skin:'#b9784f', power:5, speed:3, defense:3, style:'hat', portrait:'portrait-slash-v2.jpg' },
    { id:'freddie', name:'Freddie Mercury', short:'FREDDIE', era:'Stadium Royalty', special:'Royal Rhapsody', quote:'A plateia sabe quem manda.', color:'#f4d24c', accent:'#ece8d9', hair:'#151216', outfit:'#eee9dc', skin:'#c98d66', power:4, speed:3, defense:5, style:'royal', portrait:'portrait-freddie-v2.jpg' },
    { id:'hendrix', name:'Jimi Hendrix', short:'HENDRIX', era:'Electric Voodoo', special:'Purple Haze', quote:'A eletricidade estava no ar.', color:'#9c66ff', accent:'#e14d9a', hair:'#171217', outfit:'#694090', skin:'#855635', power:5, speed:4, defense:2, style:'psychedelic', portrait:'portrait-hendrix-v2.jpg' },
    { id:'bowie', name:'David Bowie', short:'BOWIE', era:'Starman', special:'Ziggy Stardust', quote:'Há uma estrela esperando no céu.', color:'#48c9ef', accent:'#f63c55', hair:'#df5b32', outfit:'#237ba0', skin:'#e1b28e', power:3, speed:5, defense:3, style:'starman', portrait:'portrait-bowie-v2.jpg' },
    { id:'lennon', name:'John Lennon', short:'LENNON', era:'The Dreamer', special:'Peace Pulse', quote:'Dê uma chance ao contra-ataque.', color:'#6acfa0', accent:'#27463a', hair:'#34251e', outfit:'#314d3f', skin:'#e1b08a', power:3, speed:3, defense:5, style:'moptop', portrait:'portrait-lennon-v2.jpg' },
    { id:'janis', name:'Janis Joplin', short:'JANIS', era:'Cosmic Blues', special:'Pearl Howl', quote:'Viva cada round como o último.', color:'#ef6cae', accent:'#8b3972', hair:'#8b5229', outfit:'#713866', skin:'#e4af85', power:4, speed:3, defense:4, style:'wild', portrait:'portrait-janis-v2.jpg' }
  ];

  const screens = [...document.querySelectorAll('.screen')];
  const roster = document.querySelector('#roster');
  const gameCanvas = document.querySelector('#game');
  const ctx = gameCanvas.getContext('2d');
  const keys = {};
  const touch = {};
  let mode = 'cpu';
  let pick1 = null;
  let pick2 = null;
  let muted = false;
  let audio = null;
  let match = null;
  let raf = 0;

  const $ = (selector) => document.querySelector(selector);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initAudio() {
    if (muted) return;
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  }

  function sound(type, pitch = 1) {
    if (muted) return;
    initAudio();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    osc.type = type === 'special' ? 'sawtooth' : type === 'hit' ? 'square' : 'triangle';
    osc.frequency.setValueAtTime((type === 'hit' ? 90 : type === 'special' ? 150 : 280) * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(type === 'special' ? 45 : 35, now + (type === 'special' ? .6 : .16));
    gain.gain.setValueAtTime(type === 'special' ? .12 : .07, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (type === 'special' ? .65 : .18));
    filter.type = 'lowpass';
    filter.frequency.value = type === 'special' ? 2600 : 900;
    osc.connect(filter).connect(gain).connect(audio.destination);
    osc.start(now); osc.stop(now + .7);
  }

  function makePortraitCanvas(fighter, size = 220) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    drawFighter(canvas.getContext('2d'), fighter, size / 2, size * .93, 1, size / 260, 'idle', 0, true);
    return canvas;
  }

  function stat(label, value) {
    return `<div class="stats"><b>${label}</b><span class="stat-dots">${[1,2,3,4,5].map(i => `<i class="${i <= value ? 'on' : ''}"></i>`).join('')}</span></div>`;
  }

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
    if (!pick1 || (mode === 'cpu' && pick1)) {
      pick1 = fighter;
      if (mode === 'cpu') {
        const others = fighters.filter(f => f.id !== fighter.id);
        pick2 = others[Math.floor(Math.random() * others.length)];
      }
    } else if (mode === 'local' && !pick2) {
      pick2 = fighter.id === pick1.id ? null : fighter;
    } else {
      pick1 = fighter;
      pick2 = mode === 'cpu' ? fighters.filter(f => f.id !== fighter.id)[Math.floor(Math.random() * 7)] : null;
    }
    updatePicks();
  }

  function updatePicks() {
    document.querySelectorAll('.fighter-card').forEach(card => {
      card.classList.toggle('is-p1', pick1?.id === card.dataset.id);
      card.classList.toggle('is-p2', pick2?.id === card.dataset.id);
    });
    $('#p1-pick strong').textContent = pick1 ? pick1.name : 'ESCOLHA';
    $('#p2-pick strong').textContent = pick2 ? pick2.name : (mode === 'cpu' ? 'ALEATÓRIO' : 'ESCOLHA');
    $('#start-fight').disabled = !(pick1 && pick2);
  }

  class Player {
    constructor(data, x, facing, controls, isCpu = false) {
      this.data = data; this.x = x; this.y = 430; this.vx = 0; this.vy = 0;
      this.facing = facing; this.controls = controls; this.cpu = isCpu;
      this.health = 100; this.meter = 15; this.width = 62; this.height = 150;
      this.grounded = true; this.attack = null; this.attackTimer = 0; this.cooldown = 0;
      this.hitFlash = 0; this.stun = 0; this.blocking = false; this.aiTimer = 0;
      this.afterimages = []; this.combo = 0; this.comboTimer = 0;
    }
    input(other) {
      if (this.stun > 0) return { left:false,right:false,jump:false,block:false };
      if (!this.cpu) {
        const c = this.controls;
        return {
          left: !!(keys[c.left] || touch[c.left]),
          right: !!(keys[c.right] || touch[c.right]),
          jump: !!(keys[c.jump] || touch[c.jump]),
          block: !!(keys[c.block] || touch[c.block]),
          punch: consume(c.punch), kick: consume(c.kick), special: consume(c.special)
        };
      }
      this.aiTimer--;
      const distance = Math.abs(other.x - this.x);
      const input = { left:false,right:false,jump:false,block:false,punch:false,kick:false,special:false };
      if (other.attack && distance < 115 && Math.random() < .16) input.block = true;
      if (distance > 96) input[other.x < this.x ? 'left' : 'right'] = true;
      if (distance < 135 && this.cooldown <= 0 && this.aiTimer <= 0) {
        if (this.meter >= 100 && Math.random() < .35) input.special = true;
        else input[Math.random() < .5 ? 'punch' : 'kick'] = true;
        this.aiTimer = rand(22, 48);
      }
      if (distance > 220 && Math.random() < .006) input.jump = true;
      return input;
    }
    update(other) {
      if (this.cooldown > 0) this.cooldown--;
      if (this.hitFlash > 0) this.hitFlash--;
      if (this.stun > 0) this.stun--;
      if (this.comboTimer > 0) this.comboTimer--; else this.combo = 0;
      const input = this.input(other);
      this.blocking = input.block && this.grounded && !this.attack;
      const speed = 3.2 + this.data.speed * .23;
      if (!this.attack && !this.blocking && this.stun <= 0) {
        if (input.left) this.vx = -speed;
        else if (input.right) this.vx = speed;
        else this.vx *= .68;
        if (input.jump && this.grounded) { this.vy = -12.6; this.grounded = false; sound('ui', .65); }
        if (input.punch) this.startAttack('punch');
        else if (input.kick) this.startAttack('kick');
        else if (input.special && this.meter >= 100) this.startAttack('special');
      }
      this.vy += .72;
      this.x += this.vx; this.y += this.vy;
      if (this.y >= 430) { this.y = 430; this.vy = 0; this.grounded = true; }
      this.x = clamp(this.x, 60, 900);
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
        punch:{duration:18,activeAt:10,range:92,damage:5 + this.data.power*.7,knock:3},
        kick:{duration:25,activeAt:14,range:112,damage:8 + this.data.power,knock:5},
        special:{duration:48,activeAt:33,range:this.data.style === 'royal' ? 180 : 245,damage:17 + this.data.power*1.2,knock:10}
      }[type];
      this.attack = { type, ...config, hit:false };
      this.attackTimer = config.duration;
      this.cooldown = type === 'special' ? 58 : config.duration + 3;
      if (type === 'special') {
        this.meter = 0;
        this.afterimages.push({x:this.x-16*this.facing,y:this.y,life:22});
        announce(this.data.special.toUpperCase(), 650);
        sound('special', 1 + this.data.speed*.05);
        if (this.data.style === 'starman') this.x = clamp(otherSide(this.x, this.facing), 70, 890);
        if (this.data.style === 'royal') this.health = clamp(this.health + 7, 0, 100);
      } else sound('ui', type === 'kick' ? .7 : 1);
    }
    checkHit(other) {
      const reach = this.attack.range;
      const inFront = (other.x - this.x) * this.facing > -20;
      const distance = Math.abs(other.x - this.x);
      const vertical = Math.abs(other.y - this.y) < 105;
      if (inFront && distance < reach && vertical) {
        this.attack.hit = true;
        let damage = this.attack.damage;
        if (other.blocking) damage *= .22;
        other.health = clamp(other.health - damage, 0, 100);
        other.hitFlash = 8;
        other.stun = other.blocking ? 5 : this.attack.type === 'special' ? 25 : 11;
        other.vx = this.attack.knock * this.facing * (other.blocking ? .35 : 1);
        if (this.attack.type === 'special') other.vy = -5;
        this.meter = clamp(this.meter + (this.attack.type === 'special' ? 0 : 14), 0, 100);
        other.meter = clamp(other.meter + 9, 0, 100);
        this.combo++; this.comboTimer = 60;
        match.shake = this.attack.type === 'special' ? 14 : 5;
        match.flash = this.attack.type === 'special' ? 6 : 2;
        burst((this.x + other.x)/2, other.y - 80, this.data.color, this.attack.type === 'special' ? 28 : 12);
        sound('hit', this.attack.type === 'special' ? .55 : .9);
      }
    }
  }

  function otherSide(x, facing) { return x + facing * 130; }
  function consume(key) {
    if (keys[key] === 1 || touch[key] === 1) {
      if (keys[key]) keys[key] = 2;
      if (touch[key]) touch[key] = 2;
      return true;
    }
    return false;
  }

  function startMatch() {
    if (!pick1 || !pick2) return;
    initAudio();
    showScreen('arena-screen');
    $('#p1-name').textContent = pick1.short;
    $('#p2-name').textContent = pick2.short;
    $('#opponent-label').textContent = mode === 'cpu' ? 'CPU' : 'P2';
    $('#p2-controls').hidden = mode === 'cpu';
    match = {
      p1:new Player(pick1, 260, 1, {left:'KeyA',right:'KeyD',jump:'KeyW',block:'KeyS',punch:'KeyF',kick:'KeyG',special:'KeyH'}),
      p2:new Player(pick2, 700, -1, {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',block:'ArrowDown',punch:'KeyJ',kick:'KeyK',special:'KeyL'}, mode === 'cpu'),
      timer:60, frames:0, state:'intro', intro:150, particles:[], shake:0, flash:0, ended:false, paused:false
    };
    announce('ROUND 1', 800);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function burst(x, y, color, count) {
    for (let i=0;i<count;i++) match.particles.push({x,y,vx:rand(-7,7),vy:rand(-8,2),life:rand(15,35),color,size:rand(2,7)});
  }

  function update() {
    if (!match || match.paused || match.ended) return;
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
    match.particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=.35; p.life--; });
    match.particles = match.particles.filter(p => p.life > 0);
    if (match.shake > 0) match.shake *= .76;
    if (match.flash > 0) match.flash--;
    updateHud();
  }

  function updateHud() {
    $('#p1-health').style.transform = `scaleX(${match.p1.health/100})`;
    $('#p2-health').style.transform = `scaleX(${match.p2.health/100})`;
    $('#p1-meter').style.width = `${match.p1.meter}%`;
    $('#p2-meter').style.width = `${match.p2.meter}%`;
    $('#timer').textContent = String(Math.max(0, match.timer)).padStart(2,'0');
  }

  function loop() {
    update();
    draw();
    if (match && !match.ended) raf = requestAnimationFrame(loop);
  }

  function draw() {
    if (!match) return;
    ctx.save();
    const shakeX = match.shake ? rand(-match.shake, match.shake) : 0;
    const shakeY = match.shake ? rand(-match.shake*.5, match.shake*.5) : 0;
    ctx.translate(shakeX, shakeY);
    drawStage(ctx, match.frames);
    match.p1.afterimages.forEach(a => drawFighter(ctx,match.p1.data,a.x,a.y,match.p1.facing,1,match.p1.attack?.type||'idle',match.p1.attackTimer,false,.15*a.life/22));
    match.p2.afterimages.forEach(a => drawFighter(ctx,match.p2.data,a.x,a.y,match.p2.facing,1,match.p2.attack?.type||'idle',match.p2.attackTimer,false,.15*a.life/22));
    drawFighter(ctx, match.p1.data, match.p1.x, match.p1.y, match.p1.facing, 1, match.p1.blocking?'block':match.p1.attack?.type||(!match.p1.grounded?'jump':'idle'), match.p1.attackTimer, false, 1, match.p1.hitFlash);
    drawFighter(ctx, match.p2.data, match.p2.x, match.p2.y, match.p2.facing, 1, match.p2.blocking?'block':match.p2.attack?.type||(!match.p2.grounded?'jump':'idle'), match.p2.attackTimer, false, 1, match.p2.hitFlash);
    drawEffects();
    ctx.restore();
    if (match.flash) { ctx.fillStyle=`rgba(255,255,255,${match.flash/9})`; ctx.fillRect(0,0,960,540); }
  }

  function drawStage(c, frame) {
    const g = c.createLinearGradient(0,0,0,540);
    g.addColorStop(0,'#080718'); g.addColorStop(.55,'#2b0933'); g.addColorStop(1,'#09070d');
    c.fillStyle=g; c.fillRect(-20,-20,1000,580);
    c.globalAlpha=.34;
    for (let i=0;i<6;i++) {
      const x=90+i*160;
      const beam=c.createLinearGradient(x,0,x+(i%2?150:-150),390);
      beam.addColorStop(0,i%2?'#23d7ef':'#ff2e78'); beam.addColorStop(1,'transparent');
      c.fillStyle=beam; c.beginPath(); c.moveTo(x,0); c.lineTo(x-70,430); c.lineTo(x+120,430); c.closePath(); c.fill();
    }
    c.globalAlpha=1;
    c.fillStyle='#130c18'; c.fillRect(0,332,960,108);
    for(let i=0;i<9;i++) {
      c.fillStyle=i%2?'#251329':'#1b1120'; c.fillRect(i*116,272+(i%2)*20,92,86);
      c.fillStyle='#e02b72'; for(let j=0;j<4;j++){c.beginPath();c.arc(i*116+23+(j%2)*44,296+Math.floor(j/2)*35,13,0,Math.PI*2);c.fill();}
    }
    c.strokeStyle='#36dff1'; c.lineWidth=3; c.shadowColor='#36dff1'; c.shadowBlur=10; c.beginPath();
    for(let x=0;x<=960;x+=12){const y=188+Math.sin(x*.03+frame*.06)*9+Math.sin(x*.09)*5;c.lineTo(x,y);} c.stroke(); c.shadowBlur=0;
    const floor=c.createLinearGradient(0,420,0,540); floor.addColorStop(0,'#361039');floor.addColorStop(1,'#09070d');c.fillStyle=floor;c.fillRect(0,420,960,120);
    c.strokeStyle='rgba(255,71,151,.18)';c.lineWidth=1;
    for(let y=438;y<540;y+=19){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
    for(let x=0;x<960;x+=80){c.beginPath();c.moveTo(480,420);c.lineTo(x,540);c.stroke();}
    c.fillStyle='#050407';
    for(let i=0;i<24;i++){const x=i*43+(i%3)*7;c.beginPath();c.arc(x,402+(i%2)*7,18,Math.PI,0);c.fill();c.fillRect(x-18,402,36,38);}
  }

  function drawEffects() {
    const players=[match.p1,match.p2];
    players.forEach(p => {
      if (p.attack?.type === 'special' && p.attackTimer > 10) {
        const life=p.attackTimer/48;
        ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=.7*life;
        const x=p.x+p.facing*75; const y=p.y-82;
        ctx.strokeStyle=p.data.color;ctx.lineWidth=10;ctx.shadowColor=p.data.color;ctx.shadowBlur=25;
        ctx.beginPath();
        if(p.data.style==='psychedelic'){for(let r=15;r<150;r+=28){ctx.arc(x,y,r,0,Math.PI*2);}}
        else if(p.data.style==='starman'){for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*130,y+Math.sin(a)*130);}}
        else {ctx.moveTo(p.x+p.facing*25,y);for(let i=0;i<8;i++)ctx.lineTo(x+p.facing*i*24,y+Math.sin(i*2.4+match.frames*.3)*22);}
        ctx.stroke();ctx.restore();
      }
      if(p.combo>1 && p.comboTimer>0){ctx.fillStyle=p.data.color;ctx.font='italic 900 34px Barlow Condensed';ctx.textAlign='center';ctx.fillText(`${p.combo} HIT!`,p.x,p.y-175);}
    });
    match.particles.forEach(p=>{ctx.globalAlpha=p.life/35;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;});
  }

  function drawFighter(c, f, x, ground, facing=1, scale=1, state='idle', timer=0, portrait=false, alpha=1, flash=0) {
    c.save(); c.globalAlpha=alpha; c.translate(x,ground); c.scale(facing*scale,scale);
    if (portrait) c.translate(0,4);
    const bob=state==='idle'?Math.sin(Date.now()/180)*2:0;
    c.translate(0,bob);
    if (flash) { c.shadowColor='#fff'; c.shadowBlur=22; }
    c.lineCap='round'; c.lineJoin='round'; c.lineWidth=5; c.strokeStyle='#08060b';
    const attackProgress=timer?timer/48:0;
    const armReach=(state==='punch'||state==='special')?70+(state==='special'?30:0):25;
    const kickReach=state==='kick'?68:18;
    const crouch=state==='block'?18:0;
    c.fillStyle='#0a070d';c.beginPath();c.ellipse(0,2,48,10,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#08060b';c.lineWidth=18;
    c.beginPath();c.moveTo(-16,-64+crouch);c.lineTo(-25-kickReach,-5);c.stroke();
    c.beginPath();c.moveTo(15,-64+crouch);c.lineTo(27+(state==='kick'?kickReach:0),-5-(state==='kick'?45:0));c.stroke();
    const pantsShade=c.createLinearGradient(-35,-70,35,0);pantsShade.addColorStop(0,'#09070b');pantsShade.addColorStop(.45,f.outfit);pantsShade.addColorStop(1,'#050406');
    c.strokeStyle=pantsShade;c.lineWidth=13;
    c.beginPath();c.moveTo(-16,-64+crouch);c.lineTo(-25-kickReach,-5);c.stroke();
    c.beginPath();c.moveTo(15,-64+crouch);c.lineTo(27+(state==='kick'?kickReach:0),-5-(state==='kick'?45:0));c.stroke();
    const bodyShade=c.createLinearGradient(-42,-130,42,-70);bodyShade.addColorStop(0,'#08070a');bodyShade.addColorStop(.45,f.outfit);bodyShade.addColorStop(1,f.accent);
    c.fillStyle=bodyShade;c.beginPath();c.moveTo(-38,-126+crouch);c.quadraticCurveTo(0,-145+crouch,38,-124+crouch);c.lineTo(30,-59+crouch);c.lineTo(-30,-59+crouch);c.closePath();c.fill();c.stroke();
    c.globalAlpha*=.45;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(-22,-125+crouch);c.quadraticCurveTo(-30,-94+crouch,-20,-64+crouch);c.stroke();c.globalAlpha=alpha;
    if(f.style==='grunge'){c.strokeStyle='#121515';c.lineWidth=7;for(let y=-117;y<-75;y+=14){c.beginPath();c.moveTo(-32,y+crouch);c.lineTo(32,y+crouch);c.stroke();}}
    if(f.style==='royal'){c.strokeStyle='#d7b93e';c.lineWidth=4;c.beginPath();c.moveTo(-25,-120);c.lineTo(0,-74);c.lineTo(25,-120);c.stroke();}
    if(f.style==='psychedelic'){c.fillStyle='#e14d9a';for(let i=0;i<5;i++){c.beginPath();c.arc(-24+i*12,-105+(i%2)*14,5,0,Math.PI*2);c.fill();}}
    const skinShade=c.createLinearGradient(-70,-135,75,-70);skinShade.addColorStop(0,'#6a3429');skinShade.addColorStop(.48,f.skin);skinShade.addColorStop(1,'#f4cfaa');
    c.strokeStyle=skinShade;c.lineWidth=16;
    c.beginPath();c.moveTo(-26,-116+crouch);c.lineTo(-35-armReach*(state==='block'?.2:1),-75+(state==='block'?-28:0));c.stroke();
    c.beginPath();c.moveTo(27,-116+crouch);c.lineTo(29+armReach,-78-(state==='special'?18:0));c.stroke();
    c.fillStyle=skinShade;c.strokeStyle='#08060b';c.lineWidth=5;c.beginPath();c.moveTo(-24,-175+crouch);c.quadraticCurveTo(-30,-151+crouch,-17,-132+crouch);c.quadraticCurveTo(0,-123+crouch,18,-133+crouch);c.quadraticCurveTo(29,-151+crouch,23,-176+crouch);c.quadraticCurveTo(0,-193+crouch,-24,-175+crouch);c.fill();c.stroke();
    c.fillStyle=f.hair;
    if(f.style==='hat'){
      c.fillStyle='#111';c.fillRect(-39,-204,78,18);c.fillRect(-28,-257,56,58);c.strokeRect(-39,-204,78,18);c.strokeRect(-28,-257,56,58);
      c.fillStyle=f.hair;for(let i=0;i<9;i++){c.beginPath();c.arc(-34+i*9,-161+(i%3)*9,15,0,Math.PI*2);c.fill();}
    } else if(f.style==='moptop'){
      c.beginPath();c.arc(0,-175,33,Math.PI,Math.PI*2);c.lineTo(28,-160);c.quadraticCurveTo(0,-177,-29,-158);c.fill();
    } else {
      c.beginPath();c.arc(0,-180,31,Math.PI,Math.PI*2);c.lineTo(31,-164);
      const longHair=['grunge','glam','wild'].includes(f.style);
      c.quadraticCurveTo(38,-115,22,-90);c.lineTo(12,longHair?-105:-153);c.quadraticCurveTo(-8,-139,-24,longHair?-96:-151);c.quadraticCurveTo(-39,-130,-31,-164);c.fill();
      if(f.style==='wild'){for(let i=0;i<7;i++){c.strokeStyle=f.hair;c.lineWidth=8;c.beginPath();c.moveTo(-28+i*9,-176);c.quadraticCurveTo(-55+i*15,-135,-38+i*13,-94);c.stroke();}}
    }
    c.strokeStyle='#4a241f';c.lineWidth=2;c.beginPath();c.moveTo(2,-164+crouch);c.quadraticCurveTo(8,-153+crouch,1,-150+crouch);c.stroke();
    c.fillStyle='#111';c.beginPath();c.ellipse(-9,-162+crouch,4,2.5,0,0,Math.PI*2);c.ellipse(11,-161+crouch,4,2.5,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#3b1b1b';c.lineWidth=2;c.beginPath();c.moveTo(-9,-141+crouch);c.quadraticCurveTo(1,-136+crouch,12,-142+crouch);c.stroke();
    c.globalAlpha*=.32;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(-14,-176+crouch);c.quadraticCurveTo(-22,-156+crouch,-13,-144+crouch);c.stroke();c.globalAlpha=alpha;
    if(f.style==='royal'){c.fillStyle='#2a1513';c.fillRect(-12,-143,24,5);}
    if(f.style==='starman'){c.strokeStyle='#f63c55';c.lineWidth=5;c.beginPath();c.moveTo(-10,-183);c.lineTo(12,-164);c.lineTo(-4,-145);c.stroke();}
    if(f.style==='moptop'){c.strokeStyle='#111';c.lineWidth=4;c.beginPath();c.arc(-9,-159,9,0,Math.PI*2);c.arc(10,-159,9,0,Math.PI*2);c.moveTo(0,-159);c.lineTo(2,-159);c.stroke();}
    if(f.style==='glam'){c.strokeStyle='#e5b3b6';c.lineWidth=5;c.beginPath();c.moveTo(-25,-180);c.lineTo(25,-180);c.stroke();}
    c.strokeStyle=f.color;c.globalAlpha*=.45;c.lineWidth=2;
    for(let i=0;i<5;i++){c.beginPath();c.moveTo(-23+i*11,-182+crouch);c.quadraticCurveTo(-30+i*13,-153+crouch,-22+i*12,-119+crouch);c.stroke();}
    c.globalAlpha=alpha;
    if(state==='special'){c.globalCompositeOperation='screen';c.strokeStyle=f.color;c.lineWidth=4;c.shadowColor=f.color;c.shadowBlur=18;c.beginPath();c.arc(0,-115,65+Math.sin(attackProgress*12)*8,0,Math.PI*2);c.stroke();}
    c.restore();
  }

  function announce(text, duration=800) {
    const el=$('#announcer'); el.textContent=text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),duration);
  }

  function endMatch() {
    if (match.ended) return;
    match.ended=true;
    const winner = match.p1.health === match.p2.health ? match.p1 : (match.p1.health > match.p2.health ? match.p1 : match.p2);
    announce('K.O.!', 1000);
    sound('special', .45);
    setTimeout(() => {
      $('#result-kicker').textContent = match.timer <= 0 ? 'TIME OVER' : 'KNOCKOUT';
      $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU!</em>`;
      $('#result-quote').textContent = `“${winner.data.quote}”`;
      const portrait=$('#winner-portrait');portrait.innerHTML='';
      portrait.style.setProperty('--portrait-image', `url("assets/${winner.data.portrait}")`);
      showScreen('result-screen');
    }, 1000);
  }

  document.addEventListener('keydown', e => {
    const gameKeys=['KeyA','KeyD','KeyW','KeyS','KeyF','KeyG','KeyH','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyJ','KeyK','KeyL'];
    if(gameKeys.includes(e.code)){e.preventDefault();if(!keys[e.code])keys[e.code]=1;}
    if(e.code==='Escape' && !$('#how-modal').hidden) closeHow();
    else if(e.code==='Escape' && match && !match.ended) togglePause();
  });
  document.addEventListener('keyup', e => { keys[e.code]=0; });
  document.querySelectorAll('[data-touch]').forEach(btn => {
    const map={left:'KeyA',right:'KeyD',jump:'KeyW',block:'KeyS',punch:'KeyF',kick:'KeyG',special:'KeyH'};
    const key=map[btn.dataset.touch];
    const down=e=>{e.preventDefault();initAudio();touch[key]=1;btn.classList.add('is-down');};
    const up=e=>{e.preventDefault();touch[key]=0;btn.classList.remove('is-down');};
    btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);
  });

  function togglePause(force) {
    if(!match) return;
    match.paused = typeof force === 'boolean' ? force : !match.paused;
    $('#pause-modal').hidden=!match.paused;
    if(!match.paused && !match.ended) raf=requestAnimationFrame(loop);
  }

  function openHow() {
    $('#how-modal').hidden=false;
    $('#close-how').focus();
  }

  function closeHow() {
    $('#how-modal').hidden=true;
    $('#how-to-play').focus();
  }

  $('#enter-game').addEventListener('click',()=>{initAudio();sound('ui',1.5);showScreen('select-screen');});
  $('#back-to-hero').addEventListener('click',()=>showScreen('hero-screen'));
  $('#start-fight').addEventListener('click',startMatch);
  $('#rematch').addEventListener('click',startMatch);
  $('#change-fighter').addEventListener('click',()=>{pick1=null;pick2=null;updatePicks();showScreen('select-screen');});
  $('#pause-btn').addEventListener('click',()=>togglePause());
  $('#resume').addEventListener('click',()=>togglePause(false));
  $('#quit-fight').addEventListener('click',()=>{match.ended=true;$('#pause-modal').hidden=true;showScreen('select-screen');});
  $('#sound-toggle').addEventListener('click',e=>{muted=!muted;e.currentTarget.textContent=`SOM: ${muted?'OFF':'ON'}`;if(!muted){initAudio();sound('ui');}});
  $('#how-to-play').addEventListener('click',openHow);
  $('#close-how').addEventListener('click',closeHow);
  $('#how-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeHow();});
  document.querySelectorAll('.mode-btn').forEach(btn=>btn.addEventListener('click',()=>{
    mode=btn.dataset.mode;pick1=null;pick2=null;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('is-active',b===btn));
    $('#p2-pick .player-tag').textContent=mode==='cpu'?'CPU':'PLAYER 2';updatePicks();
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden && match && !match.ended && !match.paused)togglePause(true);});
})();
