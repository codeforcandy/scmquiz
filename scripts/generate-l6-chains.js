#!/usr/bin/env node
/**
 * Generate L6 Consequence Chain candidates from L1 relationship graph.
 * Walks the graph for 3-hop paths (A→B→C) within each section.
 * Outputs candidates to stdout as JSON for LLM processing.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

// Build adjacency list from L1 relationships
function buildGraph(sectionData) {
  const graph = new Map(); // conceptId -> [{ targetId, type, description }]
  const conceptMap = new Map(); // conceptId -> { id, label: topic }

  for (const concept of sectionData.concepts || []) {
    conceptMap.set(concept.id, { id: concept.id, label: concept.topic });
    if (!graph.has(concept.id)) graph.set(concept.id, []);

    for (const rel of concept.relationships || []) {
      graph.get(concept.id).push({
        targetId: rel.target_id,
        type: rel.type,
        description: rel.description,
      });
    }
  }

  return { graph, conceptMap };
}

// Find all 3-hop paths: A→B→C
function find3HopPaths(graph, conceptMap) {
  const paths = [];

  for (const [startId, edges] of graph) {
    for (const edge1 of edges) {
      const midId = edge1.targetId;
      const midEdges = graph.get(midId) || [];

      for (const edge2 of midEdges) {
        const endId = edge2.targetId;
        // Avoid cycles: no revisiting start
        if (endId === startId) continue;

        const start = conceptMap.get(startId);
        const mid = conceptMap.get(midId);
        const end = conceptMap.get(endId);
        if (!start || !mid || !end) continue;

        paths.push({
          chain: [start, mid, end],
          links: [
            { type: edge1.type, description: edge1.description },
            { type: edge2.type, description: edge2.description },
          ],
          disrupted_concept: mid,
        });
      }
    }
  }

  return paths;
}

// Deduplicate and select diverse chains (cap per section)
function selectDiverseChains(paths, maxPerSection = 25) {
  // Prefer chains with diverse middle concepts
  const byMiddle = new Map();
  for (const p of paths) {
    const midId = p.disrupted_concept.id;
    if (!byMiddle.has(midId)) byMiddle.set(midId, []);
    byMiddle.get(midId).push(p);
  }

  const selected = [];
  const middleConcepts = [...byMiddle.keys()];

  // Round-robin select from each middle concept for diversity
  let round = 0;
  while (selected.length < maxPerSection && round < 10) {
    for (const mid of middleConcepts) {
      const group = byMiddle.get(mid);
      if (round < group.length && selected.length < maxPerSection) {
        selected.push(group[round]);
      }
    }
    round++;
  }

  return selected;
}

// Main
const allChains = {};
let totalPaths = 0;

for (const s of SECTIONS) {
  const fp = path.join(DATA_DIR, `${s}.json`);
  if (!fs.existsSync(fp)) {
    console.error(`Missing: ${fp}`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const { graph, conceptMap } = buildGraph(data);
  const paths = find3HopPaths(graph, conceptMap);
  const selected = selectDiverseChains(paths);

  allChains[s] = {
    section_id: s,
    section_title: data.section_title,
    total_paths_found: paths.length,
    selected_count: selected.length,
    chains: selected.map((p, idx) => ({
      id: `${p.chain[0].id}->${p.chain[1].id}->${p.chain[2].id}_chain`,
      chain: p.chain,
      links: p.links,
      disrupted_concept: p.disrupted_concept,
    })),
  };

  totalPaths += paths.length;
  console.error(`Section ${s}: ${paths.length} paths found, ${selected.length} selected`);
}

console.error(`\nTotal paths found: ${totalPaths}`);
console.log(JSON.stringify(allChains, null, 2));
