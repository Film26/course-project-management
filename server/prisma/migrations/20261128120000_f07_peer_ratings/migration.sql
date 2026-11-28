-- F-07 Peer Evaluation (docs/sprints/sprint-3/F-07-peer-eval.md §4).
-- CreateTable
CREATE TABLE "PeerRating" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "raterId" INTEGER NOT NULL,
    "rateeId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeerRating_rateeId_idx" ON "PeerRating"("rateeId");

-- CreateIndex
CREATE UNIQUE INDEX "PeerRating_milestoneId_raterId_rateeId_key" ON "PeerRating"("milestoneId", "raterId", "rateeId");

-- AddForeignKey
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- E1 / BR-13: a score is 1–5 and nobody rates themselves, also when the application check is bypassed.
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_score_range" CHECK ("score" BETWEEN 1 AND 5);
ALTER TABLE "PeerRating" ADD CONSTRAINT "PeerRating_not_self" CHECK ("raterId" <> "rateeId");
