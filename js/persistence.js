// ─── localStorage Wrapper ───

const PREFIX = 'scmq_';

// Global keys (not user-scoped)
const GLOBAL_KEYS = new Set(['theme', 'user']);

let currentUserId = null;

export function setCurrentUserId(id) {
  currentUserId = id;
}

function key(name) {
  if (GLOBAL_KEYS.has(name) || !currentUserId) {
    return PREFIX + name;
  }
  return PREFIX + 'u' + currentUserId + '_' + name;
}

export function load(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // quota exceeded — silently fail
  }
}

export function remove(name) {
  localStorage.removeItem(key(name));
}

// ─── User Accessors (global scope) ───

export function loadUser() {
  try {
    const raw = localStorage.getItem(PREFIX + 'user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(userId) {
  try {
    localStorage.setItem(PREFIX + 'user', JSON.stringify(userId));
  } catch {
    // quota exceeded
  }
  setCurrentUserId(userId);
}

export function clearUser() {
  localStorage.removeItem(PREFIX + 'user');
  currentUserId = null;
}

// ─── Typed Accessors ───

export function loadSession() {
  return load('session', null);
}

export function saveSession(session) {
  save('session', session);
}

export function clearSession() {
  remove('session');
}

export function loadNotes() {
  return load('notes', {});
}

export function saveNote(conceptId, text) {
  const notes = loadNotes();
  if (text.trim()) {
    notes[conceptId] = text;
  } else {
    delete notes[conceptId];
  }
  save('notes', notes);
}

export function loadFlags() {
  return load('flags', []);
}

export function saveFlags(flags) {
  save('flags', flags);
}

export function toggleFlag(conceptId) {
  const flags = loadFlags();
  const idx = flags.indexOf(conceptId);
  if (idx >= 0) {
    flags.splice(idx, 1);
  } else {
    flags.push(conceptId);
  }
  saveFlags(flags);
  return flags;
}

export function loadIffy() {
  return load('iffy', []);
}

export function saveIffy(iffy) {
  save('iffy', iffy);
}

export function toggleIffy(conceptId) {
  const iffy = loadIffy();
  const idx = iffy.indexOf(conceptId);
  if (idx >= 0) {
    iffy.splice(idx, 1);
  } else {
    iffy.push(conceptId);
  }
  saveIffy(iffy);
  return iffy;
}

export function loadStats() {
  return load('stats', {
    totalQuizzes: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    longestStreak: 0,
    lastStudied: null,
  });
}

export function updateStats(sessionResult) {
  const stats = loadStats();
  stats.totalQuizzes++;
  stats.totalCorrect += sessionResult.correct;
  stats.totalAnswered += sessionResult.total;
  stats.longestStreak = Math.max(stats.longestStreak, sessionResult.longestStreak);
  stats.lastStudied = new Date().toISOString();
  save('stats', stats);
}

export function loadLevels() {
  return load('levels', ['L1']);
}

export function saveLevels(levels) {
  save('levels', levels);
}

export function loadTheme() {
  return load('theme', 'light');
}

export function saveTheme(theme) {
  save('theme', theme);
}
