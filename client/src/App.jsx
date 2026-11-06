import { useEffect, useState } from 'react';
import { api } from './api.js';

// Baseline shell. F-01 adds the login page and current-user header;
// F-02 adds the proposal screens.
export default function App() {
  const [health, setHealth] = useState('checking…');

  useEffect(() => {
    api('/health')
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('API unreachable'));
  }, []);

  return (
    <main className="container">
      <h1>Course Project Management</h1>
      <p>
        API status: <strong>{health}</strong>
      </p>
    </main>
  );
}
