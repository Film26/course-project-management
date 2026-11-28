// F-08 domain rules (pure functions, no database) — contract docs/sprints/sprint-3/F-08-dashboard.md §2.
// D1: the dashboard only reads what F-02 … F-06 stored; it never recalculates isLate or grades.

const ACTIVE = new Set(['DRAFT', 'SUBMITTED', 'APPROVED']);
const time = (d) => (d ? new Date(d).getTime() : 0);

/** D2: the active proposal (BR-01: at most one), else the newest REJECTED by decidedAt desc then id desc, else null. */
export function currentProposal(proposals) {
  const list = proposals ?? [];
  const pick =
    list.find((p) => ACTIVE.has(p.status)) ??
    list.filter((p) => p.status === 'REJECTED').sort((a, b) => time(b.decidedAt) - time(a.decidedAt) || b.id - a.id)[0];
  return pick ? { id: pick.id, title: pick.title, status: pick.status } : null;
}

/** D2: one team × milestone cell from all versions of that team (each may carry its grade). */
export function cellFor(milestone, versions) {
  const list = versions ?? [];
  const current = list.reduce((best, v) => (!best || v.version > best.version ? v : best), null);
  const g = current?.grade ?? null;
  return {
    milestoneId: milestone.id,
    status: !current ? 'NOT_SUBMITTED' : current.isLate ? 'LATE' : 'SUBMITTED',
    versionCount: list.length,
    grade: !g ? { state: 'NONE', score: null } : { state: g.releasedAt ? 'RELEASED' : 'GRADED', score: g.score },
  };
}

/** D3: late count, released count and Σ score / maxScore × weight over released grades, rounded once, half up, to 2 decimals. */
export function teamTotals(cells, milestones) {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  let lateCount = 0;
  let releasedCount = 0;
  let sum = 0;
  for (const c of cells) {
    if (c.status === 'LATE') lateCount += 1;
    if (c.grade.state === 'RELEASED') {
      const m = byId.get(c.milestoneId);
      releasedCount += 1;
      sum += (c.grade.score * m.weight) / m.maxScore;
    }
  }
  return { lateCount, releasedCount, releasedWeightedScore: Math.round((sum + Number.EPSILON) * 100) / 100 };
}
