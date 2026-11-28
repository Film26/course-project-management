// F-07 domain rules (pure functions, no database) — contract docs/sprints/sprint-3/F-07-peer-eval.md §2.
export const LIMITS = { comment: 500 };

const positiveInt = (v) => Number.isInteger(v) && v > 0;

/** Validation table §2: rateeId positive integer, score integer 1–5, comment optional (trimmed, ≤ 500). Only these fields are read. */
export function validateRatingInput(body) {
  const src = body && typeof body === 'object' ? body : {};
  const details = {};
  if (!positiveInt(src.rateeId)) details.rateeId = 'Choose a teammate to rate';
  if (!Number.isInteger(src.score) || src.score < 1 || src.score > 5) details.score = 'Score must be a whole number from 1 to 5';
  let comment = '';
  if (src.comment !== undefined && src.comment !== null) {
    if (typeof src.comment !== 'string') details.comment = 'Comment must be text';
    else {
      comment = src.comment.trim();
      if (comment.length > LIMITS.comment) details.comment = `Comment must be at most ${LIMITS.comment} characters`;
    }
  }
  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, value: { rateeId: src.rateeId, score: src.score, comment } };
}

/** E6: mean of the scores rounded to 2 decimals (half up); null when there are none. */
export function averageOf(scores) {
  if (!scores?.length) return null;
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round((mean + Number.EPSILON) * 100) / 100;
}
