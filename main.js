// Theme Toggle — tri-state: system (default) -> light -> dark -> system ...
(function () {
    'use strict';

    var STORAGE_KEY = 'theme'; // values: 'system' | 'light' | 'dark'

    function prefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function getSavedTheme() {
        // Migrate the old 'darkMode' boolean key if present.
        var legacy = localStorage.getItem('darkMode');
        if (legacy !== null && !localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, legacy === 'true' ? 'dark' : 'light');
            localStorage.removeItem('darkMode');
        }
        return localStorage.getItem(STORAGE_KEY) || 'system';
    }

    function isDarkResolved(theme) {
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        return prefersDark();
    }

    function applyTheme(theme) {
        var dark = isDarkResolved(theme);
        document.body.classList.toggle('dark-mode', dark);
        document.body.classList.toggle('light-mode', !dark && theme === 'light');
        updateToggleButton(theme, dark);
    }

    function updateToggleButton(theme, dark) {
        var icon = document.getElementById('darkModeIcon');
        var text = document.getElementById('darkModeText');
        var btn = document.querySelector('.dark-mode-toggle');
        if (btn) {
            btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
            var label = (theme === 'system')
                ? 'Theme: System (' + (dark ? 'Dark' : 'Light') + ') \u2014 click to switch'
                : (theme === 'dark' ? 'Switch to light mode' : 'Switch to system theme');
            btn.setAttribute('title', label);
            btn.setAttribute('aria-label', label);
        }
        if (icon && text) {
            if (theme === 'system') {
                icon.textContent = '\uD83D\uDDA5\uFE0F'; // 🖥️
                text.textContent = 'System';
            } else if (dark) {
                icon.textContent = '\u2600\uFE0F'; // ☀️
                text.textContent = 'Light Mode';
            } else {
                icon.textContent = '\uD83C\uDF19'; // 🌙
                text.textContent = 'Dark Mode';
            }
        }
    }

    function cycleTheme() {
        var current = getSavedTheme();
        var next = current === 'system' ? 'light'
                 : current === 'light'  ? 'dark'
                 :                        'system';
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
    }

    // Expose for inline onclick handlers in the existing markup.
    window.toggleDarkMode = cycleTheme;

    // React to OS-level changes while user is on 'system'.
    if (window.matchMedia) {
        try {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var listener = function () {
                if (getSavedTheme() === 'system') applyTheme('system');
            };
            if (mq.addEventListener) {
                mq.addEventListener('change', listener);
            } else if (mq.addListener) {
                mq.addListener(listener);
            }
        } catch (e) { /* ignore */ }
    }

    function init() {
        applyTheme(getSavedTheme());

        // Wire up any change-handlers requested by data attributes.
        // Pages set data-on-change-show-details="true" on the relevant <select>
        // to ensure showDetails() is re-invoked when the user picks a new option.
        var selects = document.querySelectorAll('select[data-on-change-show-details="true"]');
        selects.forEach(function (sel) {
            sel.addEventListener('change', function () {
                if (typeof window.showDetails === 'function') window.showDetails();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
