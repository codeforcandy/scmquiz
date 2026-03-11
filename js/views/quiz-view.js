// ─── Quiz View ───
// Data rendered here comes from our own static JSON files in data/.
// escapeHtml is used on all text content. Safe DOM methods preferred.

import { getState, subscribe, updateSession, setState } from '../store.js';
import { submitAnswer, nextQuestion, prevQuestion } from '../quiz-engine.js';
import { saveSession, loadFlags, toggleFlag, loadIffy, toggleIffy } from '../persistence.js';
import { updateProgress } from '../ui/progress-bar.js';
import { setKeyHandlers } from '../ui/keyboard.js';
import { initSwipe } from '../ui/swipe.js';

const SECTION_COLORS = {
  A: '#B8562F', B: '#2E7D6E', C: '#6C5B9E', D: '#3A7D44', E: '#C0862B',
  F: '#8B4F6E', G: '#4A6FA5', H: '#7B6340', I: '#5B8A72', J: '#9E5A5A', K: '#4E7A8B',
};

const ANSWER_KEYS = ['A', 'B', 'C', 'D'];
let timerInterval;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderQuizView() {
  const container = document.getElementById('quiz-view');
  container.textContent = '';

  const wrapper = el('div', 'container');

  // Header
  const header = el('div', 'quiz-header');
  const counter = el('span', 'quiz-counter');
  counter.id = 'quiz-counter';

  const meta = el('div', 'quiz-meta');
  const timer = el('span', null);
  timer.id = 'timer';
  timer.textContent = '0:00';
  const streak = el('span', 'streak');
  streak.id = 'streak';
  meta.append(timer, streak);

  const actionBar = el('div', 'action-bar');

  const flagBtn = el('button', 'action-btn action-btn--flag');
  flagBtn.id = 'flag-btn';
  flagBtn.title = 'Flag (F)';
  flagBtn.append(el('span', null, '\u2691'));
  const fHint = el('span', 'shortcut-hint', 'F');
  flagBtn.appendChild(fHint);

  const iffyBtn = el('button', 'action-btn action-btn--iffy');
  iffyBtn.id = 'iffy-btn';
  iffyBtn.title = 'Iffy (I)';
  iffyBtn.append(el('span', null, '?'));
  const iHint = el('span', 'shortcut-hint', 'I');
  iffyBtn.appendChild(iHint);

  const notesBtn = el('button', 'action-btn action-btn--notes');
  notesBtn.id = 'notes-btn';
  notesBtn.title = 'Notes (N)';
  notesBtn.append(el('span', null, '\u270E'));
  const nHint = el('span', 'shortcut-hint', 'N');
  notesBtn.appendChild(nHint);

  actionBar.append(flagBtn, iffyBtn, notesBtn);
  header.append(counter, meta, actionBar);
  wrapper.appendChild(header);

  // Question area
  const questionArea = el('div');
  questionArea.id = 'question-area';
  wrapper.appendChild(questionArea);

  // Footer
  const footer = el('div', 'quiz-footer');
  footer.id = 'quiz-footer';
  footer.style.display = 'none';
  const prevBtn = el('button', 'btn btn--ghost', '\u2190 Back');
  prevBtn.id = 'prev-btn';
  const nextBtn = el('button', 'btn btn--primary', 'Next \u2192');
  nextBtn.id = 'next-btn';
  footer.append(prevBtn, nextBtn);
  wrapper.appendChild(footer);

  container.appendChild(wrapper);

  startTimer();
  renderQuestion();

  const session = getState().session;
  updateProgress(session.currentIndex, session.questions.length);
  document.getElementById('progress-bar').style.display = '';

  initSwipe(container, { onLeft: handleNext, onRight: handlePrev });
  updateKeyHandlers();

  flagBtn.addEventListener('click', handleFlag);
  iffyBtn.addEventListener('click', handleIffy);
  notesBtn.addEventListener('click', handleNotes);
  nextBtn.addEventListener('click', handleNext);
  prevBtn.addEventListener('click', handlePrev);
}

