import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function RosterPage({ courseId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    api(`/courses/${courseId}/roster`)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (err.status === 401) return onUnauthenticated();
        const msg = err.status === 403 ? 'You do not have access to this course.' : err.message;
        setState({ loading: false, data: null, error: msg });
      });
  }, [courseId, onUnauthenticated]);

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      {state.loading && <p>Loading roster…</p>}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.data && (
        <>
          <h2>
            {state.data.course.code} — roster
          </h2>
          {state.data.teams.length === 0 ? (
            <p className="muted">No teams yet.</p>
          ) : (
            state.data.teams.map((t) => (
              <div key={t.id} className="card">
                <h3>
                  {t.name} <span className="muted">· code {t.joinCode}</span>
                </h3>
                <ul>
                  {t.members.map((m) => (
                    <li key={m.id}>
                      {m.displayName} <span className="muted">({m.email})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <h3>Unassigned students</h3>
          {state.data.unassigned.length === 0 ? (
            <p className="muted">Every enrolled student is in a team.</p>
          ) : (
            <ul data-testid="unassigned">
              {state.data.unassigned.map((u) => (
                <li key={u.id}>
                  {u.displayName} <span className="muted">({u.email})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
