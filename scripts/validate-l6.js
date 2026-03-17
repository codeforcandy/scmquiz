#!/usr/bin/env node
/**
 * L6 Data Validation Script
 * Checks all 11 L6 JSON files for structural correctness.
 * L6 uses a `systems_thinking` array with two subtypes:
 *   - consequence_chain: 3-concept chains with disrupted middle link
 *   - cross_section_bridge: cross-section concept pairs
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

const CHAIN_FIELDS = [
  'id', 'subtype', 'chain', 'links', 'disrupted_concept',
  'consequence_description', 'explanation', 'key_terms', 'sources', 'quiz'
];
const BRIDGE_FIELDS = [
  'id', 'subtype', 'source_concept', 'target_concept',
  'interaction_description', 'explanation', 'key_terms', 'sources', 'quiz'
];

let totalErrors = 0;
let totalWarnings = 0;
let totalChains = 0;
let totalBridges = 0;

function error(msg) { totalErrors++; console.error(`  \u274C ${msg}`); }
function warn(msg) { totalWarnings++; console.warn(`  \u26A0\uFE0F  ${msg}`); }
function pass(msg) { console.log(`  \u2705 ${msg}`); }

// Load L1 data for cross-referencing
const l1Concepts = new Set();
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const c of data.concepts || []) l1Concepts.add(c.id);
  }
}

console.log('\u2550'.repeat(47));
console.log('  L6 Data Validation');
console.log('\u2550'.repeat(47) + '\n');

// Check 1: All 11 files exist
console.log('1. File existence');
const missingFiles = [];
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L6.json`);
  if (!fs.existsSync(fp)) missingFiles.push(`${s}_L6.json`);
}
if (missingFiles.length === 0) {
  pass('All 11 L6 files exist');
} else {
  error(`Missing files: ${missingFiles.join(', ')}`);
}

// Process each file
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}_L6.json`);
  if (!fs.existsSync(fp)) continue;

  console.log(`\n\u2500\u2500 Section ${s} ${'─'.repeat(36)}`);

  // Check 2: Valid JSON
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    error('Invalid JSON: ' + e.message);
    continue;
  }
  pass('Valid JSON');

  // Check 3: Metadata
  if (data.section_id !== s) {
    error(`section_id mismatch: "${data.section_id}" expected "${s}"`);
  }
  if (!data.section_title || data.section_title.length < 5) {
    error('section_title missing or too short');
  }

  const items = data.systems_thinking || [];
  if (items.length === 0) {
    error('Empty systems_thinking array');
    continue;
  }

  const ids = new Set();
  let sChains = 0, sBridges = 0;

  for (const item of items) {
    const prefix = `[${item.id || 'NO_ID'}]`;

    // Check duplicate IDs
    if (ids.has(item.id)) {
      error(`${prefix} Duplicate ID`);
    }
    ids.add(item.id);

    // Check subtype
    if (!['consequence_chain', 'cross_section_bridge'].includes(item.subtype)) {
      error(`${prefix} Invalid subtype: "${item.subtype}"`);
      continue;
    }

    if (item.subtype === 'consequence_chain') {
      sChains++;

      // Check required fields
      for (const field of CHAIN_FIELDS) {
        if (!(field in item)) {
          error(`${prefix} Missing required field: ${field}`);
        }
      }

      // Check chain is array of 3
      if (!Array.isArray(item.chain) || item.chain.length !== 3) {
        error(`${prefix} chain must be array of 3 concepts`);
      } else {
        for (const c of item.chain) {
          if (!c.id || !c.label) {
            error(`${prefix} chain concept missing id or label`);
          }
          if (!l1Concepts.has(c.id)) {
            warn(`${prefix} chain concept ${c.id} not found in L1`);
          }
        }
      }

      // Check links is array of 2
      if (!Array.isArray(item.links) || item.links.length !== 2) {
        error(`${prefix} links must be array of 2`);
      } else {
        for (const link of item.links) {
          if (!link.type || !link.description) {
            error(`${prefix} link missing type or description`);
          }
        }
      }

      // Check disrupted_concept
      if (!item.disrupted_concept?.id || !item.disrupted_concept?.label) {
        error(`${prefix} disrupted_concept missing id or label`);
      } else if (item.chain && item.chain[1]?.id !== item.disrupted_concept.id) {
        error(`${prefix} disrupted_concept must be middle chain element`);
      }

      // Check consequence_description
      if (!item.consequence_description || item.consequence_description.length < 20) {
        error(`${prefix} consequence_description too short or missing`);
      }

      // Check ID format: "X.N->X.M->X.P_chain"
      if (!/_chain$/.test(item.id)) {
        error(`${prefix} chain ID must end with "_chain"`);
      }

    } else if (item.subtype === 'cross_section_bridge') {
      sBridges++;

      // Check required fields
      for (const field of BRIDGE_FIELDS) {
        if (!(field in item)) {
          error(`${prefix} Missing required field: ${field}`);
        }
      }

      // Check source/target concepts
      if (!item.source_concept?.id || !item.source_concept?.label || !item.source_concept?.section) {
        error(`${prefix} source_concept missing id, label, or section`);
      }
      if (!item.target_concept?.id || !item.target_concept?.label || !item.target_concept?.section) {
        error(`${prefix} target_concept missing id, label, or section`);
      }

      // Check cross-section
      if (item.source_concept?.section === item.target_concept?.section) {
        error(`${prefix} bridge concepts must be from different sections`);
      }

      // Check source is from this section
      if (item.source_concept?.section !== s) {
        warn(`${prefix} source_concept section "${item.source_concept?.section}" doesn't match file section "${s}"`);
      }

      // Check interaction_description
      if (!item.interaction_description || item.interaction_description.length < 20) {
        error(`${prefix} interaction_description too short or missing`);
      }

      // Check ID format: "X.N<>Y.M_bridge"
      if (!/_bridge$/.test(item.id)) {
        error(`${prefix} bridge ID must end with "_bridge"`);
      }
    }

    // Common checks
    if (!item.explanation || item.explanation.length < 20) {
      error(`${prefix} explanation too short or missing`);
    }

    if (!Array.isArray(item.key_terms) || item.key_terms.length === 0) {
      warn(`${prefix} key_terms should be a non-empty array`);
    }

    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      warn(`${prefix} sources should be a non-empty array`);
    }

    // Quiz checks
    if (item.quiz) {
      if (item.quiz.bloom_level !== 'evaluate') {
        error(`${prefix} bloom_level must be "evaluate", got "${item.quiz.bloom_level}"`);
      }
      if (!['easy', 'medium', 'hard'].includes(item.quiz.difficulty)) {
        error(`${prefix} Invalid difficulty: "${item.quiz.difficulty}"`);
      }
      const distractors = item.quiz.distractor_descriptions || [];
      if (distractors.length !== 3) {
        error(`${prefix} Expected 3 distractor_descriptions, got ${distractors.length}`);
      }
      for (const d of distractors) {
        if (!d || d.length < 15) {
          error(`${prefix} distractor_description too short: "${d}"`);
        }
      }
    } else {
      error(`${prefix} Missing quiz object`);
    }
  }

  totalChains += sChains;
  totalBridges += sBridges;
  pass(`${sChains} chains + ${sBridges} bridges = ${items.length} total`);
}

// Final summary
console.log('\n' + '\u2550'.repeat(47));
console.log(`  Total chains: ${totalChains}`);
console.log(`  Total bridges: ${totalBridges}`);
console.log(`  Total items: ${totalChains + totalBridges}`);
console.log(`  Errors: ${totalErrors}`);
console.log(`  Warnings: ${totalWarnings}`);
console.log('\u2550'.repeat(47));

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
