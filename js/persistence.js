// ─── localStorage Wrapper ───

const PREFIX = 'scmq_';

function key(name) {
  return PREFIX + name;
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

export function loadTheme() {
  return load('theme', 'light');
}

export function saveTheme(theme) {
  save('theme', theme);
}
