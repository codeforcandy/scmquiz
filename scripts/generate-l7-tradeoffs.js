#!/usr/bin/env node
/**
 * Generate L7 Strategic Tradeoff candidates from cross-section concept pairs.
 * Finds concept pairs with natural tension (contrasts_with, different sections)
 * and outputs candidates to stdout as JSON for LLM enrichment.
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
      relationships: c.relationships || [],
      definition_words: new Set(
        (c.definition || '').toLowerCase().split(/\W+/).filter(w => w.length > 3)
      ),
    });
  }
}

// Find tradeoff candidates: concept pairs that either contrast_with
// or share key terms across different sections (natural tension)
function findTradeoffCandidates(sourceConcept) {
  const candidates = [];

  // 1. Explicit contrasts_with relationships
  for (const rel of sourceConcept.relationships) {
    if (rel.type === 'contrasts_with') {
      const target = allConcepts.find(c => c.id === rel.target_id);
      if (target) {
        candidates.push({
          source: sourceConcept,
          target,
          score: 10,
          reason: 'contrasts_with',
        });
      }
    }
  }

  // 2. Cross-section concepts with overlapping key terms (potential tension)
  const srcTerms = new Set(sourceConcept.key_terms.map(t => t.toLowerCase()));
  for (const tgt of allConcepts) {
    if (tgt.section === sourceConcept.section) continue;
    let overlap = 0;
    for (const t of tgt.key_terms) {
      if (srcTerms.has(t.toLowerCase())) overlap += 2;
    }
    // Definition word overlap
    for (const w of tgt.definition_words) {
      if (sourceConcept.definition_words.has(w)) overlap += 0.3;
    }
    if (overlap >= 3) {
      candidates.push({
        source: sourceConcept,
        target: tgt,
        score: overlap,
        reason: 'cross_section_overlap',
      });
    }
  }

  return candidates;
}

// Find lever concepts (related to both sides of the tradeoff)
function findLevers(source, target) {
  const levers = [];
  const usedIds = new Set([source.id, target.id]);

  // Concepts connected to source
  for (const rel of source.relationships) {
    const lever = allConcepts.find(c => c.id === rel.target_id && !usedIds.has(c.id));
    if (lever) {
      levers.push({ ...lever, relevance: 'source_connected' });
      usedIds.add(lever.id);
    }
  }

  // Concepts connected to target
  for (const rel of target.relationships) {
    const lever = allConcepts.find(c => c.id === rel.target_id && !usedIds.has(c.id));
    if (lever && !usedIds.has(lever.id)) {
      levers.push({ ...lever, relevance: 'target_connected' });
      usedIds.add(lever.id);
    }
  }

  return levers.slice(0, 5); // Top 5 candidates
}

// Generate candidates per section
const results = {};

for (const s of SECTIONS) {
  const sectionConcepts = allConcepts.filter(c => c.section === s);
  const sectionCandidates = [];

  for (const src of sectionConcepts) {
    const candidates = findTradeoffCandidates(src);
    for (const c of candidates) {
      const levers = findLevers(c.source, c.target);
      sectionCandidates.push({
        id: `TRADEOFF_${s}_${src.id}_${c.target.id}`,
        source_concept: { id: src.id, label: src.label, section: src.section },
        target_concept: { id: c.target.id, label: c.target.label, section: c.target.section },
        score: c.score,
        reason: c.reason,
        suggested_levers: levers.map(l => ({
          id: l.id, label: l.label, section: l.section,
        })),
      });
    }
  }

  // Sort by score, take top 5 per section
  sectionCandidates.sort((a, b) => b.score - a.score);

  results[s] = {
    section_id: s,
    section_title: sectionTitles[s],
    total_candidates: sectionCandidates.length,
    selected_count: Math.min(5, sectionCandidates.length),
    candidates: sectionCandidates.slice(0, 5),
  };

  console.error(`Section ${s}: ${sectionCandidates.length} candidates, top ${Math.min(5, sectionCandidates.length)} selected`);
}

console.log(JSON.stringify(results, null, 2));
