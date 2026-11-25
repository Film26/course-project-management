import { useState } from 'react';

// F-03 FR-10/FR-11 — forms shown when an enrolled student has no team yet. The API decides every rule
// (enrollment, one team per course, team size, lock); the forms only check the simple field rules first.

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

function CreateTeamForm({ busy, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Team name is required');
    if (trimmed.length > 60) return setError('At most 60 characters');
    onCreate(trimmed);
  }
  return (
    <form className="card" onSubmit={submit} noValidate data-testid="create-team">
      <h3>Create a team</h3>
      <label>
        Team name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
        />
        {error && <span className="error">{error}</span>}
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Create team
        </button>
      </div>
    </form>
  );
}

function JoinTeamForm({ busy, onJoin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    const normalised = code.trim().toUpperCase();
    if (!CODE.test(normalised)) return setError('Enter the 8-character join code (no O, I, 0 or 1)');
    onJoin(normalised);
  }
  return (
    <form className="card" onSubmit={submit} noValidate data-testid="join-team">
      <h3>Join a team</h3>
      <label>
        Join code
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
        />
        {error && <span className="error">{error}</span>}
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Join team
        </button>
      </div>
    </form>
  );
}

export function NoTeam({ busy, onCreate, onJoin }) {
  return (
    <>
      <p className="muted">You are not in a team for this course yet. Create one, or join a team with the code a teammate gives you.</p>
      <CreateTeamForm busy={busy} onCreate={onCreate} />
      <JoinTeamForm busy={busy} onJoin={onJoin} />
    </>
  );
}

/** Team header: members, join code, size and the leave button (hidden when BR-08 locks the team). */
export function TeamInfo({ course, team, busy, onLeave }) {
  const [copied, setCopied] = useState(false);
  const count = team.members.length;
  async function copy() {
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="card" data-testid="team-info">
      <p>
        Members: {team.members.map((m) => m.displayName).join(', ')}
      </p>
      <p className="muted" data-testid="team-size">
        {count} / {course.maxTeamSize} members (minimum {course.minTeamSize})
      </p>
      <p>
        Join code: <strong data-testid="join-code">{team.joinCode}</strong>{' '}
        <button type="button" className="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </p>
      {team.locked ? (
        <p className="muted">Team locked: the proposal is approved.</p>
      ) : (
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => window.confirm(`Leave ${team.name}?`) && onLeave()}
        >
          Leave team
        </button>
      )}
    </div>
  );
}
