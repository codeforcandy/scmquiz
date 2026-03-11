// ─── Progress Bar ───

const el = () => document.getElementById('progress-fill');

export function updateProgress(current, total) {
  const fill = el();
  if (!fill) return;
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  fill.style.width = `${pct}%`;
}

export function resetProgress() {
  const fill = el();
  if (fill) fill.style.width = '0%';
}
