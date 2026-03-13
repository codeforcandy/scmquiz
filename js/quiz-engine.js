// ─── Quiz Engine ───

import { getState, updateSession } from './store.js';

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Common SCM words to never mask (they appear in most topics/definitions)
const STOP_WORDS = new Set([
  'supply', 'chain', 'management', 'the', 'a', 'an', 'of', 'in', 'and',
  'to', 'for', 'is', 'how', 'what', 'define', 'explain', 'describe',
  'identify', 'analyze', 'determine', 'list', 'understand',
]);

/**
 * Mask distinguishing words from the topic that appear in the definition,
 * so the definition doesn't directly give away the answer.
 */
function maskDefinition(definition, topic) {
  // Extract meaningful words from topic (3+ chars, not stop words)
  const topicWords = topic
    .replace(/[^a-zA-Z\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  if (topicWords.length === 0) return definition;

  let masked = definition;
  for (const word of topicWords) {
    // Case-insensitive replacement, preserve surrounding text
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');
    masked = masked.replace(regex, '______');
  }

  // Collapse consecutive blanks: "______ ______" → "______"
  masked = masked.replace(/(______\s*){2,}/g, '______ ');

  return masked;
}

/**
 * Generate quiz questions from filtered concepts.
 * Each question: show definition → pick correct topic from 4 choices.
 */
export function generateQuestions(filteredConcepts) {
  const concepts = getState().concepts;
  const shuffled = shuffle(filteredConcepts);

  return shuffled.map(concept => {
    if (concept.level === 'L5') {
      return buildL5Question(concept, filteredConcepts, concepts);
    }
    if (concept.level === 'L3') {
      return buildScenarioQuestion(concept, filteredConcepts, concepts);
    }
    if (concept.level === 'L4') {
      return buildL4Question(concept, filteredConcepts, concepts);
    }
    const choices = buildChoices(concept, filteredConcepts, concepts);
    return {
      conceptId: concept.id,
      definition: maskDefinition(concept.definition, concept.topic),
      correctTopic: concept.topic,
      section: concept.section,
      sectionTitle: concept.sectionTitle,
      level: concept.level || 'L1',
      bloomLevel: concept.quiz.bloom_level,
      difficulty: concept.quiz.difficulty,
      explanation: concept.explanation,
      keyTerms: concept.key_terms,
      sources: concept.sources,
      choices: shuffle(choices),
    };
  });
}

function buildChoices(concept, pool, allConcepts) {
  const correctTopic = concept.topic;
  const choices = [correctTopic];
  const used = new Set([concept.id]);

  // 2 distractors from distractor_ids
  for (const did of concept.quiz.distractor_ids) {
    if (choices.length >= 3) break;
    const d = allConcepts.get(did);
    if (d && !used.has(did)) {
      choices.push(d.topic);
      used.add(did);
    }
  }

  // 4th distractor: prefer same section + same level
  const sameSection = pool.filter(c =>
    c.section === concept.section && !used.has(c.id) && c.level === concept.level
  );
  if (sameSection.length > 0) {
    const pick = sameSection[Math.floor(Math.random() * sameSection.length)];
    choices.push(pick.topic);
    used.add(pick.id);
  }

  // Fallback: same section any level
  if (choices.length < 4) {
    const sameSectionAny = pool.filter(c => c.section === concept.section && !used.has(c.id));
    if (sameSectionAny.length > 0) {
      const pick = sameSectionAny[Math.floor(Math.random() * sameSectionAny.length)];
      choices.push(pick.topic);
      used.add(pick.id);
    }
  }

  // Fallback: if still < 4, pull from any section (prefer same level)
  if (choices.length < 4) {
    const remaining = [...allConcepts.values()].filter(c => !used.has(c.id));
    const sameLevelFirst = remaining.sort((a, b) =>
      (b.level === concept.level ? 1 : 0) - (a.level === concept.level ? 1 : 0)
    );
    const shuffledRemaining = shuffle(sameLevelFirst);
    for (const c of shuffledRemaining) {
      if (choices.length >= 4) break;
      choices.push(c.topic);
      used.add(c.id);
    }
  }

  return choices.slice(0, 4);
}

function buildScenarioQuestion(concept, pool, allConcepts) {
  const choices = buildL3Choices(concept, pool, allConcepts);
  return {
    conceptId: concept.id,
    questionType: 'scenario',
    scenario: concept.scenario,
    correctTopic: concept.topic,
    section: concept.section,
    sectionTitle: concept.sectionTitle,
    level: 'L3',
    bloomLevel: concept.quiz.bloom_level,
    difficulty: concept.quiz.difficulty,
    explanation: concept.explanation,
    keyTerms: concept.key_terms,
    sources: concept.sources,
    choices: shuffle(choices),
  };
}

function buildL3Choices(concept, pool, allConcepts) {
  const correctTopic = concept.topic;
  const choices = [correctTopic];
  const used = new Set([concept.id]);

  // 1. Relationship distractors (hardest — closely related concepts)
  const relDistractors = concept.quiz.relationship_distractors || [];
  for (const rid of relDistractors) {
    if (choices.length >= 4) break;
    const d = allConcepts.get(rid);
    if (d && !used.has(rid)) {
      choices.push(d.topic);
      used.add(rid);
    }
  }

  // 2. Curated distractor_ids
  for (const did of concept.quiz.distractor_ids) {
    if (choices.length >= 4) break;
    const d = allConcepts.get(did);
    if (d && !used.has(did)) {
      choices.push(d.topic);
      used.add(did);
    }
  }

  // 3. Same section from pool
  if (choices.length < 4) {
    const sameSection = pool.filter(c =>
      c.section === concept.section && !used.has(c.id)
    );
    for (const c of shuffle(sameSection)) {
      if (choices.length >= 4) break;
      choices.push(c.topic);
      used.add(c.id);
    }
  }

  // 4. Any concept
  if (choices.length < 4) {
    const remaining = [...allConcepts.values()].filter(c => !used.has(c.id));
    for (const c of shuffle(remaining)) {
      if (choices.length >= 4) break;
      choices.push(c.topic);
      used.add(c.id);
    }
  }

  return choices.slice(0, 4);
}

function buildL4Question(concept, pool, allConcepts) {
  const choices = buildL3Choices(concept, pool, allConcepts);
  return {
    conceptId: concept.id,
    questionType: 'analogy',
    definition: concept.simplified_definition,
    analogy: concept.analogy,
    concreteExample: concept.concrete_example,
    correctTopic: concept.topic,
    section: concept.section,
    sectionTitle: concept.sectionTitle,
    level: 'L4',
    bloomLevel: concept.quiz.bloom_level,
    difficulty: concept.quiz.difficulty,
    explanation: concept.explanation,
    keyTerms: concept.key_terms,
    sources: concept.sources,
    choices: shuffle(choices),
  };
}

function buildL5Question(concept, pool, allConcepts) {
  const choices = buildL5Choices(concept, pool, allConcepts);
  return {
    conceptId: concept.id,
    questionType: 'relationship',
    sourceConcept: concept.source_concept,
    targetConcept: concept.target_concept,
    relationshipType: concept.relationship_type,
    correctAnswer: concept.correct_description,
    section: concept.section,
    sectionTitle: concept.sectionTitle,
    level: 'L5',
    bloomLevel: concept.quiz.bloom_level,
    difficulty: concept.quiz.difficulty,
    explanation: concept.explanation,
    keyTerms: concept.key_terms,
    sources: concept.sources,
    choices: shuffle(choices),
  };
}

function buildL5Choices(concept, pool, allConcepts) {
  const correct = concept.correct_description;
  const choices = [correct];
  const usedIds = new Set([concept.id]);

  // 1. Prefer curated distractor_hint_ids
  const hints = concept.quiz.distractor_hint_ids || [];
  for (const hid of hints) {
    if (choices.length >= 4) break;
    const d = allConcepts.get(hid + '_L5');
    if (d && !usedIds.has(d.id) && d.correct_description !== correct) {
      choices.push(d.correct_description);
      usedIds.add(d.id);
    }
  }

  // 2. Same-section L5 entries sharing source or target concept
  if (choices.length < 4) {
    const srcId = concept.source_concept.id;
    const tgtId = concept.target_concept.id;
    const related = pool.filter(c =>
      c.level === 'L5' && !usedIds.has(c.id) &&
      c.correct_description !== correct &&
      (c.source_concept?.id === srcId || c.source_concept?.id === tgtId ||
       c.target_concept?.id === srcId || c.target_concept?.id === tgtId)
    );
    for (const c of shuffle(related)) {
      if (choices.length >= 4) break;
      choices.push(c.correct_description);
      usedIds.add(c.id);
    }
  }

  // 3. Random same-section L5 entries
  if (choices.length < 4) {
    const sameSection = pool.filter(c =>
      c.level === 'L5' && c.section === concept.section &&
      !usedIds.has(c.id) && c.correct_description !== correct
    );
    for (const c of shuffle(sameSection)) {
      if (choices.length >= 4) break;
      choices.push(c.correct_description);
      usedIds.add(c.id);
    }
  }

  // 4. Any L5 entry
  if (choices.length < 4) {
    const any = [...allConcepts.values()].filter(c =>
      c.level === 'L5' && !usedIds.has(c.id) && c.correct_description !== correct
    );
    for (const c of shuffle(any)) {
      if (choices.length >= 4) break;
      choices.push(c.correct_description);
      usedIds.add(c.id);
    }
  }

  return choices.slice(0, 4);
}

/**
 * Create a new session
 */
export function createSession(questions) {
  return {
    questions,
    currentIndex: 0,
    answers: {},       // { index: { selected, correct, isCorrect } }
    flags: [],
    iffy: [],
    startTime: Date.now(),
    endTime: null,
    streak: 0,
    longestStreak: 0,
  };
}

/**
 * Submit an answer for the current question
 */
export function submitAnswer(answerTopic) {
  const session = getState().session;
  const question = session.questions[session.currentIndex];
  const correctValue = question.correctAnswer || question.correctTopic;
  const isCorrect = answerTopic === correctValue;

  const newStreak = isCorrect ? session.streak + 1 : 0;
  const longestStreak = Math.max(session.longestStreak, newStreak);

  const answers = {
    ...session.answers,
    [session.currentIndex]: {
      selected: answerTopic,
      correct: correctValue,
      isCorrect,
    },
  };

  updateSession({ answers, streak: newStreak, longestStreak });
  return { isCorrect, correctTopic: correctValue };
}

/**
 * Move to next question
 */
export function nextQuestion() {
  const session = getState().session;
  const nextIdx = session.currentIndex + 1;

  if (nextIdx >= session.questions.length) {
    updateSession({ endTime: Date.now() });
    return false; // quiz complete
  }

  updateSession({ currentIndex: nextIdx });
  return true;
}

/**
 * Move to previous question (review)
 */
export function prevQuestion() {
  const session = getState().session;
  if (session.currentIndex > 0) {
    updateSession({ currentIndex: session.currentIndex - 1 });
    return true;
  }
  return false;
}

/**
 * Calculate final results
 */
export function calculateResults() {
  const session = getState().session;
  const answers = session.answers;
  const total = session.questions.length;
  const answered = Object.keys(answers).length;
  const correct = Object.values(answers).filter(a => a.isCorrect).length;
  const wrong = answered - correct;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const elapsed = (session.endTime || Date.now()) - session.startTime;

  return {
    total,
    answered,
    correct,
    wrong,
    percentage,
    longestStreak: session.longestStreak,
    elapsed,
  };
}
