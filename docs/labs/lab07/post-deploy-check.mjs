// Post-deployment checks for Part E §3 that need no password: version, readiness, and that protected endpoints of
// every feature answer 401 (deployed with the right routes and NFR-02). The critical journeys are checked by hand.
// Usage: node post-deploy-check.mjs <URL> <expected commit> [output file]
import fs from 'node:fs';

const [url = 'https://cpms-t4xsm3f7aa-as.a.run.app', expected = '', out] = process.argv.slice(2);
const lines = [`# Post-deployment check — ${url} — ${new Date().toISOString()}`];
let ok = true;
const check = (name, pass, detail) => {
  ok &&= pass;
  lines.push(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

const get = async (path, init) => {
  const res = await fetch(url + path, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

const version = await get('/api/version');
check('GET /api/version', version.status === 200 && (!expected || version.body?.commit?.startsWith(expected)), `→ ${version.status} ${JSON.stringify(version.body)} (expected ${expected || 'any'})`);
const ready = await get('/api/ready');
check('GET /api/ready', ready.status === 200 && ready.body?.db === 'connected', `→ ${ready.status} ${JSON.stringify(ready.body)}`);

// One protected endpoint per feature: 401 means the route exists and requires a session (NFR-02).
for (const [name, path, method] of [
  ['F-01 courses', '/api/courses', 'GET'],
  ['F-02 proposals list', '/api/courses/1/proposals', 'GET'],
  ['F-03 join team', '/api/courses/1/teams/join', 'POST'],
  ['F-04 milestones', '/api/courses/1/milestones', 'GET'],
  ['F-05 submissions', '/api/milestones/1/submissions', 'GET'],
  ['F-06 my grades', '/api/courses/1/my-grades', 'GET'],
  ['F-09 audit log', '/api/courses/1/audit', 'GET'],
  ['Lab 7 withdraw (new route)', '/api/proposals/1/withdraw', 'POST'],
  ['F-02 submit (Sprint 1 path)', '/api/proposals/1/submit', 'POST'],
  ['F-02 approve (Sprint 1 path)', '/api/proposals/1/approve', 'POST'],
  ['F-02 reject (Sprint 1 path)', '/api/proposals/1/reject', 'POST'],
]) {
  const r = await get(path, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
  check(`${name} without session`, r.status === 401 && r.body?.error?.code === 'UNAUTHENTICATED', `${method} ${path} → ${r.status} ${r.body?.error?.code ?? ''}`);
}
lines.push(ok ? 'RESULT: all checks passed' : 'RESULT: some checks FAILED');
const text = lines.join('\n') + '\n';
process.stdout.write(text);
if (out) fs.writeFileSync(out, text);
process.exit(ok ? 0 : 1);
