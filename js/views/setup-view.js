// ─── Setup View ───
// Note: All data rendered here comes from our own static JSON files in data/,
// not from user input. The innerHTML usage is safe for this context.

import { getState, setState } from '../store.js';
import { filterConcepts } from '../data-loader.js';
import { generateQuestions, createSession } from '../quiz-engine.js';
import { loadSession, saveSession, loadLevels, saveLevels } from '../persistence.js';

const SECTION_COLORS = {
  A: '#B8562F', B: '#2E7D6E', C: '#6C5B9E', D: '#3A7D44', E: '#C0862B',
  F: '#8B4F6E', G: '#4A6FA5', H: '#7B6340', I: '#5B8A72', J: '#9E5A5A', K: '#4E7A8B',
};

let selectedSections = [];
let selectedDifficulties = ['easy', 'medium', 'hard'];
let selectedLevels = ['L1'];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderSetupView() {
  const { sectionMeta, concepts } = getState();
  const container = document.getElementById('setup-view');
  const saved = loadSession();

  // Build DOM using safe methods
  container.textContent = '';

  // Resume banner
  if (saved && saved.currentIndex < saved.questions.length && !saved.endTime) {
    const answered = Object.keys(saved.answers).length;
    const banner = document.createElement('div');
    banner.className = 'resume-banner';
    banner.id = 'resume-banner';

    const txt = document.createElement('span');
    txt.className = 'resume-banner__text';
    txt.textContent = `Resume quiz? (${answered}/${saved.questions.length} answered)`;
    banner.appendChild(txt);

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:var(--space-2)';
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn btn--primary';
    resumeBtn.style.cssText = 'padding:var(--space-2) var(--space-4);font-size:var(--text-sm)';
    resumeBtn.id = 'resume-btn';
    resumeBtn.textContent = 'Resume';
    const discardBtn = document.createElement('button');
    discardBtn.className = 'btn btn--ghost';
    discardBtn.id = 'discard-btn';
    discardBtn.textContent = 'Discard';
    btnWrap.append(resumeBtn, discardBtn);
    banner.appendChild(btnWrap);
    container.appendChild(banner);
  }

  // Header
  const header = document.createElement('div');
  header.className = 'setup-header';
  const h1 = document.createElement('h1');
  h1.className = 'setup-header__title';
  h1.textContent = 'SCM Study Quiz';
  const sub = document.createElement('p');
  sub.className = 'setup-header__subtitle';
  const totalConcepts = [...concepts.values()].length;
  sub.textContent = `${totalConcepts} concepts across 11 sections (L1\u2013L8)`;
  header.append(h1, sub);
  container.appendChild(header);

  // Level toggle
  const levelSection = document.createElement('div');
  levelSection.className = 'setup-section';
  const levelLabel = document.createElement('div');
  levelLabel.className = 'setup-section__label';
  const levelSpan = document.createElement('span');
  levelSpan.textContent = 'Level';
  levelLabel.appendChild(levelSpan);
  levelSection.appendChild(levelLabel);

  const levelGrid = document.createElement('div');
  levelGrid.className = 'chip-grid';
  levelGrid.id = 'level-chips';

  const levels = [
    { key: 'L1', label: 'L1 Textbook', color: 'var(--accent)', bg: 'var(--accent-light)' },
    { key: 'L2', label: 'L2 Analogies', color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
    { key: 'L3', label: 'L3 Scenarios', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    { key: 'L4', label: 'L4 Analogies+', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
    { key: 'L5', label: 'L5 Connections', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
    { key: 'L6', label: 'L6 Systems', color: '#b91c1c', bg: 'rgba(185,28,28,0.08)' },
    { key: 'L7', label: 'L7 Tradeoffs', color: '#4338ca', bg: 'rgba(67,56,202,0.08)' },
    { key: 'L8', label: 'L8 Micro', color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  ];
  for (const lv of levels) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.level = lv.key;
    chip.style.setProperty('--chip-color', lv.color);
    chip.style.setProperty('--chip-bg', lv.bg);
    chip.textContent = lv.label + ' ';
    const cnt = document.createElement('span');
    cnt.className = 'chip-count';
    chip.appendChild(cnt);
    levelGrid.appendChild(chip);
  }
  levelSection.appendChild(levelGrid);
  container.appendChild(levelSection);

  // Sections
  const secSection = document.createElement('div');
  secSection.className = 'setup-section';

  const secLabel = document.createElement('div');
  secLabel.className = 'setup-section__label';
  const secSpan = document.createElement('span');
  secSpan.textContent = 'Sections';
  const secActions = document.createElement('div');
  secActions.className = 'setup-section__actions';
  const selAllBtn = document.createElement('button');
  selAllBtn.className = 'btn btn--ghost';
  selAllBtn.id = 'select-all-btn';
  selAllBtn.style.fontSize = 'var(--text-xs)';
  selAllBtn.textContent = 'Select All';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn--ghost';
  clearBtn.id = 'clear-all-btn';
  clearBtn.style.fontSize = 'var(--text-xs)';
  clearBtn.textContent = 'Clear';
  secActions.append(selAllBtn, clearBtn);
  secLabel.append(secSpan, secActions);
  secSection.appendChild(secLabel);

  const chipGrid = document.createElement('div');
  chipGrid.className = 'chip-grid';
  chipGrid.id = 'section-chips';

  for (const [id, meta] of sectionMeta) {
    const color = SECTION_COLORS[id];
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.section = id;
    chip.style.setProperty('--chip-color', color);
    chip.style.setProperty('--chip-bg', color + '15');

    const strong = document.createElement('strong');
    strong.textContent = id;
    chip.appendChild(strong);
    chip.append(' ' + meta.title.split(' ').slice(0, 3).join(' ') + ' ');
    const cnt = document.createElement('span');
    cnt.className = 'chip-count';
    cnt.textContent = meta.conceptCount;
    chip.appendChild(cnt);
    chipGrid.appendChild(chip);
  }
  secSection.appendChild(chipGrid);
  container.appendChild(secSection);

  // Difficulty
  const diffSection = document.createElement('div');
  diffSection.className = 'setup-section';
  const diffLabel = document.createElement('div');
  diffLabel.className = 'setup-section__label';
  const diffSpan = document.createElement('span');
  diffSpan.textContent = 'Difficulty';
  diffLabel.appendChild(diffSpan);
  diffSection.appendChild(diffLabel);

  const diffGrid = document.createElement('div');
  diffGrid.className = 'chip-grid';
  diffGrid.id = 'difficulty-chips';

  const diffs = [
    { key: 'easy', color: 'var(--correct)', bg: 'var(--correct-light)' },
    { key: 'medium', color: '#9B7A20', bg: 'var(--flag-light)' },
    { key: 'hard', color: 'var(--wrong)', bg: 'var(--wrong-light)' },
  ];
  for (const d of diffs) {
    const chip = document.createElement('button');
    chip.className = 'chip chip--active';
    chip.dataset.difficulty = d.key;
    chip.style.setProperty('--chip-color', d.color);
    chip.style.setProperty('--chip-bg', d.bg);
    chip.textContent = d.key.charAt(0).toUpperCase() + d.key.slice(1) + ' ';
    const cnt = document.createElement('span');
    cnt.className = 'chip-count';
    chip.appendChild(cnt);
    diffGrid.appendChild(chip);
  }
  diffSection.appendChild(diffGrid);
  container.appendChild(diffSection);

  // Question count
  const qcDiv = document.createElement('div');
  qcDiv.className = 'question-count';
  qcDiv.id = 'question-count';
  const qcNum = document.createElement('span');
  qcNum.className = 'question-count__number';
  qcNum.textContent = '0';
  const qcLabel = document.createElement('span');
  qcLabel.className = 'question-count__label';
  qcLabel.textContent = 'questions available';
  qcDiv.append(qcNum, qcLabel);
  container.appendChild(qcDiv);

  // Start button
  const startWrap = document.createElement('div');
  startWrap.style.cssText = 'text-align:center;padding-bottom:var(--space-8)';
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn--primary';
  startBtn.id = 'start-btn';
  startBtn.disabled = true;
  startBtn.textContent = 'Start Quiz';
  startWrap.appendChild(startBtn);
  container.appendChild(startWrap);

  container.classList.add('view-enter');

  // Default: select all sections, restore persisted levels
  selectedSections = [...sectionMeta.keys()];
  selectedDifficulties = ['easy', 'medium', 'hard'];
  selectedLevels = loadLevels();
  updateChipStates();
  updateCount();

  bindSetupEvents();
}

function bindSetupEvents() {
  document.getElementById('level-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-level]');
    if (!chip) return;
    const lv = chip.dataset.level;
    const idx = selectedLevels.indexOf(lv);
    if (idx >= 0) {
      if (selectedLevels.length > 1) selectedLevels.splice(idx, 1);
    } else {
      selectedLevels.push(lv);
    }
    saveLevels(selectedLevels);
    updateChipStates();
    updateCount();
  });

  document.getElementById('section-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-section]');
    if (!chip) return;
    const id = chip.dataset.section;
    const idx = selectedSections.indexOf(id);
    if (idx >= 0) selectedSections.splice(idx, 1);
    else selectedSections.push(id);
    updateChipStates();
    updateCount();
  });

  document.getElementById('difficulty-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-difficulty]');
    if (!chip) return;
    const d = chip.dataset.difficulty;
    const idx = selectedDifficulties.indexOf(d);
    if (idx >= 0) {
      if (selectedDifficulties.length > 1) selectedDifficulties.splice(idx, 1);
    } else {
      selectedDifficulties.push(d);
    }
    updateChipStates();
    updateCount();
  });

  document.getElementById('select-all-btn')?.addEventListener('click', () => {
    selectedSections = [...getState().sectionMeta.keys()];
    updateChipStates();
    updateCount();
  });

  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    selectedSections = [];
    updateChipStates();
    updateCount();
  });

  document.getElementById('start-btn')?.addEventListener('click', () => {
    const { concepts } = getState();
    const filtered = filterConcepts(concepts, selectedSections, selectedDifficulties, selectedLevels);
    const questions = generateQuestions(filtered);
    const session = createSession(questions);
    setState({ session });
    saveSession(session);
    setState({ currentView: 'quiz' });
  });

  document.getElementById('resume-btn')?.addEventListener('click', () => {
    const saved = loadSession();
    if (saved) {
      setState({ session: saved, currentView: 'quiz' });
    }
  });

  document.getElementById('discard-btn')?.addEventListener('click', () => {
    import('../persistence.js').then(p => p.clearSession());
    document.getElementById('resume-banner')?.remove();
  });
}

