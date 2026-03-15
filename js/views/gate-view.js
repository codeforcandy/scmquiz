// ─── Gate View (Passphrase Entry) ───

import { setState } from '../store.js';
import { authenticate } from '../auth.js';
import { saveUser } from '../persistence.js';

export function renderGateView() {
  const container = document.getElementById('gate-view');
  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'gate';
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh';

  // Icon
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:2.5rem;margin-bottom:var(--space-4)';
  icon.textContent = '\u{1F4DA}';
  wrapper.appendChild(icon);

  // Title
  const title = document.createElement('h1');
  title.className = 'setup-header__title';
  title.textContent = 'SCM Study Quiz';
  wrapper.appendChild(title);

  // Subtitle
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-8);text-align:center';
  subtitle.textContent = 'Enter your passphrase to continue';
  wrapper.appendChild(subtitle);

  // Form card
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'width:100%;max-width:320px;padding:var(--space-8) var(--space-6)';

  // Input
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Passphrase';
  input.autocomplete = 'off';
  input.style.cssText = [
    'width:100%',
    'padding:var(--space-3) var(--space-4)',
    'border:1.5px solid var(--border)',
    'border-radius:var(--radius-md)',
    'background:var(--bg-primary)',
    'color:var(--text-primary)',
    'font-family:var(--font-ui)',
    'font-size:var(--text-base)',
    'outline:none',
    'transition:border-color var(--duration-fast)',
    'box-sizing:border-box',
  ].join(';');
  input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
  input.addEventListener('blur', () => { input.style.borderColor = 'var(--border)'; });
  card.appendChild(input);

  // Error message
  const error = document.createElement('p');
  error.style.cssText = 'font-size:var(--text-xs);color:var(--wrong);margin-top:var(--space-2);min-height:1.2em';
  card.appendChild(error);

  // Submit button
  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.style.cssText = 'width:100%;margin-top:var(--space-4)';
  btn.textContent = 'Enter';
  card.appendChild(btn);

  wrapper.appendChild(card);
  container.appendChild(wrapper);

  // Focus input
  requestAnimationFrame(() => input.focus());

  // Submit handler
  let submitting = false;
  async function submit() {
    if (submitting) return;
    const val = input.value;
    if (!val.trim()) {
      error.textContent = 'Please enter a passphrase';
      shake(card);
      return;
    }
    submitting = true;
    btn.disabled = true;
    btn.textContent = '...';
    error.textContent = '';

    const userId = await authenticate(val);
    if (userId) {
      saveUser(userId);
      setState({ currentUser: userId, currentView: 'setup' });
    } else {
      error.textContent = 'Incorrect passphrase';
      shake(card);
      input.value = '';
      input.focus();
    }
    submitting = false;
    btn.disabled = false;
    btn.textContent = 'Enter';
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'pulseWrong var(--duration-normal) var(--ease-out)';
}
