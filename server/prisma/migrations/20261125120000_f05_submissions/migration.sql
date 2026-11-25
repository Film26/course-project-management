-- F-05 Deliverable submission (docs/sprints/sprint-2/F-05-submissions.md §4).
-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "isLate" BOOLEAN NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_teamId_idx" ON "Submission"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_milestoneId_teamId_version_key" ON "Submission"("milestoneId", "teamId", "version");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- S4: versions start at 1.
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_version_positive" CHECK ("version" >= 1);
