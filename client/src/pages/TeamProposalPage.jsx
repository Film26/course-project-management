import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge, formatTime } from '../proposalUi.jsx';
import { NoTeam, TeamInfo } from '../teamUi.jsx';

const LIMITS = { title: 120, description: 5000 };

function validate({ title, description }) {
  const errors = {};
  if (!title.trim()) errors.title = 'Title is required';
  else if (title.trim().length > LIMITS.title) errors.title = `At most ${LIMITS.title} characters`;
  if (!description.trim()) errors.description = 'Description is required';
  else if (description.trim().length > LIMITS.description) errors.description = `At most ${LIMITS.description} characters`;
  return errors;
}

// F-02 FR-05/FR-06/FR-09 — Student view of their team's proposal. The API enforces every rule;
// the form only mirrors them for convenience.
function ProposalForm({ initial, busy, submitLabel, onSave, extraAction }) {
  const [fields, setFields] = useState({ title: initial?.title ?? '', description: initial?.description ?? '' });
  const [errors, setErrors] = useState({});

  function save(e) {
    e.preventDefault();
    const errs = validate(fields);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(fields);
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <label>
        Title
        <input value={fields.title} maxLength={LIMITS.title + 20} onChange={(e) => setFields({ ...fields, title: e.target.value })} />
        {errors.title && <span className="error">{errors.title}</span>}
      </label>
      <label>
        Description
        <textarea rows={5} value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} />
        {errors.description && <span className="error">{errors.description}</span>}
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>
        {extraAction}
      </div>
    </form>
  );
}

export default function TeamProposalPage({ courseId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '', status: 0 });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    api(`/courses/${courseId}/my-team`)
      .then((data) => setState({ loading: false, data, error: '', status: 200 }))
      .catch((err) => {
        if (err.status === 401) return onUnauthenticated();
        // F-03: 404 = enrolled without a team (show create/join), 403 = not enrolled.
        const msg = err.status === 403 ? 'You are not enrolled in this course.' : err.message;
        setState({ loading: false, data: null, error: msg, status: err.status });
      });
  }, [courseId, onUnauthenticated]);

  useEffect(load, [load]);

  async function run(call) {
    setBusy(true);
    setActionError('');
    try {
      await call();
      load();
    } catch (err) {
      if (err.status === 401) return onUnauthenticated();
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) return <p>Loading team proposal…</p>;

  const back = (
    <button className="link" onClick={onBack}>
      ← Back
    </button>
  );
  if (state.status === 404)
    return (
      <section>
        {back}
        <h2>My team</h2>
        {actionError && (
          <p className="error" role="alert">
            {actionError}
          </p>
        )}
        <NoTeam
          busy={busy}
          onCreate={(name) => run(() => api(`/courses/${courseId}/teams`, { method: 'POST', body: { name } }))}
          onJoin={(joinCode) => run(() => api(`/courses/${courseId}/teams/join`, { method: 'POST', body: { joinCode } }))}
        />
      </section>
    );
  if (state.error)
    return (
      <section>
        {back}
        <p className="error" role="alert">
          {state.error}
        </p>
      </section>
    );

  const { course, team, proposals } = state.data;
  const current = proposals.find((p) => p.status !== 'REJECTED');
  const history = proposals.filter((p) => p !== current);
  const lastRejected = !current ? proposals.find((p) => p.status === 'REJECTED') : null;

  return (
    <section>
      {back}
      <h2>
        {course.code} — {team.name}
      </h2>
      <p className="muted">Proposal deadline: {formatTime(course.proposalDeadline)}</p>
      <TeamInfo course={course} team={team} busy={busy} onLeave={() => run(() => api(`/teams/${team.id}/leave`, { method: 'POST' }))} />
      {team.members.length < course.minTeamSize && (
        <p className="muted" data-testid="size-warning">
          Your team needs at least {course.minTeamSize} members before a proposal can be submitted.
        </p>
      )}

      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      {current && (
        <div className="card" data-testid="current-proposal">
          <div className="row">
            <h3>{current.title}</h3>
            <StatusBadge status={current.status} />
          </div>
          {current.status !== 'DRAFT' && <p className="pre">{current.description}</p>}
          {current.status === 'SUBMITTED' && <p className="muted">Submitted {formatTime(current.submittedAt)} — waiting for the instructor's decision.</p>}
          {/* Lab 7 (Issue #74): withdraw back to DRAFT while the deadline has not passed; the API decides (403/409). */}
          {current.status === 'SUBMITTED' && Date.now() <= new Date(course.proposalDeadline).getTime() && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Withdraw this submission? The proposal goes back to draft so your team can edit it and submit again.')) {
                  run(() => api(`/proposals/${current.id}/withdraw`, { method: 'POST' }));
                }
              }}
            >
              Withdraw submission
            </button>
          )}
          {current.status === 'APPROVED' && (
            <p className="ok">
              Approved by {current.decidedBy?.displayName} on {formatTime(current.decidedAt)}.
            </p>
          )}
          {current.status === 'DRAFT' && (
            <ProposalForm
              key={current.id + current.updatedAt}
              initial={current}
              busy={busy}
              submitLabel="Save draft"
              onSave={(fields) => run(() => api(`/proposals/${current.id}`, { method: 'PATCH', body: fields }))}
              extraAction={
                <button type="button" disabled={busy} onClick={() => run(() => api(`/proposals/${current.id}/submit`, { method: 'POST' }))}>
                  Submit proposal
                </button>
              }
            />
          )}
        </div>
      )}

      {!current && (
        <>
          {lastRejected ? (
            <p className="error" data-testid="rejection">
              Your last proposal "{lastRejected.title}" was rejected: {lastRejected.rejectReason}
            </p>
          ) : (
            <p className="muted">Your team has no proposal yet.</p>
          )}
          <h3>New proposal</h3>
          <ProposalForm
            busy={busy}
            submitLabel="Create draft"
            onSave={(fields) => run(() => api(`/teams/${team.id}/proposals`, { method: 'POST', body: fields }))}
          />
        </>
      )}

      {history.length > 0 && (
        <>
          <h3>History</h3>
          <ul className="list">
            {history.map((p) => (
              <li key={p.id} className="card">
                <div className="row">
                  <strong>{p.title}</strong>
                  <StatusBadge status={p.status} />
                </div>
                {p.rejectReason && <p className="muted">Reason: {p.rejectReason}</p>}
                <p className="muted">Decided {formatTime(p.decidedAt)} by {p.decidedBy?.displayName ?? '—'}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
