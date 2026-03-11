// ─── Keyboard Shortcuts ───

let handlers = {};

export function initKeyboard() {
  // Only enable on devices with hover (desktop)
  if (!window.matchMedia('(hover: hover)').matches) return;

  document.addEventListener('keydown', e => {
    // Skip if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    if (handlers[key]) {
      e.preventDefault();
      handlers[key]();
    }
  });
}

export function setKeyHandlers(newHandlers) {
  handlers = newHandlers;
}

export function clearKeyHandlers() {
  handlers = {};
}
