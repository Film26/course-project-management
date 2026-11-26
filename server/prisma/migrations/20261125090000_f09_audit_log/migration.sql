-- F-09 Audit log (docs/sprints/sprint-3/F-09-audit.md §4).
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'TEAM_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'GRADE_RELEASED');

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "action" "AuditAction" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEntry_courseId_createdAt_idx" ON "AuditEntry"("courseId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- L2: entries are append-only. UPDATE is refused; rows disappear only when their course is deleted (cascade).
CREATE FUNCTION audit_entry_no_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditEntry rows are append-only';
END;
$$;
CREATE TRIGGER audit_entry_no_update BEFORE UPDATE ON "AuditEntry"
FOR EACH ROW EXECUTE FUNCTION audit_entry_no_update();
