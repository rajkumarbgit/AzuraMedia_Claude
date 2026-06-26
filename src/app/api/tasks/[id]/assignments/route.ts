import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, canExecuteTasks } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";
import { computeAutoScheduledStart } from "@/lib/scheduling";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const task = await prisma.task.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json();
  const { userId, shift, date, hoursBooked } = body;

  // Anyone with execution access (Ops/Lead/PM/CEO/Admin) can assign themselves to a task.
  // Assigning someone *else* still requires being the task's lead, a PM, or higher.
  const isSelfAssign = userId === user!.id && canExecuteTasks(user!.role);
  const allowedRoles = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"];
  if (!isSelfAssign && !allowedRoles.includes(user!.role) && task.leadId !== user!.id) {
    return NextResponse.json({ error: "Only the lead/PM can assign someone else to this task" }, { status: 403 });
  }
  if (!userId || !shift || !date || hoursBooked === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const onLeave = await prisma.leave.findUnique({
    where: { userId_date: { userId, date: new Date(date) } },
  });
  if (onLeave) {
    return NextResponse.json({ error: "This person is marked on leave for that date" }, { status: 409 });
  }

  // Auto-position this booking on the user's Live Job Timeline: right after their last booked
  // job that day, or at "now" if they have nothing booked yet (see computeAutoScheduledStart).
  const scheduledStart = await computeAutoScheduledStart(userId, new Date(date), shift);

  const assignment = await prisma.taskAssignment.create({
    data: { taskId: task.id, userId, shift, date: new Date(date), hoursBooked, scheduledStart },
    include: { user: { select: { name: true } } },
  });

  const updatedTask = await prisma.task.update({ where: { id: task.id }, data: { version: { increment: 1 } } });

  await addTimelineEvent({
    jobId: task.jobId,
    type: "OPS_ASSIGNED",
    description: `${assignment.user.name} booked on ${task.taskNo} for ${date} (${shift} shift, ${hoursBooked}h) by ${user!.name}`,
    version: task.job.version,
    actorId: user!.id,
  });

  return NextResponse.json({ assignment, taskVersion: updatedTask.version }, { status: 201 });
}
