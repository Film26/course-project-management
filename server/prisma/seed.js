// Reproducible synthetic seed data. Safe to run repeatedly (upserts).
// Password for every seeded account comes from SEED_PASSWORD in server/.env (or .env.e2e when NODE_ENV=e2e) — never a real password.
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { envFileFor } from '../src/envFile.js';
import { seedMilestones } from './seedMilestones.js';
dotenv.config({ path: envFileFor(process.env.NODE_ENV), override: true, quiet: true });

const prisma = new PrismaClient();

const password = process.env.SEED_PASSWORD;
if (!password) {
  console.error('SEED_PASSWORD is not set (see server/.env.example)');
  process.exit(1);
}

const users = [
  { email: 'instructor1@cpms.test', displayName: 'Instructor One', role: 'INSTRUCTOR' },
  { email: 'student1@cpms.test', displayName: 'Student One', role: 'STUDENT' },
  { email: 'student2@cpms.test', displayName: 'Student Two', role: 'STUDENT' },
  { email: 'student3@cpms.test', displayName: 'Student Three', role: 'STUDENT' },
  // F-03: student4 completes Team Beta (minTeamSize 2, BR-07); student5 and student6 are enrolled without a team.
  { email: 'student4@cpms.test', displayName: 'Student Four', role: 'STUDENT' },
  { email: 'student5@cpms.test', displayName: 'Student Five', role: 'STUDENT' },
  { email: 'student6@cpms.test', displayName: 'Student Six', role: 'STUDENT' },
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const byEmail = {};
  const createdNow = new Set(); // users that did not exist before this run
  for (const u of users) {
    if (!(await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } }))) createdNow.add(u.email);
    byEmail[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.displayName, role: u.role, passwordHash },
      create: { ...u, passwordHash },
    });
  }

  const course = await prisma.course.upsert({
    where: { code: 'CPE334' },
    update: {},
    create: {
      code: 'CPE334',
      name: 'Software Engineering',
      instructorId: byEmail['instructor1@cpms.test'].id,
      proposalDeadline: new Date('2026-12-31T16:59:59Z'), // 23:59:59 Asia/Bangkok
    },
  });

  // F-03 T1: every seeded student is enrolled in CPE334 (enrollments are never removed by the app).
  for (const u of users.filter((x) => x.role === 'STUDENT')) {
    await prisma.enrollment.upsert({
      where: { courseId_userId: { courseId: course.id, userId: byEmail[u.email].id } },
      update: {},
      create: { courseId: course.id, userId: byEmail[u.email].id },
    });
  }

  // Fixed join codes so tests and UAT can use them (F-03 contract §4).
  const teams = [
    { name: 'Team Alpha', joinCode: 'ALPHA234', members: ['student1@cpms.test', 'student2@cpms.test'] },
    { name: 'Team Beta', joinCode: 'BETA2345', members: ['student3@cpms.test', 'student4@cpms.test'] },
  ];
  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { courseId_name: { courseId: course.id, name: t.name } },
      update: { joinCode: t.joinCode },
      create: { name: t.name, joinCode: t.joinCode, courseId: course.id },
    });
    // The seed runs on every deploy. Students can now leave and join teams (F-03), so a membership is seeded only
    // for a student created in this run who has no team in the course yet. A student who later leaves a team is
    // never put back by the next deploy (same idea as the F-04 milestone seed, PR #48 review).
    for (const email of t.members) {
      const userId = byEmail[email].id;
      if (!createdNow.has(email)) continue;
      const inTeam = await prisma.teamMember.findUnique({ where: { courseId_userId: { courseId: course.id, userId } } });
      if (!inTeam) await prisma.teamMember.create({ data: { teamId: team.id, userId, courseId: course.id } });
    }
  }

  // F-04: seed milestones (rule for re-runs in seedMilestones.js, TEST-04-13).
  const createdMilestones = await seedMilestones(prisma, course.id);

  console.log(`Seeded ${users.length} users, course ${course.code}, ${teams.length} teams, ${createdMilestones} new milestones.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
