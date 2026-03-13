#!/usr/bin/env node
/**
 * L5 Data Validation Script
 * Checks all 11 L5 JSON files for structural correctness.
 * L5 uses a `relationships` array (not `concepts`), keyed as "X.N->X.M".
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const REQUIRED_FIELDS = [
  'id', 'source_concept', 'target_concept', 'relationship_type',
  'correct_description', 'explanation', 'key_terms', 'sources', 'quiz'
];
const VALID_REL_TYPES = ['related_to', 'includes', 'part_of', 'prerequisite_for', 'contrasts_with', 'applies_to'];

let totalErrors = 0;
let totalWarnings = 0;
let totalRelationships = 0;

function error(msg) { totalErrors++; console.error(`  \u274C ${msg}`); }
function warn(msg) { totalWarnings++; console.warn(`  \u26A0\uFE0F  ${msg}`); }
function pass(msg) { console.log(`  \u2705 ${msg}`); }

// Load all L1 data for cross-referencing
const l1Data = {};
const l1Relationships = {};
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    l1Data[s] = data;
    // Build relationship lookup: "A.1->A.2" => true
    l1Relationships[s] = new Set();
    for (const c of data.concepts || []) {
      for (const r of c.relationships || []) {
        l1Relationships[s].add(`${c.id}->${r.target_id}`);
      }
    }
  }
}

console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log('  L5 Data Validation');
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

// Check 1: All 11 files exist
console.log('1. File existence');
const missingFiles = [];
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L5.json`);
  if (!fs.existsSync(fp)) missingFiles.push(`${s}_L5.json`);
}
if (missingFiles.length === 0) {
  pass('All 11 L5 files exist');
} else {
  error(`Missing files: ${missingFiles.join(', ')}`);
}

// Collect all L5 IDs across sections for distractor validation
const allL5Ids = new Set();
const allL5Data = {};

for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L5.json`);
  if (!fs.existsSync(fp)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    allL5Data[s] = data;
    for (const rel of data.relationships || []) {
      allL5Ids.add(rel.id);
    }
  } catch (e) {
    // Will be caught in per-section validation
  }
}

// Process each file
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L5.json`);
  if (!fs.existsSync(fp)) continue;

  console.log(`\n\u2500\u2500 Section ${s} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);

  // Check 2: Valid JSON
  const data = allL5Data[s];
  if (!data) {
    error('Invalid JSON');
    continue;
  }
  pass('Valid JSON');

  // Check 3: Metadata
  const l1 = l1Data[s];
  if (l1) {
    if (data.section_id === l1.section_id) {
      pass(`section_id matches L1: "${data.section_id}"`);
    } else {
      error(`section_id mismatch: L5="${data.section_id}" L1="${l1.section_id}"`);
    }
    if (data.section_title === l1.section_title) {
      pass('section_title matches L1');
    } else {
      error(`section_title mismatch: L5="${data.section_title}" L1="${l1.section_title}"`);
    }
  }

  const rels = data.relationships || [];
  const relCount = rels.length;
  totalRelationships += relCount;

  // Check 4: Relationship count matches L1 relationships
  if (l1Relationships[s]) {
    const expectedCount = l1Relationships[s].size;
    if (relCount === expectedCount) {
      pass(`Relationship count matches L1: ${relCount}`);
    } else {
      warn(`Relationship count: L5=${relCount}, L1=${expectedCount}`);
    }
  }

  // Build ID set for this section
  const sectionRelIds = new Set(rels.map(r => r.id));

  for (const rel of rels) {
    const prefix = `[${rel.id}]`;

    // Check 5: Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in rel)) {
        error(`${prefix} Missing required field: ${field}`);
      }
    }

    // Check 6: ID format "X.N->X.M"
    const idPattern = new RegExp(`^${s}\\.\\d+->${s}\\.\\d+$`);
    if (!idPattern.test(rel.id)) {
      error(`${prefix} Invalid ID format (expected "${s}.N->${s}.M")`);
    }

    // Check 7: source_concept and target_concept have id and label
    if (rel.source_concept) {
      if (!rel.source_concept.id || !rel.source_concept.label) {
        error(`${prefix} source_concept missing id or label`);
      }
    }
    if (rel.target_concept) {
      if (!rel.target_concept.id || !rel.target_concept.label) {
        error(`${prefix} target_concept missing id or label`);
      }
    }

    // Check 8: relationship_type is valid
    if (rel.relationship_type && !VALID_REL_TYPES.includes(rel.relationship_type)) {
      error(`${prefix} Invalid relationship_type: "${rel.relationship_type}"`);
    }

    // Check 9: correct_description is non-empty
    if (!rel.correct_description || rel.correct_description.length < 10) {
      error(`${prefix} correct_description too short or missing`);
    }

    // Check 10: quiz fields
    if (rel.quiz) {
      if (rel.quiz.bloom_level !== 'analyze') {
        error(`${prefix} bloom_level must be "analyze", got "${rel.quiz.bloom_level}"`);
      }
      if (!['easy', 'medium', 'hard'].includes(rel.quiz.difficulty)) {
        error(`${prefix} Invalid difficulty: "${rel.quiz.difficulty}"`);
      }

      // Check 11: distractor_hint_ids reference real L5 entries
      const hints = rel.quiz.distractor_hint_ids || [];
      if (hints.length !== 3) {
        warn(`${prefix} Expected 3 distractor_hint_ids, got ${hints.length}`);
      }
      for (const hid of hints) {
        if (!allL5Ids.has(hid)) {
          error(`${prefix} distractor_hint_id "${hid}" not found in any L5 file`);
        }
        if (hid === rel.id) {
          error(`${prefix} distractor_hint_id references self`);
        }
      }
    } else {
      error(`${prefix} Missing quiz object`);
    }

    // Check 12: key_terms is array with items
    if (!Array.isArray(rel.key_terms) || rel.key_terms.length === 0) {
      warn(`${prefix} key_terms should be a non-empty array`);
    }

    // Check 13: sources is array with items
    if (!Array.isArray(rel.sources) || rel.sources.length === 0) {
      warn(`${prefix} sources should be a non-empty array`);
    }
  }

  // Check 14: No duplicate IDs
  if (sectionRelIds.size !== relCount) {
    error(`Duplicate relationship IDs found (${relCount} entries, ${sectionRelIds.size} unique)`);
  }

  pass(`${relCount} relationships processed`);
}

// Final summary
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log(`  Total relationships: ${totalRelationships}`);
console.log(`  Errors: ${totalErrors}`);
console.log(`  Warnings: ${totalWarnings}`);
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

if (totalErrors > 0) {
  console.log('\n\uD83D\uDD34 VALIDATION FAILED');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('\n\uD83D\uDFE1 VALIDATION PASSED WITH WARNINGS');
  process.exit(0);
} else {
  console.log('\n\uD83D\uDFE2 VALIDATION PASSED');
  process.exit(0);
}
