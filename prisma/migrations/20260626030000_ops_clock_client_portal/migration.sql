-- AlterEnum: add CLIENT role
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'QUERY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TimeLogAction" AS ENUM ('START', 'HOLD', 'QUERY', 'RESUME', 'COMPLETE');

-- AlterTable: Client gets a short uniform code (used for job numbering) + a job sequence counter
ALTER TABLE "Client" ADD COLUMN "code" TEXT;
ALTER TABLE "Client" ADD COLUMN "jobSeq" INTEGER NOT NULL DEFAULT 0;

-- Backfill codes for any existing rows so the column can become NOT NULL/UNIQUE.
UPDATE "Client" SET "code" = 'NIM' WHERE "id" = 'seed-client-a' AND "code" IS NULL;
UPDATE "Client" SET "code" = 'SOL' WHERE "id" = 'seed-client-b' AND "code" IS NULL;
UPDATE "Client" SET "code" = UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 6)) WHERE "code" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- AlterTable: User gains an optional link to a Client (for role = CLIENT logins) + presence heartbeat
ALTER TABLE "User" ADD COLUMN "clientId" TEXT;
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: ApprovalRequest gains a cost-impact snapshot shown to the client reviewer
ALTER TABLE "ApprovalRequest" ADD COLUMN "costImpact" JSONB;

-- AlterTable: Mandate gains an optional cost added to the client budget
ALTER TABLE "Mandate" ADD COLUMN "addedCost" DECIMAL(14,2);

-- AlterTable: TaskAssignment becomes a live work clock per assigned person
ALTER TABLE "TaskAssignment" ADD COLUMN "workStatus" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "TaskAssignment" ADD COLUMN "actualMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TaskAssignment" ADD COLUMN "lastStartedAt" TIMESTAMP(3);
ALTER TABLE "TaskAssignment" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateTable: TimeLog (audit trail of Start/Hold/Query/Resume/Complete actions)
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" "TimeLogAction" NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BreakLog (per-day break entries, capped at 60 min/day in application code)
CREATE TABLE "BreakLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobComment (PM/Lead commentary on a job/task, e.g. after completion)
CREATE TABLE "JobComment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreakLog_userId_date_idx" ON "BreakLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BreakLog" ADD CONSTRAINT "BreakLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobComment" ADD CONSTRAINT "JobComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
