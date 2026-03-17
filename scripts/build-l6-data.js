#!/usr/bin/env node
/**
 * Build L6 data files from chain and bridge candidates.
 * Generates consequence descriptions, explanations, and distractors
 * based on the chain/bridge structure and L1 concept data.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

const chains = JSON.parse(fs.readFileSync('/tmp/l6-chains.json', 'utf8'));
const bridges = JSON.parse(fs.readFileSync('/tmp/l6-bridges.json', 'utf8'));

// Load L1 data for context
const l1Data = {};
for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  l1Data[s] = JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// Get concept definition
function getConceptDef(conceptId) {
  const section = conceptId.split('.')[0];
  const data = l1Data[section];
  if (!data) return null;
  return data.concepts.find(c => c.id === conceptId);
}

// Strip leading action verbs from topic labels for natural prose
function stripVerb(label) {
  return label
    .replace(/^(Define |Explain |Describe |Identify |Analyze |Determine |List |Understand |Compare |Evaluate )/i, '')
    .replace(/^(How |What is )/i, '')
    .trim();
}

// Capitalize first letter
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Generate consequence description for a chain disruption
function generateConsequence(chain, links, disrupted) {
  const mid = stripVerb(chain[1].label);
  const end = stripVerb(chain[2].label);
  const start = stripVerb(chain[0].label);
  const link2Type = links[1].type.replace(/_/g, ' ');

  return `When ${mid.toLowerCase()} is disrupted, the ${link2Type} connection to ${end.toLowerCase()} breaks down. ${cap(end)} loses its foundational input from ${start.toLowerCase()}, degrading overall supply chain performance in this area.`;
}

// Generate explanation for a chain
function generateChainExplanation(chain, links) {
  const midLabel = stripVerb(chain[1].label);
  const startLabel = stripVerb(chain[0].label);
  const endLabel = stripVerb(chain[2].label);
  const link1Type = links[0].type.replace(/_/g, ' ');
  const link2Type = links[1].type.replace(/_/g, ' ');

  return `${cap(midLabel)} serves as a critical intermediary in this concept chain. The ${link1Type} relationship from ${startLabel.toLowerCase()} to ${midLabel.toLowerCase()} establishes a dependency, and the ${link2Type} relationship from ${midLabel.toLowerCase()} to ${endLabel.toLowerCase()} carries that influence forward. When ${midLabel.toLowerCase()} is disrupted, the downstream effect on ${endLabel.toLowerCase()} is not merely a loss of one input — it severs the entire pathway through which ${startLabel.toLowerCase()} influences ${endLabel.toLowerCase()}, creating a cascade of operational and strategic gaps.`;
}

// Generate distractors for chain questions
function generateChainDistractors(chain, links) {
  const midLabel = stripVerb(chain[1].label);
  const endLabel = stripVerb(chain[2].label);

  return [
    `The supply chain would automatically compensate through alternative pathways, making ${midLabel.toLowerCase()} redundant and improving overall efficiency.`,
    `Disrupting ${midLabel.toLowerCase()} would primarily improve downstream accuracy by eliminating an unnecessary intermediary step in the process.`,
    `The impact would be isolated to ${midLabel.toLowerCase()} alone, with no downstream effect on ${endLabel.toLowerCase()} or other connected concepts.`,
  ];
}

// Generate bridge interaction description
function generateBridgeInteraction(src, tgt) {
  const srcLabel = stripVerb(src.label);
  const tgtLabel = stripVerb(tgt.label);

  return `${cap(srcLabel)} and ${tgtLabel.toLowerCase()} have a bidirectional relationship across their domains: decisions in ${srcLabel.toLowerCase()} directly influence how ${tgtLabel.toLowerCase()} is configured and managed, while feedback from ${tgtLabel.toLowerCase()} operations informs adjustments to ${srcLabel.toLowerCase()} strategy.`;
}

// Generate bridge explanation
function generateBridgeExplanation(src, tgt) {
  const srcLabel = stripVerb(src.label);
  const tgtLabel = stripVerb(tgt.label);

  return `The cross-section relationship between ${srcLabel.toLowerCase()} (Section ${src.section}) and ${tgtLabel.toLowerCase()} (Section ${tgt.section}) illustrates how supply chain concepts rarely exist in isolation. ${cap(srcLabel)} provides strategic direction that shapes ${tgtLabel.toLowerCase()} decisions, while ${tgtLabel.toLowerCase()} generates operational data and constraints that feed back into ${srcLabel.toLowerCase()} planning. This bidirectional interaction means that changes in either domain can ripple across section boundaries, requiring managers to think holistically rather than in functional silos.`;
}

// Generate bridge distractors
function generateBridgeDistractors(src, tgt) {
  const srcLabel = stripVerb(src.label);
  const tgtLabel = stripVerb(tgt.label);

  return [
    `${cap(srcLabel)} and ${tgtLabel.toLowerCase()} operate independently with no meaningful interaction, as they belong to separate functional domains.`,
    `${cap(srcLabel)} completely subsumes ${tgtLabel.toLowerCase()}, making cross-domain interaction unnecessary since one domain controls the other entirely.`,
    `The interaction between ${srcLabel.toLowerCase()} and ${tgtLabel.toLowerCase()} is purely one-directional, with no feedback mechanism from ${tgtLabel.toLowerCase()} back to ${srcLabel.toLowerCase()}.`,
  ];
}

// Build L6 data for each section
for (const s of SECTIONS) {
  const sectionChains = chains[s]?.chains || [];
  const sectionBridges = bridges[s]?.bridges || [];
  const l1 = l1Data[s];

  const systemsThinking = [];

  // Process chains
  for (const c of sectionChains) {
    const midDef = getConceptDef(c.disrupted_concept.id);
    const sources = midDef?.sources || [
      { url: 'https://cscmp.org', title: 'CSCMP SCM Glossary', site: 'CSCMP' },
    ];

    systemsThinking.push({
      id: c.id,
      subtype: 'consequence_chain',
      chain: c.chain,
      links: c.links,
      disrupted_concept: c.disrupted_concept,
      consequence_description: generateConsequence(c.chain, c.links, c.disrupted_concept),
      explanation: generateChainExplanation(c.chain, c.links),
      key_terms: ['disruption', 'consequence chain', 'downstream impact', 'systems thinking'],
      sources: sources.slice(0, 3),
      quiz: {
        bloom_level: 'evaluate',
        difficulty: 'hard',
        distractor_descriptions: generateChainDistractors(c.chain, c.links),
      },
    });
  }

  // Process bridges
  for (const b of sectionBridges) {
    const srcDef = getConceptDef(b.source_concept.id);
    const tgtDef = getConceptDef(b.target_concept.id);
    const sources = [
      ...(srcDef?.sources || []).slice(0, 2),
      ...(tgtDef?.sources || []).slice(0, 1),
    ];
    if (sources.length === 0) {
      sources.push({ url: 'https://cscmp.org', title: 'CSCMP SCM Glossary', site: 'CSCMP' });
    }

    systemsThinking.push({
      id: b.id,
      subtype: 'cross_section_bridge',
      source_concept: b.source_concept,
      target_concept: b.target_concept,
      interaction_description: generateBridgeInteraction(b.source_concept, b.target_concept),
      explanation: generateBridgeExplanation(b.source_concept, b.target_concept),
      key_terms: ['cross-domain interaction', 'systems thinking', 'bidirectional relationship', 'feedback loop'],
      sources: sources.slice(0, 3),
      quiz: {
        bloom_level: 'evaluate',
        difficulty: 'hard',
        distractor_descriptions: generateBridgeDistractors(b.source_concept, b.target_concept),
      },
    });
  }

  const output = {
    section_id: s,
    section_title: l1.section_title,
    generated_at: '2026-03-13T00:00:00Z',
    systems_thinking: systemsThinking,
  };

  const outPath = path.join(DATA_DIR, `${s}_L6.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`${s}_L6.json: ${sectionChains.length} chains + ${sectionBridges.length} bridges = ${systemsThinking.length} total`);
}
