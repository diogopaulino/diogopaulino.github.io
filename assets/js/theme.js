(function() {
  'use strict';

  const toggle = document.querySelector('.theme-toggle');
  const html = document.documentElement;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  // Initialization is handled in head script to prevent FOUC

  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      
      // Update theme-color for mobile browsers
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', next === 'dark' ? '#0a0a0a' : '#fafbfc');
      }
    });
  }
})();
