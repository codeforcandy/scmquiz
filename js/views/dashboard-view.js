// ─── Dashboard View ───
// Shows progress tracking: score trends, section accuracy, timing stats.

import { setState } from '../store.js';
import { loadHistory, loadStats } from '../persistence.js';

const SECTION_COLORS = {
  A: '#B8562F', B: '#2E7D6E', C: '#6C5B9E', D: '#3A7D44', E: '#C0862B',
  F: '#8B4F6E', G: '#4A6FA5', H: '#7B6340', I: '#5B8A72', J: '#9E5A5A', K: '#4E7A8B',
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderDashboardView() {
  const container = document.getElementById('dashboard-view');
  container.textContent = '';

  const history = loadHistory();
  const stats = loadStats();

  const wrapper = el('div', 'container view-enter');

  // Header
  const header = el('div', 'dash-header');
  const backBtn = el('button', 'btn btn--ghost', 'Back');
  backBtn.addEventListener('click', () => setState({ currentView: 'setup' }));
  header.appendChild(backBtn);
  header.appendChild(el('h1', 'dash-title', 'Progress'));
  header.appendChild(el('div')); // spacer
  wrapper.appendChild(header);

  if (history.length === 0) {
    const empty = el('div', 'dash-empty');
    empty.appendChild(el('p', 'dash-empty__icon', '~'));
    empty.appendChild(el('p', 'dash-empty__text', 'No sessions yet. Complete a quiz to see your progress here.'));
    wrapper.appendChild(empty);
    container.appendChild(wrapper);
    return;
  }

  // ── Overview Cards ──
  const overview = el('div', 'dash-overview');

  const accuracy = stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  overview.appendChild(makeStatCard('Sessions', String(stats.totalQuizzes)));
  overview.appendChild(makeStatCard('Accuracy', accuracy + '%'));
  overview.appendChild(makeStatCard('Best Streak', String(stats.longestStreak)));

  const avgTime = history.reduce((s, h) => s + h.avgTimeMs, 0) / history.length;
  overview.appendChild(makeStatCard('Avg/Question', formatTime(avgTime)));
  wrapper.appendChild(overview);

  // ── Score Trend ──
  const recent = history.slice(-20);
  wrapper.appendChild(el('h2', 'dash-section-title', 'Score Trend'));
  wrapper.appendChild(buildScoreTrend(recent));

  // ── Section Accuracy ──
  const sectionData = aggregateSections(history);
  if (Object.keys(sectionData).length > 0) {
    wrapper.appendChild(el('h2', 'dash-section-title', 'Section Accuracy'));
    wrapper.appendChild(buildSectionBars(sectionData));
  }

  // ── Timing Trend ──
  wrapper.appendChild(el('h2', 'dash-section-title', 'Avg Time per Question'));
  wrapper.appendChild(buildTimingTrend(recent));

  // ── Recent Sessions ──
  wrapper.appendChild(el('h2', 'dash-section-title', 'Recent Sessions'));
  wrapper.appendChild(buildRecentList(history.slice(-10).reverse()));

  container.appendChild(wrapper);
}

function makeStatCard(label, value) {
  const card = el('div', 'dash-stat');
  card.appendChild(el('div', 'dash-stat__value', value));
  card.appendChild(el('div', 'dash-stat__label', label));
  return card;
}

function formatTime(ms) {
  if (ms < 1000) return ms + 'ms';
  const secs = ms / 1000;
  return secs < 60 ? secs.toFixed(1) + 's' : Math.floor(secs / 60) + 'm ' + Math.round(secs % 60) + 's';
}

function buildScoreTrend(sessions) {
  const chart = el('div', 'dash-chart');
  const bars = el('div', 'dash-bars');

  for (const s of sessions) {
    const col = el('div', 'dash-bar-col');
    const bar = el('div', 'dash-bar');
    bar.style.height = s.score + '%';
    bar.classList.add(
      s.score >= 80 ? 'dash-bar--good' : s.score >= 50 ? 'dash-bar--ok' : 'dash-bar--bad'
    );
    bar.title = `${s.score}% (${s.correct}/${s.total}) — ${new Date(s.date).toLocaleDateString()}`;
    col.appendChild(bar);

    const label = el('div', 'dash-bar-label', s.score + '%');
    col.appendChild(label);
    bars.appendChild(col);
  }

  chart.appendChild(bars);
  return chart;
}

function buildTimingTrend(sessions) {
  const chart = el('div', 'dash-chart');
  const bars = el('div', 'dash-bars');

  const maxTime = Math.max(...sessions.map(s => s.avgTimeMs), 1);

  for (const s of sessions) {
    const col = el('div', 'dash-bar-col');
    const pct = Math.round((s.avgTimeMs / maxTime) * 100);
    const bar = el('div', 'dash-bar dash-bar--timing');
    bar.style.height = pct + '%';
    bar.title = `${formatTime(s.avgTimeMs)} avg — ${new Date(s.date).toLocaleDateString()}`;
    col.appendChild(bar);

    const label = el('div', 'dash-bar-label', formatTime(s.avgTimeMs));
    col.appendChild(label);
    bars.appendChild(col);
  }

  chart.appendChild(bars);
  return chart;
}

function aggregateSections(history) {
  const agg = {};
  for (const h of history) {
    for (const [sec, data] of Object.entries(h.sections)) {
      if (!agg[sec]) agg[sec] = { correct: 0, total: 0 };
      agg[sec].correct += data.correct;
      agg[sec].total += data.total;
    }
  }
  return agg;
}

function buildSectionBars(sectionData) {
  const list = el('div', 'dash-section-bars');

  const sorted = Object.entries(sectionData).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [sec, data] of sorted) {
    const pct = Math.round((data.correct / data.total) * 100);
    const row = el('div', 'dash-section-row');

    const label = el('div', 'dash-section-label');
    const badge = el('span', 'dash-section-badge', sec);
    badge.style.background = SECTION_COLORS[sec] || 'var(--accent)';
    label.appendChild(badge);
    label.appendChild(el('span', 'dash-section-pct', pct + '%'));
    row.appendChild(label);

    const track = el('div', 'dash-section-track');
    const fill = el('div', 'dash-section-fill');
    fill.style.width = pct + '%';
    fill.style.background = SECTION_COLORS[sec] || 'var(--accent)';
    fill.classList.add(
      pct >= 80 ? 'dash-section-fill--good' : pct >= 50 ? 'dash-section-fill--ok' : 'dash-section-fill--bad'
    );
    track.appendChild(fill);
    row.appendChild(track);

    const detail = el('span', 'dash-section-detail', `${data.correct}/${data.total}`);
    row.appendChild(detail);

    list.appendChild(row);
  }

  return list;
}

function buildRecentList(sessions) {
  const list = el('div', 'dash-recent');

  for (const s of sessions) {
    const item = el('div', 'dash-recent-item');

    const left = el('div', 'dash-recent-left');
    const dateStr = new Date(s.date).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    left.appendChild(el('div', 'dash-recent-date', dateStr));
    left.appendChild(el('div', 'dash-recent-detail',
      `${s.total} questions | ${formatTime(s.durationMs)} | streak: ${s.longestStreak}`));
    item.appendChild(left);

    const scoreEl = el('div', 'dash-recent-score', s.score + '%');
    scoreEl.classList.add(
      s.score >= 80 ? 'dash-recent-score--good' : s.score >= 50 ? 'dash-recent-score--ok' : 'dash-recent-score--bad'
    );
    item.appendChild(scoreEl);

    list.appendChild(item);
  }

  return list;
}
