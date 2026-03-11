// ─── Data Loader ───

import { setState } from './store.js';

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export async function loadAllData() {
  const fetches = SECTIONS.map(s =>
    fetch(`data/${s}.json`).then(r => r.json())
  );
  const results = await Promise.all(fetches);

  const concepts = new Map();
  const sectionMeta = new Map();

  for (const sectionData of results) {
    const { section_id, section_title, concepts: items } = sectionData;

    sectionMeta.set(section_id, {
      id: section_id,
      title: section_title,
      conceptCount: items.length,
    });

    for (const concept of items) {
      concepts.set(concept.id, {
        ...concept,
        section: section_id,
        sectionTitle: section_title,
      });
    }
  }

  setState({ concepts, sectionMeta });
  return { concepts, sectionMeta };
}

export function getConceptsBySection(concepts, sectionId) {
  return [...concepts.values()].filter(c => c.section === sectionId);
}

export function getConceptsByDifficulty(concepts, difficulty) {
  return [...concepts.values()].filter(c => c.quiz.difficulty === difficulty);
}

export function filterConcepts(concepts, sections, difficulties) {
  return [...concepts.values()].filter(c =>
    sections.includes(c.section) &&
    difficulties.includes(c.quiz.difficulty)
  );
}