function renderQuestion() {
  const session = getState().session;
  const q = session.questions[session.currentIndex];
  const answer = session.answers[session.currentIndex];
  const flags = loadFlags();
  const iffy = loadIffy();
  const color = SECTION_COLORS[q.section];

  // Counter
  document.getElementById('quiz-counter').textContent =
    `${session.currentIndex + 1} / ${session.questions.length}`;

  // Streak
  const streakEl = document.getElementById('streak');
  if (session.streak >= 3) {
    streakEl.textContent = '\uD83D\uDD25 ' + session.streak;
    streakEl.classList.add('streak--visible');
    if (!streakEl.dataset.shown) {
      streakEl.classList.add('streak-enter');
      streakEl.dataset.shown = '1';
    }
  } else {
    streakEl.classList.remove('streak--visible');
    delete streakEl.dataset.shown;
  }

  // Flag/iffy states
  document.getElementById('flag-btn').classList.toggle('active', flags.includes(q.conceptId));
  document.getElementById('iffy-btn').classList.toggle('active', iffy.includes(q.conceptId));

  // Build question card with safe DOM methods
  const area = document.getElementById('question-area');
  area.textContent = '';

  const card = el('div', 'card card--bordered definition-card card-enter');
  card.style.setProperty('--card-section-color', color);

  // Badges
  const badges = el('div', 'definition-card__badges');
  const secBadge = el('span', 'badge badge--section', 'Section ' + q.section);
  secBadge.style.background = color;
  const bloomBadge = el('span', 'badge badge--bloom', q.bloomLevel);
  const diffBadge = el('span', 'badge badge--difficulty-' + q.difficulty, q.difficulty);
  badges.append(secBadge, bloomBadge, diffBadge);
  card.appendChild(badges);

  // Definition text
  const defText = el('p', 'definition-card__text', q.definition);
  card.appendChild(defText);

  // Explanation (collapsed by default)
  const explanation = el('div', 'explanation');
  explanation.id = 'explanation';
  const explInner = el('div', 'explanation__inner');
  const explContent = el('div', 'explanation__content');
  const explText = el('p', 'explanation__text', q.explanation);
  explContent.appendChild(explText);

  // Key terms
  const termsWrap = el('div');
  termsWrap.style.cssText = 'margin-top:var(--space-3);display:flex;flex-wrap:wrap;gap:var(--space-2)';
  for (const t of q.keyTerms) {
    termsWrap.appendChild(el('span', 'key-term', t));
  }
  explContent.appendChild(termsWrap);

  // Sources
  const srcWrap = el('div');
  srcWrap.style.cssText = 'margin-top:var(--space-3);display:flex;flex-wrap:wrap;gap:var(--space-3)';
  for (const s of q.sources) {
    const a = document.createElement('a');
    a.className = 'source-link';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.site + ' \u2197';
    srcWrap.appendChild(a);
  }
  explContent.appendChild(srcWrap);

  explInner.appendChild(explContent);
  explanation.appendChild(explInner);
  card.appendChild(explanation);
  area.appendChild(card);

  // Answer buttons
  const grid = el('div', 'answers-grid stagger');
  grid.id = 'answers-grid';

  q.choices.forEach((choice, i) => {
    const btn = el('button', 'btn btn--answer');
    btn.dataset.choice = choice;

    if (answer) {
      btn.disabled = true;
      if (choice === answer.correct) {
        btn.classList.add('btn--correct', 'pulse-correct');
      } else if (choice === answer.selected && !answer.isCorrect) {
        btn.classList.add('btn--wrong', 'pulse-wrong');
      } else {
        btn.classList.add('btn--dimmed');
      }
    }

    const key = el('span', 'answer-key', ANSWER_KEYS[i]);
    btn.appendChild(key);
    btn.append(' ' + choice);

    if (!answer) {
      btn.addEventListener('click', () => handleAnswer(choice));
    }

    grid.appendChild(btn);
  });

  area.appendChild(grid);

  // Show explanation and footer if answered
  if (answer) {
    document.getElementById('explanation').classList.add('explanation--open');
    document.getElementById('quiz-footer').style.display = '';
  } else {
    document.getElementById('quiz-footer').style.display = 'none';
  }

  updateProgress(session.currentIndex, session.questions.length);
  saveSession(getState().session);
  updateKeyHandlers();
}

function handleAnswer(choice) {
  submitAnswer(choice);
  renderQuestion();
}

function handleNext() {
  const session = getState().session;
  if (!session.answers[session.currentIndex]) return;
  const hasMore = nextQuestion();
  if (hasMore) {
    renderQuestion();
  } else {
    clearInterval(timerInterval);
    setState({ currentView: 'results' });
  }
}

function handlePrev() {
  if (prevQuestion()) renderQuestion();
}

function handleFlag() {
  const q = getState().session.questions[getState().session.currentIndex];
  toggleFlag(q.conceptId);
  const btn = document.getElementById('flag-btn');
  btn.classList.toggle('active');
  btn.classList.add('bounce');
  setTimeout(() => btn.classList.remove('bounce'), 200);
}

function handleIffy() {
  const q = getState().session.questions[getState().session.currentIndex];
  toggleIffy(q.conceptId);
  const btn = document.getElementById('iffy-btn');
  btn.classList.toggle('active');
  btn.classList.add('bounce');
  setTimeout(() => btn.classList.remove('bounce'), 200);
}

function handleNotes() {
  document.dispatchEvent(new CustomEvent('toggle-notes', {
    detail: { conceptId: getState().session.questions[getState().session.currentIndex].conceptId }
  }));
}

function startTimer() {
  const session = getState().session;
  const start = session.startTime;
  const update = () => {
    const elapsed = Date.now() - start;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const el = document.getElementById('timer');
    if (el) el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  update();
  timerInterval = setInterval(update, 1000);
}

function updateKeyHandlers() {
  const session = getState().session;
  const answered = !!session.answers[session.currentIndex];
  const handlers = { 'f': handleFlag, 'i': handleIffy, 'n': handleNotes };

  if (answered) {
    handlers['enter'] = handleNext;
    handlers['arrowright'] = handleNext;
    handlers['arrowleft'] = handlePrev;
  } else {
    const q = session.questions[session.currentIndex];
    q.choices.forEach((choice, idx) => {
      handlers[String(idx + 1)] = () => handleAnswer(choice);
    });
  }
  setKeyHandlers(handlers);
}

export function cleanupQuizView() {
  clearInterval(timerInterval);
}
