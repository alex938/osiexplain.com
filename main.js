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

// ============================================================================
// Learning tools: quiz engine, progress tracking and copy-to-clipboard.
// Progressive enhancement only — every feature degrades to plain HTML.
// ============================================================================
(function () {
    'use strict';

    var PROGRESS_KEY = 'osi:progress'; // { "layer1": {visited:true, best:4, total:5}, ... }

    function readProgress() {
        try {
            return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function writeProgress(data) {
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
        } catch (e) { /* private browsing / quota — progress is a nicety, not a requirement */ }
    }

    function recordVisit(id) {
        if (!id) return;
        var data = readProgress();
        data[id] = data[id] || {};
        data[id].visited = true;
        writeProgress(data);
    }

    function recordScore(id, correct, total) {
        if (!id) return;
        var data = readProgress();
        var entry = data[id] = data[id] || {};
        entry.visited = true;
        entry.total = total;
        if (typeof entry.best !== 'number' || correct > entry.best) entry.best = correct;
        writeProgress(data);
    }

    // ---- Quiz -------------------------------------------------------------
    function setupQuiz(quiz) {
        var id = quiz.getAttribute('data-quiz-id');
        var questions = Array.prototype.slice.call(quiz.querySelectorAll('.quiz-question'));
        if (!questions.length) return;

        var scoreEl = quiz.querySelector('.quiz-score');
        var resetBtn = quiz.querySelector('.quiz-reset');
        var answered = 0;
        var correctCount = 0;

        function updateScore() {
            if (!scoreEl) return;
            if (!answered) {
                scoreEl.textContent = '';
                scoreEl.classList.remove('is-done');
                return;
            }
            var done = answered === questions.length;
            scoreEl.textContent = done
                ? 'Score: ' + correctCount + ' / ' + questions.length + ' — ' +
                  (correctCount === questions.length ? 'perfect, you have got this.'
                   : correctCount >= Math.ceil(questions.length * 0.6) ? 'solid. Re-read the ones you missed.'
                   : 'worth another pass through this page.')
                : 'Answered ' + answered + ' of ' + questions.length + '…';
            scoreEl.classList.toggle('is-done', done);
            if (done) recordScore(id, correctCount, questions.length);
        }

        questions.forEach(function (question) {
            var answer = question.getAttribute('data-answer');
            var buttons = Array.prototype.slice.call(question.querySelectorAll('.quiz-options button'));
            var feedback = question.querySelector('.quiz-feedback');
            var explain = question.querySelector('.quiz-explain');

            buttons.forEach(function (button) {
                button.addEventListener('click', function () {
                    if (question.classList.contains('is-answered')) return;
                    question.classList.add('is-answered');
                    answered++;

                    var picked = button.getAttribute('data-option');
                    var isCorrect = picked === answer;
                    if (isCorrect) correctCount++;

                    buttons.forEach(function (other) {
                        var right = other.getAttribute('data-option') === answer;
                        if (right) other.classList.add('correct');
                        if (other === button && !isCorrect) other.classList.add('incorrect');
                        other.setAttribute('aria-disabled', 'true');
                        if (right) other.setAttribute('aria-label', other.textContent + ' — correct answer');
                    });

                    if (feedback) {
                        feedback.textContent = isCorrect ? '✅ Correct.' : '❌ Not quite.';
                        feedback.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
                    }
                    if (explain) explain.hidden = false;
                    updateScore();
                });
            });
        });

        if (resetBtn) {
            resetBtn.hidden = false;
            resetBtn.addEventListener('click', function () {
                answered = 0;
                correctCount = 0;
                questions.forEach(function (question) {
                    question.classList.remove('is-answered');
                    question.querySelectorAll('.quiz-options button').forEach(function (button) {
                        button.classList.remove('correct', 'incorrect');
                        button.removeAttribute('aria-disabled');
                        button.removeAttribute('aria-label');
                    });
                    var feedback = question.querySelector('.quiz-feedback');
                    if (feedback) {
                        feedback.textContent = '';
                        feedback.classList.remove('is-correct', 'is-incorrect');
                    }
                    var explain = question.querySelector('.quiz-explain');
                    if (explain) explain.hidden = true;
                });
                updateScore();
                questions[0].scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
            });
        }
    }

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // ---- Progress summary (home page) -------------------------------------
    function renderProgress() {
        var summary = document.getElementById('progressSummary');
        if (!summary) return;

        var cards = Array.prototype.slice.call(document.querySelectorAll('[data-progress-id]'));
        var data = readProgress();
        var visited = 0;
        var quizzed = 0;

        cards.forEach(function (card) {
            var entry = data[card.getAttribute('data-progress-id')];
            var badge = card.querySelector('.progress-badge');
            if (!badge) return;
            if (entry && typeof entry.best === 'number') {
                badge.textContent = 'Quiz ' + entry.best + '/' + entry.total;
                badge.className = 'progress-badge is-quizzed';
                badge.hidden = false;
                quizzed++;
                visited++;
            } else if (entry && entry.visited) {
                badge.textContent = 'Visited';
                badge.className = 'progress-badge is-visited';
                badge.hidden = false;
                visited++;
            } else {
                badge.hidden = true;
            }
        });

        var total = cards.length || 7;
        var bar = summary.querySelector('.progress-bar-fill');
        var text = summary.querySelector('.progress-text');
        var reset = summary.querySelector('.progress-reset');

        if (bar) bar.style.width = Math.round((visited / total) * 100) + '%';
        if (text) {
            text.textContent = visited === 0
                ? 'No layers explored yet — start anywhere, or work up from Layer 1.'
                : visited + ' of ' + total + ' layers explored · ' + quizzed + ' quiz' + (quizzed === 1 ? '' : 'zes') + ' completed';
        }
        var meter = summary.querySelector('.progress-bar');
        if (meter) {
            meter.setAttribute('aria-valuenow', String(visited));
            meter.setAttribute('aria-valuetext', visited + ' of ' + total + ' layers explored');
        }
        summary.hidden = false;
        if (reset) {
            reset.addEventListener('click', function () {
                writeProgress({});
                renderProgress();
            });
        }
    }

    // ---- Copy buttons on code / filter blocks ------------------------------
    function addCopyButtons() {
        if (!navigator.clipboard) return;
        var blocks = document.querySelectorAll('[data-copy]');
        Array.prototype.forEach.call(blocks, function (block) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'copy-btn';
            button.textContent = 'Copy';
            button.setAttribute('aria-label', 'Copy to clipboard');
            button.addEventListener('click', function () {
                var text = (block.getAttribute('data-copy') || block.textContent).trim();
                navigator.clipboard.writeText(text).then(function () {
                    button.textContent = 'Copied';
                    button.classList.add('is-copied');
                    setTimeout(function () {
                        button.textContent = 'Copy';
                        button.classList.remove('is-copied');
                    }, 1600);
                }).catch(function () {
                    button.textContent = 'Press Ctrl+C';
                });
            });
            block.classList.add('has-copy');
            block.appendChild(button);
        });
    }

    function start() {
        recordVisit(document.body.getAttribute('data-page-id'));
        Array.prototype.forEach.call(document.querySelectorAll('.quiz[data-quiz-id]'), setupQuiz);
        renderProgress();
        addCopyButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
