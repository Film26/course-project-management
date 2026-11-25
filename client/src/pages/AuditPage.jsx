import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../proposalUi.jsx';

// F-09 FR-22 — course audit log for the course instructor. Read-only; the API enforces ownership.

const LABELS = {
  PROPOSAL_APPROVED: 'Proposal approved',
  PROPOSAL_REJECTED: 'Proposal rejected',
  TEAM_CREATED: 'Team created',
  MEMBER_JOINED: 'Member joined',
  MEMBER_LEFT: 'Member left',
  GRADE_RELEASED: 'Grade released',
};

function summary(e) {
  const d = e.details ?? {};
  switch (e.action) {
    case 'PROPOSAL_APPROVED':
      return `Approved "${d.title}"`;
    case 'PROPOSAL_REJECTED':
      return `Rejected "${d.title}": ${d.reason}`;
    case 'GRADE_RELEASED':
      return `${d.milestoneTitle}: ${d.score} / ${d.maxScore}`;
    default:
      return d.teamName ?? '';
  }
}

export default function AuditPage({ courseId, onBack, onUnauthenticated }) {
  const [action, setAction] = useState('');
  const [state, setState] = useState({ loading: true, course: null, entries: [], nextBefore: null, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);

  const path = (before) => {
    const q = new URLSearchParams();
    if (action) q.set('action', action);
    if (before) q.set('before', String(before));
    const s = q.toString();
    return `/courses/${courseId}/audit${s ? `?${s}` : ''}`;
  };

  function fail(err) {
    if (err.status === 401) return onUnauthenticated();
    const msg = err.status === 403 ? 'You do not have access to this course.' : err.message;
    setState((s) => ({ ...s, loading: false, error: msg }));
  }

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(path())
      .then((d) => current && setState({ loading: false, course: d.course, entries: d.entries, nextBefore: d.nextBefore, error: '' }))
      .catch((err) => current && fail(err));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, action]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await api(path(state.nextBefore));
      setState((s) => ({ ...s, entries: [...s.entries, ...d.entries], nextBefore: d.nextBefore }));
    } catch (err) {
      fail(err);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      <div className="row">
        <h2>{state.course ? `${state.course.code} — audit log` : 'Audit log'}</h2>
        <label className="inline">
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All</option>
            {Object.entries(LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.loading && <p>Loading audit log…</p>}
      {!state.loading && state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {!state.loading && !state.error && state.entries.length === 0 && <p className="muted">No activity yet.</p>}
      {!state.loading && !state.error && state.entries.length > 0 && (
        <ul className="list" data-testid="audit-list">
          {state.entries.map((e) => (
            <li key={e.id} className="card" data-testid="audit-entry">
              <div className="row">
                <strong>{LABELS[e.action]}</strong>
                <span className="muted">{formatTime(e.createdAt)}</span>
              </div>
              <p>{summary(e)}</p>
              <p className="muted">
                By {e.actor.displayName}
                {e.team && ` · ${e.team.name}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      {state.nextBefore && (
        <button className="secondary" disabled={loadingMore} onClick={loadMore}>
          Load more
        </button>
      )}
    </section>
  );
}
