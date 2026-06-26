import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

// Non-manager users propose a job-level amendment (budget, % split, etc.) for PM approval.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json();
  const { comment, ...changes } = body;
  const allowed = ["title", "currency", "clientBudget", "productionSpendPercent", "pmComment", "estimatedHours"];
  const payload: any = {};
  for (const key of allowed) if (key in changes) payload[key] = changes[key];

  // A client (or anyone) can also submit a general, free-text amendment request with no
  // specific field changes — e.g. "please extend the deadline" — for PM/CEO to action manually.
  if (Object.keys(payload).length === 0 && !comment?.trim()) {
    return NextResponse.json({ error: "Describe the amendment you're requesting" }, { status: 400 });
  }

  if (isManager(user!.role)) {
    const updated = await prisma.job.update({ where: { id: job.id }, data: { ...payload, version: { increment: 1 } } });
    await addTimelineEvent({
      jobId: job.id,
      type: "JOB_AMENDED",
      description: `Job amended by ${user!.name}: ${Object.keys(payload).join(", ")}`,
      version: updated.version,
      actorId: user!.id,
      meta: payload,
    });
    return NextResponse.json({ job: updated, autoApproved: true });
  }

  const approval = await prisma.approvalRequest.create({
    data: { jobId: job.id, type: "JOB_AMEND", comment, payload, requestedById: user!.id },
  });

  await addTimelineEvent({
    jobId: job.id,
    type: "JOB_AMEND_REQUESTED",
    description: `${user!.name} requested job amendment: ${Object.keys(payload).join(", ")}${comment ? ` — "${comment}"` : ""}`,
    version: job.version,
    actorId: user!.id,
    meta: { approvalId: approval.id },
  });

  return NextResponse.json({ approval, autoApproved: false }, { status: 201 });
}
