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
  const l5Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L5.json`)
      .then(r => r.ok ? r.json() : { section_id: s, relationships: [] })
      .catch(() => ({ section_id: s, relationships: [] }))
  );
  const l6Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L6.json`)
      .then(r => r.ok ? r.json() : { section_id: s, systems_thinking: [] })
      .catch(() => ({ section_id: s, systems_thinking: [] }))
  );
  const l7Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L7.json`)
      .then(r => r.ok ? r.json() : { section_id: s, tradeoffs: [] })
      .catch(() => ({ section_id: s, tradeoffs: [] }))
  );
  const l8Fetches = SECTIONS.map(s =>
    fetch(`data/${s}_L8.json`)
      .then(r => r.ok ? r.json() : { section_id: s, micro_definitions: [] })
      .catch(() => ({ section_id: s, micro_definitions: [] }))
  );
  const [l1Results, l2Results, l3Results, l4Results, l5Results, l6Results, l7Results, l8Results] = await Promise.all([
    Promise.all(l1Fetches),
    Promise.all(l2Fetches),
    Promise.all(l3Fetches),
    Promise.all(l4Fetches),
    Promise.all(l5Fetches),
    Promise.all(l6Fetches),
    Promise.all(l7Fetches),
    Promise.all(l8Fetches),
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
      l5ConceptCount: 0,
      l6ConceptCount: 0,
      l7ConceptCount: 0,
      l8ConceptCount: 0,
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

  // Load L5 relationships
  for (const sectionData of l5Results) {
    const { section_id, relationships: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l5ConceptCount = items.length;

    for (const rel of items) {
      concepts.set(rel.id + '_L5', {
        ...rel,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L5',
      });
    }
  }

  // Load L6 systems thinking entries
  for (const sectionData of l6Results) {
    const { section_id, systems_thinking: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l6ConceptCount = (items || []).length;

    for (const entry of items || []) {
      concepts.set(entry.id + '_L6', {
        ...entry,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L6',
      });
    }
  }

  // Load L7 tradeoffs
  for (const sectionData of l7Results) {
    const { section_id, tradeoffs: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l7ConceptCount = (items || []).length;

    for (const entry of items || []) {
      concepts.set(entry.id + '_L7', {
        ...entry,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L7',
      });
    }
  }

  // Load L8 micro definitions
  for (const sectionData of l8Results) {
    const { section_id, micro_definitions: items } = sectionData;
    const meta = sectionMeta.get(section_id);
    if (meta) meta.l8ConceptCount = (items || []).length;

    for (const entry of items || []) {
      concepts.set(entry.id + '_L8', {
        ...entry,
        section: section_id,
        sectionTitle: meta ? meta.title : section_id,
        level: 'L8',
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
