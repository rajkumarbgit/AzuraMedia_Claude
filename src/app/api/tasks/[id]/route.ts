import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const task = await prisma.task.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerLead = task.leadId === user!.id;
  const allowedRoles = ["CEO", "ADMIN", "PROJECT_MANAGER", "PRODUCTION_LEAD"];
  if (!allowedRoles.includes(user!.role) && !isOwnerLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["name", "description", "leadId", "status", "estimatedHours", "startDate", "endDate"];
  const data: any = {};
  for (const key of allowed) if (key in body) data[key] = body[key];
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate) data.endDate = new Date(data.endDate);

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { ...data, version: { increment: 1 } },
  });

  await addTimelineEvent({
    jobId: task.jobId,
    type: "TASK_AMENDED",
    description: `Task ${task.taskNo} amended by ${user!.name} (task v${updated.version}): ${Object.keys(data).join(", ")}`,
    version: task.job.version,
    actorId: user!.id,
    meta: data,
  });

  return NextResponse.json(updated);
}
