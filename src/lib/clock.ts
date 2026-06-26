import { prisma } from "@/lib/prisma";

// Per-day break cap, in minutes (request: "max 1 hr per day").
export const BREAK_CAP_MINUTES = 60;

// A user is considered "online" if their last heartbeat ping was within this window.
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
// Between ONLINE and AWAY thresholds the user is "away" (tab open but idle / stale ping).
// Beyond AWAY_THRESHOLD_MS (or no heartbeat at all) they're "offline".
export const AWAY_THRESHOLD_MS = 10 * 60 * 1000;

export function isOnline(lastSeenAt: Date | string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  return Date.now() - t < ONLINE_THRESHOLD_MS;
}

export type PresenceStatus = "online" | "away" | "offline" | "leave";

// Four-state presence: green (online) / yellow (away) / red (offline) / red-with-slash (on
// leave / out of office — takes priority over the heartbeat-derived state).
export function presenceStatus(lastSeenAt: Date | string | null | undefined, onLeave = false): PresenceStatus {
  if (onLeave) return "leave";
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (elapsed < ONLINE_THRESHOLD_MS) return "online";
  if (elapsed < AWAY_THRESHOLD_MS) return "away";
  return "offline";
}

// Roll a task's overall status up from its individual assignment work-clocks.
export async function recomputeTaskStatus(taskId: string) {
  const assignments = await prisma.taskAssignment.findMany({
    where: { taskId },
    select: { workStatus: true },
  });

  let status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" = "NOT_STARTED";
  if (assignments.length > 0) {
    if (assignments.every((a) => a.workStatus === "COMPLETED")) {
      status = "COMPLETED";
    } else if (assignments.some((a) => a.workStatus === "IN_PROGRESS")) {
      status = "IN_PROGRESS";
    } else if (assignments.some((a) => a.workStatus === "ON_HOLD" || a.workStatus === "QUERY")) {
      status = "BLOCKED";
    } else {
      status = "NOT_STARTED";
    }
  }

  return prisma.task.update({ where: { id: taskId }, data: { status } });
}
