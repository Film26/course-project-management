// Shared fetch wrapper. Sends the session cookie and normalises errors to
// { status, code, message } so every screen can show the same error state.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? 'Request failed');
    err.status = res.status;
    err.code = data?.error?.code ?? 'UNKNOWN';
    throw err;
  }
  return data;
}
