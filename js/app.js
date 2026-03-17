// ─── App Entry Point ───

import { subscribe, setState } from './store.js';
import { loadAllData } from './data-loader.js';
import { renderSetupView } from './views/setup-view.js';
import { renderQuizView, cleanupQuizView } from './views/quiz-view.js';
import { renderResultsView } from './views/results-view.js';
import { renderGateView } from './views/gate-view.js';
import { initNotesPanel } from './views/notes-panel.js';
import { initTheme } from './ui/theme.js';
import { initKeyboard } from './ui/keyboard.js';
import { resetProgress } from './ui/progress-bar.js';
import { loadUser, setCurrentUserId } from './persistence.js';
import { flushPendingLogs } from './logger.js';
import { loadAuthData } from './auth.js';

// Data loading promise — resolved once quiz data is ready
let dataReady = null;

function ensureDataLoaded() {
  return dataReady;
}

async function init() {
  initTheme();
  initKeyboard();
  initNotesPanel();

  // Subscribe to view changes
  subscribe('currentView', async (view, prevView) => {
    if (prevView === 'quiz') cleanupQuizView();

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));

    // Show target view
    const viewEl = document.getElementById(view + '-view');
    if (viewEl) viewEl.classList.add('view--active');

    // Render
    switch (view) {
      case 'gate':
        resetProgress();
        document.getElementById('progress-bar').style.display = 'none';
        renderGateView();
        break;
      case 'setup':
        resetProgress();
        document.getElementById('progress-bar').style.display = 'none';
        await ensureDataLoaded();
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

  // Start loading auth + quiz data in parallel
  const authPromise = loadAuthData();
  dataReady = loadAllData();

  // Check for existing user session
  const userId = loadUser();

  if (userId) {
    // Authenticated — wait for data, then show setup
    setCurrentUserId(userId);
    flushPendingLogs();
    await dataReady;
    setState({ currentUser: userId, currentView: 'setup' });
  } else {
    // Not authenticated — show gate immediately (no data needed)
    await authPromise;
    setState({ currentView: 'gate' });
  }
}

init().catch(err => {
  console.error('Failed to initialize app:', err);
  const el = document.getElementById('gate-view') || document.getElementById('setup-view');
  if (el) {
    el.textContent = '';
    const msg = document.createElement('p');
    msg.style.cssText = 'text-align:center;padding:2rem;color:var(--text-muted)';
    msg.textContent = 'Failed to load. Please refresh the page.';
    el.appendChild(msg);
  }
});
