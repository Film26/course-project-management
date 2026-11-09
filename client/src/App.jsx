import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import RosterPage from './pages/RosterPage.jsx';
import TeamProposalPage from './pages/TeamProposalPage.jsx';
import ProposalReviewPage from './pages/ProposalReviewPage.jsx';

// F-01: session restore via /auth/me, header with current user, logout.
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [view, setView] = useState({ name: 'home' });

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setView({ name: 'home' });
    }
  }, []);

  // Any 401 from a protected call means the session is gone → back to login.
  const onUnauthenticated = useCallback(() => setUser(null), []);

  if (user === undefined) return <main className="container">Loading…</main>;
  if (user === null) return <LoginPage onLoggedIn={setUser} />;

  return (
    <>
      <header className="topbar">
        <strong className="brand" onClick={() => setView({ name: 'home' })}>
          Course Project Management
        </strong>
        <span className="who" data-testid="current-user">
          {user.displayName} <span className="badge">{user.role}</span>
        </span>
        <button onClick={logout}>Log out</button>
      </header>
      <main className="container">
        {view.name === 'home' && (
          <HomePage
            user={user}
            onOpenRoster={(c) => setView({ name: 'roster', courseId: c.id })}
            onOpenProposals={(c) => setView({ name: 'proposals', courseId: c.id })}
            onOpenTeamProposal={(c) => setView({ name: 'team-proposal', courseId: c.id })}
            onUnauthenticated={onUnauthenticated}
          />
        )}
        {view.name === 'roster' && (
          <RosterPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'proposals' && (
          <ProposalReviewPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'team-proposal' && (
          <TeamProposalPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
      </main>
    </>
  );
}
