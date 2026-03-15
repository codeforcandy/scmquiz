// ─── Results View ───
// Data rendered here comes from our own static JSON files in data/.
// Uses safe DOM methods for rendering.

import { getState, setState } from '../store.js';
import { calculateResults, createSession } from '../quiz-engine.js';
import { clearSession, updateStats, loadFlags, loadIffy } from '../persistence.js';

const SECTION_COLORS = {
  A: '#B8562F', B: '#2E7D6E', C: '#6C5B9E', D: '#3A7D44', E: '#C0862B',
  F: '#8B4F6E', G: '#4A6FA5', H: '#7B6340', I: '#5B8A72', J: '#9E5A5A', K: '#4E7A8B',
};

let currentFilter = 'all';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderResultsView() {
  const container = document.getElementById('results-view');
  const results = calculateResults();
  const session = getState().session;
  const flags = loadFlags();
  const iffy = loadIffy();

  updateStats(results);
  clearSession();

  document.getElementById('progress-bar').style.display = 'none';

  let scoreClass = 'results-score--ok';
  if (results.percentage >= 80) scoreClass = 'results-score--good';
  else if (results.percentage < 50) scoreClass = 'results-score--bad';

  const mins = Math.floor(results.elapsed / 60000);
  const secs = Math.floor((results.elapsed % 60000) / 1000);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const wrongIds = [];
  const flaggedIds = [];
  const iffyIds = [];
  session.questions.forEach((q, i) => {
    const a = session.answers[i];
    if (a && !a.isCorrect) wrongIds.push(i);
    if (flags.includes(q.conceptId)) flaggedIds.push(i);
    if (iffy.includes(q.conceptId)) iffyIds.push(i);
  });

  container.textContent = '';
  const wrapper = el('div', 'container view-enter');

  // Score header
  const header = el('div', 'results-header');
  header.appendChild(el('div', 'results-score ' + scoreClass, results.percentage + '%'));

  const subtitle = el('p');
  subtitle.style.cssText = 'color:var(--text-secondary);margin-bottom:var(--space-4)';
  subtitle.textContent = `${results.correct} of ${results.total} correct`;
  header.appendChild(subtitle);

  const stats = el('div', 'results-stats');
  const timeStat = el('div');
  timeStat.appendChild(el('span', 'results-stat__value', timeStr));
  timeStat.append(' time');
  const streakStat = el('div');
  streakStat.appendChild(el('span', 'results-stat__value', String(results.longestStreak)));
  streakStat.append(' streak');
  stats.append(timeStat, streakStat);
  header.appendChild(stats);
  wrapper.appendChild(header);

  // Actions
  const actions = el('div', 'results-actions');
  const newBtn = el('button', 'btn btn--primary', 'New Quiz');
  newBtn.id = 'new-quiz-btn';
  actions.appendChild(newBtn);

  if (wrongIds.length > 0) {
    const retryBtn = el('button', 'btn btn--secondary', 'Retry Wrong');
    retryBtn.id = 'retry-wrong-btn';
    actions.appendChild(retryBtn);
  }

  const exportBtn = el('button', 'btn btn--ghost', 'Export Study List');
  exportBtn.id = 'export-btn';
  actions.appendChild(exportBtn);
  wrapper.appendChild(actions);

  // Tabs
  const tabs = el('div', 'tab-bar');
  tabs.id = 'results-tabs';
  const tabData = [
    { key: 'all', label: `All (${results.total})` },
    { key: 'wrong', label: `Wrong (${wrongIds.length})` },
    { key: 'flagged', label: `Flagged (${flaggedIds.length})` },
    { key: 'iffy', label: `Iffy (${iffyIds.length})` },
  ];
  for (const t of tabData) {
    const tab = el('button', 'tab-bar__tab' + (t.key === 'all' ? ' tab-bar__tab--active' : ''), t.label);
    tab.dataset.filter = t.key;
    tabs.appendChild(tab);
  }
  wrapper.appendChild(tabs);

  // List
  const list = el('div', 'results-list');
  list.id = 'results-list';
  wrapper.appendChild(list);

  container.appendChild(wrapper);

  renderFilteredList('all', session, flags, iffy);

  // Events
  tabs.addEventListener('click', e => {
    const tab = e.target.closest('[data-filter]');
    if (tab) renderFilteredList(tab.dataset.filter, session, flags, iffy);
  });

  newBtn.addEventListener('click', () => {
    setState({ session: null, currentView: 'setup' });
  });

  document.getElementById('retry-wrong-btn')?.addEventListener('click', () => {
    const wrongQuestions = wrongIds.map(i => session.questions[i]);
    if (wrongQuestions.length === 0) return;
    const newSession = createSession(wrongQuestions);
    setState({ session: newSession, currentView: 'quiz' });
  });

  exportBtn.addEventListener('click', () => {
    let text = 'SCM Study List\n==============\n\n';
    const exportItems = new Set();
    session.questions.forEach((q, i) => {
      const a = session.answers[i];
      if (!a?.isCorrect || flags.includes(q.conceptId) || iffy.includes(q.conceptId)) {
        exportItems.add(i);
      }
    });
    for (const i of exportItems) {
      const q = session.questions[i];
      const a = session.answers[i];
      const status = [];
      if (a && !a.isCorrect) status.push('WRONG');
      if (flags.includes(q.conceptId)) status.push('FLAGGED');
      if (iffy.includes(q.conceptId)) status.push('IFFY');
      const label = q.questionType === 'strategic_tradeoff'
        ? `${q.objectiveA.label} vs ${q.objectiveB.label}`
        : q.questionType === 'consequence_chain'
          ? `${q.chain[0].label} \u2192 ${q.chain[1].label} \u2192 ${q.chain[2].label}`
          : (q.questionType === 'relationship' || q.questionType === 'cross_section_bridge')
            ? `${q.sourceConcept.label} \u2194 ${q.targetConcept.label}`
            : q.questionType === 'reverse_match'
              ? q.topicPrompt
              : q.correctTopic;
      const desc = q.questionType === 'strategic_tradeoff'
        ? q.scenario
        : (q.questionType === 'relationship' || q.questionType === 'consequence_chain' || q.questionType === 'cross_section_bridge')
          ? q.correctAnswer
          : q.questionType === 'reverse_match'
            ? q.correctAnswer
            : (q.scenario || q.definition);
      text += `[${q.section}] ${label} (${status.join(', ')})\n`;
      text += `  ${(desc || '').slice(0, 120)}...\n\n`;
    }
    navigator.clipboard.writeText(text).then(() => {
      const orig = exportBtn.textContent;
      exportBtn.textContent = 'Copied!';
      setTimeout(() => exportBtn.textContent = orig, 2000);
    });
  });
}

