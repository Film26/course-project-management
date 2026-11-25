import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../proposalUi.jsx';

// F-04 FR-13 / FR-14 — milestones of a course. The instructor manages them; a student reads them with
// the team's status. Every rule (BR-09 total ≤ 100 %, ownership) is enforced by the API; the form only
// repeats the simple field checks so the user sees them before sending.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // SRS A-03: the UI works in Asia/Bangkok time
const STATUS_LABEL = { NOT_SUBMITTED: 'Not submitted', SUBMITTED: 'Submitted', LATE: 'Late', NO_TEAM: 'Join a team to submit' };

/** UTC ISO string → value for <input type="datetime-local"> in Bangkok time. */
function toBangkokInput(iso) {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}
/** <input type="datetime-local"> value (Bangkok wall time) → ISO string with an explicit +07:00 offset. */
function fromBangkokInput(value) {
  return `${value}:00+07:00`;
}

function checkFields(f) {
  const errors = {};
  if (!f.title.trim()) errors.title = 'Title is required';
  else if (f.title.trim().length > 120) errors.title = 'At most 120 characters';
  if (f.description.trim().length > 2000) errors.description = 'At most 2000 characters';
  if (!f.dueAt) errors.dueAt = 'Due date is required';
  const weight = Number(f.weight);
  if (!Number.isInteger(weight) || weight < 1 || weight > 100) errors.weight = 'Weight must be a whole number from 1 to 100';
  const maxScore = Number(f.maxScore);
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 1000) errors.maxScore = 'Max score must be a whole number from 1 to 1000';
  return errors;
}

function MilestoneForm({ initial, submitLabel, busy, onSave, onCancel }) {
  const [f, setF] = useState(
    initial
      ? { title: initial.title, description: initial.description, dueAt: toBangkokInput(initial.dueAt), weight: String(initial.weight), maxScore: String(initial.maxScore) }
      : { title: '', description: '', dueAt: '', weight: '', maxScore: '100' },
  );
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => {
    setF({ ...f, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined });
  };
  const inPast = f.dueAt && new Date(fromBangkokInput(f.dueAt)).getTime() < Date.now();

  function submit(e) {
    e.preventDefault();
    const found = checkFields(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave({
      title: f.title,
      description: f.description,
      dueAt: fromBangkokInput(f.dueAt),
      weight: Number(f.weight),
      maxScore: Number(f.maxScore),
    });
  }

  return (
    <form className="card" onSubmit={submit} noValidate data-testid="milestone-form">
      <label>
        Title
        <input value={f.title} onChange={set('title')} />
        {errors.title && <span className="error">{errors.title}</span>}
      </label>
      <label>
        Description
        <textarea rows={2} value={f.description} onChange={set('description')} />
        {errors.description && <span className="error">{errors.description}</span>}
      </label>
      <label>
        Due date (Bangkok time)
        <input type="datetime-local" value={f.dueAt} onChange={set('dueAt')} />
        {errors.dueAt && <span className="error">{errors.dueAt}</span>}
        {inPast && <span className="muted">This due date is in the past.</span>}
      </label>
      <label>
        Weight (%)
        <input type="number" min={1} max={100} value={f.weight} onChange={set('weight')} />
        {errors.weight && <span className="error">{errors.weight}</span>}
      </label>
      <label>
        Max score
        <input type="number" min={1} max={1000} value={f.maxScore} onChange={set('maxScore')} />
        {errors.maxScore && <span className="error">{errors.maxScore}</span>}
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function errorText(err) {
  if (err.code === 'WEIGHT_EXCEEDED') return err.message; // "Total weight would be 101 % (max 100 %)"
  if (err.status === 403) return 'You do not have access to this course.';
  return err.message;
}

export default function MilestonesPage({ user, courseId, onBack, onUnauthenticated }) {
  const isInstructor = user.role === 'INSTRUCTOR';
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null); // milestone id, 'new' or null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true }));
    api(`/courses/${courseId}/milestones`)
      .then((data) => current && setState({ loading: false, data, error: '' }))
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) return onUnauthenticated();
        setState({ loading: false, data: null, error: errorText(err) });
      });
    return () => {
      current = false;
    };
  }, [courseId, reloadKey, onUnauthenticated]);

  async function run(request) {
    setBusy(true);
    setActionError('');
    try {
      await request();
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.status === 401) return onUnauthenticated();
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function remove(m) {
    if (!window.confirm(`Delete milestone "${m.title}"?`)) return;
    run(() => api(`/milestones/${m.id}`, { method: 'DELETE' }));
  }

  const back = (
    <button className="link" onClick={onBack}>
      ← Back
    </button>
  );
  if (state.loading && !state.data) return <section>{back}<p>Loading milestones…</p></section>;
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

  const { course, milestones, totalWeight, team } = state.data;
  return (
    <section>
      {back}
      <h2>{course.code} — milestones</h2>
      <p className="muted" data-testid="total-weight">
        Total weight: {totalWeight} / 100 %{!isInstructor && team && ` · Team: ${team.name}`}
      </p>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${Math.min(totalWeight, 100)}%` }} />
      </div>

      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      {milestones.length === 0 ? (
        <p className="muted">No milestones yet.</p>
      ) : (
        <ul className="list">
          {milestones.map((m) =>
            editing === m.id ? (
              <li key={m.id}>
                <MilestoneForm
                  initial={m}
                  submitLabel="Save milestone"
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(fields) => run(() => api(`/milestones/${m.id}`, { method: 'PATCH', body: fields }))}
                />
              </li>
            ) : (
              <li key={m.id} className="card" data-testid={`milestone-${m.id}`}>
                <div className="row">
                  <strong>{m.title}</strong>
                  {!isInstructor && (
                    <span className={`badge status-${m.teamStatus.toLowerCase()}`} data-testid="team-status">
                      {STATUS_LABEL[m.teamStatus]}
                    </span>
                  )}
                </div>
                {m.description && <p className="pre">{m.description}</p>}
                <p className="muted">
                  Due {formatTime(m.dueAt)} · Weight {m.weight} % · Max score {m.maxScore}
                </p>
                {isInstructor && (
                  <div className="actions">
                    <button disabled={busy} onClick={() => setEditing(m.id)}>
                      Edit
                    </button>
                    <button className="danger" disabled={busy} onClick={() => remove(m)}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {isInstructor &&
        (editing === 'new' ? (
          <>
            <h3>New milestone</h3>
            <MilestoneForm
              submitLabel="Create milestone"
              busy={busy}
              onCancel={() => setEditing(null)}
              onSave={(fields) => run(() => api(`/courses/${courseId}/milestones`, { method: 'POST', body: fields }))}
            />
          </>
        ) : (
          <button onClick={() => setEditing('new')}>Add milestone</button>
        ))}
    </section>
  );
}
