import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge, formatTime } from '../proposalUi.jsx';

const FILTERS = ['', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DRAFT'];
const REASON_MAX = 500;

// F-02 FR-07/FR-08 — Instructor review list. Approve/reject are enforced by the API (owner + SUBMITTED only).
function ReviewRow({ proposal, onDecide, busy }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function confirmReject() {
    if (!reason.trim()) return setError('A reason is required');
    if (reason.trim().length > REASON_MAX) return setError(`At most ${REASON_MAX} characters`);
    onDecide(proposal, 'reject', reason);
  }

  return (
    <li className="card" data-testid={`proposal-${proposal.id}`}>
      <div className="row">
        <span>
          <strong>{proposal.team.name}</strong> — {proposal.title}
        </span>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="pre">{proposal.description}</p>
      <p className="muted">
        Submitted: {formatTime(proposal.submittedAt)}
        {proposal.decidedAt && ` · Decided: ${formatTime(proposal.decidedAt)} by ${proposal.decidedBy?.displayName}`}
      </p>
      {proposal.rejectReason && <p className="muted">Reason: {proposal.rejectReason}</p>}

      {proposal.status === 'SUBMITTED' && !rejecting && (
        <div className="actions">
          <button disabled={busy} onClick={() => onDecide(proposal, 'approve')}>
            Approve
          </button>
          <button className="danger" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      )}
      {rejecting && (
        <div className="reject-box">
          <label>
            Reason for rejection
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
            />
          </label>
          <span className="muted">
            {reason.trim().length}/{REASON_MAX}
          </span>
          {error && <span className="error">{error}</span>}
          <div className="actions">
            <button className="danger" disabled={busy} onClick={confirmReject}>
              Confirm reject
            </button>
            <button className="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ProposalReviewPage({ courseId, onBack, onUnauthenticated }) {
  const [status, setStatus] = useState('SUBMITTED');
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  // Ignore responses from an earlier filter/reload so a slow, stale list never overwrites a newer one.
  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true }));
    api(`/courses/${courseId}/proposals${status ? `?status=${status}` : ''}`)
      .then((data) => current && setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) return onUnauthenticated();
        const msg = err.status === 403 ? 'You do not have access to this course.' : err.message;
        setState({ loading: false, data: null, error: msg });
      });
    return () => {
      current = false;
    };
  }, [courseId, status, reloadKey, onUnauthenticated]);

  async function decide(proposal, action, reason) {
    setBusy(true);
    setActionError('');
    try {
      await api(`/proposals/${proposal.id}/${action}`, { method: 'POST', body: action === 'reject' ? { reason } : undefined });
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.status === 401) return onUnauthenticated();
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back
      </button>
      <div className="row">
        <h2>{state.data ? `${state.data.course.code} — proposals` : 'Proposals'}</h2>
        <label className="inline">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f ? f.charAt(0) + f.slice(1).toLowerCase() : 'All'}
              </option>
            ))}
          </select>
        </label>
      </div>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {state.loading && <p>Loading proposals…</p>}
      {!state.loading && state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {!state.loading && state.data && state.data.proposals.length === 0 && <p className="muted">No proposals.</p>}
      {!state.loading && state.data && state.data.proposals.length > 0 && (
        <ul className="list">
          {state.data.proposals.map((p) => (
            <ReviewRow key={`${p.id}-${p.status}`} proposal={p} onDecide={decide} busy={busy} />
          ))}
        </ul>
      )}
    </section>
  );
}
