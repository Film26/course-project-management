// F-08 application layer: course dashboard (Prisma). Read-only (D1). Built from a fixed number of queries (D4, NFR-10):
// course, teams + member counts, proposals, milestones, submissions with their grades — never one query per team.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { cellFor, currentProposal, teamTotals } from './rules.js';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export async function courseDashboard(courseId, user) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, code: true, name: true, instructorId: true } });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  if (course.instructorId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'You do not teach this course'); // D5

  const [teams, proposals, milestones, submissions] = await Promise.all([
    prisma.team.findMany({ where: { courseId }, select: { id: true, name: true, _count: { select: { members: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    prisma.proposal.findMany({ where: { team: { courseId } }, select: { id: true, teamId: true, title: true, status: true, decidedAt: true } }),
    prisma.milestone.findMany({
      where: { courseId },
      select: { id: true, title: true, dueAt: true, weight: true, maxScore: true },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.submission.findMany({
      where: { milestone: { courseId } },
      select: { milestoneId: true, teamId: true, version: true, isLate: true, grade: { select: { score: true, releasedAt: true } } },
    }),
  ]);

  const group = (rows, key) => {
    const map = new Map();
    for (const r of rows) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return map;
  };
  const proposalsByTeam = group(proposals, (p) => p.teamId);
  const versionsByCell = group(submissions, (s) => `${s.teamId}:${s.milestoneId}`);

  const rows = teams.map((t) => {
    const cells = milestones.map((m) => cellFor(m, versionsByCell.get(`${t.id}:${m.id}`)));
    return {
      id: t.id,
      name: t.name,
      memberCount: t._count.members,
      proposal: currentProposal(proposalsByTeam.get(t.id)),
      cells,
      ...teamTotals(cells, milestones),
    };
  });

  const proposalTotals = Object.fromEntries([...STATUSES, 'NONE'].map((s) => [s, 0]));
  for (const r of rows) proposalTotals[r.proposal?.status ?? 'NONE'] += 1;
  const perMilestone = milestones.map((m, i) => ({
    milestoneId: m.id,
    submitted: rows.filter((r) => r.cells[i].status !== 'NOT_SUBMITTED').length,
    late: rows.filter((r) => r.cells[i].status === 'LATE').length,
  }));

  return {
    course: { id: course.id, code: course.code, name: course.name },
    milestones,
    teams: rows,
    totals: { teams: rows.length, proposals: proposalTotals, perMilestone },
  };
}
