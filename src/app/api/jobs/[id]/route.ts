import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireUser();
  if (error) return error;

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true } },
      mandates: { orderBy: { createdAt: "asc" } },
      approvals: {
        include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      timelineEvents: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        include: {
          lead: { select: { id: true, name: true, role: true, lastSeenAt: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, role: true, lastSeenAt: true } },
              timeLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
            },
            orderBy: { date: "asc" },
          },
          comments: {
            include: { author: { select: { name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
          eodComments: {
            include: { user: { select: { name: true, role: true } } },
            orderBy: { date: "asc" },
          },
        },
      },
      comments: {
        where: { taskId: null },
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

// Direct amend by a manager (PM/CEO/ADMIN) - applies immediately, bumps version, logs timeline.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!isManager(user!.role)) {
    return NextResponse.json({ error: "Only Project Managers can amend a job directly" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["title", "currency", "clientBudget", "productionSpendPercent", "pmComment", "status", "estimatedHours"];
  const data: any = {};
  for (const key of allowed) if (key in body) data[key] = body[key];

  const job = await prisma.job.update({
    where: { id: params.id },
    data: { ...data, version: { increment: 1 } },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "JOB_AMENDED",
    description: `Job amended by ${user!.name}: ${Object.keys(data).join(", ")}`,
    version: job.version,
    actorId: user!.id,
    meta: data,
  });

  return NextResponse.json(job);
}
