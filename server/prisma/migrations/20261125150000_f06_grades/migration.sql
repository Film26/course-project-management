-- F-06 Grading (docs/sprints/sprint-2/F-06-grading.md §4).
-- CreateTable
CREATE TABLE "Grade" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "gradedById" INTEGER NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_submissionId_key" ON "Grade"("submissionId");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- G1: a score is never negative (the upper bound, maxScore, lives in another table and is checked in the service).
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_score_nonnegative" CHECK ("score" >= 0);
