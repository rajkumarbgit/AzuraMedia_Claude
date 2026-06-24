import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const jobId = searchParams.get("jobId");

  const tasks = await prisma.task.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(q
        ? {
            OR: [
              { taskNo: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { job: { jobNo: { contains: q, mode: "insensitive" } } },
              { lead: { name: { contains: q, mode: "insensitive" } } },
              { assignments: { some: { user: { name: { contains: q, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    },
    include: {
      job: { select: { id: true, jobNo: true, title: true } },
      lead: { select: { id: true, name: true } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!isManager(user!.role) && user!.role !== "PRODUCTION_LEAD") {
    return NextResponse.json({ error: "Only PM/Lead can create tasks" }, { status: 403 });
  }

  const body = await req.json();
  const { jobId, name, description, leadId, estimatedHours, startDate, endDate } = body;
  if (!jobId || !name || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const existingCount = await prisma.task.count({ where: { jobId } });
  const taskNo = `${job.jobNo}-T${existingCount + 1}`;

  const task = await prisma.task.create({
    data: {
      jobId,
      taskNo,
      name,
      description,
      leadId: leadId || null,
      estimatedHours: estimatedHours ?? 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    include: { lead: { select: { name: true } } },
  });

  await addTimelineEvent({
    jobId,
    type: "TASK_CREATED",
    description: `Task ${task.taskNo} "${task.name}" created by ${user!.name}${task.lead ? ` (lead: ${task.lead.name})` : ""}`,
    version: job.version,
    actorId: user!.id,
  });

  return NextResponse.json(task, { status: 201 });
}
