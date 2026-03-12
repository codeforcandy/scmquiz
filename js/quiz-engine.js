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
  const isCorrect = answerTopic === question.correctTopic;

  const newStreak = isCorrect ? session.streak + 1 : 0;
  const longestStreak = Math.max(session.longestStreak, newStreak);

  const answers = {
    ...session.answers,
    [session.currentIndex]: {
      selected: answerTopic,
      correct: question.correctTopic,
      isCorrect,
    },
  };

  updateSession({ answers, streak: newStreak, longestStreak });
  return { isCorrect, correctTopic: question.correctTopic };
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
