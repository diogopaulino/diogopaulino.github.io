(function () {
  'use strict';

  const pic = document.getElementById('profile-pic');
  const egg = document.getElementById('labs-easter-egg');

  if (!pic || !egg) return;

  let revealed = false;
  let timer = null;

  function reveal() {
    if (revealed) return;
    revealed = true;
    egg.classList.add('revealed');
    try {
      localStorage.setItem('labsRevealed', '1');
    } catch (e) { }
  }

  function hide() {
    try {
      if (localStorage.getItem('labsRevealed') === '1') return;
    } catch (e) { }
    if (revealed) {
      revealed = false;
      egg.classList.remove('revealed');
    }
  }

  try {
    if (localStorage.getItem('labsRevealed') === '1') reveal();
  } catch (e) { }

  pic.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    timer = setTimeout(reveal, 300);
  });

  pic.addEventListener('mouseleave', () => {
    clearTimeout(timer);
    setTimeout(hide, 500);
  });

  function spin() {
    pic.classList.remove('coin-spin');
    void pic.offsetWidth; // Force reflow
    pic.classList.add('coin-spin');
    setTimeout(() => pic.classList.remove('coin-spin'), 1500);
  }

  pic.addEventListener('click', () => {
    reveal();
    spin();
  });

  // O toque curto usa o clique nativo, inclusive para ativação por teclado.
  let touchTimer;
  pic.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchTimer = setTimeout(reveal, 300);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    pic.addEventListener(type, () => clearTimeout(touchTimer));
  }

  let keys = [];
  const code = ['l', 'a', 'b', 's'];

  document.addEventListener('keydown', (e) => {
    keys.push(e.key.toLowerCase());
    if (keys.length > code.length) keys.shift();
    if (JSON.stringify(keys) === JSON.stringify(code)) {
      reveal();
      keys = [];
    }
  });
})();
