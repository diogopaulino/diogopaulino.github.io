(function() {
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
    } catch (e) {}
  }

  function hide() {
    try {
      if (localStorage.getItem('labsRevealed') === '1') return;
    } catch (e) {}
    if (revealed) {
      revealed = false;
      egg.classList.remove('revealed');
    }
  }

  try {
    if (localStorage.getItem('labsRevealed') === '1') reveal();
  } catch (e) {}

  pic.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    timer = setTimeout(reveal, 300);
  });

  pic.addEventListener('mouseleave', () => {
    clearTimeout(timer);
    setTimeout(hide, 500);
  });

  pic.addEventListener('click', reveal);

  let touchTimer = null;
  let touchDur = 0;

  pic.addEventListener('touchstart', () => {
    touchDur = 0;
    touchTimer = setInterval(() => {
      touchDur += 100;
      if (touchDur >= 300) {
        clearInterval(touchTimer);
        reveal();
      }
    }, 100);
  });

  pic.addEventListener('touchend', () => {
    clearInterval(touchTimer);
    if (touchDur < 300) reveal();
  });

  pic.addEventListener('touchcancel', () => clearInterval(touchTimer));

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
