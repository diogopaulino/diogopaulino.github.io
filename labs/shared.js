(function () {
    const html = document.documentElement;
    const THEME_CORE_URL = '/assets/js/theme.js';

    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && !html.getAttribute('data-theme')) {
            html.setAttribute('data-theme', savedTheme);
        }
    } catch (err) {
        /* noop */
    }

    function stripInlineIconStyles() {
        const icons = document.querySelectorAll('.sun-icon, .moon-icon');
        icons.forEach((icon) => {
            if (icon.hasAttribute('style')) {
                icon.removeAttribute('style');
            }
        });
    }

    function initToggle() {
        if (!window.ThemeManager) return;
        window.ThemeManager.initToggle({
            toggleSelector: '.theme-toggle',
            metaThemeSelector: 'meta[name="theme-color"]'
        });
        stripInlineIconStyles();
    }

    function ensureThemeCore() {
        if (window.ThemeManager) {
            initToggle();
            return;
        }

        if (document.querySelector('script[data-theme-core]')) {
            document.querySelector('script[data-theme-core]').addEventListener('load', initToggle, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = THEME_CORE_URL;
        script.defer = true;
        script.dataset.themeCore = 'true';
        script.addEventListener('load', initToggle, { once: true });
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureThemeCore);
    } else {
        ensureThemeCore();
    }
})();
