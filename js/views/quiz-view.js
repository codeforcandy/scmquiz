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
let selectedChoice = null;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function formatQuestionText(q, answer) {
  const lines = [];

  // Header: [Section] [Level] [bloom] [difficulty]
  lines.push(`[Section ${q.section}] [${q.level}] [${q.bloomLevel}] [${q.difficulty}]`);
  lines.push('');

  // Question prompt + content by type
  lines.push('QUESTION:');
  if (q.questionType === 'strategic_tradeoff') {
    lines.push('Which strategy correctly navigates this tradeoff?');
    lines.push(`Objective A: ${q.objectiveA.label} (${q.objectiveA.section})`);
    lines.push(`Objective B: ${q.objectiveB.label} (${q.objectiveB.section})`);
    lines.push(`Scenario: ${q.scenario}`);
    lines.push(`Levers: ${q.levers.map(l => `[${l.section}] ${l.label}`).join(', ')}`);
  } else if (q.questionType === 'consequence_chain') {
    lines.push('What happens downstream when the middle link is disrupted?');
    lines.push(`${q.chain[0].label} → ${q.chain[1].label} [DISRUPTED] → ${q.chain[2].label}`);
  } else if (q.questionType === 'cross_section_bridge') {
    lines.push('How do these concepts interact across domains?');
    lines.push(`[${q.sourceConcept.section}] ${q.sourceConcept.label} ↔ [${q.targetConcept.section}] ${q.targetConcept.label}`);
  } else if (q.questionType === 'relationship') {
    lines.push('How are these concepts connected?');
    lines.push(`${q.sourceConcept.label} ↕ ${q.relationshipType.replace(/_/g, ' ')} ↕ ${q.targetConcept.label}`);
  } else if (q.questionType === 'reverse_match') {
    lines.push('What does this concept mean?');
    lines.push(q.topicPrompt);
  } else if (q.questionType === 'micro_definition') {
    lines.push('Name this concept.');
    lines.push(q.definition);
  } else if (q.questionType === 'scenario') {
    lines.push('What concept is being demonstrated?');
    lines.push(q.scenario);
  } else if (q.questionType === 'analogy') {
    lines.push('Which concept does this describe?');
    lines.push(q.definition);
  } else {
    lines.push('Which concept matches this definition?');
    lines.push(q.definition);
  }
  lines.push('');

  // Answer key: find letter + correct text
  const correctValue = (q.questionType === 'relationship' || q.questionType === 'consequence_chain' || q.questionType === 'cross_section_bridge')
    ? answer.correct
    : answer.correct;
  const correctIdx = q.choices.indexOf(correctValue);
  const letter = correctIdx >= 0 ? ANSWER_KEYS[correctIdx] : '?';
  lines.push(`ANSWER KEY: ${letter}) ${correctValue}`);
  lines.push('');

  // Explanation
  lines.push('EXPLANATION:');
  lines.push(q.explanation);
  lines.push('');

  // Key terms
  lines.push(`KEY TERMS: ${q.keyTerms.join(', ')}`);

  return lines.join('\n');
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

  const homeBtn = el('button', 'action-btn action-btn--home');
  homeBtn.id = 'home-btn';
  homeBtn.title = 'Exit to Home';
  homeBtn.append(el('span', null, '\u2716'));

  actionBar.append(flagBtn, iffyBtn, notesBtn, homeBtn);
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
  homeBtn.addEventListener('click', handleHome);
}

