import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";

// Drag-and-drop support for the Live Job Timeline (Gantt): move a job box to a new time
// (scheduledStart) and/or a new person (userId) for the same day.
// - Anyone who owns the assignment, leads the task, or is a manager can reschedule its time.
// - Reassigning to a *different* user is a managerial action (PM/Lead/CEO/Admin only) —
//   ops shouldn't be able to hand their own work off to someone else by dragging.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { scheduledStart, userId } = body as { scheduledStart?: string | null; userId?: string };

  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: params.id },
    include: { task: { select: { leadId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const isOwner = assignment.userId === user!.id;
  const isLeadOfTask = assignment.task.leadId === user!.id;
  const canTouch = isOwner || isLeadOfTask || isManager(user!.role) || user!.role === "PRODUCTION_LEAD";
  if (!canTouch) {
    return NextResponse.json({ error: "You can only move your own assignment" }, { status: 403 });
  }

  if (userId && userId !== assignment.userId) {
    const canReassign = isManager(user!.role) || user!.role === "PRODUCTION_LEAD";
    if (!canReassign) {
      return NextResponse.json({ error: "Only PM/Lead/CEO/Admin can reassign a job to another person" }, { status: 403 });
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!target || !target.isActive) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const data: any = {};
  if (scheduledStart !== undefined) data.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
  if (userId && userId !== assignment.userId) data.userId = userId;

  const updated = await prisma.taskAssignment.update({
    where: { id: assignment.id },
    data,
    include: { user: { select: { id: true, name: true, role: true, lastSeenAt: true } } },
  });

  return NextResponse.json(updated);
}