function renderFilteredList(filter, session, flags, iffy) {
  currentFilter = filter;
  const list = document.getElementById('results-list');

  document.querySelectorAll('.tab-bar__tab').forEach(tab => {
    tab.classList.toggle('tab-bar__tab--active', tab.dataset.filter === filter);
  });

  let indices = [];
  session.questions.forEach((q, i) => {
    const a = session.answers[i];
    switch (filter) {
      case 'wrong': if (a && !a.isCorrect) indices.push(i); break;
      case 'flagged': if (flags.includes(q.conceptId)) indices.push(i); break;
      case 'iffy': if (iffy.includes(q.conceptId)) indices.push(i); break;
      default: indices.push(i);
    }
  });

  list.textContent = '';

  if (indices.length === 0) {
    const empty = el('p', null, 'No items to show');
    empty.style.cssText = 'text-align:center;color:var(--text-muted);padding:var(--space-8)';
    list.appendChild(empty);
    return;
  }

  for (const i of indices) {
    const q = session.questions[i];
    const a = session.answers[i];
    const isCorrect = a?.isCorrect;
    const color = SECTION_COLORS[q.section];

    const item = el('div', 'result-item');
    item.dataset.index = i;

    // Header
    const hdr = el('button', 'result-item__header');
    hdr.appendChild(el('span', 'result-item__icon', isCorrect ? '\u2705' : '\u274C'));

    const isRelationship = q.questionType === 'relationship';
    const isChain = q.questionType === 'consequence_chain';
    const isBridge = q.questionType === 'cross_section_bridge';
    const isTradeoff = q.questionType === 'strategic_tradeoff';
    const isReverse = q.questionType === 'reverse_match';
    const topicText = isTradeoff
      ? `${q.objectiveA.label} vs ${q.objectiveB.label}`
      : isChain
        ? `${q.chain[0].label} \u2192 ${q.chain[1].label} \u2192 ${q.chain[2].label}`
        : isBridge
          ? `${q.sourceConcept.label} \u2194 ${q.targetConcept.label}`
          : isRelationship
            ? `${q.sourceConcept.label} \u2194 ${q.targetConcept.label}`
            : isReverse
              ? q.topicPrompt
              : q.correctTopic;
    const topic = el('span', 'result-item__topic', topicText);
    if (!isCorrect) topic.style.color = 'var(--wrong)';
    hdr.appendChild(topic);

    const badge = el('span', 'badge badge--section', q.section);
    badge.style.cssText = `background:${color};font-size:0.6rem`;
    hdr.appendChild(badge);
    if (q.level !== 'L1') {
      const lvBadge = el('span', 'badge badge--level-' + q.level, q.level);
      lvBadge.style.fontSize = '0.6rem';
      hdr.appendChild(lvBadge);
    }
    hdr.appendChild(el('span', 'result-item__chevron', '\u25BC'));
    item.appendChild(hdr);

    // Body
    const body = el('div', 'result-item__body');
    const inner = el('div', 'result-item__body-inner');
    const content = el('div', 'result-item__content');

    if (!isCorrect && a) {
      const wrongAns = el('p', null, 'Your answer: ' + a.selected);
      wrongAns.style.cssText = 'margin-bottom:var(--space-2);color:var(--wrong);font-size:var(--text-xs)';
      content.appendChild(wrongAns);
    }

    if (isReverse) {
      const correctDesc = el('p', null, 'Correct definition: ' + (q.correctAnswer || a?.correct));
      correctDesc.style.cssText = 'margin-bottom:var(--space-3);font-style:italic;color:var(--correct)';
      content.appendChild(correctDesc);
    } else if (isTradeoff) {
      const scenarioEl = el('p', null, q.scenario);
      scenarioEl.style.cssText = 'margin-bottom:var(--space-2);font-style:italic;font-size:var(--text-xs);color:var(--text-muted)';
      content.appendChild(scenarioEl);
      const correctDesc = el('p', null, 'Correct strategy: ' + (q.correctAnswer || a?.correct));
      correctDesc.style.cssText = 'margin-bottom:var(--space-3);font-style:italic;color:var(--correct)';
      content.appendChild(correctDesc);
    } else if (isRelationship || isChain || isBridge) {
      const correctDesc = el('p', null, 'Correct: ' + (q.correctAnswer || a?.correct));
      correctDesc.style.cssText = 'margin-bottom:var(--space-3);font-style:italic;color:var(--correct)';
      content.appendChild(correctDesc);
    } else {
      const def = el('p', null, q.scenario || q.definition);
      def.style.cssText = 'margin-bottom:var(--space-3);font-style:italic';
      content.appendChild(def);
    }
    content.appendChild(el('p', null, q.explanation));

    const terms = el('div');
    terms.style.cssText = 'margin-top:var(--space-3);display:flex;flex-wrap:wrap;gap:var(--space-2)';
    for (const t of q.keyTerms) {
      terms.appendChild(el('span', 'key-term', t));
    }
    content.appendChild(terms);

    inner.appendChild(content);
    body.appendChild(inner);
    item.appendChild(body);

    hdr.addEventListener('click', () => item.classList.toggle('result-item--expanded'));
    list.appendChild(item);
  }
}
