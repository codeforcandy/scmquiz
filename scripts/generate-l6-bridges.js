#!/usr/bin/env node
/**
 * Generate L6 Cross-Section Bridge candidates.
 * Finds meaningful concept pairs across different sections.
 * Uses L1 concept topics and keyword overlap to suggest pairs.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

// Load all L1 concepts
const allConcepts = [];
const sectionTitles = {};

for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  sectionTitles[s] = data.section_title;

  for (const c of data.concepts || []) {
    allConcepts.push({
      id: c.id,
      section: s,
      label: c.topic,
      key_terms: c.key_terms || [],
      definition_words: new Set(
        (c.definition || '').toLowerCase().split(/\W+/).filter(w => w.length > 3)
      ),
    });
  }
}

// Score pairs by keyword overlap
function scorePair(a, b) {
  if (a.section === b.section) return 0;

  let score = 0;
  // Key term overlap
  const aTerms = new Set(a.key_terms.map(t => t.toLowerCase()));
  for (const t of b.key_terms) {
    if (aTerms.has(t.toLowerCase())) score += 3;
  }

  // Definition word overlap (less weight)
  for (const w of b.definition_words) {
    if (a.definition_words.has(w)) score += 0.5;
  }

  return score;
}

// Find top bridge candidates per section
const bridgesBySourceSection = {};

for (const s of SECTIONS) {
  const sectionConcepts = allConcepts.filter(c => c.section === s);
  const otherConcepts = allConcepts.filter(c => c.section !== s);
  const candidates = [];

  for (const src of sectionConcepts) {
    for (const tgt of otherConcepts) {
      const score = scorePair(src, tgt);
      if (score >= 2) {
        candidates.push({
          id: `${src.id}<>${tgt.id}_bridge`,
          source_concept: { id: src.id, label: src.label, section: src.section },
          target_concept: { id: tgt.id, label: tgt.label, section: tgt.section },
          score,
        });
      }
    }
  }

  // Sort by score desc, take top 8
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.slice(0, 8);

  bridgesBySourceSection[s] = {
    section_id: s,
    section_title: sectionTitles[s],
    total_candidates: candidates.length,
    selected_count: selected.length,
    bridges: selected,
  };

  console.error(`Section ${s}: ${candidates.length} candidates, ${selected.length} selected`);
}

console.log(JSON.stringify(bridgesBySourceSection, null, 2));
