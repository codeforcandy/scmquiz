// ─── Notes Panel ───

import { getState } from '../store.js';
import { loadNotes, saveNote } from '../persistence.js';

let isOpen = false;
let currentConceptId = null;
let debounceTimer = null;

export function initNotesPanel() {
  document.addEventListener('toggle-notes', (e) => {
    const conceptId = e.detail?.conceptId;
    if (isOpen && conceptId === currentConceptId) {
      closeNotes();
    } else {
      openNotes(conceptId);
    }
  });

  // Close on backdrop click
  document.getElementById('notes-backdrop')?.addEventListener('click', closeNotes);
  document.getElementById('notes-close')?.addEventListener('click', closeNotes);
}

function openNotes(conceptId) {
  currentConceptId = conceptId;
  isOpen = true;

  const panel = document.getElementById('notes-panel');
  const backdrop = document.getElementById('notes-backdrop');
  if (!panel) return;

  const concepts = getState().concepts;
  const concept = concepts.get(conceptId);
  const notes = loadNotes();
  const noteText = notes[conceptId] || '';

  panel.querySelector('.notes-panel__concept').textContent =
    concept ? `${conceptId}: ${concept.topic}` : conceptId;
  panel.querySelector('.notes-panel__textarea').value = noteText;

  panel.classList.add('notes-panel--open');
  backdrop.classList.add('backdrop--visible');
  document.getElementById('notes-btn')?.classList.add('active');

  // Focus textarea
  setTimeout(() => panel.querySelector('.notes-panel__textarea')?.focus(), 300);

  // Auto-save with debounce
  const textarea = panel.querySelector('.notes-panel__textarea');
  textarea.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveNote(currentConceptId, textarea.value);
    }, 500);
  };
}

function closeNotes() {
  isOpen = false;
  const panel = document.getElementById('notes-panel');
  const backdrop = document.getElementById('notes-backdrop');
  if (panel) panel.classList.remove('notes-panel--open');
  if (backdrop) backdrop.classList.remove('backdrop--visible');
  document.getElementById('notes-btn')?.classList.remove('active');

  // Save immediately on close
  if (currentConceptId) {
    const textarea = panel?.querySelector('.notes-panel__textarea');
    if (textarea) saveNote(currentConceptId, textarea.value);
  }
}

export function isNotesOpen() {
  return isOpen;
}
