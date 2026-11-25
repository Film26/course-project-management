// F-04 seed data: three milestones for a course, total weight 90 % (a 10 % milestone still fits, 11 % does not — BR-09).
// Kept in its own module so the rule for re-running the seed can be tested (TEST-04-13).
export const SEED_MILESTONES = [
  { title: 'M1 Requirements', description: 'SRS, feature inventory and Sprint 1 contracts', dueAt: '2026-12-01T16:59:00Z', weight: 20, maxScore: 100 },
  { title: 'M2 Design', description: 'System-level SDS and Sprint 2 contracts', dueAt: '2026-12-06T16:59:00Z', weight: 30, maxScore: 100 },
  { title: 'M3 Final release', description: 'Deployed final release and demonstration video', dueAt: '2026-12-13T16:59:00Z', weight: 40, maxScore: 100 },
];

/**
 * The seed runs on every deploy. It adds the milestones only to a course that has **none**, so it never re-adds a
 * milestone the instructor renamed or deleted, and never pushes the total over 100 % (BR-09, PR #48 review).
 * Returns the number of milestones created (3 or 0).
 */
export async function seedMilestones(prisma, courseId) {
  if ((await prisma.milestone.count({ where: { courseId } })) > 0) return 0;
  await prisma.milestone.createMany({ data: SEED_MILESTONES.map((m) => ({ ...m, dueAt: new Date(m.dueAt), courseId })) });
  return SEED_MILESTONES.length;
}
