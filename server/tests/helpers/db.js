// Test helpers: wipe the test database and create users directly.
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/db.js';

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditEntry", "Grade", "Submission", "Enrollment", "Milestone", "Proposal", "TeamMember", "Team", "Course", "Session", "User" RESTART IDENTITY CASCADE',
  );
}

export async function createUser({ email, password = 'Test-Pass-123', role = 'STUDENT', displayName }) {
  return prisma.user.create({
    data: {
      email,
      role,
      displayName: displayName ?? email,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
}

export { prisma };
