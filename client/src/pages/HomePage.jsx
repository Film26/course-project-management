import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function HomePage({ user, onOpenRoster, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, courses: [], error: '' });

  useEffect(() => {
    api('/courses')
      .then((d) => setState({ loading: false, courses: d.courses, error: '' }))
      .catch((err) => {
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, courses: [], error: err.message });
      });
  }, [onUnauthenticated]);

  if (state.loading) return <p>Loading courses…</p>;
  if (state.error) return <p className="error">{state.error}</p>;

  return (
    <section>
      <h2>My courses</h2>
      {state.courses.length === 0 ? (
        <p className="muted">You are not part of any course yet.</p>
      ) : (
        <ul className="list">
          {state.courses.map((c) => (
            <li key={c.id} className="card row">
              <span>
                <strong>{c.code}</strong> {c.name}
              </span>
              {/* Convenience only — the API enforces INSTRUCTOR + ownership (403 otherwise). */}
              {user.role === 'INSTRUCTOR' && <button onClick={() => onOpenRoster(c)}>View roster</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
