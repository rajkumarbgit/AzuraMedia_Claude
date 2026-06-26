-- AlterTable: TaskAssignment gains an optional explicit start time used to position the
-- job box on the hour-column Live Job Timeline (Gantt) and to support drag-to-reschedule.
-- Null means "not yet positioned" — the UI falls back to the assignment's shift start time.
ALTER TABLE "TaskAssignment" ADD COLUMN "scheduledStart" TIMESTAMP(3);
