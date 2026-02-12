// Dark Mode Toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    var isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkModeButton(isDark);
}

function updateDarkModeButton(isDark) {
    var icon = document.getElementById('darkModeIcon');
    var text = document.getElementById('darkModeText');
    var btn = document.querySelector('.dark-mode-toggle');
    if (btn) {
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
    if (isDark) {
        icon.textContent = '\u2600\uFE0F';
        text.textContent = 'Light Mode';
    } else {
        icon.textContent = '\uD83C\uDF19';
        text.textContent = 'Dark Mode';
    }
}

// Load dark mode preference on page load
window.addEventListener('DOMContentLoaded', function() {
    var savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        document.body.classList.add('dark-mode');
        updateDarkModeButton(true);
    }
});
