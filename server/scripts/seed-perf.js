// F-08 TEST-08-06 (NFR-10): performance data — course PERF50 with 50 teams × 3 students, 4 milestones,
// 2 versions per team and milestone, and grades (half released). Synthetic accounts only (@perf.cpms.test).
// Refuses to run unless the database name contains "perf" or "test", so it can never touch the UAT database `cpms`.
// Usage: DATABASE_URL=<…/cpms_perf> SEED_PASSWORD=<synthetic> node scripts/seed-perf.js
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
const dbName = url ? new URL(url).pathname.slice(1) : '';
if (!/perf|test/.test(dbName)) {
  console.error(`Refusing to seed performance data into "${dbName || '(no DATABASE_URL)'}": the name must contain "perf" or "test".`);
  process.exit(1);
}
if (!process.env.SEED_PASSWORD) {
  console.error('SEED_PASSWORD is not set');
  process.exit(1);
}

const TEAMS = 50;
const PER_TEAM = 3;
const DAY = 86400000;
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 10);
  const existing = await prisma.course.findUnique({ where: { code: 'PERF50' } });
  if (existing) {
    // Re-run from a clean course: submissions first (milestone FK is RESTRICT), then the course cascades.
    await prisma.submission.deleteMany({ where: { milestone: { courseId: existing.id } } });
    await prisma.course.delete({ where: { id: existing.id } });
  }
  const instructor = await prisma.user.upsert({
    where: { email: 'perf-instructor@perf.cpms.test' },
    update: { passwordHash },
    create: { email: 'perf-instructor@perf.cpms.test', displayName: 'Perf Instructor', role: 'INSTRUCTOR', passwordHash },
  });
  const course = await prisma.course.create({
    data: { code: 'PERF50', name: 'Performance course (NFR-10)', instructorId: instructor.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  const now = Date.now();
  const milestones = [];
  for (let i = 1; i <= 4; i++) {
    milestones.push(
      await prisma.milestone.create({ data: { courseId: course.id, title: `P${i}`, dueAt: new Date(now - (5 - i) * DAY), weight: 25, maxScore: 100 } }),
    );
  }
  for (let t = 1; t <= TEAMS; t++) {
    const students = [];
    for (let s = 1; s <= PER_TEAM; s++) {
      const email = `perf-t${t}-s${s}@perf.cpms.test`;
      students.push(
        await prisma.user.upsert({ where: { email }, update: {}, create: { email, displayName: `Perf T${t} S${s}`, role: 'STUDENT', passwordHash } }),
      );
    }
    await prisma.enrollment.createMany({ data: students.map((u) => ({ courseId: course.id, userId: u.id })) });
    const team = await prisma.team.create({
      data: {
        name: `Perf Team ${String(t).padStart(2, '0')}`,
        courseId: course.id,
        members: { create: students.map((u) => ({ userId: u.id, courseId: course.id })) },
      },
    });
    await prisma.proposal.create({
      data: { teamId: team.id, title: `Perf proposal ${t}`, description: 'Synthetic', status: 'APPROVED', decidedAt: new Date(), decidedById: instructor.id },
    });
    for (const m of milestones) {
      for (const version of [1, 2]) {
        const sub = await prisma.submission.create({
          data: {
            milestoneId: m.id,
            teamId: team.id,
            version,
            url: `https://example.com/perf/${t}/${m.id}/v${version}`,
            isLate: version === 2 && t % 5 === 0,
            submittedById: students[0].id,
          },
        });
        if (version === 2) {
          await prisma.grade.create({
            data: {
              submissionId: sub.id,
              score: 60 + ((t * 7 + m.id) % 40),
              feedback: 'Synthetic',
              gradedById: instructor.id,
              gradedAt: new Date(),
              releasedAt: t % 2 ? new Date() : null,
            },
          });
        }
      }
    }
  }
  const [counts] = await prisma.$queryRaw`SELECT
    (SELECT count(*) FROM "Team" WHERE "courseId" = ${course.id})::int AS teams,
    (SELECT count(*) FROM "Enrollment" WHERE "courseId" = ${course.id})::int AS students,
    (SELECT count(*) FROM "Submission" s JOIN "Milestone" m ON m.id = s."milestoneId" WHERE m."courseId" = ${course.id})::int AS submissions`;
  console.log(`PERF50 seeded in ${dbName}: course id ${course.id}`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
