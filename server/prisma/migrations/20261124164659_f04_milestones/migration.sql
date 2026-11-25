-- CreateTable
CREATE TABLE "Milestone" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "weight" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_courseId_idx" ON "Milestone"("courseId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- F-04 M2: per-row ranges (Prisma does not model CHECK constraints and does not report them as drift).
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_weight_range" CHECK ("weight" BETWEEN 1 AND 100);
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_maxScore_range" CHECK ("maxScore" BETWEEN 1 AND 1000);
