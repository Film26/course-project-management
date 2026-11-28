import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import RosterPage from './pages/RosterPage.jsx';
import TeamProposalPage from './pages/TeamProposalPage.jsx';
import ProposalReviewPage from './pages/ProposalReviewPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import MilestonesPage from './pages/MilestonesPage.jsx';
import SubmissionsPage from './pages/SubmissionsPage.jsx';
import MyGradesPage from './pages/MyGradesPage.jsx';
import PeerRatePage from './pages/PeerRatePage.jsx';
import PeerSummaryPage from './pages/PeerSummaryPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

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
            onOpenAudit={(c) => setView({ name: 'audit', courseId: c.id })}
            onOpenMilestones={(c) => setView({ name: 'milestones', courseId: c.id })}
            onOpenGrades={(c) => setView({ name: 'my-grades', courseId: c.id })}
            onOpenPeerSummary={(c) => setView({ name: 'peer-summary', courseId: c.id })}
            onOpenDashboard={(c) => setView({ name: 'dashboard', courseId: c.id })}
            onUnauthenticated={onUnauthenticated}
          />
        )}
        {view.name === 'roster' && (
          <RosterPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'proposals' && (
          <ProposalReviewPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'audit' && (
          <AuditPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'milestones' && (
          <MilestonesPage
            user={user}
            courseId={view.courseId}
            onBack={() => setView({ name: 'home' })}
            onOpenSubmissions={(m) => setView({ name: 'submissions', milestoneId: m.id, courseId: view.courseId })}
            onOpenPeerRating={(m) => setView({ name: 'peer-rate', milestoneId: m.id, courseId: view.courseId })}
            onUnauthenticated={onUnauthenticated}
          />
        )}
        {view.name === 'my-grades' && (
          <MyGradesPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'submissions' && (
          <SubmissionsPage
            user={user}
            milestoneId={view.milestoneId}
            onBack={() => setView({ name: 'milestones', courseId: view.courseId })}
            onUnauthenticated={onUnauthenticated}
          />
        )}
        {view.name === 'peer-rate' && (
          <PeerRatePage
            milestoneId={view.milestoneId}
            onBack={() => setView({ name: 'milestones', courseId: view.courseId })}
            onUnauthenticated={onUnauthenticated}
          />
        )}
        {view.name === 'dashboard' && (
          <DashboardPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'peer-summary' && (
          <PeerSummaryPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
        {view.name === 'team-proposal' && (
          <TeamProposalPage courseId={view.courseId} onBack={() => setView({ name: 'home' })} onUnauthenticated={onUnauthenticated} />
        )}
      </main>
    </>
  );
}
