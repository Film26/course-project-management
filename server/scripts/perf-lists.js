// F-08 TEST-08-06 (NFR-10): p50 / p95 / max of the three list endpoints (roster, proposal list, dashboard) of PERF50.
// Logs in as the synthetic perf instructor; the password is read from PERF_PASSWORD and never printed.
// Usage: PERF_PASSWORD=<synthetic> node server/scripts/perf-lists.js <base URL> [--warmup 20] [--requests 200] [--concurrency 10]
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const base = (args[0] ?? '').replace(/\/$/, '');
const WARMUP = opt('warmup', 20);
const REQUESTS = opt('requests', 200);
const CONCURRENCY = opt('concurrency', 10);
const TARGET_MS = 500;
if (!/^https?:\/\//.test(base) || !process.env.PERF_PASSWORD) {
  console.error('Usage: PERF_PASSWORD=… node server/scripts/perf-lists.js <base URL> [--warmup 20] [--requests 200] [--concurrency 10]');
  process.exit(1);
}

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'perf-instructor@perf.cpms.test', password: process.env.PERF_PASSWORD }),
});
if (login.status !== 200) {
  console.error(`Login failed: ${login.status}`);
  process.exit(1);
}
const cookie = login.headers.get('set-cookie').split(';')[0];
const get = (path) => fetch(`${base}${path}`, { headers: { cookie } });
const { courses } = await (await get('/api/courses')).json();
const perf = courses.find((c) => c.code === 'PERF50');
if (!perf) {
  console.error('Course PERF50 not found — run server/scripts/seed-perf.js first');
  process.exit(1);
}
const version = await (await fetch(`${base}/api/version`)).json();

const endpoints = [
  ['roster', `/api/courses/${perf.id}/roster`, (b) => b.teams?.length],
  ['proposal list', `/api/courses/${perf.id}/proposals`, (b) => b.proposals?.length],
  ['dashboard', `/api/courses/${perf.id}/dashboard`, (b) => b.teams?.length],
];
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

console.log(`# NFR-10 measurement — ${new Date().toISOString()}`);
console.log(`# target ${base}  commit ${version.commit}  course PERF50 (id ${perf.id})`);
console.log(`# warm-up ${WARMUP}, measured ${REQUESTS} requests, concurrency ${CONCURRENCY}, target p95 < ${TARGET_MS} ms`);
let allPass = true;
for (const [name, path, rows] of endpoints) {
  const size = rows(await (await get(path)).json());
  for (let i = 0; i < WARMUP; i++) await (await get(path)).arrayBuffer();
  const times = [];
  let errors = 0;
  let started = 0;
  async function worker() {
    while (started < REQUESTS) {
      started += 1;
      const t0 = performance.now();
      const res = await get(path);
      await res.arrayBuffer();
      times.push(performance.now() - t0);
      if (res.status !== 200) errors += 1;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  times.sort((a, b) => a - b);
  const p95 = pct(times, 95);
  const pass = p95 < TARGET_MS && errors === 0;
  allPass &&= pass;
  console.log(
    `${name.padEnd(14)} rows ${String(size).padStart(3)}  n ${times.length}  p50 ${pct(times, 50).toFixed(1)} ms  p95 ${p95.toFixed(1)} ms  max ${times.at(-1).toFixed(1)} ms  errors ${errors}  ${pass ? 'PASS' : 'FAIL'}`,
  );
}
console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'} (each p95 < ${TARGET_MS} ms)`);
process.exitCode = allPass ? 0 : 1;
