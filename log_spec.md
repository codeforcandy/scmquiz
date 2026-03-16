# SCM Quiz — Session Logging API Specification

> **Version:** 1.0.0
> **Status:** Draft
> **Last updated:** 2026-03-15

## Overview

The SCM quiz runs on GitHub Pages (static hosting) and cannot persist data. This spec defines the API contract for a separate logging server that receives quiz session data for analysis.

**Design principle:** One POST per completed session. The client batches all data and sends it once when the results screen renders.

---

## Endpoints

### `POST /api/v1/sessions`

Log a completed quiz session.

**Headers:**
| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Yes | `Bearer <token>` |
| `X-Client-Version` | No | Client build version (e.g. `1.0.0`) |

**Request body:**

```jsonc
{
  // ── Identity ──────────────────────────────────

  "userId": "string",           // stable user identifier
  "sessionId": "string",        // deterministic: "u{userId}_{startTime}"

  // ── Timing ────────────────────────────────────
  "startTime": 1741000000000,   // ms since epoch (Date.now())
  "endTime":   1741000600000,   // ms since epoch
  "durationMs": 600000,         // endTime - startTime

  // ── Configuration (derived from questions) ────
  "config": {
    "sections":     ["A", "B", "C"],      // unique sections in this session
    "levels":       ["L1", "L3", "L5"],    // unique levels
    "difficulties": ["easy", "medium"],    // unique difficulties
    "questionCount": 20                    // total questions served
  },

  // ── Summary ───────────────────────────────────
  "summary": {
    "totalQuestions": 20,
    "correct": 15,
    "wrong": 5,
    "percentage": 75,           // Math.round((correct / total) * 100)
    "longestStreak": 8
  },

  // ── Per-question detail ───────────────────────
  "questions": [
    {
      "index": 0,
      "conceptId": "A.1",
      "section": "A",
      "level": "L1",
      "bloomLevel": "remember",   // remember | understand | apply | analyze | evaluate | create
      "difficulty": "easy",       // easy | medium | hard
      "questionType": "definition", // see Question Types below
      "isCorrect": true,
      "selectedAnswer": null,     // null when correct; the wrong choice when incorrect
      "answeredAt": 1741000015000, // ms since epoch (Date.now())
      "timeSpentMs": 15000,       // answeredAt - previous answeredAt (or startTime for index 0)
      "flagged": false,           // true if conceptId is in session.flags
      "iffy": false               // true if conceptId is in session.iffy
    }
    // ... one entry per question
  ]
}
```

**Question types** (determined by level):

| Level | `questionType` |
|-------|---------------|
| L1 | `definition` |
| L3 | `scenario` |
| L4 | `analogy` |
| L5 | `relationship` |
| L6 | `consequence_chain` or `cross_section_bridge` |
| L7 | `strategic_tradeoff` |
| L8 | `micro_definition` |
| L9 | `reverse_match` |

**Response — 201 Created:**

```json
{
  "status": "created",
  "sessionId": "u42_1741000000000"
}
```

---

### `GET /api/v1/health`

Health check for monitoring.

**Response — 200 OK:**

```json
{
  "status": "ok",
  "timestamp": 1741000000000
}
```

---

## Error Responses

All errors return a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description"
  }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing required fields, invalid types, negative durations |
| 401 | `UNAUTHORIZED` | Missing or invalid Bearer token |
| 409 | `DUPLICATE_SESSION` | `sessionId` already exists (safe to ignore — means it was already logged) |
| 500 | `INTERNAL_ERROR` | Server-side failure |

**409 is expected.** If the client retries after a network failure, the server may already have the session. Clients should treat 409 as success.

---

## CORS Requirements

The logging server must allow requests from the GitHub Pages origin:

```
Access-Control-Allow-Origin: https://<username>.github.io
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Version
Access-Control-Max-Age: 86400
```

The preflight `OPTIONS` request must return 204 with these headers.

---

## Payload-to-Analysis Mapping

How each field in the payload enables the analysis goals:

### Per-concept mastery

| Field | Analysis |
|-------|----------|
| `questions[].conceptId` | Group by concept across sessions |
| `questions[].isCorrect` | Track correct/incorrect over time → mastery curves |
| `questions[].section` | Identify weak sections |
| `questions[].bloomLevel` | Reveal which cognitive levels are struggling |
| `questions[].difficulty` | Separate easy vs hard mastery |
| `questions[].iffy` | Concepts the user is uncertain about even when correct |

### Study patterns

| Field | Analysis |
|-------|----------|
| `startTime` | When the user studies (time of day, day of week) |
| `durationMs` | Session length trends |
| `config.questionCount` | Session size preferences |
| `config.sections` | Which sections are being focused on |
| `config.levels` | Level progression over time |

### Score progression

| Field | Analysis |
|-------|----------|
| `summary.percentage` | Overall score trend across sessions |
| `summary.longestStreak` | Consistency indicator |
| `questions[].section` + `isCorrect` | Per-section accuracy breakdown |
| `questions[].level` + `isCorrect` | Per-level accuracy breakdown |
| `questions[].difficulty` + `isCorrect` | Per-difficulty accuracy breakdown |
| `questions[].bloomLevel` + `isCorrect` | Per-bloom-level accuracy breakdown |

