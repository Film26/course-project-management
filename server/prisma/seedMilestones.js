// F-04 seed data: three milestones for a course, total weight 90 % (a 10 % milestone still fits, 11 % does not — BR-09).
// Kept in its own module so the rule for re-running the seed can be tested (TEST-04-13).
export const SEED_MILESTONES = [
  { title: 'M1 Requirements', description: 'SRS, feature inventory and Sprint 1 contracts', dueAt: '2026-12-01T16:59:00Z', weight: 20, maxScore: 100 },
  { title: 'M2 Design', description: 'System-level SDS and Sprint 2 contracts', dueAt: '2026-12-06T16:59:00Z', weight: 30, maxScore: 100 },
  { title: 'M3 Final release', description: 'Deployed final release and demonstration video', dueAt: '2026-12-13T16:59:00Z', weight: 40, maxScore: 100 },
];

/** Matched by title so the seed stays safe to run on every deploy. Returns the number of milestones created. */
export async function seedMilestones(prisma, courseId) {
  let created = 0;
  for (const m of SEED_MILESTONES) {
    const exists = await prisma.milestone.findFirst({ where: { courseId, title: m.title }, select: { id: true } });
    if (!exists) {
      await prisma.milestone.create({ data: { ...m, dueAt: new Date(m.dueAt), courseId } });
      created += 1;
    }
  }
  return created;
}
