import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../proposalUi.jsx';
import { GradeBadge, GradeForm, gradeError } from '../gradeUi.jsx';

// F-05 FR-15/FR-16 — one milestone's submissions. Students submit and see their own team's versions; the course
// instructor sees every team's current version. The API enforces BR-10, BR-11 and ownership.

const ERRORS = {
  PROPOSAL_NOT_APPROVED: 'Your proposal must be approved before you can submit.',
  RESUBMISSION_CLOSED: 'The due date has passed and your team already has an on-time version.',
  NO_TEAM: 'Join or create a team before submitting.',
};

function LateBadge({ submission }) {
  return submission.isLate ? <span className="badge status-late">LATE</span> : <span className="badge status-submitted">On time</span>;
}

function SubmitForm({ busy, onSubmit, pastDue }) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    let ok = false;
    try {
      ok = ['http:', 'https:'].includes(new URL(url.trim()).protocol);
    } catch {
      ok = false;
    }
    if (!ok) return setError('Enter a link that starts with http:// or https://');
    if (note.trim().length > 1000) return setError('The note can have at most 1000 characters');
    onSubmit({ url: url.trim(), note: note.trim() });
  }
  return (
    <form className="card" onSubmit={submit} noValidate data-testid="submit-form">
      {pastDue && <p className="muted">Past due: this version will be marked LATE.</p>}
      <label>
        Deliverable URL
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
        />
      </label>
      <label>
        Note
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <span className="muted">{note.trim().length}/1000</span>
      {error && <span className="error">{error}</span>}
      <div className="actions">
        <button type="submit" disabled={busy}>
          Submit deliverable
        </button>
      </div>
    </form>
  );
}

function Version({ s }) {
  return (
    <li className="card" data-testid="version">
      <div className="row">
        <strong>Version {s.version}</strong>
        <LateBadge submission={s} />
      </div>
      <p>
        <a href={s.url} target="_blank" rel="noopener noreferrer">
          {s.url}
        </a>
      </p>
      {s.note && <p className="pre">{s.note}</p>}
      <p className="muted">
        {formatTime(s.submittedAt)} by {s.submittedBy.displayName}
      </p>
    </li>
  );
}

export default function SubmissionsPage({ user, milestoneId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    api(`/milestones/${milestoneId}/submissions`)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, data: null, error: err.status === 403 ? 'You do not have access to this milestone.' : err.message });
      });
  }, [milestoneId, onUnauthenticated]);
  useEffect(load, [load]);

  // F-06: save or release a grade of a team's current version (instructor).
  async function gradeAction(path, body) {
    setBusy(true);
    setActionError('');
    try {
      await api(path, { method: body ? 'PUT' : 'POST', body });
      load();
    } catch (err) {
      if (err.status === 401) return onUnauthenticated();
      setActionError(gradeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(body) {
    setBusy(true);
    setActionError('');
    try {
      await api(`/milestones/${milestoneId}/submissions`, { method: 'POST', body });
      load();
    } catch (err) {
      if (err.status === 401) return onUnauthenticated();
      setActionError(ERRORS[err.code] ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <button className="link" onClick={onBack}>
      ← Back
    </button>
  );
  if (state.loading) return <section>{back}<p>Loading submissions…</p></section>;
  if (state.error)
    return (
      <section>
        {back}
        <p className="error" role="alert">
          {state.error}
        </p>
      </section>
    );

  const { milestone } = state.data;
  const pastDue = Date.now() > new Date(milestone.dueAt).getTime();
  return (
    <section>
      {back}
      <h2>{milestone.title} — submissions</h2>
      <p className="muted">
        Due {formatTime(milestone.dueAt)} · {pastDue ? 'past due' : `on time until ${formatTime(milestone.dueAt)}`}
      </p>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      {user.role === 'INSTRUCTOR' ? (
        <ul className="list" data-testid="team-submissions">
          {state.data.teams.map(({ team, current, versionCount, grade }) => (
            <li key={team.id} className="card" data-testid={`team-row-${team.name}`}>
              <div className="row">
                <strong>{team.name}</strong>
                {current ? (
                  <span>
                    Submitted v{current.version} <LateBadge submission={current} />
                  </span>
                ) : (
                  <span className="badge status-not_submitted">Not submitted</span>
                )}
              </div>
              {current && (
                <p className="muted">
                  <a href={current.url} target="_blank" rel="noopener noreferrer">
                    {current.url}
                  </a>{' '}
                  · {formatTime(current.submittedAt)} · {versionCount} version(s)
                </p>
              )}
              {current && (
                <>
                  <GradeBadge grade={grade} />
                  <GradeForm
                    key={`${current.id}-${grade?.releasedAt ?? 'open'}`}
                    grade={grade}
                    maxScore={milestone.maxScore}
                    pastDue={pastDue}
                    busy={busy}
                    onSave={(body) => gradeAction(`/submissions/${current.id}/grade`, body)}
                    onRelease={() => gradeAction(`/submissions/${current.id}/grade/release`)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {state.data.team ? <SubmitForm busy={busy} onSubmit={submit} pastDue={pastDue} /> : <p className="muted">{ERRORS.NO_TEAM}</p>}
          <h3>Versions</h3>
          {state.data.versions.length === 0 ? (
            <p className="muted">No submission yet.</p>
          ) : (
            <ul className="list">
              {state.data.versions.map((s) => (
                <Version key={s.id} s={s} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
