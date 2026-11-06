// Reproducible synthetic seed data. Safe to run repeatedly (upserts).
// Password for every seeded account comes from SEED_PASSWORD in server/.env — never a real password.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

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
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const byEmail = {};
  for (const u of users) {
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

  const teams = [
    { name: 'Team Alpha', members: ['student1@cpms.test', 'student2@cpms.test'] },
    { name: 'Team Beta', members: ['student3@cpms.test'] },
  ];
  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { courseId_name: { courseId: course.id, name: t.name } },
      update: {},
      create: { name: t.name, courseId: course.id },
    });
    for (const email of t.members) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: byEmail[email].id } },
        update: {},
        create: { teamId: team.id, userId: byEmail[email].id },
      });
    }
  }

  console.log(`Seeded ${users.length} users, course ${course.code}, ${teams.length} teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
