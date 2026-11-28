import { useEffect, useState } from 'react';
import { api } from '../api.js';

// F-08 FR-21 — course dashboard for the course instructor. Read-only: it shows what proposals, submissions and
// grades already stored (D1); the API enforces ownership (D5).

const PROPOSAL_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved', REJECTED: 'Rejected', NONE: 'No proposal' };

function Cell({ cell, maxScore }) {
  const status =
    cell.status === 'NOT_SUBMITTED' ? (
      <span className="badge status-not_submitted">Not submitted</span>
    ) : cell.status === 'LATE' ? (
      <span className="badge status-late">Late v{cell.versionCount}</span>
    ) : (
      <span className="badge status-submitted">Submitted v{cell.versionCount}</span>
    );
  const g = cell.grade;
  return (
    <>
      {status}
      {g.state === 'RELEASED' && <div>{`${g.score} / ${maxScore} ✓`}</div>}
      {g.state === 'GRADED' && <div className="muted">{`${g.score} (draft)`}</div>}
    </>
  );
}

export default function DashboardPage({ courseId, onBack, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let current = true;
    api(`/courses/${courseId}/dashboard`)
      .then((data) => current && setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, data: null, error: err.status === 403 ? 'You do not have access to this course.' : err.message });
      });
    return () => {
      current = false;
    };
  }, [courseId, onUnauthenticated]);

  const back = (
    <button className="link" onClick={onBack}>
      ← Back
    </button>
  );
  if (state.loading) return <section>{back}<p>Loading dashboard…</p></section>;
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

  const { course, milestones, teams, totals } = state.data;
  const lateTotal = totals.perMilestone.reduce((n, m) => n + m.late, 0);
  return (
    <section>
      {back}
      <h2>{course.code} — dashboard</h2>
      <div className="tiles" data-testid="dashboard-totals">
        <div className="card tile">
          <span className="muted">Teams</span>
          <strong>{totals.teams}</strong>
        </div>
        <div className="card tile">
          <span className="muted">Proposals</span>
          <span>
            {Object.entries(totals.proposals)
              .filter(([, n]) => n > 0)
              .map(([s, n]) => `${PROPOSAL_LABEL[s]} ${n}`)
              .join(' · ') || '–'}
          </span>
        </div>
        <div className="card tile">
          <span className="muted">Late submissions</span>
          <strong>{lateTotal}</strong>
        </div>
      </div>

      {teams.length === 0 ? (
        <p className="muted">No teams yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table" data-testid="dashboard-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Proposal</th>
                {milestones.map((m) => (
                  <th key={m.id}>
                    {m.title}
                    <div className="muted">{m.weight} %</div>
                  </th>
                ))}
                <th>Late</th>
                <th>Weighted released score</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} data-testid={`dashboard-row-${t.name}`}>
                  <td>
                    <strong>{t.name}</strong>
                    <div className="muted">{t.memberCount} member(s)</div>
                  </td>
                  <td data-testid="proposal-status">
                    {t.proposal ? (
                      <span className={`badge status-${t.proposal.status.toLowerCase()}`} title={t.proposal.title}>
                        {t.proposal.status}
                      </span>
                    ) : (
                      <span className="muted">No proposal</span>
                    )}
                  </td>
                  {t.cells.map((c, i) => (
                    <td key={c.milestoneId} data-testid={`cell-${milestones[i].title}`}>
                      <Cell cell={c} maxScore={milestones[i].maxScore} />
                    </td>
                  ))}
                  <td data-testid="late-count">{t.lateCount}</td>
                  <td data-testid="weighted">{t.releasedWeightedScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Weighted released score = Σ score / max × weight over released grades only; informative, not a course grade.</p>
    </section>
  );
}