function updateChipStates() {
  document.querySelectorAll('#level-chips .chip').forEach(chip => {
    chip.classList.toggle('chip--active', selectedLevels.includes(chip.dataset.level));
  });
  document.querySelectorAll('#section-chips .chip').forEach(chip => {
    chip.classList.toggle('chip--active', selectedSections.includes(chip.dataset.section));
  });
  document.querySelectorAll('#difficulty-chips .chip').forEach(chip => {
    chip.classList.toggle('chip--active', selectedDifficulties.includes(chip.dataset.difficulty));
  });
}

function updateCount() {
  const { concepts } = getState();
  const filtered = filterConcepts(concepts, selectedSections, selectedDifficulties, selectedLevels);
  const count = filtered.length;

  const numEl = document.querySelector('.question-count__number');
  if (numEl) numEl.textContent = count;

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.disabled = count === 0;

  document.querySelectorAll('#level-chips .chip').forEach(chip => {
    const lv = chip.dataset.level;
    const lvCount = filterConcepts(concepts, selectedSections, selectedDifficulties, [lv]).length;
    const countSpan = chip.querySelector('.chip-count');
    if (countSpan) countSpan.textContent = lvCount;
  });

  document.querySelectorAll('#difficulty-chips .chip').forEach(chip => {
    const d = chip.dataset.difficulty;
    const dCount = filterConcepts(concepts, selectedSections, [d], selectedLevels).length;
    const countSpan = chip.querySelector('.chip-count');
    if (countSpan) countSpan.textContent = dCount;
  });
}
