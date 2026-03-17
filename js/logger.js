// ─── Session Logger ───
// POSTs completed quiz sessions to the logging API for progress tracking.
// Fire-and-forget: logging never blocks or breaks the quiz.

const API_URL = 'https://choi.sh/quiz/api/v1/sessions';
const AUTH_TOKEN = 'rwKOmcqkBzUwrJdZQopaeelMpDNqpJOv8ulP8PbReo';
const PENDING_KEY = 'scmquiz_pending_logs';
const MAX_PENDING = 50;

function inferQuestionType(question) {
  const typeMap = {
    L1: 'definition',
    L3: 'scenario',
    L4: 'analogy',
    L5: 'relationship',
    L7: 'strategic_tradeoff',
    L8: 'micro_definition',
    L9: 'reverse_match',
  };
  if (question.level === 'L6') {
    return question.chain ? 'consequence_chain' : 'cross_section_bridge';
  }
  return typeMap[question.level] || 'unknown';
}

function buildPayload(session, results, flags, iffy, userId) {
  const questions = session.questions.map((q, i) => {
    const answer = session.answers[i];
    const prevTime = i === 0
      ? session.startTime
      : session.answers[i - 1].answeredAt;

    return {
      index: i,
      conceptId: q.conceptId,
      section: q.section,
      level: q.level,
      bloomLevel: q.bloomLevel,
      difficulty: q.difficulty,
      questionType: inferQuestionType(q),
      isCorrect: answer.isCorrect,
      selectedAnswer: answer.isCorrect ? null : answer.selected,
      answeredAt: answer.answeredAt,
      timeSpentMs: answer.answeredAt - prevTime,
      flagged: flags.includes(q.conceptId),
      iffy: iffy.includes(q.conceptId),
    };
  });

  return {
    userId: String(userId),
    sessionId: `u${userId}_${session.startTime}`,
    startTime: session.startTime,
    endTime: session.endTime,
    durationMs: session.endTime - session.startTime,
    config: {
      sections: [...new Set(session.questions.map(q => q.section))],
      levels: [...new Set(session.questions.map(q => q.level))],
      difficulties: [...new Set(session.questions.map(q => q.difficulty))],
      questionCount: session.questions.length,
    },
    summary: {
      totalQuestions: results.total,
      correct: results.correct,
      wrong: results.wrong,
      percentage: results.percentage,
      longestStreak: results.longestStreak,
    },
    questions,
  };
}

async function postSession(payload) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    // 201 = created, 409 = duplicate (already logged) — both are success
    return res.status === 201 || res.status === 409;
  } catch {
    return false;
  }
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch { /* silent */ }
}

function enqueue(payload) {
  const queue = loadQueue();
  queue.push(payload);
  // Cap at MAX_PENDING, drop oldest
  while (queue.length > MAX_PENDING) queue.shift();
  saveQueue(queue);
}

function dequeue(sessionId) {
  const queue = loadQueue().filter(p => p.sessionId !== sessionId);
  saveQueue(queue);
}

export async function logSession(session, results, flags, iffy, userId) {
  const payload = buildPayload(session, results, flags, iffy, userId);
  const ok = await postSession(payload);
  if (!ok) {
    console.warn('[logger] Failed to log session, queuing for retry');
    enqueue(payload);
  }
}

export async function flushPendingLogs() {
  const queue = loadQueue();
  if (queue.length === 0) return;
  for (const payload of queue) {
    const ok = await postSession(payload);
    if (ok) dequeue(payload.sessionId);
  }
}
