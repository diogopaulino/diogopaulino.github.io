/* ==========================================================================
   Ravi 1·2·3: A Grande Festa Surpresa - Lógica Principal
   ========================================================================== */

(function () {
  'use strict';

  var S = {
    scene: 0,
    sheep: 0,
    toys: 0,
    candies: 0,
    animating: false
  };

  var scenes = ['scene-intro', 'scene-dream', 'scene-factory', 'scene-market', 'scene-party'];
  var prompts = [
    'Ravi 1·2·3',
    'Quantos carneirinhos Ravi vai contar?',
    'Quantos presentes vamos fazer?',
    'Quantos doces deliciosos?',
    'A Grande Festa Surpresa!'
  ];

  var els = {
    scenes: scenes.map(id => document.getElementById(id)),
    prompt: document.getElementById('prompt-text'),
    numpad: document.getElementById('number-pad'),
    sheepContainer: document.getElementById('sheep-container'),
    toysContainer: document.getElementById('toys-container'),
    candiesContainer: document.getElementById('candies-container'),
    partyItems: document.getElementById('party-items-container'),
    confetti: document.getElementById('confetti-container')
  };

  function setScene(index) {
    S.scene = index;
    S.animating = false;
    els.scenes.forEach((el, i) => {
      if(i === index) el.classList.add('active');
      else el.classList.remove('active');
    });

    els.prompt.textContent = prompts[index];
    
    // Show/hide numpad
    if(index === 0 || index === scenes.length - 1) {
      els.numpad.classList.add('hidden');
    } else {
      els.numpad.classList.remove('hidden');
    }

    if(index === scenes.length - 1) {
      startParty();
    }
  }

  function handleNumber(num) {
    if(S.animating) return;
    
    if(S.scene === 0) {
      GameAudio.init();
      GameAudio.playMagic();
      setScene(1);
      return;
    }
    
    if(S.scene === scenes.length - 1) return; // Party scene

    S.animating = true;
    els.numpad.classList.add('hidden');

    if(S.scene === 1) playDream(num);
    else if(S.scene === 2) playFactory(num);
    else if(S.scene === 3) playMarket(num);
  }

  function playDream(num) {
    S.sheep = num;
    var i = 0;
    
    function next() {
      if(i >= num) {
        setTimeout(() => setScene(2), 1500);
        return;
      }
      var s = document.createElement('div');
      s.className = 'sheep';
      s.textContent = '🐑';
      s.style.animation = 'sheepJump 1.5s ease-in-out forwards';
      els.sheepContainer.appendChild(s);
      
      setTimeout(() => {
        GameAudio.playNote(i);
      }, 300); // sync with jump peak

      i++;
      setTimeout(next, 800);
    }
    next();
  }

  function playFactory(num) {
    S.toys = num;
    var i = 0;
    var toysList = ['🎁', '🧸', '🚂', '🚗', '🤖', '🧩', '🪀', '🪁', '🎮'];
    
    function next() {
      if(i >= num) {
        setTimeout(() => setScene(3), 1500);
        return;
      }
      var t = document.createElement('div');
      t.className = 'toy';
      t.textContent = toysList[i % toysList.length];
      t.style.animation = 'toyConveyor 2s linear forwards';
      els.toysContainer.appendChild(t);
      
      GameAudio.playNote(i);
      
      i++;
      setTimeout(next, 1000);
    }
    next();
  }

  function playMarket(num) {
    S.candies = num;
    var i = 0;
    var candiesList = ['🍬', '🍭', '🍫', '🧁', '🍦', '🍩', '🍪', '🍰', '🍡'];
    
    function next() {
      if(i >= num) {
        setTimeout(() => setScene(4), 2000);
        return;
      }
      var c = document.createElement('div');
      c.className = 'candy';
      c.textContent = candiesList[i % candiesList.length];
      
      // Random X offset for dropping into basket
      var rx = (Math.random() - 0.5) * 150;
      c.style.setProperty('--rx', rx + 'px');
      c.style.animation = 'candyDrop 1s cubic-bezier(0.5, 0, 0.75, 0) forwards';
      
      els.candiesContainer.appendChild(c);
      
      setTimeout(() => {
        GameAudio.playNote(i);
      }, 500); // sync with hit basket

      i++;
      setTimeout(next, 600);
    }
    next();
  }

  function startParty() {
    GameAudio.playMagic();
    
    // Add items to table
    var allItems = [];
    var toysList = ['🎁', '🧸', '🚂', '🚗', '🤖', '🧩', '🪀', '🪁', '🎮'];
    for(var i=0; i<S.toys; i++) allItems.push(toysList[i % toysList.length]);
    
    var candiesList = ['🍬', '🍭', '🍫', '🧁', '🍦', '🍩', '🍪', '🍰', '🍡'];
    for(var j=0; j<S.candies; j++) allItems.push(candiesList[j % candiesList.length]);
    
    allItems.forEach((icon, idx) => {
      setTimeout(() => {
        var el = document.createElement('div');
        el.className = 'party-item';
        el.textContent = icon;
        els.partyItems.appendChild(el);
        GameAudio.playPop();
      }, idx * 200 + 500);
    });

    // Confetti
    for(var k=0; k<80; k++) {
      setTimeout(() => {
        var c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = ['var(--c-pink)', 'var(--c-cyan)', 'var(--c-yellow)', 'var(--c-green)', 'var(--c-orange)'][Math.floor(Math.random()*5)];
        c.style.animationDuration = (2 + Math.random() * 3) + 's';
        els.confetti.appendChild(c);
      }, Math.random() * 4000 + 500);
    }
  }

  // Events
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      var num = parseInt(e.target.dataset.val, 10);
      handleNumber(num);
    });
  });

  window.addEventListener('keydown', (e) => {
    GameAudio.init();
    if(S.scene === 0) {
      handleNumber(1); // Any key starts
      return;
    }
    var num = parseInt(e.key, 10);
    if(num >= 1 && num <= 9) {
      handleNumber(num);
    }
  });

  // Mobile fallback pra qualquer toque na tela de intro
  document.getElementById('scene-intro').addEventListener('click', () => {
    GameAudio.init();
    handleNumber(1);
  });

  // Init
  setScene(0);
})();