function renderQuestion() {
  selectedChoice = null;
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

  const isScenario = q.questionType === 'scenario';
  const isAnalogy = q.questionType === 'analogy';
  const isRelationship = q.questionType === 'relationship';
  const isConsequenceChain = q.questionType === 'consequence_chain';
  const isCrossBridge = q.questionType === 'cross_section_bridge';
  const isTradeoff = q.questionType === 'strategic_tradeoff';
  const isMicro = q.questionType === 'micro_definition';
  const isReverse = q.questionType === 'reverse_match';
  let cardClass = 'card card--bordered definition-card card-enter';
  if (isScenario) cardClass = 'card card--bordered scenario-card card-enter';
  else if (isAnalogy) cardClass = 'card card--bordered analogy-card card-enter';
  else if (isRelationship) cardClass = 'card card--bordered relationship-card card-enter';
  else if (isConsequenceChain) cardClass = 'card card--bordered chain-card card-enter';
  else if (isCrossBridge) cardClass = 'card card--bordered bridge-card card-enter';
  else if (isTradeoff) cardClass = 'card card--bordered tradeoff-card card-enter';
  else if (isMicro) cardClass = 'card card--bordered micro-card card-enter';
  else if (isReverse) cardClass = 'card card--bordered reverse-card card-enter';
  const card = el('div', cardClass);
  card.style.setProperty('--card-section-color', color);

  // Badges
  const badges = el('div', 'definition-card__badges');
  if (isTradeoff && q.levers) {
    const sections = new Set([q.section, ...q.levers.map(l => l.section)]);
    const secBadge = el('span', 'badge badge--section', 'Sections ' + [...sections].join('+'));
    secBadge.style.background = color;
    badges.appendChild(secBadge);
  } else if (isCrossBridge && q.targetConcept) {
    const secBadge = el('span', 'badge badge--section', 'Sections ' + q.section + '+' + q.targetConcept.section);
    secBadge.style.background = color;
    badges.appendChild(secBadge);
  } else {
    const secBadge = el('span', 'badge badge--section', 'Section ' + q.section);
    secBadge.style.background = color;
    badges.appendChild(secBadge);
  }
  if (q.level !== 'L1') {
    const lvBadge = el('span', 'badge badge--level-' + q.level, q.level);
    badges.appendChild(lvBadge);
  }
  const bloomBadge = el('span', 'badge badge--bloom', q.bloomLevel);
  const diffBadge = el('span', 'badge badge--difficulty-' + q.difficulty, q.difficulty);
  badges.append(bloomBadge, diffBadge);
  card.appendChild(badges);

  // Content by question type
  if (isTradeoff) {
    card.appendChild(el('p', 'tradeoff-card__prompt', 'Which strategy correctly navigates this tradeoff?'));

    // Tension bar: objective A ←→ objective B
    const tensionBar = el('div', 'tradeoff-card__tension');
    const objA = el('div', 'tradeoff-card__objective');
    objA.appendChild(el('span', 'tradeoff-card__obj-label', q.objectiveA.label));
    const objASec = el('span', 'tradeoff-card__obj-section', q.objectiveA.section);
    objASec.style.background = SECTION_COLORS[q.objectiveA.section] || color;
    objA.appendChild(objASec);

    const vs = el('div', 'tradeoff-card__vs', 'vs');

    const objB = el('div', 'tradeoff-card__objective');
    objB.appendChild(el('span', 'tradeoff-card__obj-label', q.objectiveB.label));
    const objBSec = el('span', 'tradeoff-card__obj-section', q.objectiveB.section);
    objBSec.style.background = SECTION_COLORS[q.objectiveB.section] || color;
    objB.appendChild(objBSec);

    tensionBar.append(objA, vs, objB);
    card.appendChild(tensionBar);

    // Scenario
    card.appendChild(el('p', 'tradeoff-card__scenario', q.scenario));

    // Levers
    const leversWrap = el('div', 'tradeoff-card__levers');
    leversWrap.appendChild(el('span', 'tradeoff-card__levers-label', 'Levers:'));
    for (const lever of q.levers) {
      const chip = el('span', 'tradeoff-card__lever');
      const sec = el('span', 'tradeoff-card__lever-section', lever.section);
      sec.style.background = SECTION_COLORS[lever.section] || color;
      chip.appendChild(sec);
      chip.appendChild(document.createTextNode(' ' + lever.label));
      leversWrap.appendChild(chip);
    }
    card.appendChild(leversWrap);
  } else if (isConsequenceChain) {
    card.appendChild(el('p', 'chain-card__prompt', 'What happens downstream when the middle link is disrupted?'));
    const chainViz = el('div', 'chain-card__flow');
    // Concept 1
    const c1 = el('div', 'chain-card__concept', q.chain[0].label);
    chainViz.appendChild(c1);
    // Link 1
    const link1 = el('div', 'chain-card__link');
    link1.appendChild(el('span', 'chain-card__arrow', '\u2193'));
    link1.appendChild(el('span', 'chain-card__link-type', q.links[0].type.replace(/_/g, ' ')));
    chainViz.appendChild(link1);
    // Concept 2 (disrupted)
    const c2 = el('div', 'chain-card__concept chain-card__concept--disrupted');
    c2.appendChild(el('span', 'chain-card__concept-text', q.chain[1].label));
    c2.appendChild(el('span', 'chain-card__disrupted-badge', 'DISRUPTED'));
    chainViz.appendChild(c2);
    // Link 2 (broken)
    const link2 = el('div', 'chain-card__link chain-card__link--broken');
    link2.appendChild(el('span', 'chain-card__arrow', '\u2193'));
    link2.appendChild(el('span', 'chain-card__link-type', q.links[1].type.replace(/_/g, ' ')));
    chainViz.appendChild(link2);
    // Concept 3 (affected)
    const c3 = el('div', 'chain-card__concept chain-card__concept--affected', q.chain[2].label);
    chainViz.appendChild(c3);
    card.appendChild(chainViz);
  } else if (isCrossBridge) {
    card.appendChild(el('p', 'bridge-card__prompt', 'How do these concepts interact across domains?'));
    const bridgeViz = el('div', 'bridge-card__pair');
    const srcBox = el('div', 'bridge-card__concept');
    const srcBadge = el('span', 'bridge-card__section-badge', q.sourceConcept.section);
    srcBadge.style.background = SECTION_COLORS[q.sourceConcept.section];
    srcBox.appendChild(srcBadge);
    srcBox.appendChild(el('span', 'bridge-card__label', q.sourceConcept.label));
    const connector = el('div', 'bridge-card__connector', '\u2194');
    const tgtBox = el('div', 'bridge-card__concept');
    const tgtBadge = el('span', 'bridge-card__section-badge', q.targetConcept.section);
    tgtBadge.style.background = SECTION_COLORS[q.targetConcept.section];
    tgtBox.appendChild(tgtBadge);
    tgtBox.appendChild(el('span', 'bridge-card__label', q.targetConcept.label));
    bridgeViz.append(srcBox, connector, tgtBox);
    card.appendChild(bridgeViz);
  } else if (isRelationship) {
    card.appendChild(el('p', 'relationship-card__prompt', 'How are these concepts connected?'));
    const pair = el('div', 'relationship-card__pair');
    pair.appendChild(el('div', 'relationship-card__concept', q.sourceConcept.label));
    const connector = el('div', 'relationship-card__connector');
    connector.appendChild(el('span', 'relationship-card__arrow', '\u2195'));
    connector.appendChild(el('span', 'relationship-card__type', q.relationshipType.replace(/_/g, ' ')));
    pair.appendChild(connector);
    pair.appendChild(el('div', 'relationship-card__concept', q.targetConcept.label));
    card.appendChild(pair);
  } else if (isScenario) {
    card.appendChild(el('p', 'scenario-card__prompt', 'What concept is being demonstrated?'));
    card.appendChild(el('p', 'scenario-card__text', q.scenario));
  } else if (isAnalogy) {
    card.appendChild(el('p', 'analogy-card__prompt', 'Which concept does this describe?'));
    card.appendChild(el('p', 'analogy-card__text', q.definition));
  } else if (isReverse) {
    card.appendChild(el('p', 'reverse-card__prompt', 'What does this concept mean?'));
    card.appendChild(el('p', 'reverse-card__topic', q.topicPrompt));
  } else if (isMicro) {
    card.appendChild(el('p', 'micro-card__prompt', 'Name this concept.'));
    card.appendChild(el('p', 'micro-card__text', q.definition));
  } else {
    card.appendChild(el('p', 'definition-card__text', q.definition));
  }

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

  // Copy button
  const copyBtn = el('button', 'btn btn--ghost copy-btn');
  copyBtn.textContent = '\uD83D\uDCCB Copy';
  copyBtn.addEventListener('click', () => {
    const text = formatQuestionText(q, answer);
    navigator.clipboard.writeText(text).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = orig, 2000);
    });
  });
  explContent.appendChild(copyBtn);

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
    const text = el('span', null, choice);
    btn.append(key, text);

    if (!answer) {
      if (selectedChoice === choice) {
        btn.classList.add('btn--selected');
      }
      btn.addEventListener('click', () => handleAnswerClick(choice));
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

function handleAnswerClick(choice) {
  if (selectedChoice === choice) {
    // Second click on same answer — submit it
    selectedChoice = null;
    submitAnswer(choice);
    renderQuestion();
  } else {
    // First click — select this answer
    selectedChoice = choice;
    const grid = document.getElementById('answers-grid');
    for (const btn of grid.children) {
      btn.classList.toggle('btn--selected', btn.dataset.choice === choice);
    }
    updateKeyHandlers();
  }
}

function handleHome() {
  clearInterval(timerInterval);
  selectedChoice = null;
  document.getElementById('progress-bar').style.display = 'none';
  setState({ currentView: 'setup' });
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
    if (selectedChoice) {
      handlers['enter'] = () => handleAnswerClick(selectedChoice);
    }
    q.choices.forEach((choice, idx) => {
      handlers[String(idx + 1)] = () => handleAnswerClick(choice);
    });
  }
  setKeyHandlers(handlers);
}

export function cleanupQuizView() {
  clearInterval(timerInterval);
}
