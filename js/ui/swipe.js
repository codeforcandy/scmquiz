// ─── Touch Swipe Handler ───

const THRESHOLD = 50;     // min distance
const VELOCITY = 0.3;     // min px/ms
const RESTRAINT = 100;    // max perpendicular

export function initSwipe(element, { onLeft, onRight }) {
  let startX, startY, startTime;

  element.addEventListener('touchstart', e => {
    const touch = e.changedTouches[0];
    startX = touch.pageX;
    startY = touch.pageY;
    startTime = Date.now();
  }, { passive: true });

  element.addEventListener('touchend', e => {
    const touch = e.changedTouches[0];
    const dx = touch.pageX - startX;
    const dy = touch.pageY - startY;
    const dt = Date.now() - startTime;
    const vx = Math.abs(dx) / dt;

    if (Math.abs(dx) >= THRESHOLD && Math.abs(dy) <= RESTRAINT && vx >= VELOCITY) {
      if (dx < 0 && onLeft) onLeft();
      if (dx > 0 && onRight) onRight();
    }
  }, { passive: true });
}
