(function () {
  'use strict';

  const SLOT_SELECTOR = '[data-slot]';
  const HEADER_SELECTOR = '[data-lab-header]';
  const FOOTER_SELECTOR = '[data-lab-footer]';

  function extractSlotMarkup(root, name) {
    const slot = root.querySelector(`${SLOT_SELECTOR}[data-slot="${name}"]`);
    if (!slot) return '';
    let html = '';
    if (slot.tagName === 'TEMPLATE') {
      html = slot.innerHTML.trim();
    } else {
      html = slot.innerHTML.trim();
    }
    slot.remove();
    return html;
  }

  function renderThemeToggle() {
    return `
      <div class="theme-switch-wrapper">
        <button class="theme-toggle" aria-label="Alternar tema" title="Alternar tema" type="button" aria-pressed="false">
          <div class="theme-toggle-track">
            <div class="theme-toggle-thumb">
              <svg class="sun-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"></path>
              </svg>
              <svg class="moon-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </div>
          </div>
        </button>
      </div>
    `;
  }

  function buildHeader(header) {
    const backHref = header.getAttribute('data-back-href') || '../index.html';
    const backLabel = header.getAttribute('data-back-label') || 'Labs';
    const title = header.getAttribute('data-title') || document.title || 'Labs';
    const subtitle = header.getAttribute('data-subtitle');

    const logoMarkupRaw = extractSlotMarkup(header, 'logo') || title;
    const hasHtml = /<.+>/.test(logoMarkupRaw.trim());
    const logoMarkup = hasHtml ? logoMarkupRaw : `<div class="app-logo">${logoMarkupRaw}</div>`;

    const actionsMarkup = extractSlotMarkup(header, 'actions');

    header.innerHTML = `
      <a href="${backHref}" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7"></path>
        </svg>
        <span>${backLabel}</span>
      </a>
      ${logoMarkup}
      <div class="header-actions">
        ${actionsMarkup || ''}
        ${renderThemeToggle()}
      </div>
      ${subtitle ? `<p class="subtitle lab-shell-subtitle">${subtitle}</p>` : ''}
    `;
  }

  function buildFooter(footer) {
    const homeHref = footer.getAttribute('data-home-href') || '/';
    const homeLabel = footer.getAttribute('data-home-label') || '← voltar para home';
    const extraMarkup = extractSlotMarkup(footer, 'extra');

    footer.innerHTML = `
      <a href="${homeHref}">${homeLabel}</a>
      ${extraMarkup || ''}
    `;
  }

  function initChrome() {
    const headers = document.querySelectorAll(HEADER_SELECTOR);
    headers.forEach(buildHeader);

    const footers = document.querySelectorAll(FOOTER_SELECTOR);
    footers.forEach(buildFooter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChrome);
  } else {
    initChrome();
  }
})();
