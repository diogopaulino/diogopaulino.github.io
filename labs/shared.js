(function () {
    'use strict';

    const html = document.documentElement;
    const THEME_CORE_URL = '/assets/js/theme.js';
    const SLOT_SELECTOR = '[data-slot]';
    const HEADER_SELECTOR = '[data-lab-header]';
    const FOOTER_SELECTOR = '[data-lab-footer]';

    function applySavedTheme() {
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme && !html.getAttribute('data-theme')) {
                html.setAttribute('data-theme', savedTheme);
            }
        } catch (err) {
            /* Storage can be unavailable in private browsing contexts. */
        }
    }

    function extractSlotMarkup(root, name) {
        const slot = root.querySelector(`${SLOT_SELECTOR}[data-slot="${name}"]`);
        if (!slot) return '';

        const markup = slot.innerHTML.trim();
        slot.remove();
        return markup;
    }

    function renderThemeToggle() {
        return `
            <div class="theme-switch-wrapper">
                <button class="theme-toggle" aria-label="Alternar tema" title="Alternar tema" type="button"
                    aria-pressed="false">
                    <span class="theme-toggle-track" aria-hidden="true">
                        <span class="theme-toggle-thumb">
                            <svg class="sun-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                stroke-linejoin="round">
                                <circle cx="12" cy="12" r="4"></circle>
                                <path
                                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41">
                                </path>
                            </svg>
                            <svg class="moon-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        </span>
                    </span>
                </button>
            </div>
        `;
    }

    function buildHeader(header) {
        if (header.dataset.labReady === 'true') return;

        const backHref = header.getAttribute('data-back-href') || '../index.html';
        const backLabel = header.getAttribute('data-back-label') || 'Labs';
        const title = header.getAttribute('data-title') || document.title || 'Labs';
        const subtitle = header.getAttribute('data-subtitle');
        const logoMarkup = extractSlotMarkup(header, 'logo');
        const actionsMarkup = extractSlotMarkup(header, 'actions');
        const renderedLogo = logoMarkup
            ? (/<.+>/.test(logoMarkup) ? logoMarkup : `<div class="app-logo">${logoMarkup}</div>`)
            : `<h1 class="app-logo">${title}</h1>`;

        header.innerHTML = `
            <a href="${backHref}" class="back-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                <span>${backLabel}</span>
            </a>
            ${renderedLogo}
            <div class="header-actions">
                ${actionsMarkup}
                ${renderThemeToggle()}
            </div>
            ${subtitle ? `<p class="subtitle lab-shell-subtitle">${subtitle}</p>` : ''}
        `;

        const logo = header.querySelector('.app-logo');
        if (logo && !logo.matches('h1, [role="heading"]')) {
            logo.setAttribute('role', 'heading');
            logo.setAttribute('aria-level', '1');
        }

        header.dataset.labReady = 'true';
    }

    function buildFooter(footer) {
        if (footer.dataset.labReady === 'true') return;

        const homeHref = footer.getAttribute('data-home-href') || '/';
        const homeLabel = footer.getAttribute('data-home-label') || '← voltar para home';
        const extraMarkup = extractSlotMarkup(footer, 'extra');

        footer.innerHTML = `
            <a href="${homeHref}">${homeLabel}</a>
            ${extraMarkup}
        `;
        footer.dataset.labReady = 'true';
    }

    function initChrome() {
        document.querySelectorAll(HEADER_SELECTOR).forEach(buildHeader);
        document.querySelectorAll(FOOTER_SELECTOR).forEach(buildFooter);
    }

    function ensureThemeMeta() {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = html.getAttribute('data-theme') === 'dark' ? '#0a0a0a' : '#fafbfc';
        return meta;
    }

    function stripInlineIconStyles() {
        document.querySelectorAll('.sun-icon, .moon-icon').forEach((icon) => {
            icon.removeAttribute('style');
        });
    }

    function initToggle() {
        if (!window.ThemeManager) return;

        window.ThemeManager.initToggle({
            toggleSelector: '.theme-toggle',
            metaThemeSelector: ensureThemeMeta()
        });
        stripInlineIconStyles();
    }

    function ensureThemeCore() {
        if (window.ThemeManager) {
            initToggle();
            return;
        }

        const existingScript = document.querySelector('script[data-theme-core]');
        if (existingScript) {
            existingScript.addEventListener('load', initToggle, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = THEME_CORE_URL;
        script.defer = true;
        script.dataset.themeCore = 'true';
        script.addEventListener('load', initToggle, { once: true });
        document.head.appendChild(script);
    }

    function init() {
        initChrome();
        ensureThemeCore();
    }

    applySavedTheme();
    window.LabShell = Object.freeze({ init, buildHeader, buildFooter });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
