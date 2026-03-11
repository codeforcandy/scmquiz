// ─── App Entry Point ───

import { subscribe, setState, getState } from './store.js';
import { loadAllData } from './data-loader.js';
import { renderSetupView } from './views/setup-view.js';
import { renderQuizView, cleanupQuizView } from './views/quiz-view.js';
import { renderResultsView } from './views/results-view.js';
import { initNotesPanel } from './views/notes-panel.js';
import { initTheme } from './ui/theme.js';
import { initKeyboard } from './ui/keyboard.js';
import { resetProgress } from './ui/progress-bar.js';

async function init() {
  initTheme();
  initKeyboard();
  initNotesPanel();

  // Show loading state
  document.getElementById('setup-view').classList.add('view--active');

  // Load data
  await loadAllData();

  // Subscribe to view changes
  subscribe('currentView', (view, prevView) => {
    if (prevView === 'quiz') cleanupQuizView();

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));

    // Show target view
    const viewEl = document.getElementById(view + '-view');
    if (viewEl) viewEl.classList.add('view--active');

    // Render
    switch (view) {
      case 'setup':
        resetProgress();
        document.getElementById('progress-bar').style.display = 'none';
        renderSetupView();
        break;
      case 'quiz':
        renderQuizView();
        break;
      case 'results':
        renderResultsView();
        break;
    }

    // Scroll to top
    window.scrollTo(0, 0);
  });

  // Initial render
  renderSetupView();
}

init().catch(err => {
  console.error('Failed to initialize app:', err);
  const el = document.getElementById('setup-view');
  if (el) {
    el.textContent = '';
    const msg = document.createElement('p');
    msg.style.cssText = 'text-align:center;padding:2rem;color:var(--text-muted)';
    msg.textContent = 'Failed to load quiz data. Please refresh the page.';
    el.appendChild(msg);
  }
});
