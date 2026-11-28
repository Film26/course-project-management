import { useEffect, useState } from 'react';
import { api } from '../api.js';

// F-07 FR-19 — a student rates each current teammate once per milestone (BR-13). The API decides every rule
// (self, teammate, once); the form only repeats the field checks. Only the student's own ratings are shown.

const MAX_COMMENT = 500;

function RateForm({ teammate, onRated, onError }) {
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!score) return setFieldError('Choose a score from 1 to 5');
    if (comment.trim().length > MAX_COMMENT) return setFieldError(`At most ${MAX_COMMENT} characters`);
    setBusy(true);
    try {
      await onRated({ rateeId: teammate.id, score: Number(score), comment });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="actions">
      <label className="inline">
        Score
        <select aria-label={`Score for ${teammate.displayName}`} value={score} onChange={(e) => { setScore(e.target.value); setFieldError(''); }}>
          <option value="">–</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Comment (optional)
        <textarea aria-label={`Comment for ${teammate.displayName}`} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        <span className="muted">
          {comment.trim().length} / {MAX_COMMENT}
        </span>
      </label>
      {fieldError && <span className="error">{fieldError}</span>}
      <button type="submit" disabled={busy}>
        Submit rating
      </button>
    </form>
  );
}

export default function PeerRatePage({ milestoneId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true }));
    api(`/milestones/${milestoneId}/peer-ratings/mine`)
      .then((data) => current && setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, data: null, error: err.status === 403 ? 'You do not have access to this course.' : err.message });
      });
    return () => {
      current = false;
    };
  }, [milestoneId, reloadKey, onUnauthenticated]);

  function fail(err) {
    if (err.status === 401) return onUnauthenticated();
    setActionError(err.message);
    setReloadKey((k) => k + 1);
  }

  async function rate(body) {
    setActionError('');
    await api(`/milestones/${milestoneId}/peer-ratings`, { method: 'POST', body });
    setReloadKey((k) => k + 1);
  }

  const back = (
    <button className="link" onClick={onBack}>
      ← Back
    </button>
  );
  if (state.loading && !state.data) return <section>{back}<p>Loading teammates…</p></section>;
  if (state.error) {
    return (
      <section>
        {back}
        <p className="error" role="alert">
          {state.error}
        </p>
      </section>
    );
  }

  const { milestone, teammates } = state.data;
  return (
    <section>
      {back}
      <h2>Rate teammates — {milestone.title}</h2>
      <p className="muted">Each teammate can be rated once for this milestone. Other students never see your rating.</p>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {teammates.length === 0 ? (
        <p className="muted">You have no teammates to rate yet.</p>
      ) : (
        <ul className="list" data-testid="peer-teammates">
          {teammates.map((t) => (
            <li key={t.id} className="card" data-testid={`peer-${t.id}`}>
              <div className="row">
                <strong>{t.displayName}</strong>
                {t.rated && (
                  <span className="badge status-approved" data-testid="rated">
                    Rated: {t.myRating.score}
                  </span>
                )}
              </div>
              {t.rated ? (
                t.myRating.comment && <p className="pre muted">{t.myRating.comment}</p>
              ) : (
                <RateForm teammate={t} onRated={rate} onError={fail} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
