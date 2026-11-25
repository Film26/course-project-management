import { useState } from 'react';
import { formatTime } from './proposalUi.jsx';

// F-06 FR-17 — the instructor's grade form for a team's current version. The API decides D-08 (current version,
// release only after the due date, release is final); the form only checks the simple field rules first.

const ERRORS = {
  NOT_CURRENT_VERSION: 'The team has submitted a newer version. Reload and grade the current one.',
  GRADE_RELEASED: 'This grade has already been released and cannot change.',
  BEFORE_DUE: 'A grade can be released only after the due date.',
  NOT_GRADED: 'Save a grade before releasing it.',
};
export const gradeError = (err) => ERRORS[err.code] ?? err.message;

export function GradeBadge({ grade }) {
  if (!grade) return <span className="badge status-not_submitted">Not graded</span>;
  if (grade.releasedAt) return <span className="badge status-approved">Released</span>;
  return <span className="badge status-submitted">Graded (not released)</span>;
}

export function GradeForm({ grade, maxScore, pastDue, busy, onSave, onRelease }) {
  const [score, setScore] = useState(grade ? String(grade.score) : '');
  const [feedback, setFeedback] = useState(grade?.feedback ?? '');
  const [error, setError] = useState('');

  if (grade?.releasedAt) {
    return (
      <p className="ok" data-testid="released-grade">
        {grade.score} / {maxScore} released {formatTime(grade.releasedAt)} — {grade.feedback}
      </p>
    );
  }

  function save(e) {
    e.preventDefault();
    const n = Number(score);
    if (score.trim() === '' || !Number.isInteger(n) || n < 0 || n > maxScore) return setError(`Score must be a whole number from 0 to ${maxScore}`);
    if (!feedback.trim()) return setError('Feedback is required');
    if (feedback.trim().length > 2000) return setError('Feedback can have at most 2000 characters');
    setError('');
    onSave({ score: n, feedback: feedback.trim() });
  }

  return (
    <form className="reject-box" onSubmit={save} noValidate data-testid="grade-form">
      <label>
        Score (of {maxScore})
        <input type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value)} />
      </label>
      <label>
        Feedback
        <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </label>
      <span className="muted">{feedback.trim().length}/2000</span>
      {error && <span className="error">{error}</span>}
      <div className="actions">
        <button type="submit" disabled={busy}>
          Save grade
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !grade || !pastDue}
          title={pastDue ? '' : 'Available after the due date'}
          onClick={() => window.confirm('Students will see this grade; it cannot be changed. Release?') && onRelease()}
        >
          {pastDue ? 'Release' : 'Release (available after the due date)'}
        </button>
      </div>
    </form>
  );
}
