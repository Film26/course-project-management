import { useEffect, useState } from 'react';
import { api } from '../api.js';

// F-07 FR-20 — per-student average peer ratings for the course instructor. Comments are shown without the
// rater's name (BR-13); the API enforces course ownership.

export default function PeerSummaryPage({ courseId, onBack, onUnauthenticated }) {
  const [milestoneId, setMilestoneId] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    api(`/courses/${courseId}/milestones`)
      .then((d) => setMilestones(d.milestones))
      .catch(() => setMilestones([]));
  }, [courseId]);

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(`/courses/${courseId}/peer-ratings${milestoneId ? `?milestoneId=${milestoneId}` : ''}`)
      .then((data) => current && setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, data: null, error: err.status === 403 ? 'You do not have access to this course.' : err.message });
      });
    return () => {
      current = false;
    };
  }, [courseId, milestoneId, onUnauthenticated]);

  const { data } = state;
  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      <div className="row">
        <h2>{data ? `${data.course.code} — peer ratings` : 'Peer ratings'}</h2>
        <label className="inline">
          Milestone
          <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">All milestones</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.loading && <p>Loading peer ratings…</p>}
      {!state.loading && state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {!state.loading && data && data.students.length === 0 && <p className="muted">No students in this course yet.</p>}
      {!state.loading && data && data.students.length > 0 && (
        <div className="table-scroll">
          <table className="table" data-testid="peer-summary">
            <thead>
              <tr>
                <th>Team</th>
                <th>Student</th>
                <th>Average</th>
                <th>Ratings</th>
                <th>Comments (anonymous)</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} data-testid={`peer-row-${s.id}`}>
                  <td>{s.team?.name ?? <span className="muted">No team</span>}</td>
                  <td>{s.displayName}</td>
                  <td data-testid="average">{s.average === null ? '–' : s.average.toFixed(2)}</td>
                  <td data-testid="count">{s.count}</td>
                  <td>
                    {s.comments.length === 0 ? (
                      <span className="muted">–</span>
                    ) : (
                      <details>
                        <summary>{s.comments.length} comment(s)</summary>
                        <ul>
                          {s.comments.map((c, i) => (
                            <li key={i} className="pre">
                              {c}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