### Session replay / full detail

| Field | Analysis |
|-------|----------|
| `questions[]` (all fields) | Reconstruct the entire session |
| `questions[].selectedAnswer` | See what wrong answer was chosen |
| `questions[].timeSpentMs` | Identify questions that took long (confusion) or were fast (confidence) |
| `questions[].flagged` | Questions the user flagged for later review |
| `questions[].answeredAt` | Exact timeline of the session |

---

## Client Integration Notes

> These are implementation guidelines for when the logging client is built. The actual `js/logger.js` module and wiring into `results-view.js` are deferred to server implementation time.

### Where to hook in

The POST should fire inside `renderResultsView()` in `js/results-view.js`, after the session has `endTime` set and results are calculated. This is the single point where a session is known to be complete.

### Building the payload

```javascript
// Pseudocode — actual implementation deferred
function buildSessionPayload(session, results) {
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
      flagged: session.flags.includes(q.conceptId),
      iffy: session.iffy.includes(q.conceptId),
    };
  });

  return {
    userId: getUserId(),
    sessionId: `u${getUserId()}_${session.startTime}`,
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
```

### Retry queue strategy

Since the quiz runs on GitHub Pages with no backend, network failures are expected. The client should:

1. **Attempt POST** when results render
2. **On failure** (network error or 5xx), store the payload in `localStorage` under a key like `pendingLogs`
3. **On next quiz load**, check `pendingLogs` and retry any stored payloads
4. **On 409** (duplicate), remove from queue — already logged
5. **On 201**, remove from queue
6. **Queue cap**: Keep at most 50 pending payloads; drop oldest if exceeded

```javascript
// localStorage key
const PENDING_KEY = 'scmquiz_pending_logs';
```

### `questionType` inference

```javascript
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
```

---

## Validation Rules

The server should validate incoming payloads:

| Field | Rule |
|-------|------|
| `userId` | Non-empty string |
| `sessionId` | Non-empty string, matches pattern `u<userId>_<timestamp>` |
| `startTime` | Positive integer |
| `endTime` | Positive integer, >= `startTime` |
| `durationMs` | Positive integer, equals `endTime - startTime` |
| `config.sections` | Non-empty array of strings |
| `config.levels` | Non-empty array of strings |
| `config.difficulties` | Non-empty array, values in `[easy, medium, hard]` |
| `config.questionCount` | Positive integer |
| `summary.totalQuestions` | Positive integer, equals `config.questionCount` |
| `summary.correct` | Non-negative integer, <= `totalQuestions` |
| `summary.wrong` | Non-negative integer, equals `totalQuestions - correct` |
| `summary.percentage` | Integer 0–100 |
| `summary.longestStreak` | Non-negative integer, <= `totalQuestions` |
| `questions` | Non-empty array, length equals `config.questionCount` |
| `questions[].conceptId` | Non-empty string |
| `questions[].bloomLevel` | One of: remember, understand, apply, analyze, evaluate, create |
| `questions[].difficulty` | One of: easy, medium, hard |
| `questions[].isCorrect` | Boolean |
| `questions[].selectedAnswer` | `null` if `isCorrect` is true; non-empty string if false |
| `questions[].answeredAt` | Positive integer, >= `startTime`, <= `endTime` |
| `questions[].timeSpentMs` | Positive integer |
| `questions[].flagged` | Boolean |
| `questions[].iffy` | Boolean |

---

## Example Full Payload

```json
{
  "userId": "42",
  "sessionId": "u42_1741000000000",
  "startTime": 1741000000000,
  "endTime": 1741000300000,
  "durationMs": 300000,
  "config": {
    "sections": ["A", "B"],
    "levels": ["L1", "L3"],
    "difficulties": ["easy", "medium"],
    "questionCount": 3
  },
  "summary": {
    "totalQuestions": 3,
    "correct": 2,
    "wrong": 1,
    "percentage": 67,
    "longestStreak": 2
  },
  "questions": [
    {
      "index": 0,
      "conceptId": "A.1",
      "section": "A",
      "level": "L1",
      "bloomLevel": "remember",
      "difficulty": "easy",
      "questionType": "definition",
      "isCorrect": true,
      "selectedAnswer": null,
      "answeredAt": 1741000012000,
      "timeSpentMs": 12000,
      "flagged": false,
      "iffy": false
    },
    {
      "index": 1,
      "conceptId": "B.5",
      "section": "B",
      "level": "L3",
      "bloomLevel": "apply",
      "difficulty": "medium",
      "questionType": "scenario",
      "isCorrect": true,
      "selectedAnswer": null,
      "answeredAt": 1741000030000,
      "timeSpentMs": 18000,
      "flagged": false,
      "iffy": true
    },
    {
      "index": 2,
      "conceptId": "A.3",
      "section": "A",
      "level": "L1",
      "bloomLevel": "remember",
      "difficulty": "easy",
      "questionType": "definition",
      "isCorrect": false,
      "selectedAnswer": "Supply Chain Visibility",
      "answeredAt": 1741000055000,
      "timeSpentMs": 25000,
      "flagged": true,
      "iffy": false
    }
  ]
}
```
