import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isManager } from "@/lib/api-auth";
import { addTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const approval = await prisma.approvalRequest.findUnique({ where: { id: params.id }, include: { job: true } });
  if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  // Cost-increasing mandate requests are reviewed by the client who owns the job — not
  // internally — since the client bears the cost impact. An ONSITE_MANAGER tagged to this
  // client can decide on the client's behalf too. Everything else stays internal.
  if (approval.type === "MANDATE_ADD") {
    let authorized = user!.role === "CLIENT" && user!.clientId === approval.job.clientId;
    if (!authorized && user!.role === "ONSITE_MANAGER") {
      const tagged = await prisma.managedClient.findUnique({
        where: { userId_clientId: { userId: user!.id, clientId: approval.job.clientId } },
      });
      authorized = !!tagged;
    }
    if (!authorized) {
      return NextResponse.json(
        { error: "Only the client (or their tagged onsite manager) can approve a cost-increasing mandate request" },
        { status: 403 }
      );
    }
  } else if (!isManager(user!.role)) {
    return NextResponse.json({ error: "Only Project Managers can review approvals" }, { status: 403 });
  }

  const body = await req.json();
  const { decision, reviewComment } = body as { decision: "APPROVED" | "REJECTED"; reviewComment?: string };
  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: { status: decision, reviewedById: user!.id, reviewComment, reviewedAt: new Date() },
  });

  if (decision === "REJECTED") {
    await addTimelineEvent({
      jobId: approval.jobId,
      type: `${approval.type}_REJECTED`,
      description: `${user!.name} rejected request${reviewComment ? ` — "${reviewComment}"` : ""}`,
      version: approval.job.version,
      actorId: user!.id,
    });
    return NextResponse.json(updated);
  }

  // APPROVED: apply the change + bump job version.
  const payload = approval.payload as any;
  let job = approval.job;

  if (approval.type === "MANDATE_ADD") {
    const addedCost = Number(payload.addedCost ?? 0);
    await prisma.mandate.create({
      data: { jobId: job.id, name: payload.name, description: payload.description, addedCost: addedCost || null, status: "ACTIVE" },
    });
    if (addedCost) {
      await prisma.job.update({ where: { id: job.id }, data: { clientBudget: { increment: addedCost } } });
    }
  } else if (approval.type === "MANDATE_REDUCE") {
    await prisma.mandate.update({ where: { id: payload.mandateId }, data: { status: "REMOVED" } });
  } else if (approval.type === "JOB_AMEND") {
    await prisma.job.update({ where: { id: job.id }, data: payload });
  }

  job = await prisma.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });

  await addTimelineEvent({
    jobId: job.id,
    type: `${approval.type}_APPROVED`,
    description: `${user!.name} approved request${reviewComment ? ` — "${reviewComment}"` : ""} (v${job.version})`,
    version: job.version,
    actorId: user!.id,
  });

  return NextResponse.json(updated);
}
