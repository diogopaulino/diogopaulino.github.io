(function () {
  'use strict';

  const storageKey = 'theme';
  const html = document.documentElement;

  function getPreferredTheme() {
    try {
      return localStorage.getItem(storageKey) || html.getAttribute('data-theme') || 'light';
    } catch (err) {
      return 'light';
    }
  }

  function persistTheme(value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch (err) {
      /* noop */
    }
  }

  function updateMetaTag(theme, selector) {
    if (!selector) return;
    const meta = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#fafbfc');
    }
  }

  function updateAriaPressed(el, theme) {
    if (el && el.hasAttribute('aria-pressed')) {
      el.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  function bindToggle(options = {}) {
    const {
      toggleSelector = '.theme-toggle',
      toggle: providedToggle,
      metaThemeSelector = 'meta[name="theme-color"]',
      onChange
    } = options;

    const toggleEl = providedToggle || document.querySelector(toggleSelector);
    if (!toggleEl || toggleEl.dataset.themeBound === 'true') return;
    toggleEl.dataset.themeBound = 'true';

    updateAriaPressed(toggleEl, html.getAttribute('data-theme') || 'light');

    const metaTarget = typeof metaThemeSelector === 'string' && metaThemeSelector.length
      ? document.querySelector(metaThemeSelector)
      : metaThemeSelector;

    toggleEl.addEventListener('click', () => {
      const current = html.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';

      html.setAttribute('data-theme', next);
      persistTheme(next);
      updateMetaTag(next, metaTarget);
      updateAriaPressed(toggleEl, next);

      if (typeof onChange === 'function') {
        onChange(next, toggleEl);
      }
    });
  }

  function initialize() {
    const initial = getPreferredTheme();
    html.setAttribute('data-theme', initial);
    updateMetaTag(initial, 'meta[name="theme-color"]');
    bindToggle();
  }

  window.ThemeManager = window.ThemeManager || {
    initToggle: bindToggle,
    getTheme: () => html.getAttribute('data-theme') || 'light',
    setTheme: (value, opts = {}) => {
      const next = value === 'dark' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      persistTheme(next);
      updateMetaTag(next, opts.metaThemeSelector || 'meta[name="theme-color"]');
      if (typeof opts.onChange === 'function') {
        opts.onChange(next);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
