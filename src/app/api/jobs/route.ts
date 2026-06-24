import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const minBudget = searchParams.get("minBudget");
  const maxBudget = searchParams.get("maxBudget");

  const jobs = await prisma.job.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(minBudget || maxBudget
        ? {
            clientBudget: {
              ...(minBudget ? { gte: parseFloat(minBudget) } : {}),
              ...(maxBudget ? { lte: parseFloat(maxBudget) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { jobNo: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
              { createdBy: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true } },
      mandates: true,
      _count: { select: { tasks: true, approvals: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!isManager(user!.role)) {
    return NextResponse.json({ error: "Only Project Managers can create jobs" }, { status: 403 });
  }

  const body = await req.json();
  const { jobNo, title, clientId, currency, clientBudget, productionSpendPercent, pmComment, estimatedHours, mandates } = body;

  if (!jobNo || !title || !clientId || !clientBudget || productionSpendPercent === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.job.findUnique({ where: { jobNo } });
  if (existing) return NextResponse.json({ error: "Job No already exists" }, { status: 409 });

  const job = await prisma.job.create({
    data: {
      jobNo,
      title,
      clientId,
      currency: currency ?? "USD",
      clientBudget,
      productionSpendPercent,
      pmComment,
      estimatedHours: estimatedHours ?? null,
      status: "IN_PROGRESS",
      createdById: user!.id,
      mandates: {
        create: (mandates ?? []).filter((m: string) => m.trim()).map((name: string) => ({ name: name.trim() })),
      },
    },
    include: { mandates: true, client: true },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "JOB_CREATED",
    description: `Job ${job.jobNo} created by ${user!.name}`,
    version: job.version,
    actorId: user!.id,
  });

  return NextResponse.json(job, { status: 201 });
}
