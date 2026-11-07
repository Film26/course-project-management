// Shared bits for the F-02 proposal screens.
export function StatusBadge({ status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`} data-testid="status">
      {status}
    </span>
  );
}

// Timestamps are stored in UTC and shown in Asia/Bangkok time (SRS A-03).
export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
}
