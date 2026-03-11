// ─── Pub/Sub State Management ───

const listeners = new Map();
let state = {
  concepts: new Map(),
  sectionMeta: new Map(),
  session: null,
  currentView: 'setup',
  theme: 'light',
};

export function getState() {
  return state;
}

export function setState(partial) {
  const prev = { ...state };
  state = { ...state, ...partial };
  for (const [key, cbs] of listeners) {
    if (key in partial) {
      cbs.forEach(cb => cb(state[key], prev[key]));
    }
  }
  // wildcard listeners
  if (listeners.has('*')) {
    listeners.get('*').forEach(cb => cb(state, prev));
  }
}

export function subscribe(key, cb) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(cb);
  return () => listeners.get(key).delete(cb);
}

export function getSession() {
  return state.session;
}

export function updateSession(partial) {
  setState({ session: { ...state.session, ...partial } });
}
