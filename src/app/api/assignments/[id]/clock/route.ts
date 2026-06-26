import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { recomputeTaskStatus } from "@/lib/clock";
import { addTimelineEvent } from "@/lib/timeline";

type Action = "START" | "HOLD" | "QUERY" | "RESUME" | "COMPLETE";

// Start / Hold / Query / Resume / Complete a single assignment's personal work clock.
// Every action is appended to TimeLog (audit trail for the job roadmap) and rolls the
// parent Task's overall status up via recomputeTaskStatus.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { action, note } = body as { action: Action; note?: string };
  if (!["START", "HOLD", "QUERY", "RESUME", "COMPLETE"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: params.id },
    include: { task: { include: { job: true, lead: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const isOwner = assignment.userId === user!.id;
  const isLeadOfTask = assignment.task.leadId === user!.id;
  if (!isOwner && !isLeadOfTask && !isManager(user!.role)) {
    return NextResponse.json({ error: "You can only clock your own assignment" }, { status: 403 });
  }

  // Ops cannot start/resume a job's work while a cost-increasing mandate is still pending the
  // client's approval. PM/Lead/CEO may still assign work — they just can't have Ops clock in.
  if ((action === "START" || action === "RESUME") && user!.role === "OPS") {
    const pendingMandate = await prisma.approvalRequest.findFirst({
      where: { jobId: assignment.task.jobId, type: "MANDATE_ADD", status: "PENDING" },
    });
    if (pendingMandate) {
      return NextResponse.json(
        { error: "This job has a mandate pending client approval — Ops cannot start work until it's approved." },
        { status: 403 }
      );
    }
  }

  const now = new Date();
  const data: any = {};

  function elapsedMinutesSinceStart(): number {
    if (!assignment.lastStartedAt) return 0;
    return Math.max(0, Math.round((now.getTime() - new Date(assignment.lastStartedAt).getTime()) / 60000));
  }

  switch (action) {
    case "START":
    case "RESUME":
      data.workStatus = "IN_PROGRESS";
      data.lastStartedAt = now;
      break;
    case "HOLD":
    case "QUERY":
      data.actualMinutes = assignment.actualMinutes + elapsedMinutesSinceStart();
      data.workStatus = action === "HOLD" ? "ON_HOLD" : "QUERY";
      data.lastStartedAt = null;
      break;
    case "COMPLETE":
      data.actualMinutes = assignment.actualMinutes + elapsedMinutesSinceStart();
      data.workStatus = "COMPLETED";
      data.lastStartedAt = null;
      data.completedAt = now;
      break;
  }

  const updated = await prisma.taskAssignment.update({ where: { id: assignment.id }, data });

  await prisma.timeLog.create({
    data: { assignmentId: assignment.id, action, note, actorId: user!.id },
  });

  await recomputeTaskStatus(assignment.taskId);

  await addTimelineEvent({
    jobId: assignment.task.jobId,
    type: `WORK_${action}`,
    description: `${user!.name} ${action.toLowerCase()}ed work on "${assignment.task.name}"${note ? ` — "${note}"` : ""}`,
    version: assignment.task.job.version,
    actorId: user!.id,
    meta: { taskId: assignment.taskId, assignmentId: assignment.id, action },
  });

  return NextResponse.json(updated);
}
