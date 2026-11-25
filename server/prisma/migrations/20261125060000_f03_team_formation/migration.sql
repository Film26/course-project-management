-- F-03 Team formation (docs/sprints/sprint-2/F-03-teams.md §4). Safe on a database with existing teams:
-- every existing team gets a join code, every existing membership gets its course, and every existing
-- member is enrolled in the course, so nobody loses access.

-- T7: join codes are 8 characters from A-Z and 2-9 without O, I, 0, 1.
CREATE FUNCTION cpms_join_code() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 8)
$$;

-- BR-07: team size limits per course.
ALTER TABLE "Course" ADD COLUMN "maxTeamSize" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "minTeamSize" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Course" ADD CONSTRAINT "Course_team_size_range" CHECK (1 <= "minTeamSize" AND "minTeamSize" <= "maxTeamSize");

-- T7: the default fills a code for every existing row.
ALTER TABLE "Team" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "joinCode" TEXT NOT NULL DEFAULT cpms_join_code();

-- BR-06: TeamMember.courseId, back-filled from the team before it becomes NOT NULL.
ALTER TABLE "TeamMember" ADD COLUMN "courseId" INTEGER,
ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "TeamMember" tm SET "courseId" = t."courseId" FROM "Team" t WHERE t.id = tm."teamId";
ALTER TABLE "TeamMember" ALTER COLUMN "courseId" SET NOT NULL;

-- T1: enrollment, back-filled from the existing memberships.
CREATE TABLE "Enrollment" (
    "courseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("courseId","userId")
);
INSERT INTO "Enrollment" ("courseId", "userId") SELECT DISTINCT "courseId", "userId" FROM "TeamMember";

CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");
CREATE UNIQUE INDEX "TeamMember_courseId_userId_key" ON "TeamMember"("courseId", "userId");

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
