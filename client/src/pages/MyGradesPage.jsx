import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../proposalUi.jsx';

// F-06 FR-18 — released grades of the student's own team. Unreleased grades never reach this page (the API
// does not send them, BR-12).
export default function MyGradesPage({ courseId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    api(`/courses/${courseId}/my-grades`)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (err.status === 401) return onUnauthenticated();
        const msg = err.code === 'NO_TEAM' ? 'You are not in a team for this course.' : err.status === 403 ? 'You are not enrolled in this course.' : err.message;
        setState({ loading: false, data: null, error: msg });
      });
  }, [courseId, onUnauthenticated]);

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      <h2>{state.data ? `${state.data.course.code} — my grades (${state.data.team.name})` : 'My grades'}</h2>
      {state.loading && <p>Loading grades…</p>}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.data && state.data.grades.length === 0 && <p className="muted">No released grades yet.</p>}
      {state.data && state.data.grades.length > 0 && (
        <ul className="list">
          {state.data.grades.map((g) => (
            <li key={g.milestone.id} className="card" data-testid="my-grade">
              <div className="row">
                <strong>{g.milestone.title}</strong>
                <span>
                  {g.score} / {g.milestone.maxScore}
                </span>
              </div>
              <p className="pre">{g.feedback}</p>
              <p className="muted">
                Version {g.version} · weight {g.milestone.weight} % · released {formatTime(g.releasedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
