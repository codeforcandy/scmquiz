#!/usr/bin/env node
/**
 * L4 Data Validation Script
 * Checks all 11 L4 JSON files for structural correctness and internal consistency.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const REQUIRED_FIELDS = ['id', 'topic', 'analogy', 'concrete_example', 'simplified_definition', 'explanation', 'key_terms', 'sources', 'relationships', 'quiz'];

let totalErrors = 0;
let totalWarnings = 0;
let totalConcepts = 0;

function error(msg) { totalErrors++; console.error(`  ❌ ${msg}`); }
function warn(msg) { totalWarnings++; console.warn(`  ⚠️  ${msg}`); }
function pass(msg) { console.log(`  ✅ ${msg}`); }

// Load all L1 data for cross-referencing
const l1Data = {};
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  if (fs.existsSync(fp)) {
    l1Data[s] = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }
}

console.log('═══════════════════════════════════════════════');
console.log('  L4 Data Validation');
console.log('═══════════════════════════════════════════════\n');

// Check 1: All 11 files exist
console.log('1. File existence');
const missingFiles = [];
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L4.json`);
  if (!fs.existsSync(fp)) missingFiles.push(`${s}_L4.json`);
}
if (missingFiles.length === 0) {
  pass(`All 11 L4 files exist`);
} else {
  error(`Missing files: ${missingFiles.join(', ')}`);
}

// Process each file
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L4.json`);
  if (!fs.existsSync(fp)) continue;

  console.log(`\n── Section ${s} ──────────────────────────────`);

  // Check 2: Valid JSON
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    pass('Valid JSON');
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
    continue;
  }

  // Check 3: Correct metadata matches L1
  const l1 = l1Data[s];
  if (l1) {
    if (data.section_id === l1.section_id) {
      pass(`section_id matches L1: "${data.section_id}"`);
    } else {
      error(`section_id mismatch: L4="${data.section_id}" L1="${l1.section_id}"`);
    }
    if (data.section_title === l1.section_title) {
      pass(`section_title matches L1`);
    } else {
      error(`section_title mismatch: L4="${data.section_title}" L1="${l1.section_title}"`);
    }
  }

  const concepts = data.concepts || [];
  const conceptCount = concepts.length;
  totalConcepts += conceptCount;

  // Check 4: Concept count matches L1
  if (l1) {
    const l1Count = (l1.concepts || []).length;
    if (conceptCount === l1Count) {
      pass(`Concept count matches L1: ${conceptCount}`);
    } else {
      error(`Concept count mismatch: L4=${conceptCount} L1=${l1Count}`);
    }
  }

  // Build ID lookup for this section
  const sectionIds = new Set(concepts.map(c => c.id));
  const relationshipTargets = {};
  for (const c of concepts) {
    relationshipTargets[c.id] = new Set((c.relationships || []).map(r => r.target_id));
  }

  for (const c of concepts) {
    const prefix = `[${c.id}]`;

    // Check 5: Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in c)) {
        error(`${prefix} Missing required field: ${field}`);
      }
    }

    // Check 6: No topic name leaks in simplified_definition
    if (c.simplified_definition && c.topic) {
      const topicLower = c.topic.toLowerCase();
      const defLower = c.simplified_definition.toLowerCase();
      if (defLower.includes(topicLower)) {
        warn(`${prefix} simplified_definition contains exact topic name: "${c.topic}"`);
      }
    }

    // Check quiz fields
    if (c.quiz) {
      // Check 7: Bloom level must be "understand"
      if (c.quiz.bloom_level === 'understand') {
        // good
      } else {
        error(`${prefix} Invalid bloom_level: "${c.quiz.bloom_level}" (expected "understand")`);
      }

      // Check 8: Difficulty matches L1
      if (l1) {
        const l1Concept = (l1.concepts || []).find(lc => lc.id === c.id);
        if (l1Concept && l1Concept.quiz) {
          if (c.quiz.difficulty !== l1Concept.quiz.difficulty) {
            error(`${prefix} Difficulty mismatch: L4="${c.quiz.difficulty}" L1="${l1Concept.quiz.difficulty}"`);
          }
        }
      }

      // Check 9: distractor_ids valid (3 per concept)
      const dids = c.quiz.distractor_ids || [];
      if (dids.length !== 3) {
        error(`${prefix} Expected 3 distractor_ids, got ${dids.length}`);
      }
      for (const did of dids) {
        if (!sectionIds.has(did)) {
          error(`${prefix} distractor_id "${did}" not found in section ${s}`);
        }
        if (did === c.id) {
          error(`${prefix} distractor_id references self`);
        }
      }

      // Check 10: relationship_distractors valid (2 per concept)
      const rdids = c.quiz.relationship_distractors || [];
      if (rdids.length !== 2) {
        error(`${prefix} Expected 2 relationship_distractors, got ${rdids.length}`);
      }
      for (const rdid of rdids) {
        if (!sectionIds.has(rdid)) {
          error(`${prefix} relationship_distractor "${rdid}" not found in section ${s}`);
        }
        if (rdid === c.id) {
          error(`${prefix} relationship_distractor references self`);
        }
      }

      // Check 11: relationship_distractors sourced from relationships
      const targets = relationshipTargets[c.id] || new Set();
      for (const rdid of rdids) {
        if (!targets.has(rdid)) {
          error(`${prefix} relationship_distractor "${rdid}" not in concept's relationships`);
        }
      }
    } else {
      error(`${prefix} Missing quiz object`);
    }
  }

  pass(`${conceptCount} concepts processed`);
}

// Final summary
console.log('\n═══════════════════════════════════════════════');
console.log(`  Total concepts: ${totalConcepts}`);
console.log(`  Errors: ${totalErrors}`);
console.log(`  Warnings: ${totalWarnings}`);
console.log('═══════════════════════════════════════════════');

if (totalErrors > 0) {
  console.log('\n🔴 VALIDATION FAILED');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('\n🟡 VALIDATION PASSED WITH WARNINGS');
  process.exit(0);
} else {
  console.log('\n🟢 VALIDATION PASSED');
  process.exit(0);
}
