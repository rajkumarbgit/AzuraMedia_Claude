import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

// Reduce/remove a mandate: direct if manager, otherwise a PM-approval request.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const { comment } = body;

  const mandate = await prisma.mandate.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!mandate) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });

  if (isManager(user!.role)) {
    const updatedMandate = await prisma.mandate.update({
      where: { id: mandate.id },
      data: { status: "REMOVED", version: { increment: 1 } },
    });
    const job = await prisma.job.update({ where: { id: mandate.jobId }, data: { version: { increment: 1 } } });
    await addTimelineEvent({
      jobId: job.id,
      type: "MANDATE_REMOVED",
      description: `Mandate "${mandate.name}" removed by ${user!.name}`,
      version: job.version,
      actorId: user!.id,
    });
    return NextResponse.json({ mandate: updatedMandate, autoApproved: true });
  }

  const approval = await prisma.approvalRequest.create({
    data: {
      jobId: mandate.jobId,
      type: "MANDATE_REDUCE",
      comment,
      payload: { mandateId: mandate.id, name: mandate.name },
      requestedById: user!.id,
    },
  });

  await addTimelineEvent({
    jobId: mandate.jobId,
    type: "MANDATE_REDUCE_REQUESTED",
    description: `${user!.name} requested to remove mandate "${mandate.name}"${comment ? ` — "${comment}"` : ""}`,
    version: mandate.job.version,
    actorId: user!.id,
    meta: { approvalId: approval.id },
  });

  return NextResponse.json({ approval, autoApproved: false }, { status: 201 });
}
