// ─── Data Loader ───

import { setState } from './store.js';

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

export async function loadAllData() {
  // Fetch L1 and L2 files in parallel
  const l1Fetches = SECTIONS.map(s =>
    fetch(`data/${s}.json`).then(r => r.json())
  );
  const l2Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L2.json`).then(r => r.json())
  );
  const l3Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L3.json`)
      .then(r => r.ok ? r.json() : { section_id: s, concepts: [] })
      .catch(() => ({ section_id: s, concepts: [] }))
  );
  const l4Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L4.json`)
      .then(r => r.ok ? r.json() : { section_id: s, concepts: [] })
      .catch(() => ({ section_id: s, concepts: [] }))
  );
  const [l1Results, l2Results, l3Results, l4Results] = await Promise.all([
    Promise.all(l1Fetches),
    Promise.all(l2Fetches),
    Promise.all(l3Fetches),
    Promise.all(l4Fetches),
  ]);

  const concepts = new Map();
  const sectionMeta = new Map();

  // Load L1 concepts
  for (const sectionData of l1Results) {
    const { section_id, section_title, concepts: items } = sectionData;

    sectionMeta.set(section_id, {
      id: section_id,
      title: section_title,
      conceptCount: items.length,
      l2ConceptCount: 0,
      l3ConceptCount: 0,
      l4ConceptCount: 0,
    });

    for (const concept of items) {
      concepts.set(concept.id, {
        ...concept,
        section: section_id,
        sectionTitle: section_title,
        level: 'L1',
      });
    }
  }

  // Load L2 concepts
  for (const sectionData of l2Results) {
    const { section_id, concepts: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l2ConceptCount = items.length;

    for (const concept of items) {
      concepts.set(concept.id + '_L2', {
        ...concept,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L2',
      });
    }
  }

  // Load L3 concepts
  for (const sectionData of l3Results) {
    const { section_id, concepts: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l3ConceptCount = items.length;

    for (const concept of items) {
      concepts.set(concept.id + '_L3', {
        ...concept,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L3',
      });
    }
  }

  // Load L4 concepts
  for (const sectionData of l4Results) {
    const { section_id, concepts: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l4ConceptCount = items.length;

    for (const concept of items) {
      concepts.set(concept.id + '_L4', {
        ...concept,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L4',
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

export function filterConcepts(concepts, sections, difficulties, levels = ['L1']) {
  return [...concepts.values()].filter(c =>
    sections.includes(c.section) &&
    difficulties.includes(c.quiz.difficulty) &&
    levels.includes(c.level)
  );
}
